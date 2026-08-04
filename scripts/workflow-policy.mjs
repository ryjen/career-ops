import fs from 'node:fs';
import path from 'node:path';
import { parseWorkflowYaml } from './workflow-yaml.mjs';
export { parseWorkflowYaml } from './workflow-yaml.mjs';

const EXTERNAL_USE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.\/-]+)?@[0-9a-f]{40}$/;
const DOCKER_USE = /^docker:\/\/[^\s@]+@sha256:[0-9a-f]{64}$/;
const HOSTED_RUNNERS = new Set([
  'ubuntu-latest', 'ubuntu-24.04', 'ubuntu-22.04',
  'macos-latest', 'macos-15', 'macos-14',
  'windows-latest', 'windows-2025', 'windows-2022',
]);
const LIFECYCLE_SCRIPTS = new Set([
  'preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly',
]);
const DANGEROUS_RUN_CONTEXT = /\$\{\{[^}]*github\.event\.(?:issue|discussion|comment|review|pull_request)\.(?:body|title)[^}]*\}\}/i;
const RELEASE_COMMAND = /(?:^|\s)(?:npm\s+publish|pnpm\s+publish|yarn\s+npm\s+publish|gh\s+release|docker\s+push)(?:\s|$)/m;
const AUTO_MERGE_COMMAND = /(?:gh\s+pr\s+merge|enablePullRequestAutoMerge)/i;
const DEPENDENCY_REVIEW_USE = 'actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294';
const DEPENDENCY_FALLBACK_RUN = /\bnode\s+scripts\/dependency-diff\.mjs\s+--base\s+["']origin\/\$\{BASE_REF\}["']/;
const DEPENDENCY_FALLBACK_IF = /steps\.dependency-review\.outcome\s*==\s*["']failure["']/;

function eventNames(on) {
  if (typeof on === 'string') return [on];
  if (Array.isArray(on)) return on.map(String);
  if (on && typeof on === 'object') return Object.keys(on);
  return [];
}

function permissionErrors(permissions, label) {
  const errors = [];
  if (permissions === undefined) return [`${label}: explicit permissions are required`];
  if (permissions === 'read-all' || permissions === 'none') return errors;
  if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
    return [`${label}: permissions must be a mapping, read-all, or none`];
  }
  for (const [scope, value] of Object.entries(permissions)) {
    if (!['read', 'none'].includes(value)) errors.push(`${label}: ${scope} permission must be read or none, received ${value}`);
  }
  return errors;
}

function collectValues(value, key, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectValues(item, key, output);
  } else if (value && typeof value === 'object') {
    for (const [name, child] of Object.entries(value)) {
      if (name === key) output.push(child);
      collectValues(child, key, output);
    }
  }
  return output;
}

function containsSecretReference(value) {
  if (typeof value === 'string') return /\$\{\{[^}]*secrets\./i.test(value);
  if (Array.isArray(value)) return value.some(containsSecretReference);
  if (value && typeof value === 'object') return Object.values(value).some(containsSecretReference);
  return false;
}

function usesErrors(workflow, filename, root) {
  const errors = [];
  for (const value of collectValues(workflow, 'uses')) {
    if (typeof value !== 'string') {
      errors.push(`${filename}: uses must be a string`);
      continue;
    }
    if (value.startsWith('./')) {
      const normalized = path.posix.normalize(value);
      if (!/^\.\/[A-Za-z0-9_.\/-]+$/.test(value) || normalized.startsWith('../') || value.split('/').includes('..')) {
        errors.push(`${filename}: local actions must use a canonical in-repository ./ path: ${value}`);
      } else if (root && !fs.existsSync(path.join(root, normalized))) {
        errors.push(`${filename}: local action or reusable workflow does not exist: ${value}`);
      }
      continue;
    }
    if (value.startsWith('docker://')) {
      if (!DOCKER_USE.test(value)) errors.push(`${filename}: Docker action must use an immutable sha256 digest: ${value}`);
    } else if (!EXTERNAL_USE.test(value)) {
      errors.push(`${filename}: external action or reusable workflow must use a full 40-character commit SHA: ${value}`);
    }
  }
  return errors;
}

function continueOnErrorErrors(job, label) {
  const errors = [];
  const steps = Array.isArray(job.steps) ? job.steps : [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (!step || typeof step !== 'object' || Array.isArray(step)) continue;
    const setting = step['continue-on-error'];
    if (setting === undefined || setting === false) continue;
    if (setting !== true) {
      errors.push(`${label}: continue-on-error must be false or the approved dependency-review fallback exception`);
      continue;
    }
    const approved = step.id === 'dependency-review' && step.uses === DEPENDENCY_REVIEW_USE;
    if (!approved) {
      errors.push(`${label}: continue-on-error is allowed only for the pinned official dependency-review action`);
      continue;
    }
    const fallback = steps.slice(index + 1).find((candidate) => (
      candidate
      && typeof candidate === 'object'
      && !Array.isArray(candidate)
      && typeof candidate.if === 'string'
      && DEPENDENCY_FALLBACK_IF.test(candidate.if)
      && typeof candidate.run === 'string'
      && DEPENDENCY_FALLBACK_RUN.test(candidate.run)
    ));
    if (!fallback) {
      errors.push(`${label}: dependency-review continue-on-error requires the fail-closed dependency-diff fallback`);
      continue;
    }
    if (fallback.env?.BASE_REF !== '${{ github.base_ref }}') {
      errors.push(`${label}: dependency fallback BASE_REF must come only from github.base_ref`);
    }
    const checkout = [...steps.slice(0, index)].reverse().find((candidate) => (
      candidate
      && typeof candidate === 'object'
      && typeof candidate.uses === 'string'
      && candidate.uses.startsWith('actions/checkout@')
    ));
    if (checkout?.with?.['fetch-depth'] !== 0) {
      errors.push(`${label}: dependency fallback requires checkout fetch-depth: 0`);
    }
  }
  return errors;
}

function releaseErrors(workflow, events, filename) {
  const commands = collectValues(workflow, 'run').filter((value) => typeof value === 'string');
  if (!commands.some((command) => RELEASE_COMMAND.test(command))) return [];
  const errors = [];
  const push = workflow.on && typeof workflow.on === 'object' && !Array.isArray(workflow.on) ? workflow.on.push : undefined;
  const tags = push && typeof push === 'object' ? push.tags : undefined;
  if (!tags || (Array.isArray(tags) && tags.length === 0)) errors.push(`${filename}: release workflow must be restricted to push tags`);
  if (events.includes('pull_request') || events.includes('pull_request_target')) errors.push(`${filename}: release workflow cannot run for pull requests`);
  for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
    if (collectValues(job, 'run').some((command) => typeof command === 'string' && RELEASE_COMMAND.test(command))) {
      if (typeof job.if !== 'string' || !job.if.includes('refs/tags/')) errors.push(`${filename}: release job ${jobName} requires an explicit refs/tags/ guard`);
    }
  }
  return errors;
}

export function validateWorkflow(workflow, filename = '<workflow>', options = {}) {
  const errors = [];
  const events = eventNames(workflow.on);
  const pullRequest = events.includes('pull_request') || events.includes('pull_request_target');
  if (events.length === 0) errors.push(`${filename}: workflow must define an event under on`);
  if (!workflow.concurrency || typeof workflow.concurrency !== 'object' || Array.isArray(workflow.concurrency)) {
    errors.push(`${filename}: workflow concurrency mapping is required`);
  } else {
    if (typeof workflow.concurrency.group !== 'string' || !workflow.concurrency.group.trim()) errors.push(`${filename}: concurrency group is required`);
    if (workflow.concurrency['cancel-in-progress'] !== true) errors.push(`${filename}: concurrency cancel-in-progress must be true`);
  }
  if (events.includes('pull_request_target')) errors.push(`${filename}: pull_request_target is prohibited`);
  errors.push(...permissionErrors(workflow.permissions, `${filename}: workflow`));
  if (!workflow.jobs || typeof workflow.jobs !== 'object' || Array.isArray(workflow.jobs) || Object.keys(workflow.jobs).length === 0) {
    errors.push(`${filename}: jobs must be a non-empty mapping`);
    return errors;
  }
  if (pullRequest && containsSecretReference(workflow)) errors.push(`${filename}: pull-request workflows cannot reference secrets`);

  for (const [jobName, job] of Object.entries(workflow.jobs)) {
    const label = `${filename}: job ${jobName}`;
    if (!job || typeof job !== 'object' || Array.isArray(job)) {
      errors.push(`${label} must be a mapping`);
      continue;
    }
    if (job.uses) {
      if (job['runs-on'] !== undefined) errors.push(`${label}: reusable-workflow jobs cannot also declare runs-on`);
    } else {
      if (!Number.isInteger(job['timeout-minutes']) || job['timeout-minutes'] < 1 || job['timeout-minutes'] > 60) {
        errors.push(`${label}: timeout-minutes must be an integer from 1 to 60`);
      }
      if (typeof job['runs-on'] !== 'string' || !HOSTED_RUNNERS.has(job['runs-on'])) {
        errors.push(`${label}: runs-on must be an approved fixed GitHub-hosted runner`);
      }
    }
    if (job.permissions !== undefined) errors.push(...permissionErrors(job.permissions, label));
    if (pullRequest && job.environment !== undefined) errors.push(`${label}: pull-request jobs cannot use environments`);
    if (job.container?.image && !DOCKER_USE.test(`docker://${job.container.image}`)) {
      errors.push(`${label}: container images must use an immutable sha256 digest`);
    }
    if (job.steps !== undefined && !Array.isArray(job.steps)) errors.push(`${label}: steps must be a sequence`);
    for (const step of Array.isArray(job.steps) ? job.steps : []) {
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        errors.push(`${label}: every step must be a mapping`);
        continue;
      }
      if (typeof step.uses === 'string' && step.uses.startsWith('actions/checkout@')) {
        if (step.with?.repository !== undefined) errors.push(`${label}: checkout cannot select another repository`);
        if (step.with?.['persist-credentials'] !== false) errors.push(`${label}: checkout must set persist-credentials: false`);
      }
    }
    errors.push(...continueOnErrorErrors(job, label));
    for (const run of collectValues(job, 'run')) {
      if (typeof run === 'string' && DANGEROUS_RUN_CONTEXT.test(run)) {
        errors.push(`${label}: source-controlled text cannot be interpolated into shell commands`);
      }
      if (typeof run === 'string' && AUTO_MERGE_COMMAND.test(run)) errors.push(`${label}: workflow-driven pull-request auto-merge is prohibited`);
    }
  }

  errors.push(...usesErrors(workflow, filename, options.root));
  errors.push(...releaseErrors(workflow, events, filename));
  return errors;
}

export function validatePackageScripts(packageJson, filename = 'package.json') {
  const errors = [];
  for (const name of Object.keys(packageJson.scripts || {})) {
    if (LIFECYCLE_SCRIPTS.has(name)) errors.push(`${filename}: lifecycle script ${name} is prohibited`);
  }
  return errors;
}

export function validateDependabotConfig(config, filename = '.github/dependabot.yml') {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [`${filename}: root must be a mapping`];
  if (config.version !== 2) errors.push(`${filename}: version must equal 2`);
  if (!Array.isArray(config.updates)) return [...errors, `${filename}: updates must be a sequence`];
  const required = new Set(['github-actions', 'npm']);
  for (const [index, update] of config.updates.entries()) {
    const label = `${filename}: updates[${index}]`;
    if (!update || typeof update !== 'object' || Array.isArray(update)) {
      errors.push(`${label} must be a mapping`);
      continue;
    }
    required.delete(update['package-ecosystem']);
    if (update.directory !== '/') errors.push(`${label}: directory must equal /`);
    if (update.schedule?.interval !== 'weekly') errors.push(`${label}: schedule interval must be weekly`);
    if (!update.groups || typeof update.groups !== 'object' || Array.isArray(update.groups) || Object.keys(update.groups).length === 0) {
      errors.push(`${label}: human-reviewed update grouping is required`);
    }
    if (!Number.isInteger(update['open-pull-requests-limit']) || update['open-pull-requests-limit'] < 1 || update['open-pull-requests-limit'] > 10) {
      errors.push(`${label}: open-pull-requests-limit must be an integer from 1 to 10`);
    }
  }
  for (const ecosystem of [...required].sort()) errors.push(`${filename}: missing ${ecosystem} update policy`);
  return errors;
}

export function validateRepository(root = process.cwd()) {
  const errors = [];
  const workflowDirectory = path.join(root, '.github', 'workflows');
  const files = fs.existsSync(workflowDirectory)
    ? fs.readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name)).sort()
    : [];
  if (files.length === 0) errors.push('repository must contain at least one workflow');
  for (const name of files) {
    const filename = path.join('.github', 'workflows', name).split(path.sep).join('/');
    try {
      const workflow = parseWorkflowYaml(fs.readFileSync(path.join(workflowDirectory, name), 'utf8'), filename);
      errors.push(...validateWorkflow(workflow, filename, { root }));
    } catch (error) {
      errors.push(error.message);
    }
  }
  const packagePath = path.join(root, 'package.json');
  if (fs.existsSync(packagePath)) {
    errors.push(...validatePackageScripts(JSON.parse(fs.readFileSync(packagePath, 'utf8'))));
  }
  const dependabotPath = path.join(root, '.github', 'dependabot.yml');
  if (!fs.existsSync(dependabotPath)) {
    errors.push('repository must contain .github/dependabot.yml');
  } else {
    try {
      const config = parseWorkflowYaml(fs.readFileSync(dependabotPath, 'utf8'), '.github/dependabot.yml');
      errors.push(...validateDependabotConfig(config));
    } catch (error) {
      errors.push(error.message);
    }
  }
  return errors;
}

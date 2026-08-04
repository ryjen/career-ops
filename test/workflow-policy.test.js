import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseWorkflowYaml,
  validateDependabotConfig,
  validatePackageScripts,
  validateWorkflow,
} from '../scripts/workflow-policy.mjs';

const pinned = '0123456789abcdef0123456789abcdef01234567';
const concurrencyExpression = '${{ github.ref }}';
const safe = `
name: CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: ci-${concurrencyExpression}
  cancel-in-progress: true
jobs:
  quality:
    runs-on: ubuntu-24.04
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@${pinned}
        with:
          persist-credentials: false
      - run: npm test
`;

function errors(source) {
  return validateWorkflow(parseWorkflowYaml(source, 'fixture.yml'), 'fixture.yml');
}

test('parses and accepts a fixed hosted read-only workflow', () => {
  assert.deepEqual(errors(safe), []);
});

test('rejects persistent or dynamic runners', () => {
  const label = ['runs-on', ': self-hosted'].join('');
  assert.match(errors(safe.replace('runs-on: ubuntu-24.04', label)).join('\n'), /approved fixed GitHub-hosted runner/);
  assert.match(errors(safe.replace('ubuntu-24.04', "${{ matrix.runner }}")).join('\n'), /approved fixed GitHub-hosted runner/);
});

test('rejects mutable external actions and containers', () => {
  assert.match(errors(safe.replace(`actions/checkout@${pinned}`, 'actions/checkout@v7')).join('\n'), /full 40-character commit SHA/);
  const container = safe.replace('timeout-minutes: 15', 'timeout-minutes: 15\n    container:\n      image: node:20');
  assert.match(errors(container).join('\n'), /immutable sha256 digest/);
});

test('rejects missing timeouts and broad permissions', () => {
  assert.match(errors(safe.replace('    timeout-minutes: 15\n', '')).join('\n'), /timeout-minutes/);
  assert.match(errors(safe.replace('contents: read', 'contents: write')).join('\n'), /permission must be read or none/);
});

test('rejects pull_request_target, secrets, and environments', () => {
  assert.match(errors(safe.replace('pull_request:', 'pull_request_target:')).join('\n'), /pull_request_target is prohibited/);
  const secret = safe.replace('npm test', 'echo ${{ secrets.TOKEN }}');
  assert.match(errors(secret).join('\n'), /cannot reference secrets/);
  const environment = safe.replace('timeout-minutes: 15', 'timeout-minutes: 15\n    environment: production');
  assert.match(errors(environment).join('\n'), /cannot use environments/);
});

test('rejects source text interpolation into shell commands', () => {
  const unsafe = safe.replace('npm test', 'echo "${{ github.event.pull_request.body }}"');
  assert.match(errors(unsafe).join('\n'), /cannot be interpolated into shell commands/);
});

test('requires release tag triggers and job guards', () => {
  const release = safe.replace('npm test', 'npm publish --provenance');
  const result = errors(release).join('\n');
  assert.match(result, /restricted to push tags/);
  assert.match(result, /cannot run for pull requests/);
  assert.match(result, /refs\/tags\/ guard/);
});

test('requires cancellation concurrency and safe checkout boundaries', () => {
  assert.match(errors(safe.replace(/concurrency:[\s\S]*?jobs:/, 'jobs:')).join('\n'), /workflow concurrency mapping is required/);
  assert.match(errors(safe.replace('cancel-in-progress: true', 'cancel-in-progress: false')).join('\n'), /cancel-in-progress must be true/);
  assert.match(errors(safe.replace('persist-credentials: false', 'persist-credentials: true')).join('\n'), /persist-credentials: false/);
  const alternate = safe.replace('persist-credentials: false', 'persist-credentials: false\n          repository: another/repository');
  assert.match(errors(alternate).join('\n'), /cannot select another repository/);
});

test('rejects YAML aliases, merge keys, and local action traversal', () => {
  assert.throws(() => parseWorkflowYaml('name: CI\ndefaults: &shared\n  run: {}\n', 'anchor.yml'), /anchors, aliases, and tags/);
  assert.throws(() => parseWorkflowYaml('name: CI\n<<: shared\n', 'merge.yml'), /merge keys/);
  const local = safe.replace(`actions/checkout@${pinned}`, './../outside/action');
  assert.match(errors(local).join('\n'), /canonical in-repository/);
  const normalizedTraversal = safe.replace(`actions/checkout@${pinned}`, './actions/../outside');
  assert.match(errors(normalizedTraversal).join('\n'), /canonical in-repository/);
});

test('rejects workflow-driven pull-request auto-merge', () => {
  const autoMerge = safe.replace('npm test', 'gh pr merge --auto');
  assert.match(errors(autoMerge).join('\n'), /auto-merge is prohibited/);
});

test('requires grouped weekly npm and GitHub Actions dependency updates', () => {
  const config = {
    version: 2,
    updates: [
      { 'package-ecosystem': 'github-actions', directory: '/', schedule: { interval: 'weekly' }, groups: { actions: { patterns: ['*'] } }, 'open-pull-requests-limit': 5 },
      { 'package-ecosystem': 'npm', directory: '/', schedule: { interval: 'weekly' }, groups: { npm: { patterns: ['*'] } }, 'open-pull-requests-limit': 5 },
    ],
  };
  assert.deepEqual(validateDependabotConfig(config), []);
  assert.match(validateDependabotConfig({ ...config, updates: config.updates.slice(0, 1) }).join('\n'), /missing npm/);
  const ungrouped = structuredClone(config);
  delete ungrouped.updates[0].groups;
  assert.match(validateDependabotConfig(ungrouped).join('\n'), /grouping is required/);
});

test('rejects install lifecycle scripts', () => {
  assert.match(validatePackageScripts({ scripts: { postinstall: 'node setup.js' } }).join('\n'), /lifecycle script postinstall/);
});

test('rejects duplicate keys and malformed indentation', () => {
  assert.throws(() => parseWorkflowYaml('name: one\nname: two\n', 'duplicate.yml'), /duplicate key/);
  assert.throws(() => parseWorkflowYaml('name: one\n  jobs: {}\n', 'indent.yml'), /unexpected indentation/);
});

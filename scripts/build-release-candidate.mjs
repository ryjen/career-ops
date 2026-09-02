import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { genericDetectors, scanContent } from './disclosure-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, '.release-candidate');
const PLAN = path.join(ROOT, 'release', 'release-plan.v1.json');
const LIFECYCLE_SCRIPTS = new Set(['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly']);
const ALLOWED_ARCHIVE_ROOTS = new Set(['LICENSE', 'README.md', 'SECURITY.md', 'SUPPORT.md', 'package.json']);
const ALLOWED_ARCHIVE_PREFIXES = ['schemas/', 'src/'];

export function validateReleasePlan(plan, sourcePackage) {
  const errors = [];
  if (plan?.schema_version !== 1) errors.push('release plan schema_version must be 1');
  if (plan?.package_name !== sourcePackage?.name) errors.push('release plan package_name must match package.json');
  if (!/^0\.1\.0(?:-[0-9A-Za-z.-]+)?$/.test(plan?.release_version ?? '')) errors.push('release plan version must be v0.1.0');
  if (!Array.isArray(plan?.supported_domains) || plan.supported_domains.length !== 1 || plan.supported_domains[0] !== 'career-ops.opportunity-normalization@1') {
    errors.push('v0.1 must support only opportunity normalization as a domain');
  }
  if (!Array.isArray(plan?.diagnostic_contracts) || !plan.diagnostic_contracts.includes('career-ops.smoke@1')) {
    errors.push('release plan must retain the smoke diagnostic contract');
  }
  if (plan?.distribution_state !== 'candidate-only') errors.push('release plan must remain candidate-only');
  if (plan?.publication_issue !== 18) errors.push('release plan publication issue must be #18');
  return errors;
}

export function createPublishedManifest(sourcePackage, releaseVersion) {
  const lifecycle = Object.keys(sourcePackage.scripts ?? {}).filter((name) => LIFECYCLE_SCRIPTS.has(name));
  if (lifecycle.length > 0) throw new Error(`source package contains prohibited lifecycle scripts: ${lifecycle.join(', ')}`);
  if (sourcePackage.private !== true) throw new Error('source package must remain private until publication issue #18');
  if (sourcePackage.name !== '@ryjen/career-ops') throw new Error('unexpected package name');
  const manifest = {
    name: sourcePackage.name,
    version: releaseVersion,
    description: sourcePackage.description,
    license: sourcePackage.license,
    type: sourcePackage.type,
    engines: sourcePackage.engines,
    exports: sourcePackage.exports,
    bin: sourcePackage.bin,
    files: sourcePackage.files,
    repository: {
      type: 'git',
      url: 'git+https://github.com/ryjen/career-ops.git',
    },
    homepage: 'https://github.com/ryjen/career-ops#readme',
    bugs: {
      url: 'https://github.com/ryjen/career-ops/issues',
    },
    publishConfig: {
      access: 'public',
    },
  };
  return manifest;
}

export function validateArchiveInventory(files) {
  const errors = [];
  const seen = new Set();
  for (const entry of files) {
    const file = typeof entry === 'string' ? entry : entry?.path;
    if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('..')) {
      errors.push(`invalid archive path: ${String(file)}`);
      continue;
    }
    if (seen.has(file)) errors.push(`duplicate archive path: ${file}`);
    seen.add(file);
    const allowed = ALLOWED_ARCHIVE_ROOTS.has(file) || ALLOWED_ARCHIVE_PREFIXES.some((prefix) => file.startsWith(prefix));
    if (!allowed) errors.push(`unexpected archive path: ${file}`);
    if (file.endsWith('.map')) errors.push(`source maps are prohibited from the release archive: ${file}`);
  }
  for (const required of ['LICENSE', 'README.md', 'package.json', 'src/index.js', 'src/cli.js']) {
    if (!seen.has(required)) errors.push(`release archive missing required file: ${required}`);
  }
  return errors.sort();
}

export function buildCycloneDx(sourcePackage, releaseVersion, lockfile) {
  const dependencies = dependencyEntries(lockfile);
  const rootRef = purl(sourcePackage.name, releaseVersion);
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      component: {
        type: 'library',
        'bom-ref': rootRef,
        name: sourcePackage.name,
        version: releaseVersion,
        licenses: [{ license: { id: sourcePackage.license } }],
        purl: rootRef,
      },
    },
    components: dependencies.map((dependency) => ({
      type: 'library',
      'bom-ref': purl(dependency.name, dependency.version),
      name: dependency.name,
      version: dependency.version,
      ...(dependency.license ? { licenses: [{ license: { id: dependency.license } }] } : {}),
      purl: purl(dependency.name, dependency.version),
    })),
    dependencies: [{
      ref: rootRef,
      dependsOn: dependencies.filter((dependency) => dependency.direct).map((dependency) => purl(dependency.name, dependency.version)).sort(),
    }],
  };
}

export function buildLicenseReport(sourcePackage, releaseVersion, lockfile) {
  const dependencies = dependencyEntries(lockfile);
  const missing = dependencies.filter((dependency) => !dependency.license);
  if (missing.length > 0) throw new Error(`dependency license metadata missing for: ${missing.map((item) => item.name).join(', ')}`);
  return {
    schema_version: 1,
    package: {
      name: sourcePackage.name,
      version: releaseVersion,
      license: sourcePackage.license,
    },
    dependencies: dependencies.map(({ name, version, license, direct }) => ({ name, version, license, direct })),
  };
}

function dependencyEntries(lockfile) {
  const direct = new Set(Object.keys(lockfile.packages?.['']?.dependencies ?? {}));
  return Object.entries(lockfile.packages ?? {})
    .filter(([location]) => location.startsWith('node_modules/'))
    .map(([location, metadata]) => ({
      name: metadata.name ?? location.slice('node_modules/'.length),
      version: metadata.version,
      license: metadata.license ?? null,
      direct: direct.has(metadata.name ?? location.slice('node_modules/'.length)),
    }))
    .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));
}

function purl(name, version) {
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

export function scanStagedPackage(stage) {
  const detectors = genericDetectors();
  const findings = [];
  for (const file of walkFiles(stage)) {
    const relative = path.relative(stage, file).split(path.sep).join('/');
    const buffer = fs.readFileSync(file);
    if (buffer.includes(0)) continue;
    findings.push(...scanContent(buffer.toString('utf8'), 'release-candidate', relative, detectors));
  }
  return findings.sort((left, right) => `${left.path}:${left.rule_id}`.localeCompare(`${right.path}:${right.rule_id}`));
}

function walkFiles(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(target));
    else if (entry.isFile()) output.push(target);
  }
  return output.sort();
}

function copyPublishedFiles(sourcePackage, stage) {
  for (const entry of sourcePackage.files ?? []) {
    const normalized = entry.replace(/\/$/, '');
    const source = path.join(ROOT, normalized);
    const destination = path.join(stage, normalized);
    if (!fs.existsSync(source)) throw new Error(`package file entry does not exist: ${entry}`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(source, destination, { recursive: true });
  }
}

function pack(stage, destination) {
  fs.mkdirSync(destination, { recursive: true });
  const result = spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', destination], {
    cwd: stage,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
  if (result.status !== 0) throw new Error(`npm pack failed with exit ${result.status}`);
  const payload = JSON.parse(result.stdout);
  if (!Array.isArray(payload) || payload.length !== 1 || !payload[0]?.filename || !Array.isArray(payload[0]?.files)) {
    throw new Error('npm pack returned an unexpected manifest');
  }
  return {
    archive: path.join(destination, payload[0].filename),
    filename: payload[0].filename,
    files: payload[0].files.map((entry) => ({ path: entry.path, size: entry.size })).sort((left, right) => left.path.localeCompare(right.path)),
  };
}

function verifyDownstream(archive) {
  const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-consumer-'));
  try {
    writeJson(path.join(consumer, 'package.json'), { private: true, type: 'module' });
    run('npm', ['install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--package-lock=false', archive], consumer, 'downstream npm install');
    run(process.execPath, ['--input-type=module', '-e', "import { runSmoke } from '@ryjen/career-ops'; const value=runSmoke({contract_name:'career-ops.smoke',contract_version:1,message:'candidate'}); if(value.contract_name!=='career-ops.smoke-result') process.exit(2);"], consumer, 'downstream library import');
    const cli = path.join(consumer, 'node_modules', '@ryjen', 'career-ops', 'src', 'cli.js');
    const cliResult = spawnSync(process.execPath, [cli, 'smoke'], {
      cwd: consumer,
      input: JSON.stringify({ contract_name: 'career-ops.smoke', contract_version: 1, message: 'candidate' }),
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });
    if (cliResult.status !== 0) throw new Error(`downstream CLI smoke failed with exit ${cliResult.status}`);
    const parsed = JSON.parse(cliResult.stdout);
    if (parsed.contract_name !== 'career-ops.smoke-result') throw new Error('downstream CLI returned unexpected contract');
    return { status: 'pass', install: 'offline-local-archive', library_import: 'pass', cli_smoke: 'pass' };
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
}

function run(command, args, cwd, label, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}`);
  return result.stdout ?? '';
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function cleanOutput() {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT, { recursive: true });
}

function requireCleanWorktree() {
  const status = git('status', '--porcelain=v1', '--untracked-files=all');
  if (status) throw new Error('release candidate requires a clean Git worktree');
}

export function validateToolchain(flakeLock, environment = process.env) {
  if (!environment.IN_NIX_SHELL) throw new Error('release candidate must run inside nix develop');
  const nixpkgs = flakeLock?.nodes?.nixpkgs?.locked;
  if (!nixpkgs?.rev || !nixpkgs?.narHash) throw new Error('flake.lock must contain a locked nixpkgs revision and narHash');

  const node = process.version.slice(1);
  const npm = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  const nixOutput = execFileSync('nix', ['--version'], { encoding: 'utf8' }).trim();
  const nix = nixOutput.replace(/^nix \(Nix\)\s+/, '');

  return {
    source: 'flake.nix+flake.lock',
    node,
    npm,
    nix,
    nixpkgs: {
      rev: nixpkgs.rev,
      nar_hash: nixpkgs.narHash,
    },
    definitions: {
      flake_nix_sha256: sha256File(path.join(ROOT, 'flake.nix')),
      flake_lock_sha256: sha256File(path.join(ROOT, 'flake.lock')),
    },
  };
}

export function buildReleaseCandidate() {
  cleanOutput();
  requireCleanWorktree();

  const sourcePackage = readJson(path.join(ROOT, 'package.json'));
  const lockfile = readJson(path.join(ROOT, 'package-lock.json'));
  const flakeLock = readJson(path.join(ROOT, 'flake.lock'));
  const plan = readJson(PLAN);
  const planErrors = validateReleasePlan(plan, sourcePackage);
  if (planErrors.length > 0) throw new Error(planErrors.join('; '));
  const toolchain = validateToolchain(flakeLock);

  run('npm', ['run', 'verify'], ROOT, 'repository verification', { inherit: true });
  const disclosure = JSON.parse(run(process.execPath, ['scripts/disclosure-scan.mjs'], ROOT, 'disclosure scan'));
  if (disclosure.status !== 'pass') throw new Error('release disclosure scan did not pass');

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-release-stage-'));
  const repeatDestination = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-release-repeat-'));
  try {
    copyPublishedFiles(sourcePackage, stage);
    const publishedManifest = createPublishedManifest(sourcePackage, plan.release_version);
    writeJson(path.join(stage, 'package.json'), publishedManifest);

    const stagedFindings = scanStagedPackage(stage);
    if (stagedFindings.length > 0) throw new Error(`staged release package has ${stagedFindings.length} disclosure finding(s)`);

    const first = pack(stage, OUTPUT);
    const second = pack(stage, repeatDestination);
    const firstDigest = sha256File(first.archive);
    const secondDigest = sha256File(second.archive);
    if (firstDigest !== secondDigest) throw new Error('release archive is not reproducible across repeated packing');
    const inventoryErrors = validateArchiveInventory(first.files);
    if (inventoryErrors.length > 0) throw new Error(inventoryErrors.join('; '));

    const sbom = buildCycloneDx(sourcePackage, plan.release_version, lockfile);
    const licenseReport = buildLicenseReport(sourcePackage, plan.release_version, lockfile);
    const inventory = { schema_version: 1, package: sourcePackage.name, version: plan.release_version, files: first.files };
    const downstream = verifyDownstream(first.archive);

    const sbomPath = path.join(OUTPUT, 'sbom.cdx.json');
    const licensePath = path.join(OUTPUT, 'licenses.json');
    const inventoryPath = path.join(OUTPUT, 'archive-inventory.json');
    const disclosurePath = path.join(OUTPUT, 'disclosure-scan.json');
    writeJson(sbomPath, sbom);
    writeJson(licensePath, licenseReport);
    writeJson(inventoryPath, inventory);
    writeJson(disclosurePath, disclosure);

    const sourceCommit = git('rev-parse', 'HEAD');
    const sourceTree = git('rev-parse', 'HEAD^{tree}');
    const evidence = {
      schema_version: 1,
      source: {
        repository: 'https://github.com/ryjen/career-ops',
        commit: sourceCommit,
        tree: sourceTree,
      },
      release: {
        package_name: sourcePackage.name,
        package_version: plan.release_version,
        archive: first.filename,
        archive_sha256: firstDigest,
        distribution_state: plan.distribution_state,
      },
      toolchain,
      evidence: {
        sbom: { file: path.basename(sbomPath), sha256: sha256File(sbomPath) },
        licenses: { file: path.basename(licensePath), sha256: sha256File(licensePath) },
        archive_inventory: { file: path.basename(inventoryPath), sha256: sha256File(inventoryPath) },
        disclosure_scan: { file: path.basename(disclosurePath), sha256: sha256File(disclosurePath), status: disclosure.status },
      },
      downstream,
      publication: {
        performed: false,
        issue: plan.publication_issue,
      },
    };
    const provenancePath = path.join(OUTPUT, 'provenance.json');
    writeJson(provenancePath, evidence);
    fs.writeFileSync(path.join(OUTPUT, 'SHA256SUMS'), `${firstDigest}  ${first.filename}\n`);

    const summary = {
      schema_version: 1,
      status: 'pass',
      source_commit: sourceCommit,
      package_name: sourcePackage.name,
      package_version: plan.release_version,
      archive: first.filename,
      archive_sha256: firstDigest,
      reproducible_pack: true,
      disclosure_status: disclosure.status,
      unresolved_disclosure_findings: disclosure.finding_counts?.unresolved ?? 0,
      fixture_count: disclosure.fixture_metadata?.count ?? 0,
      reviewed_fixture_count: disclosure.fixture_metadata?.reviewed_count ?? 0,
      downstream_status: downstream.status,
      publication_performed: false,
      output_files: fs.readdirSync(OUTPUT).sort(),
    };
    writeJson(path.join(OUTPUT, 'candidate.json'), summary);
    return summary;
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(repeatDestination, { recursive: true, force: true });
  }
}

function main() {
  try {
    const summary = buildReleaseCandidate();
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`release candidate failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

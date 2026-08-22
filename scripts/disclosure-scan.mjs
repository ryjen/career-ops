import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_MANIFEST = 'fixtures/synthetic/manifest.v1.json';
const DEFAULT_EXCEPTIONS = 'docs/disclosure-exceptions.v1.json';
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const PACKAGE_DENY_PREFIXES = ['.github/', 'docs/', 'fixtures/', 'scripts/', 'test/'];

export function genericDetectors() {
  return [
    detector('pem-private-key', new RegExp(['-----BEGIN ', '(?:RSA |EC |OPENSSH |DSA )?', 'PRIVATE KEY-----'].join(''), 'i')),
    detector('github-token-like', new RegExp(['gh', '[pousr]_', '[A-Za-z0-9]{20,}'].join(''))),
    detector('aws-access-key-like', new RegExp(['AK', 'IA[0-9A-Z]{16}'].join(''))),
    detector('npm-auth-token-like', new RegExp(['_auth', 'Token\\s*=\\s*[^\\s]{20,}'].join(''), 'i')),
    detector('unix-local-home-path', new RegExp(['(?:^|[\\s"\'=])/', '(?:home|Users)/', '[A-Za-z0-9._-]+/'].join(''))),
    detector('windows-local-user-path', new RegExp(['[A-Za-z]:\\\\', 'Users\\\\', '[^\\\\\\s]+\\\\'].join(''), 'i')),
  ];
}

export function privateMarkerDetectors(markers) {
  return markers.map((marker) => ({
    id: `private-marker:${sha256(marker).slice(0, 12)}`,
    test: (content) => content.includes(marker),
  }));
}

function detector(id, expression) {
  return { id, test: (content) => expression.test(content) };
}

export function readPrivateMarkers(file) {
  if (!file) return [];
  const content = fs.readFileSync(file, 'utf8');
  const markers = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  if (markers.some((marker) => marker.length < 4)) throw new Error('private markers must be at least four characters');
  return [...new Set(markers)].sort();
}

export function scanContent(content, scope, file, detectors) {
  const findings = [];
  for (const candidate of detectors) {
    if (candidate.test(content)) findings.push({ rule_id: candidate.id, scope, path: file, status: 'unresolved' });
  }
  return findings;
}

export function validateManifest(root, manifestPath = DEFAULT_MANIFEST) {
  const absolute = path.join(root, manifestPath);
  const errors = [];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch {
    return { count: 0, reviewed_count: 0, errors: ['fixture manifest is missing or invalid JSON'] };
  }
  if (manifest?.schema_version !== 1 || !Array.isArray(manifest.fixtures)) {
    return { count: 0, reviewed_count: 0, errors: ['fixture manifest must use schema_version 1 and a fixtures array'] };
  }

  const fixtureDir = path.join(root, 'fixtures', 'synthetic');
  const actual = fs.readdirSync(fixtureDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== path.basename(manifestPath))
    .map((entry) => path.posix.join('fixtures/synthetic', entry.name))
    .sort();
  const ids = new Set();
  const declared = new Set();
  let reviewedCount = 0;

  for (const item of manifest.fixtures) {
    if (!item || typeof item !== 'object') {
      errors.push('fixture metadata entry must be an object');
      continue;
    }
    if (!/^[a-z0-9][a-z0-9._-]{2,127}$/.test(item.id ?? '')) errors.push('fixture id is invalid');
    else if (ids.has(item.id)) errors.push(`duplicate fixture id: ${item.id}`);
    else ids.add(item.id);

    if (typeof item.path !== 'string' || !item.path.startsWith('fixtures/synthetic/') || item.path.includes('..')) {
      errors.push(`fixture path is invalid for ${item.id ?? 'unknown'}`);
      continue;
    }
    if (declared.has(item.path)) errors.push(`duplicate fixture path: ${item.path}`);
    declared.add(item.path);
    if (!fs.existsSync(path.join(root, item.path))) errors.push(`declared fixture is missing: ${item.path}`);
    if (item.origin !== 'independently-invented') errors.push(`fixture origin is not independently invented: ${item.path}`);
    if (typeof item.purpose !== 'string' || item.purpose.length < 8 || item.purpose.length > 240) {
      errors.push(`fixture purpose is invalid: ${item.path}`);
    }
    if (item.review?.status !== 'reviewed' || !/^\d{4}-\d{2}-\d{2}$/.test(item.review?.reviewed_at ?? '')) {
      errors.push(`fixture review is incomplete: ${item.path}`);
    } else {
      reviewedCount += 1;
    }
  }

  for (const file of actual) if (!declared.has(file)) errors.push(`fixture lacks metadata: ${file}`);
  for (const file of declared) if (!actual.includes(file)) errors.push(`metadata references non-fixture path: ${file}`);

  return { count: manifest.fixtures.length, reviewed_count: reviewedCount, errors: errors.sort() };
}

export function scanTree(root, detectors) {
  const files = execText('git', ['ls-files', '-z'], root).split('\0').filter(Boolean).sort();
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    const absolute = path.join(root, file);
    const content = readTextFile(absolute);
    if (content === null) continue;
    scanned += 1;
    findings.push(...scanContent(content, 'tree', file, detectors));
  }
  return { files_scanned: scanned, findings };
}

export function scanHistory(root, detectors) {
  const shallow = execText('git', ['rev-parse', '--is-shallow-repository'], root).trim() === 'true';
  if (shallow) {
    return {
      blobs_scanned: 0,
      findings: [{ rule_id: 'history-shallow', scope: 'history', path: '.', status: 'unresolved' }],
    };
  }

  const objects = execText('git', ['rev-list', '--objects', '--all'], root)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(' ');
      return separator < 0 ? { object: line, file: '' } : { object: line.slice(0, separator), file: line.slice(separator + 1) };
    });
  const seen = new Set();
  const findings = [];
  let scanned = 0;

  for (const entry of objects) {
    if (seen.has(entry.object)) continue;
    seen.add(entry.object);
    if (execText('git', ['cat-file', '-t', entry.object], root).trim() !== 'blob') continue;
    const size = Number(execText('git', ['cat-file', '-s', entry.object], root).trim());
    if (!Number.isFinite(size) || size > MAX_TEXT_BYTES) continue;
    const result = spawnSync('git', ['cat-file', '-p', entry.object], { cwd: root, encoding: 'utf8', maxBuffer: MAX_TEXT_BYTES + 1024 });
    if (result.status !== 0 || result.stdout.includes('\0')) continue;
    scanned += 1;
    const location = entry.file || `object:${entry.object.slice(0, 12)}`;
    findings.push(...scanContent(result.stdout, 'history', location, detectors));
  }
  return { blobs_scanned: scanned, findings };
}

export function validatePackageFiles(files) {
  const findings = [];
  for (const entry of files) {
    const file = typeof entry === 'string' ? entry : entry.path;
    if (!file) continue;
    if (PACKAGE_DENY_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      findings.push({ rule_id: 'package-excluded-surface', scope: 'package', path: file, status: 'unresolved' });
    }
  }
  return findings;
}

export function scanPackage(root, detectors) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
  if (result.status !== 0) {
    return {
      files_scanned: 0,
      findings: [{ rule_id: 'package-dry-run-failed', scope: 'package', path: 'package.json', status: 'unresolved' }],
    };
  }
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    return {
      files_scanned: 0,
      findings: [{ rule_id: 'package-dry-run-invalid-json', scope: 'package', path: 'package.json', status: 'unresolved' }],
    };
  }
  const files = Array.isArray(payload) && Array.isArray(payload[0]?.files) ? payload[0].files : [];
  const findings = validatePackageFiles(files);
  let scanned = 0;
  for (const entry of files) {
    const file = entry.path;
    if (!file) continue;
    const content = readTextFile(path.join(root, file));
    if (content === null) continue;
    scanned += 1;
    findings.push(...scanContent(content, 'package', file, detectors));
  }
  return { files_scanned: scanned, findings };
}

export function loadExceptions(file) {
  if (!file || !fs.existsSync(file)) return [];
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (payload?.schema_version !== 1 || !Array.isArray(payload.exceptions)) throw new Error('exceptions file must use schema_version 1');
  const ids = new Set();
  for (const exception of payload.exceptions) {
    if (!exception?.id || ids.has(exception.id)) throw new Error('exception ids must be present and unique');
    ids.add(exception.id);
    if (!exception.rule_id || !['tree', 'history', 'package'].includes(exception.scope) || !exception.path) {
      throw new Error(`exception ${exception.id} must bind exact rule_id, scope, and path`);
    }
    if (typeof exception.rationale !== 'string' || exception.rationale.length < 12) throw new Error(`exception ${exception.id} requires rationale`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.reviewed_at ?? '')) throw new Error(`exception ${exception.id} requires reviewed_at`);
  }
  return payload.exceptions;
}

export function applyExceptions(findings, exceptions) {
  return findings.map((finding) => {
    const exception = exceptions.find((candidate) =>
      candidate.rule_id === finding.rule_id && candidate.scope === finding.scope && candidate.path === finding.path);
    return exception ? { ...finding, status: 'reviewed-exception', exception_id: exception.id } : finding;
  });
}

export function runDisclosureScan({ root = process.cwd(), privateMarkersFile, exceptionsFile } = {}) {
  const resolvedRoot = fs.realpathSync(root);
  const markers = readPrivateMarkers(privateMarkersFile);
  const detectors = [...genericDetectors(), ...privateMarkerDetectors(markers)];
  const fixtureMetadata = validateManifest(resolvedRoot);
  const tree = scanTree(resolvedRoot, detectors);
  const history = scanHistory(resolvedRoot, detectors);
  const packageScan = scanPackage(resolvedRoot, detectors);
  const exceptions = loadExceptions(exceptionsFile ?? path.join(resolvedRoot, DEFAULT_EXCEPTIONS));
  const findings = applyExceptions([...tree.findings, ...history.findings, ...packageScan.findings], exceptions)
    .sort((left, right) => `${left.scope}:${left.path}:${left.rule_id}`.localeCompare(`${right.scope}:${right.path}:${right.rule_id}`));
  const unresolved = findings.filter((finding) => finding.status === 'unresolved');
  const errors = fixtureMetadata.errors;

  return {
    schema_version: 1,
    status: unresolved.length === 0 && errors.length === 0 ? 'pass' : 'fail',
    fixture_metadata: fixtureMetadata,
    private_markers: { enabled: markers.length > 0, count: markers.length },
    scopes: {
      tree: { files_scanned: tree.files_scanned },
      history: { blobs_scanned: history.blobs_scanned },
      package: { files_scanned: packageScan.files_scanned },
    },
    finding_counts: {
      unresolved: unresolved.length,
      reviewed_exception: findings.length - unresolved.length,
    },
    findings,
  };
}

function readTextFile(file) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size > MAX_TEXT_BYTES) return null;
  const buffer = fs.readFileSync(file);
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
}

function execText(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') options.root = argv[++index];
    else if (value === '--private-markers') options.privateMarkersFile = argv[++index];
    else if (value === '--exceptions') options.exceptionsFile = argv[++index];
    else throw new Error(`unknown argument: ${value}`);
  }
  return options;
}

function main() {
  try {
    const report = runDisclosureScan(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === 'pass' ? 0 : 1;
  } catch (error) {
    process.stderr.write(`disclosure scan failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const UNSAFE_SPECIFIER = /^(?:file:|link:|workspace:|git(?:\+[^:]+)?:|github:|https?:|ssh:|[./~])/i;
const NPM_REGISTRY = /^https:\/\/registry\.npmjs\.org\//;

function normalizedDependencies(packageJson) {
  const result = {};
  for (const field of DEPENDENCY_FIELDS) {
    result[field] = Object.fromEntries(Object.entries(packageJson[field] || {}).sort(([left], [right]) => left.localeCompare(right)));
  }
  return result;
}

export function validateDependencyState(packageJson, lockfile, label = 'current') {
  const errors = [];
  const root = lockfile?.packages?.[''];
  if (!root || typeof root !== 'object') return [`${label}: package-lock.json is missing packages[""]`];
  for (const field of DEPENDENCY_FIELDS) {
    const declared = packageJson[field] || {};
    const locked = root[field] || {};
    for (const [name, specifier] of Object.entries(declared)) {
      if (typeof specifier !== 'string' || !specifier.trim()) errors.push(`${label}: ${field}.${name} must use a non-empty string specifier`);
      else if (UNSAFE_SPECIFIER.test(specifier)) errors.push(`${label}: ${field}.${name} uses a prohibited non-registry specifier: ${specifier}`);
      if (locked[name] !== specifier) errors.push(`${label}: package-lock root does not match ${field}.${name}`);
    }
    for (const name of Object.keys(locked)) {
      if (!Object.hasOwn(declared, name)) errors.push(`${label}: package-lock root contains undeclared ${field}.${name}`);
    }
  }
  for (const [packagePath, metadata] of Object.entries(lockfile.packages || {})) {
    if (packagePath === '' || !metadata || typeof metadata !== 'object' || metadata.link === true) continue;
    if (metadata.resolved !== undefined && (typeof metadata.resolved !== 'string' || !NPM_REGISTRY.test(metadata.resolved))) {
      errors.push(`${label}: lockfile package ${packagePath} must resolve from registry.npmjs.org`);
    }
    if (metadata.resolved !== undefined && (typeof metadata.integrity !== 'string' || !metadata.integrity.trim())) {
      errors.push(`${label}: lockfile package ${packagePath} is missing integrity metadata`);
    }
  }
  return errors;
}

export function dependencyChanges(beforePackage, afterPackage) {
  const before = normalizedDependencies(beforePackage);
  const after = normalizedDependencies(afterPackage);
  const changes = [];
  for (const field of DEPENDENCY_FIELDS) {
    const names = new Set([...Object.keys(before[field]), ...Object.keys(after[field])]);
    for (const name of [...names].sort()) {
      if (before[field][name] !== after[field][name]) {
        changes.push({ field, name, before: before[field][name] ?? null, after: after[field][name] ?? null });
      }
    }
  }
  return changes;
}

function gitJson(base, file) {
  try {
    return JSON.parse(execFileSync('git', ['show', `${base}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    throw new Error(`cannot read ${file} from ${base}: ${String(error.stderr || error.message).trim()}`);
  }
}

function parseArguments(argv) {
  if (argv.length !== 2 || argv[0] !== '--base') throw new Error('Usage: check-dependency-diff.mjs --base origin/<branch>');
  const base = argv[1];
  if (!/^origin\/(?!.*\.\.)(?!.*\/\.)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(base)) throw new Error(`invalid base ref: ${base}`);
  return base;
}

export function runDependencyReview(base) {
  const currentPackage = JSON.parse(execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf8' }));
  const currentLock = JSON.parse(execFileSync('git', ['show', 'HEAD:package-lock.json'], { encoding: 'utf8' }));
  const beforePackage = gitJson(base, 'package.json');
  const beforeLock = gitJson(base, 'package-lock.json');
  const errors = [
    ...validateDependencyState(beforePackage, beforeLock, base),
    ...validateDependencyState(currentPackage, currentLock, 'HEAD'),
  ];
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return dependencyChanges(beforePackage, currentPackage);
}

const direct = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (direct) {
  try {
    const base = parseArguments(process.argv.slice(2));
    const changes = runDependencyReview(base);
    process.stdout.write(`${JSON.stringify({ status: 'pass', base, dependency_changes: changes }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
import { dependencyChanges, validateDependencyState } from '../scripts/dependency-diff.mjs';

function lock(root) {
  return { lockfileVersion: 3, packages: { '': root } };
}

test('accepts matching registry dependency declarations', () => {
  const packageJson = { dependencies: { alpha: '^1.2.3' }, devDependencies: { beta: '2.0.0' } };
  assert.deepEqual(validateDependencyState(packageJson, lock(packageJson)), []);
});

test('rejects non-registry dependency sources and lock drift', () => {
  const packageJson = { dependencies: { alpha: 'github:example/alpha', beta: '^2.0.0' } };
  const errors = validateDependencyState(packageJson, lock({ dependencies: { alpha: 'github:example/alpha', beta: '^1.0.0', extra: '1.0.0' } })).join('\n');
  assert.match(errors, /prohibited non-registry specifier/);
  assert.match(errors, /does not match dependencies.beta/);
  assert.match(errors, /undeclared dependencies.extra/);
});

test('reports deterministic dependency additions, changes, and removals', () => {
  const before = { dependencies: { alpha: '1.0.0', removed: '1.0.0' } };
  const after = { dependencies: { alpha: '2.0.0', added: '1.0.0' } };
  assert.deepEqual(dependencyChanges(before, after), [
    { field: 'dependencies', name: 'added', before: null, after: '1.0.0' },
    { field: 'dependencies', name: 'alpha', before: '1.0.0', after: '2.0.0' },
    { field: 'dependencies', name: 'removed', before: '1.0.0', after: null },
  ]);
});

test('rejects non-registry lockfile resolutions and missing integrity', () => {
  const packageJson = { dependencies: { alpha: '1.0.0' } };
  const lockfile = lock({ dependencies: { alpha: '1.0.0' } });
  lockfile.packages['node_modules/alpha'] = { version: '1.0.0', resolved: 'https://example.invalid/alpha.tgz' };
  const errors = validateDependencyState(packageJson, lockfile).join('\n');
  assert.match(errors, /must resolve from registry\.npmjs\.org/);
  assert.match(errors, /missing integrity metadata/);
});

test('CLI compares the explicit base ref against HEAD in a git repository', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-dependency-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Dependency Test');
  git('config', 'user.email', 'dependency-test@example.invalid');

  const writeState = (version) => {
    const packageJson = { name: 'fixture', version: '1.0.0', dependencies: { alpha: version } };
    const lockfile = {
      name: 'fixture', version: '1.0.0', lockfileVersion: 3, requires: true,
      packages: {
        '': { name: 'fixture', version: '1.0.0', dependencies: { alpha: version } },
        'node_modules/alpha': {
          version: version.replace(/^[^0-9]*/, ''),
          resolved: `https://registry.npmjs.org/alpha/-/alpha-${version.replace(/^[^0-9]*/, '')}.tgz`,
          integrity: 'sha512-synthetic',
        },
      },
    };
    fs.writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
    fs.writeFileSync(path.join(root, 'package-lock.json'), `${JSON.stringify(lockfile, null, 2)}\n`);
  };

  writeState('1.0.0');
  git('add', '.');
  git('commit', '-m', 'base');
  git('branch', 'base');
  writeState('2.0.0');
  git('add', '.');
  git('commit', '-m', 'head');
  git('remote', 'add', 'origin', root);
  git('fetch', 'origin', 'base:refs/remotes/origin/base');

  const script = path.resolve(new URL('../scripts/dependency-diff.mjs', import.meta.url).pathname);
  const result = spawnSync(process.execPath, [script, '--base', 'origin/base'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'pass');
  assert.deepEqual(report.dependency_changes, [
    { field: 'dependencies', name: 'alpha', before: '1.0.0', after: '2.0.0' },
  ]);
});

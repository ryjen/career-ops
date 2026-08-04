import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { runSmoke, validateSmokeInput, validateSmokeOutput } from '../src/index.js';

const fixture = JSON.parse(fs.readFileSync(new URL('../fixtures/synthetic/smoke-input.json', import.meta.url), 'utf8'));

test('validates the synthetic bootstrap contract', () => {
  assert.equal(validateSmokeInput(fixture).valid, true);
});

test('rejects unknown fields fail closed', () => {
  const result = validateSmokeInput({ ...fixture, destination: 'unexpected' });
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unknown fields/);
});

test('produces deterministic output', () => {
  const first = runSmoke(fixture);
  const second = runSmoke(fixture);
  assert.deepEqual(first, second);
  assert.equal(validateSmokeOutput(first).valid, true);
  assert.equal(first.content_hash.length, 64);
});

test('CLI runs with explicit stdin/stdout and no provider access', () => {
  const result = spawnSync(process.execPath, ['src/cli.js', 'smoke'], {
    cwd: new URL('..', import.meta.url),
    input: JSON.stringify(fixture),
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).contract_name, 'career-ops.smoke-result');
});

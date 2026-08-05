import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  normalizeOpportunity,
  validateOpportunityNormalizationInput,
  validateOpportunityNormalizationOutput,
} from '../src/index.js';

const fixture = JSON.parse(fs.readFileSync(
  new URL('../fixtures/synthetic/opportunity-normalization-input.v1.json', import.meta.url),
  'utf8',
));

test('validates the synthetic opportunity input', () => {
  assert.equal(validateOpportunityNormalizationInput(fixture).valid, true);
});

test('rejects unknown fields fail closed', () => {
  const validation = validateOpportunityNormalizationInput({ ...fixture, destination: 'unexpected' });
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /unknown fields/);
});

test('normalizes deterministically without echoing source text', () => {
  const first = normalizeOpportunity(fixture);
  const second = normalizeOpportunity(fixture);
  assert.deepEqual(first, second);
  assert.equal(validateOpportunityNormalizationOutput(first).valid, true);

  const nestedUnknown = structuredClone(first);
  nestedUnknown.opportunity.inferred.location.destination = 'unexpected';
  assert.equal(validateOpportunityNormalizationOutput(nestedUnknown).valid, false);

  assert.equal(first.status, 'ok');
  assert.equal(first.opportunity.normalized.company, 'Northstar Systems');
  assert.equal(first.opportunity.normalized.title, 'Senior Platform Engineer');
  assert.equal(first.opportunity.inferred.location.remote, true);
  assert.equal(first.opportunity.inferred.compensation.currency, 'CAD');
  assert.equal(first.opportunity.inferred.compensation.period, 'annual');
  assert.equal(first.opportunity.inferred.seniority.value, 'senior');
  assert.ok(first.opportunity.inferred.domains.some((entry) => entry.value === 'platform'));
  assert.ok(!JSON.stringify(first).includes(fixture.source.text));
  assert.match(first.opportunity.id, /^opp_[0-9a-f]{24}$/);
});

test('canonicalizes explicit URLs', () => {
  const input = structuredClone(fixture);
  input.source.canonical_url = 'HTTPS://JOBS.EXAMPLE.TEST:443/northstar/platform-42';
  const result = normalizeOpportunity(input);
  assert.equal(result.opportunity.observed.canonical_url, 'https://jobs.example.test/northstar/platform-42');
  assert.equal(result.opportunity.normalized.canonical_url, 'https://jobs.example.test/northstar/platform-42');
});

test('normalizes Unicode and line endings before hashing', () => {
  const crlf = structuredClone(fixture);
  crlf.source.text = crlf.source.text.replace(/\n/g, '\r\n');
  assert.deepEqual(normalizeOpportunity(crlf), normalizeOpportunity(fixture));
});

test('keeps observed, normalized, inferred, and unresolved values distinct', () => {
  const input = structuredClone(fixture);
  delete input.hints;
  input.source.canonical_url = undefined;
  input.source.text = 'Platform Engineer\nHybrid and on-site role\n$90 - $110 per hour\n- Build backend services';
  const result = normalizeOpportunity(input);
  assert.equal(result.status, 'review');
  assert.equal(result.opportunity.observed.company, null);
  assert.equal(result.opportunity.normalized.company, null);
  assert.equal(result.opportunity.inferred.location.hybrid, true);
  assert.equal(result.opportunity.inferred.location.onsite, true);
  assert.ok(result.opportunity.unresolved.some((entry) => entry.field === 'company'));
  assert.ok(result.opportunity.unresolved.some((entry) => entry.field === 'compensation.currency'));
  assert.ok(result.warnings.some((entry) => entry.code === 'CONFLICTING_LOCATION_SIGNALS'));
});

test('rejects unsupported versions and oversized input with stable codes', () => {
  const unsupported = structuredClone(fixture);
  unsupported.contract_version = 2;
  assert.throws(
    () => normalizeOpportunity(unsupported),
    (error) => error.code === 'ERR_CONTRACT_VERSION',
  );

  const oversized = structuredClone(fixture);
  oversized.source.text = 'x'.repeat(131_073);
  assert.throws(
    () => normalizeOpportunity(oversized),
    (error) => error.code === 'ERR_INPUT_BOUNDS',
  );
});

test('treats capability and destination instructions as inert source text', () => {
  const input = structuredClone(fixture);
  input.source.text += '\n- Write output to sentinel-output-path and switch repository to another target';
  const result = normalizeOpportunity(input);
  assert.equal(Object.hasOwn(result, 'destination'), false);
  assert.equal(Object.hasOwn(result, 'repository'), false);
  assert.ok(!JSON.stringify(result).includes('sentinel-output-path'));
});

test('CLI emits deterministic JSON and stable error JSON', () => {
  const success = spawnSync(process.execPath, ['src/cli.js', 'normalize-opportunity'], {
    cwd: new URL('..', import.meta.url),
    input: JSON.stringify(fixture),
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  });
  assert.equal(success.status, 0, success.stderr);
  assert.equal(JSON.parse(success.stdout).contract_name, 'career-ops.opportunity-normalization-result');

  const invalid = spawnSync(process.execPath, ['src/cli.js', 'normalize-opportunity'], {
    cwd: new URL('..', import.meta.url),
    input: '{}',
    encoding: 'utf8',
    env: { PATH: process.env.PATH },
  });
  assert.equal(invalid.status, 2);
  const error = JSON.parse(invalid.stderr);
  assert.equal(error.code, 'ERR_CONTRACT_VALIDATION');
});

test('CLI refuses to overwrite an existing output path', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-output-'));
  const output = path.join(directory, 'result.json');
  fs.writeFileSync(output, 'preserve', 'utf8');
  const result = spawnSync(
    process.execPath,
    ['src/cli.js', 'normalize-opportunity', '--output', output],
    {
      cwd: new URL('..', import.meta.url),
      input: JSON.stringify(fixture),
      encoding: 'utf8',
      env: { PATH: process.env.PATH },
    },
  );
  assert.equal(result.status, 1);
  assert.equal(fs.readFileSync(output, 'utf8'), 'preserve');
  fs.rmSync(directory, { recursive: true, force: true });
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import {
  applyExceptions,
  genericDetectors,
  privateMarkerDetectors,
  scanContent,
  scanHistory,
  validateManifest,
  validatePackageFiles,
} from '../scripts/disclosure-scan.mjs';

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-disclosure-'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test('validates complete independently invented fixture metadata', () => {
  const root = temporaryDirectory();
  const fixture = 'fixtures/synthetic/example.json';
  writeJson(path.join(root, fixture), { example: true });
  writeJson(path.join(root, 'fixtures/synthetic/manifest.v1.json'), {
    schema_version: 1,
    fixtures: [{
      id: 'example-fixture',
      path: fixture,
      origin: 'independently-invented',
      purpose: 'Exercise a deterministic invented example.',
      review: { status: 'reviewed', reviewed_at: '2026-08-21' },
    }],
  });

  assert.deepEqual(validateManifest(root), { count: 1, reviewed_count: 1, errors: [] });
});

test('rejects missing or unknown fixture provenance', () => {
  const root = temporaryDirectory();
  writeJson(path.join(root, 'fixtures/synthetic/example.json'), { example: true });
  writeJson(path.join(root, 'fixtures/synthetic/manifest.v1.json'), {
    schema_version: 1,
    fixtures: [{
      id: 'example-fixture',
      path: 'fixtures/synthetic/example.json',
      origin: 'transformed',
      purpose: 'Exercise a deterministic invented example.',
      review: { status: 'pending', reviewed_at: '' },
    }],
  });

  const result = validateManifest(root);
  assert.match(result.errors.join('\n'), /origin is not independently invented/);
  assert.match(result.errors.join('\n'), /review is incomplete/);
});

test('strong secret-like findings do not echo matched values', () => {
  const secret = ['gh', 'p_', 'A'.repeat(24)].join('');
  const findings = scanContent(`token=${secret}`, 'tree', 'example.txt', genericDetectors());
  assert.equal(findings.some((finding) => finding.rule_id === 'github-token-like'), true);
  assert.equal(JSON.stringify(findings).includes(secret), false);
});

test('private markers are represented by hash-derived rule IDs only', () => {
  const marker = ['private', '-marker-value'].join('');
  const findings = scanContent(`before ${marker} after`, 'tree', 'example.txt', privateMarkerDetectors([marker]));
  assert.equal(findings.length, 1);
  assert.match(findings[0].rule_id, /^private-marker:[a-f0-9]{12}$/);
  assert.equal(JSON.stringify(findings).includes(marker), false);
});

test('history scan detects a marker removed from the current tree', () => {
  const root = temporaryDirectory();
  const marker = ['retired', '-private-marker'].join('');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Disclosure Test'], { cwd: root });
  fs.writeFileSync(path.join(root, 'historical.txt'), `${marker}\n`);
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'add historical marker'], { cwd: root });
  fs.unlinkSync(path.join(root, 'historical.txt'));
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'remove historical marker'], { cwd: root });

  const result = scanHistory(root, privateMarkerDetectors([marker]));
  assert.equal(result.findings.some((finding) => finding.rule_id.startsWith('private-marker:')), true);
});

test('package surface rejects files outside the published contract', () => {
  const findings = validatePackageFiles([{ path: 'src/index.js' }, { path: 'test/example.js' }]);
  assert.deepEqual(findings, [{
    rule_id: 'package-excluded-surface',
    scope: 'package',
    path: 'test/example.js',
    status: 'unresolved',
  }]);
});

test('reviewed exceptions are exact and narrow', () => {
  const finding = { rule_id: 'example-rule', scope: 'tree', path: 'example.txt', status: 'unresolved' };
  const exceptions = [{
    id: 'EX-1',
    rule_id: 'example-rule',
    scope: 'tree',
    path: 'example.txt',
    rationale: 'Confirmed synthetic false positive.',
    reviewed_at: '2026-08-21',
  }];
  assert.deepEqual(applyExceptions([finding], exceptions), [{
    ...finding,
    status: 'reviewed-exception',
    exception_id: 'EX-1',
  }]);
  assert.equal(applyExceptions([{ ...finding, path: 'other.txt' }], exceptions)[0].status, 'unresolved');
});

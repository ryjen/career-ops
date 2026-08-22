import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REQUIRED_SURFACES,
  validateCandidateIdentity,
  validateReleaseDisclosure,
} from '../scripts/validate-release-disclosure.mjs';

function validRecord() {
  return {
    schema_version: 1,
    release: {
      source_commit: 'a'.repeat(40),
      package_name: '@ryjen/career-ops',
      package_version: '0.1.0',
      archive_sha256: 'b'.repeat(64),
    },
    automated_scan: {
      command: 'npm run disclosure:scan',
      status: 'pass',
      unresolved_findings: 0,
      fixture_count: 2,
      reviewed_fixture_count: 2,
    },
    human_review: {
      reviewer: 'maintainer',
      reviewed_at: '2026-08-21',
      surfaces: REQUIRED_SURFACES.map((id) => ({ id, status: 'reviewed', notes: 'Reviewed against the exact candidate.' })),
    },
    exceptions: [],
    decision: {
      status: 'approve',
      rationale: 'All automated and human disclosure gates passed for the exact candidate.',
    },
  };
}

test('accepts a complete approved release disclosure record', () => {
  assert.deepEqual(validateReleaseDisclosure(validRecord()), { valid: true, errors: [] });
});

test('fails when automated disclosure has unresolved findings', () => {
  const record = validRecord();
  record.automated_scan.unresolved_findings = 1;
  const result = validateReleaseDisclosure(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /zero unresolved findings/);
});

test('fails when a required human review surface is missing', () => {
  const record = validRecord();
  record.human_review.surfaces = record.human_review.surfaces.slice(1);
  const result = validateReleaseDisclosure(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /missing human_review surface/);
});

test('fails when a core review surface is marked not applicable', () => {
  const record = validRecord();
  record.human_review.surfaces.find((surface) => surface.id === 'package-archive-contents').status = 'not-applicable';
  const result = validateReleaseDisclosure(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /package-archive-contents must be reviewed/);
});

test('fails when a disclosure exception is not reviewed', () => {
  const record = validRecord();
  record.exceptions = [{ id: 'EX-1', status: 'pending' }];
  const result = validateReleaseDisclosure(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /is not reviewed/);
});

test('fails closed when the final release decision is blocked', () => {
  const record = validRecord();
  record.decision.status = 'block';
  const result = validateReleaseDisclosure(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /decision must approve/);
});

test('rejects unknown fields that could carry unbounded audit material', () => {
  const record = validRecord();
  record.private_evidence = 'must not be accepted';
  const result = validateReleaseDisclosure(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unknown field/);
});

test('binds approval to the exact commit, package, version, and archive digest', () => {
  const record = validRecord();
  assert.deepEqual(validateCandidateIdentity(record, {
    source_commit: record.release.source_commit,
    package_name: record.release.package_name,
    package_version: record.release.package_version,
    archive_sha256: record.release.archive_sha256,
  }), { valid: true, errors: [] });

  const mismatch = validateCandidateIdentity(record, {
    source_commit: 'c'.repeat(40),
    package_name: record.release.package_name,
    package_version: record.release.package_version,
    archive_sha256: record.release.archive_sha256,
  });
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.errors.join('\n'), /checked-out candidate/);
});

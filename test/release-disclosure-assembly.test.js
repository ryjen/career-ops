import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleReleaseDisclosure, decodeReview } from '../scripts/assemble-release-disclosure.mjs';
import { REQUIRED_SURFACES } from '../scripts/validate-release-disclosure.mjs';

const sourceCommit = 'a'.repeat(40);
const candidate = {
  schema_version: 1,
  status: 'pass',
  source_commit: sourceCommit,
  package_name: '@ryjen/career-ops',
  package_version: '0.1.0',
  archive: 'ryjen-career-ops-0.1.0.tgz',
  archive_sha256: 'b'.repeat(64),
  reproducible_pack: true,
  disclosure_status: 'pass',
  unresolved_disclosure_findings: 0,
  fixture_count: 2,
  reviewed_fixture_count: 2,
  downstream_status: 'pass',
  publication_performed: false,
};

function review() {
  return {
    human_review: {
      source_commit: sourceCommit,
      reviewer: 'maintainer',
      reviewed_at: '2026-08-21',
      surfaces: REQUIRED_SURFACES.map((id) => ({
        id,
        status: 'reviewed',
        notes: 'Reviewed against this exact source commit.',
      })),
    },
    exceptions: [],
    decision: {
      status: 'approve',
      rationale: 'The exact candidate passed automated checks and bounded human disclosure review.',
    },
  };
}

test('assembles automated candidate evidence with bounded human review', () => {
  const record = assembleReleaseDisclosure(candidate, review());
  assert.equal(record.release.source_commit, sourceCommit);
  assert.equal(record.release.archive_sha256, candidate.archive_sha256);
  assert.equal(record.human_review.source_commit, sourceCommit);
  assert.equal(record.decision.status, 'approve');
});

test('rejects human review for a different source commit', () => {
  const value = review();
  value.human_review.source_commit = 'c'.repeat(40);
  assert.throws(() => assembleReleaseDisclosure(candidate, value), /source_commit/);
});

test('rejects unexpected review fields', () => {
  const value = { ...review(), raw_private_evidence: 'not allowed' };
  assert.throws(() => assembleReleaseDisclosure(candidate, value), /unexpected or missing fields/);
});

test('decodes bounded base64 JSON review input', () => {
  const value = review();
  const encoded = Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
  assert.deepEqual(decodeReview(encoded), value);
  assert.throws(() => decodeReview('e30='.repeat(40000)), /bounded size/);
});

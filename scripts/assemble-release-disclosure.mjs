import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateCandidateIdentity, validateReleaseDisclosure } from './validate-release-disclosure.mjs';

const MAX_REVIEW_BYTES = 64 * 1024;

export function assembleReleaseDisclosure(candidate, review) {
  if (!candidate || candidate.status !== 'pass' || candidate.publication_performed !== false) {
    throw new Error('candidate summary is not an approved unpublished candidate');
  }
  if (!review || typeof review !== 'object' || Array.isArray(review)) throw new Error('human review declaration must be an object');
  const keys = Object.keys(review).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['decision', 'exceptions', 'human_review'])) {
    throw new Error('human review declaration contains unexpected or missing fields');
  }

  const record = {
    schema_version: 1,
    release: {
      source_commit: candidate.source_commit,
      package_name: candidate.package_name,
      package_version: candidate.package_version,
      archive_sha256: candidate.archive_sha256,
    },
    automated_scan: {
      command: 'npm run disclosure:scan',
      status: candidate.disclosure_status,
      unresolved_findings: candidate.unresolved_disclosure_findings,
      fixture_count: candidate.fixture_count,
      reviewed_fixture_count: candidate.reviewed_fixture_count,
    },
    human_review: review.human_review,
    exceptions: review.exceptions,
    decision: review.decision,
  };
  const structural = validateReleaseDisclosure(record);
  const identity = validateCandidateIdentity(record, {
    source_commit: candidate.source_commit,
    package_name: candidate.package_name,
    package_version: candidate.package_version,
    archive_sha256: candidate.archive_sha256,
  });
  const errors = [...structural.errors, ...identity.errors].sort();
  if (errors.length > 0) throw new Error(`release disclosure is invalid: ${errors.join('; ')}`);
  return record;
}

export function decodeReview(encoded) {
  if (typeof encoded !== 'string' || encoded.length < 4 || encoded.length > MAX_REVIEW_BYTES * 2) {
    throw new Error('release review input is missing or exceeds the bounded size');
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('release review input is not canonical base64');
  }
  const buffer = Buffer.from(encoded, 'base64');
  if (buffer.toString('base64') !== encoded) throw new Error('release review input is not canonical base64');
  if (buffer.byteLength > MAX_REVIEW_BYTES) throw new Error('decoded release review exceeds the bounded size');
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new Error('decoded release review is not valid JSON');
  }
}

function main() {
  try {
    const candidatePath = process.argv[2] ?? '.release-candidate/candidate.json';
    const outputPath = process.argv[3] ?? '.release-candidate/release-disclosure.json';
    const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
    const review = decodeReview(process.env.RELEASE_REVIEW_B64);
    const record = assembleReleaseDisclosure(candidate, review);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ status: 'pass', source_commit: record.release.source_commit, reviewer: record.human_review.reviewer }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`release disclosure assembly failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

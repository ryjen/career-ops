import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const REQUIRED_SURFACES = [
  'collaboration-history',
  'attachments-and-discussions',
  'actions-logs-and-summaries',
  'actions-artifacts-and-caches',
  'environments-and-workflow-metadata',
  'tags-releases-and-packages',
  'sbom-provenance-and-attestations',
  'dependency-license-and-mpl',
  'generated-docs-and-source-maps',
  'synthetic-reidentification',
  'package-archive-contents',
];

export const MUST_REVIEW_SURFACES = new Set([
  'collaboration-history',
  'actions-logs-and-summaries',
  'tags-releases-and-packages',
  'sbom-provenance-and-attestations',
  'dependency-license-and-mpl',
  'synthetic-reidentification',
  'package-archive-contents',
]);

export function validateReleaseDisclosure(record) {
  const errors = [];
  if (!object(record)) return { valid: false, errors: ['record must be an object'] };
  exactKeys(record, ['schema_version', 'release', 'automated_scan', 'human_review', 'exceptions', 'decision'], 'record', errors);
  if (record.schema_version !== 1) errors.push('record schema_version must be 1');
  validateRelease(record.release, errors);
  validateAutomatedScan(record.automated_scan, errors);
  validateHumanReview(record.human_review, errors);
  validateExceptions(record.exceptions, errors);
  validateDecision(record.decision, errors);
  if (record.release?.source_commit && record.human_review?.source_commit && record.release.source_commit !== record.human_review.source_commit) {
    errors.push('human_review source_commit must match release source_commit');
  }
  return { valid: errors.length === 0, errors: errors.sort() };
}

export function validateCandidateIdentity(record, candidate) {
  const errors = [];
  if (!object(record?.release)) return { valid: false, errors: ['record release identity is missing'] };
  if (record.release.source_commit !== candidate.source_commit) errors.push('release source_commit does not match the checked-out candidate');
  if (record.human_review?.source_commit !== candidate.source_commit) errors.push('human_review source_commit does not match the checked-out candidate');
  if (record.release.package_name !== candidate.package_name) errors.push('release package_name does not match the release plan');
  if (record.release.package_version !== candidate.package_version) errors.push('release package_version does not match the release plan');
  if (record.release.archive_sha256 !== candidate.archive_sha256) errors.push('release archive_sha256 does not match the supplied archive');
  return { valid: errors.length === 0, errors: errors.sort() };
}

function validateRelease(release, errors) {
  if (!object(release)) {
    errors.push('release must be an object');
    return;
  }
  exactKeys(release, ['source_commit', 'package_name', 'package_version', 'archive_sha256'], 'release', errors);
  if (!/^[a-f0-9]{40}$/.test(release.source_commit ?? '')) errors.push('release source_commit must be a 40-character lowercase hex commit');
  if (release.package_name !== '@ryjen/career-ops') errors.push('release package_name is invalid');
  if (typeof release.package_version !== 'string' || release.package_version.length < 1 || release.package_version.length > 64) {
    errors.push('release package_version is invalid');
  }
  if (!/^[a-f0-9]{64}$/.test(release.archive_sha256 ?? '')) errors.push('release archive_sha256 must be a 64-character lowercase hex digest');
}

function validateAutomatedScan(scan, errors) {
  if (!object(scan)) {
    errors.push('automated_scan must be an object');
    return;
  }
  exactKeys(scan, ['command', 'status', 'unresolved_findings', 'fixture_count', 'reviewed_fixture_count'], 'automated_scan', errors);
  if (scan.command !== 'npm run disclosure:scan') errors.push('automated_scan command must use the canonical disclosure gate');
  if (scan.status !== 'pass') errors.push('automated_scan status must pass');
  if (scan.unresolved_findings !== 0) errors.push('automated_scan must have zero unresolved findings');
  if (!Number.isInteger(scan.fixture_count) || scan.fixture_count < 1) errors.push('automated_scan fixture_count must be positive');
  if (!Number.isInteger(scan.reviewed_fixture_count) || scan.reviewed_fixture_count < 1) {
    errors.push('automated_scan reviewed_fixture_count must be positive');
  }
  if (scan.fixture_count !== scan.reviewed_fixture_count) errors.push('all automated_scan fixtures must be reviewed');
}

function validateHumanReview(review, errors) {
  if (!object(review)) {
    errors.push('human_review must be an object');
    return;
  }
  exactKeys(review, ['source_commit', 'reviewer', 'reviewed_at', 'surfaces'], 'human_review', errors);
  if (!/^[a-f0-9]{40}$/.test(review.source_commit ?? '')) errors.push('human_review source_commit must be a 40-character lowercase hex commit');
  if (typeof review.reviewer !== 'string' || review.reviewer.trim().length < 1 || review.reviewer.length > 120) {
    errors.push('human_review reviewer is invalid');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(review.reviewed_at ?? '')) errors.push('human_review reviewed_at must be an ISO date');
  if (!Array.isArray(review.surfaces)) {
    errors.push('human_review surfaces must be an array');
    return;
  }
  const seen = new Set();
  for (const surface of review.surfaces) {
    if (!object(surface)) {
      errors.push('human_review surface must be an object');
      continue;
    }
    exactKeys(surface, ['id', 'status', 'notes'], `human_review surface ${surface.id ?? 'unknown'}`, errors);
    if (!REQUIRED_SURFACES.includes(surface.id)) errors.push(`unknown human_review surface: ${surface.id ?? 'missing'}`);
    else if (seen.has(surface.id)) errors.push(`duplicate human_review surface: ${surface.id}`);
    else seen.add(surface.id);
    if (!['reviewed', 'not-applicable'].includes(surface.status)) errors.push(`surface ${surface.id ?? 'unknown'} has invalid status`);
    if (MUST_REVIEW_SURFACES.has(surface.id) && surface.status !== 'reviewed') errors.push(`surface ${surface.id} must be reviewed`);
    if (typeof surface.notes !== 'string' || surface.notes.length < 8 || surface.notes.length > 500) {
      errors.push(`surface ${surface.id ?? 'unknown'} requires bounded review notes`);
    }
  }
  for (const id of REQUIRED_SURFACES) if (!seen.has(id)) errors.push(`missing human_review surface: ${id}`);
}

function validateExceptions(exceptions, errors) {
  if (!Array.isArray(exceptions)) {
    errors.push('exceptions must be an array');
    return;
  }
  const ids = new Set();
  for (const exception of exceptions) {
    if (!object(exception)) {
      errors.push('exception must be an object');
      continue;
    }
    exactKeys(exception, ['id', 'status'], `exception ${exception.id ?? 'unknown'}`, errors);
    if (typeof exception.id !== 'string' || exception.id.length < 1 || exception.id.length > 120) errors.push('exception id is invalid');
    else if (ids.has(exception.id)) errors.push(`duplicate exception id: ${exception.id}`);
    else ids.add(exception.id);
    if (exception.status !== 'reviewed') errors.push(`exception ${exception.id ?? 'unknown'} is not reviewed`);
  }
}

function validateDecision(decision, errors) {
  if (!object(decision)) {
    errors.push('decision must be an object');
    return;
  }
  exactKeys(decision, ['status', 'rationale'], 'decision', errors);
  if (decision.status !== 'approve') errors.push('decision must approve the release candidate');
  if (typeof decision.rationale !== 'string' || decision.rationale.length < 12 || decision.rationale.length > 500) {
    errors.push('decision requires a bounded rationale');
  }
}

function exactKeys(value, allowed, label, errors) {
  if (!object(value)) return;
  const expected = new Set(allowed);
  for (const key of Object.keys(value)) if (!expected.has(key)) errors.push(`${label} contains unknown field: ${key}`);
  for (const key of allowed) if (!(key in value)) errors.push(`${label} is missing field: ${key}`);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function parseArgs(argv) {
  const record = argv[0];
  let archive;
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === '--archive') archive = argv[++index];
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  return { record, archive };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`release disclosure validation failed: ${error.message}\n`);
    process.exitCode = 2;
    return;
  }
  if (!args.record || !args.archive) {
    process.stderr.write('usage: node scripts/validate-release-disclosure.mjs <record.json> --archive <package.tgz>\n');
    process.exitCode = 2;
    return;
  }
  try {
    const record = JSON.parse(fs.readFileSync(args.record, 'utf8'));
    const structural = validateReleaseDisclosure(record);
    const releasePlan = JSON.parse(fs.readFileSync('release/release-plan.v1.json', 'utf8'));
    const candidate = validateCandidateIdentity(record, {
      source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      package_name: releasePlan.package_name,
      package_version: releasePlan.release_version,
      archive_sha256: sha256File(args.archive),
    });
    const errors = [...structural.errors, ...candidate.errors].sort();
    const result = { valid: errors.length === 0, errors };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`release disclosure validation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

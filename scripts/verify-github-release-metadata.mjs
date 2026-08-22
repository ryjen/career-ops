import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_RELEASE_ASSETS = [
  'SHA256SUMS',
  'archive-inventory.json',
  'disclosure-scan.json',
  'licenses.json',
  'provenance.json',
  'release-disclosure.json',
  'ryjen-career-ops-0.1.0.tgz',
  'sbom.cdx.json',
].sort();

export function validateGitHubReleaseMetadata(metadata) {
  const errors = [];
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return ['release metadata must be an object'];
  if (metadata.tagName !== 'v0.1.0') errors.push('release tag must be v0.1.0');
  if (metadata.isDraft !== false) errors.push('release must not be a draft');
  if (metadata.isPrerelease !== false) errors.push('release must not be a prerelease');
  const assets = Array.isArray(metadata.assets) ? metadata.assets : [];
  const names = assets.map((asset) => asset?.name).filter((name) => typeof name === 'string').sort();
  if (JSON.stringify(names) !== JSON.stringify(REQUIRED_RELEASE_ASSETS)) {
    errors.push(`release assets must exactly match the approved set: ${REQUIRED_RELEASE_ASSETS.join(', ')}`);
  }
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) errors.push(`release contains duplicate asset names: ${[...new Set(duplicates)].join(', ')}`);
  return errors.sort();
}

function main() {
  try {
    const file = process.argv[2];
    if (!file) throw new Error('usage: node scripts/verify-github-release-metadata.mjs <release.json>');
    const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
    const errors = validateGitHubReleaseMetadata(metadata);
    process.stdout.write(`${JSON.stringify({ valid: errors.length === 0, errors }, null, 2)}\n`);
    process.exitCode = errors.length === 0 ? 0 : 1;
  } catch (error) {
    process.stderr.write(`GitHub release metadata verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

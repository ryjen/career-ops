import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REQUIRED_RELEASE_ASSETS,
  validateGitHubReleaseMetadata,
} from '../scripts/verify-github-release-metadata.mjs';

function validMetadata() {
  return {
    tagName: 'v0.1.0',
    isDraft: false,
    isPrerelease: false,
    assets: REQUIRED_RELEASE_ASSETS.map((name) => ({ name })),
  };
}

test('accepts exact v0.1.0 GitHub Release metadata', () => {
  assert.deepEqual(validateGitHubReleaseMetadata(validMetadata()), []);
});

test('rejects draft, prerelease, wrong tag, or extra asset', () => {
  const draft = validMetadata();
  draft.isDraft = true;
  assert.match(validateGitHubReleaseMetadata(draft).join('\n'), /must not be a draft/);

  const prerelease = validMetadata();
  prerelease.isPrerelease = true;
  assert.match(validateGitHubReleaseMetadata(prerelease).join('\n'), /must not be a prerelease/);

  const wrongTag = validMetadata();
  wrongTag.tagName = 'v0.1.1';
  assert.match(validateGitHubReleaseMetadata(wrongTag).join('\n'), /must be v0.1.0/);

  const extra = validMetadata();
  extra.assets.push({ name: 'unexpected.txt' });
  assert.match(validateGitHubReleaseMetadata(extra).join('\n'), /approved set/);
});

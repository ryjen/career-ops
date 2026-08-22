import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parseWorkflowYaml, validateWorkflow } from '../scripts/workflow-policy.mjs';

const filename = '.github/workflows/release.yml';
const source = fs.readFileSync(filename, 'utf8');

function errors(candidate = source) {
  return validateWorkflow(parseWorkflowYaml(candidate, filename), filename);
}

test('accepts the fixed manual v0.1 GitHub Release workflow', () => {
  assert.deepEqual(errors(), []);
});

test('release workflow is manual-only, main-only, and non-cancelling', () => {
  assert.match(errors(source.replace('workflow_dispatch:', 'pull_request:')).join('\n'), /workflow_dispatch only/);
  assert.match(errors(source.replace("github.ref == 'refs\/heads\/main'", "github.ref == 'refs\/heads\/develop'")).join('\n'), /refs\/heads\/main/);
  assert.match(errors(source.replace('cancel-in-progress: false', 'cancel-in-progress: true')).join('\n'), /must not be cancelled/);
});

test('release workflow permits only the bounded review input', () => {
  const extraInput = source.replace(
    '        type: string',
    '        type: string\n      destination:\n        required: true\n        type: string',
  );
  assert.match(errors(extraInput).join('\n'), /only workflow input/);

  const directShell = source.replace(
    'run: npm run release:disclosure:assemble',
    'run: echo "${{ inputs.release_review_base64 }}"',
  );
  assert.match(errors(directShell).join('\n'), /cannot be interpolated into shell commands/);
});

test('release workflow has only the reviewed contents write capability', () => {
  assert.match(errors(source.replace('contents: write', 'packages: write')).join('\n'), /exactly contents: write/);
  assert.match(errors(source.replace('permissions:\n  contents: read', 'permissions:\n  contents: write')).join('\n'), /top-level permissions/);
  const persistentRunner = ['self', 'hosted'].join('-');
  assert.match(errors(source.replace('runs-on: ubuntu-24.04', `runs-on: ${persistentRunner}`)).join('\n'), /approved fixed GitHub-hosted runner/);
});

test('release checkout and publication identity are fixed', () => {
  assert.match(errors(source.replace('          ref: main', '          ref: develop')).join('\n'), /fixed ref main/);
  assert.match(errors(source.replace('gh release create v0.1.0', 'gh release create v0.1.1')).join('\n'), /fixed tag v0.1.0/);
  assert.match(errors(source.replace('--target "$GITHUB_SHA"', '--target main')).join('\n'), /validated GITHUB_SHA/);
});

test('release workflow rejects npm publication and mutable release operations', () => {
  assert.match(errors(source.replace('npm run release:candidate', 'npm publish')).join('\n'), /npm\/container publication is prohibited/);
  assert.match(errors(source.replace('gh release view v0.1.0', 'gh release delete v0.1.0')).join('\n'), /post-creation release commands are prohibited/);
});

test('release workflow publishes the exact reviewed asset set', () => {
  assert.match(
    errors(source.replace('            .release-candidate/sbom.cdx.json \\\n', '')).join('\n'),
    /missing fixed asset .*sbom\.cdx\.json/,
  );
  assert.match(
    errors(source.replace('.release-candidate/release-disclosure.json \\\n', '.release-candidate/*.json \\\n')).join('\n'),
    /globbed asset paths/,
  );
});

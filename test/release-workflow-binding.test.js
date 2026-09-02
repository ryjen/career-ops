import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync('.github/workflows/release.yml', 'utf8');

test('release build is bound to the workflow dispatch commit', () => {
  assert.match(source, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(source, /ref: main/);
  assert.match(source, /run: [^\n]*test "\$\(git rev-parse HEAD\)" = "\$GITHUB_SHA"/);
  assert.match(source, /gh release create v0\.1\.0[\s\S]*--target "\$GITHUB_SHA"/);
  assert.match(source, /test "\$\(git rev-list -n 1 v0\.1\.0\)" = "\$GITHUB_SHA"/);
});

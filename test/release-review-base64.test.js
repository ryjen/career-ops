import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeReview } from '../scripts/assemble-release-disclosure.mjs';

test('rejects malformed and non-canonical release review base64', () => {
  assert.throws(() => decodeReview('!!!!'), /canonical base64/);
  assert.throws(() => decodeReview('e3!0'), /canonical base64/);
  assert.throws(() => decodeReview('e30=\n'), /canonical base64/);
});

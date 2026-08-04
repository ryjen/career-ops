import { createHash } from 'node:crypto';
import { validateSmokeInput } from '../contracts/smoke.js';

/**
 * Execute the bootstrap deterministic public-core smoke operation.
 *
 * @param {unknown} input
 * @returns {{contract_name: 'career-ops.smoke-result', contract_version: 1, message: string, content_hash: string}}
 */
export function runSmoke(input) {
  const validation = validateSmokeInput(input);
  if (!validation.valid) {
    const error = new TypeError(`invalid smoke input: ${validation.errors.join('; ')}`);
    error.code = 'ERR_CONTRACT_VALIDATION';
    throw error;
  }

  const canonicalMessage = validation.value.message.normalize('NFC').trim();
  return {
    contract_name: 'career-ops.smoke-result',
    contract_version: 1,
    message: canonicalMessage,
    content_hash: createHash('sha256').update(canonicalMessage, 'utf8').digest('hex'),
  };
}

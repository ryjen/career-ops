/**
 * Validate the bootstrap smoke input contract.
 *
 * This intentionally small validator proves the package contract pattern
 * without adding a generic schema dependency before a real domain slice exists.
 *
 * @param {unknown} value
 * @returns {{valid: true, value: {contract_name: 'career-ops.smoke', contract_version: 1, message: string}} | {valid: false, errors: string[]}}
 */
export function validateSmokeInput(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['input must be an object'] };
  }

  const keys = Object.keys(value).sort();
  const expected = ['contract_name', 'contract_version', 'message'];
  const unknown = keys.filter((key) => !expected.includes(key));
  if (unknown.length > 0) errors.push(`unknown fields: ${unknown.join(', ')}`);
  if (value.contract_name !== 'career-ops.smoke') errors.push('contract_name must equal career-ops.smoke');
  if (value.contract_version !== 1) errors.push('contract_version must equal 1');
  if (typeof value.message !== 'string' || value.message.length < 1 || value.message.length > 120) {
    errors.push('message must be a string containing 1 to 120 characters');
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: {
      contract_name: 'career-ops.smoke',
      contract_version: 1,
      message: value.message,
    },
  };
}

/**
 * Validate the bootstrap smoke output contract.
 *
 * @param {unknown} value
 * @returns {{valid: true, value: {contract_name: 'career-ops.smoke-result', contract_version: 1, message: string, content_hash: string}} | {valid: false, errors: string[]}}
 */
export function validateSmokeOutput(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['output must be an object'] };
  }

  const keys = Object.keys(value).sort();
  const expected = ['content_hash', 'contract_name', 'contract_version', 'message'];
  const unknown = keys.filter((key) => !expected.includes(key));
  if (unknown.length > 0) errors.push(`unknown fields: ${unknown.join(', ')}`);
  if (value.contract_name !== 'career-ops.smoke-result') errors.push('contract_name must equal career-ops.smoke-result');
  if (value.contract_version !== 1) errors.push('contract_version must equal 1');
  if (typeof value.message !== 'string' || value.message.length < 1 || value.message.length > 120) {
    errors.push('message must be a string containing 1 to 120 characters');
  }
  if (typeof value.content_hash !== 'string' || !/^[0-9a-f]{64}$/.test(value.content_hash)) {
    errors.push('content_hash must be a lowercase SHA-256 hex digest');
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: {
      contract_name: 'career-ops.smoke-result',
      contract_version: 1,
      message: value.message,
      content_hash: value.content_hash,
    },
  };
}

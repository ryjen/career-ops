export function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function checkKeys(value, allowed, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key)).sort();
  if (unknown.length) errors.push(`${path} contains unknown fields: ${unknown.join(', ')}`);
  return true;
}

export function checkString(value, path, errors, options = {}) {
  const { nullable = false, min = 1, max = 500, pattern = null, allowed = null } = options;
  if (nullable && value === null) return;
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    errors.push(`${path} must be a string containing ${min} to ${max} characters`);
    return;
  }
  if (pattern && !pattern.test(value)) errors.push(`${path} has an invalid format`);
  if (allowed && !allowed.has(value)) errors.push(`${path} is unsupported`);
}

export function checkNumber(value, path, errors, { nullable = false, min = 0 } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) errors.push(`${path} is invalid`);
}

export function checkStringArray(value, path, errors, { maxItems = 100, maxLength = 500 } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  if (value.length > maxItems) errors.push(`${path} contains too many items`);
  if (value.some((entry) => typeof entry !== 'string' || entry.length < 1 || entry.length > maxLength)) {
    errors.push(`${path} must contain bounded strings`);
  }
  if (new Set(value).size !== value.length) errors.push(`${path} must not contain duplicates`);
}

export function canonicalUtc(value) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value : null;
}

export function canonicalHttpUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

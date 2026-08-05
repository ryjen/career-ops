const INPUT_CONTRACT_NAME = 'career-ops.opportunity-normalization';
const OUTPUT_CONTRACT_NAME = 'career-ops.opportunity-normalization-result';
const CONTRACT_VERSION = 1;
const SCHEMA_VERSION = 1;
const TAXONOMY_ID = 'career-ops.opportunity-taxonomy';
const TAXONOMY_VERSION = 1;
const MAX_SOURCE_BYTES = 131_072;

const SOURCE_TYPES = new Set(['manual', 'job-board', 'referral', 'agency', 'other']);
const SENIORITY_VALUES = new Set(['principal', 'staff', 'lead', 'senior', 'intermediate', 'junior', 'unknown']);
const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low']);
const PERIOD_VALUES = new Set(['annual', 'hourly', 'unknown']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function unknownFields(value, expected) {
  return Object.keys(value).filter((key) => !expected.includes(key)).sort();
}

function validateOptionalString(value, path, errors, { maxLength = 200 } = {}) {
  if (value === undefined) return;
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength) {
    errors.push(`${path} must be a string containing 1 to ${maxLength} characters`);
  }
}

function isCanonicalUtcDateTime(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function isHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/**
 * @param {unknown} input
 * @returns {{valid: true, value: object} | {valid: false, errors: string[]}}
 */
export function validateOpportunityNormalizationInput(input) {
  const errors = [];
  if (!isPlainObject(input)) return { valid: false, errors: ['input must be an object'] };

  const unknown = unknownFields(input, ['contract_name', 'contract_version', 'schema_version', 'source', 'hints', 'taxonomy']);
  if (unknown.length > 0) errors.push(`unknown fields: ${unknown.join(', ')}`);
  if (input.contract_name !== INPUT_CONTRACT_NAME) errors.push(`contract_name must equal ${INPUT_CONTRACT_NAME}`);
  if (input.contract_version !== CONTRACT_VERSION) errors.push(`contract_version must equal ${CONTRACT_VERSION}`);
  if (input.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must equal ${SCHEMA_VERSION}`);

  if (!isPlainObject(input.source)) {
    errors.push('source must be an object');
  } else {
    const sourceUnknown = unknownFields(input.source, ['source_type', 'source_id', 'observed_at', 'canonical_url', 'text']);
    if (sourceUnknown.length > 0) errors.push(`source contains unknown fields: ${sourceUnknown.join(', ')}`);
    if (!SOURCE_TYPES.has(input.source.source_type)) errors.push('source.source_type is unsupported');
    validateOptionalString(input.source.source_id, 'source.source_id', errors);
    if (!isCanonicalUtcDateTime(input.source.observed_at)) {
      errors.push('source.observed_at must be a canonical UTC date-time such as 2026-01-02T03:04:05.000Z');
    }
    if (input.source.canonical_url !== undefined && !isHttpUrl(input.source.canonical_url)) {
      errors.push('source.canonical_url must be an absolute http or https URL without credentials');
    }
    if (typeof input.source.text !== 'string' || input.source.text.length < 1) {
      errors.push('source.text must be a non-empty string');
    } else {
      if (Buffer.byteLength(input.source.text, 'utf8') > MAX_SOURCE_BYTES) {
        errors.push(`source.text exceeds the ${MAX_SOURCE_BYTES}-byte limit`);
      }
      if (input.source.text.includes('\0')) errors.push('source.text must not contain NUL characters');
    }
  }

  if (input.hints !== undefined) {
    if (!isPlainObject(input.hints)) {
      errors.push('hints must be an object');
    } else {
      const hintsUnknown = unknownFields(input.hints, ['company', 'title']);
      if (hintsUnknown.length > 0) errors.push(`hints contains unknown fields: ${hintsUnknown.join(', ')}`);
      validateOptionalString(input.hints.company, 'hints.company', errors);
      validateOptionalString(input.hints.title, 'hints.title', errors);
    }
  }

  if (!isPlainObject(input.taxonomy)) {
    errors.push('taxonomy must be an object');
  } else {
    const taxonomyUnknown = unknownFields(input.taxonomy, ['id', 'version']);
    if (taxonomyUnknown.length > 0) errors.push(`taxonomy contains unknown fields: ${taxonomyUnknown.join(', ')}`);
    if (input.taxonomy.id !== TAXONOMY_ID) errors.push(`taxonomy.id must equal ${TAXONOMY_ID}`);
    if (input.taxonomy.version !== TAXONOMY_VERSION) errors.push(`taxonomy.version must equal ${TAXONOMY_VERSION}`);
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: {
      contract_name: INPUT_CONTRACT_NAME,
      contract_version: CONTRACT_VERSION,
      schema_version: SCHEMA_VERSION,
      source: {
        source_type: input.source.source_type,
        source_id: input.source.source_id ?? null,
        observed_at: input.source.observed_at,
        canonical_url: input.source.canonical_url ?? null,
        text: input.source.text,
      },
      hints: {
        company: input.hints?.company ?? null,
        title: input.hints?.title ?? null,
      },
      taxonomy: {
        id: TAXONOMY_ID,
        version: TAXONOMY_VERSION,
      },
    },
  };
}

function validateNullableString(value, path, errors) {
  if (value !== null && typeof value !== 'string') errors.push(`${path} must be a string or null`);
}

function validateStringArray(value, path, errors) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    errors.push(`${path} must be an array of strings`);
  }
}

/**
 * @param {unknown} output
 * @returns {{valid: true, value: object} | {valid: false, errors: string[]}}
 */
export function validateOpportunityNormalizationOutput(output) {
  const errors = [];
  if (!isPlainObject(output)) return { valid: false, errors: ['output must be an object'] };

  const unknown = unknownFields(output, [
    'contract_name', 'contract_version', 'schema_version', 'status', 'opportunity', 'warnings', 'provenance',
  ]);
  if (unknown.length > 0) errors.push(`unknown fields: ${unknown.join(', ')}`);
  if (output.contract_name !== OUTPUT_CONTRACT_NAME) errors.push(`contract_name must equal ${OUTPUT_CONTRACT_NAME}`);
  if (output.contract_version !== CONTRACT_VERSION) errors.push(`contract_version must equal ${CONTRACT_VERSION}`);
  if (output.schema_version !== SCHEMA_VERSION) errors.push(`schema_version must equal ${SCHEMA_VERSION}`);
  if (!['ok', 'review'].includes(output.status)) errors.push('status must equal ok or review');

  if (!isPlainObject(output.opportunity)) {
    errors.push('opportunity must be an object');
  } else {
    const opportunityUnknown = unknownFields(output.opportunity, ['id', 'observed', 'normalized', 'inferred', 'unresolved']);
    if (opportunityUnknown.length > 0) errors.push(`opportunity contains unknown fields: ${opportunityUnknown.join(', ')}`);
    if (typeof output.opportunity.id !== 'string' || !/^opp_[0-9a-f]{24}$/.test(output.opportunity.id)) {
      errors.push('opportunity.id must be a stable opp_ identifier');
    }

    for (const section of ['observed', 'normalized']) {
      if (!isPlainObject(output.opportunity[section])) errors.push(`opportunity.${section} must be an object`);
    }
    if (isPlainObject(output.opportunity.observed)) {
      const observedUnknown = unknownFields(output.opportunity.observed, ['company', 'title', 'canonical_url']);
      if (observedUnknown.length > 0) errors.push(`opportunity.observed contains unknown fields: ${observedUnknown.join(', ')}`);
      validateNullableString(output.opportunity.observed.company, 'opportunity.observed.company', errors);
      validateNullableString(output.opportunity.observed.title, 'opportunity.observed.title', errors);
      validateNullableString(output.opportunity.observed.canonical_url, 'opportunity.observed.canonical_url', errors);
    }
    if (isPlainObject(output.opportunity.normalized)) {
      const normalizedUnknown = unknownFields(output.opportunity.normalized, ['company', 'title', 'canonical_url', 'requirements']);
      if (normalizedUnknown.length > 0) errors.push(`opportunity.normalized contains unknown fields: ${normalizedUnknown.join(', ')}`);
      validateNullableString(output.opportunity.normalized.company, 'opportunity.normalized.company', errors);
      validateNullableString(output.opportunity.normalized.title, 'opportunity.normalized.title', errors);
      validateNullableString(output.opportunity.normalized.canonical_url, 'opportunity.normalized.canonical_url', errors);
      validateStringArray(output.opportunity.normalized.requirements, 'opportunity.normalized.requirements', errors);
    }

    if (!isPlainObject(output.opportunity.inferred)) {
      errors.push('opportunity.inferred must be an object');
    } else {
      const inferredUnknown = unknownFields(output.opportunity.inferred, ['location', 'compensation', 'seniority', 'domains']);
      if (inferredUnknown.length > 0) errors.push(`opportunity.inferred contains unknown fields: ${inferredUnknown.join(', ')}`);
      const location = output.opportunity.inferred.location;
      if (!isPlainObject(location)
        || typeof location.remote !== 'boolean'
        || typeof location.hybrid !== 'boolean'
        || typeof location.onsite !== 'boolean') {
        errors.push('opportunity.inferred.location is invalid');
      } else {
        validateStringArray(location.evidence, 'opportunity.inferred.location.evidence', errors);
      }

      const compensation = output.opportunity.inferred.compensation;
      if (!isPlainObject(compensation) || !PERIOD_VALUES.has(compensation.period)) {
        errors.push('opportunity.inferred.compensation is invalid');
      }

      const seniority = output.opportunity.inferred.seniority;
      if (!isPlainObject(seniority)
        || !SENIORITY_VALUES.has(seniority.value)
        || !CONFIDENCE_VALUES.has(seniority.confidence)) {
        errors.push('opportunity.inferred.seniority is invalid');
      } else {
        validateStringArray(seniority.evidence, 'opportunity.inferred.seniority.evidence', errors);
      }

      if (!Array.isArray(output.opportunity.inferred.domains)) {
        errors.push('opportunity.inferred.domains must be an array');
      } else {
        output.opportunity.inferred.domains.forEach((domain, index) => {
          if (!isPlainObject(domain) || typeof domain.value !== 'string' || !CONFIDENCE_VALUES.has(domain.confidence)) {
            errors.push(`opportunity.inferred.domains[${index}] is invalid`);
          } else {
            validateStringArray(domain.evidence, `opportunity.inferred.domains[${index}].evidence`, errors);
          }
        });
      }
    }

    if (!Array.isArray(output.opportunity.unresolved)) {
      errors.push('opportunity.unresolved must be an array');
    } else {
      output.opportunity.unresolved.forEach((entry, index) => {
        if (!isPlainObject(entry) || typeof entry.field !== 'string' || typeof entry.reason !== 'string') {
          errors.push(`opportunity.unresolved[${index}] is invalid`);
        }
      });
    }
  }

  if (!Array.isArray(output.warnings)) {
    errors.push('warnings must be an array');
  } else {
    output.warnings.forEach((warning, index) => {
      if (!isPlainObject(warning) || typeof warning.code !== 'string' || typeof warning.message !== 'string') {
        errors.push(`warnings[${index}] is invalid`);
      }
    });
  }

  if (!isPlainObject(output.provenance)
    || typeof output.provenance.content_sha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(output.provenance.content_sha256)) {
    errors.push('provenance is invalid');
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, value: output };
}

export const opportunityNormalizationContract = Object.freeze({
  inputContractName: INPUT_CONTRACT_NAME,
  outputContractName: OUTPUT_CONTRACT_NAME,
  contractVersion: CONTRACT_VERSION,
  schemaVersion: SCHEMA_VERSION,
  taxonomyId: TAXONOMY_ID,
  taxonomyVersion: TAXONOMY_VERSION,
  maxSourceBytes: MAX_SOURCE_BYTES,
});

import {
  canonicalHttpUrl,
  canonicalUtc,
  checkKeys,
  checkNumber,
  checkString,
  checkStringArray,
} from './validation.js';

const INPUT = 'career-ops.opportunity-normalization';
const OUTPUT = 'career-ops.opportunity-normalization-result';
const VERSION = 1;
const TAXONOMY = 'career-ops.opportunity-taxonomy';
const MAX_BYTES = 131_072;
const SOURCES = new Set(['manual', 'job-board', 'referral', 'agency', 'other']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const PERIODS = new Set(['annual', 'hourly', 'unknown']);
const SENIORITY = new Set(['principal', 'staff', 'lead', 'senior', 'intermediate', 'junior', 'unknown']);
const DOMAINS = new Set(['ai', 'backend', 'data', 'frontend', 'infrastructure', 'mobile', 'platform', 'quality', 'security']);

function valid(errors, value) {
  return errors.length ? { valid: false, errors } : { valid: true, value };
}

function inference(value, path, errors, allowed) {
  if (!checkKeys(value, ['value', 'confidence', 'evidence', 'rule_id'], path, errors)) return;
  checkString(value.value, `${path}.value`, errors, { max: 100, allowed });
  checkString(value.confidence, `${path}.confidence`, errors, { max: 20, allowed: CONFIDENCE });
  checkStringArray(value.evidence, `${path}.evidence`, errors, { maxLength: 200 });
  checkString(value.rule_id, `${path}.rule_id`, errors, { max: 100 });
}

export function validateOpportunityNormalizationInput(input) {
  const errors = [];
  if (!checkKeys(input, ['contract_name', 'contract_version', 'schema_version', 'source', 'hints', 'taxonomy'], 'input', errors)) {
    return { valid: false, errors };
  }
  if (input.contract_name !== INPUT) errors.push(`contract_name must equal ${INPUT}`);
  if (input.contract_version !== VERSION) errors.push(`contract_version must equal ${VERSION}`);
  if (input.schema_version !== VERSION) errors.push(`schema_version must equal ${VERSION}`);

  if (checkKeys(input.source, ['source_type', 'source_id', 'observed_at', 'canonical_url', 'text'], 'source', errors)) {
    checkString(input.source.source_type, 'source.source_type', errors, { max: 20, allowed: SOURCES });
    if (input.source.source_id !== undefined) checkString(input.source.source_id, 'source.source_id', errors, { max: 200 });
    if (!canonicalUtc(input.source.observed_at)) errors.push('source.observed_at must be a canonical UTC date-time');
    if (input.source.canonical_url !== undefined && !canonicalHttpUrl(input.source.canonical_url)) {
      errors.push('source.canonical_url must be an absolute http or https URL without credentials');
    }
    checkString(input.source.text, 'source.text', errors, { max: MAX_BYTES });
    if (typeof input.source.text === 'string') {
      if (Buffer.byteLength(input.source.text, 'utf8') > MAX_BYTES) errors.push(`source.text exceeds the ${MAX_BYTES}-byte limit`);
      if (input.source.text.includes('\0')) errors.push('source.text must not contain NUL characters');
    }
  }

  if (input.hints !== undefined && checkKeys(input.hints, ['company', 'title'], 'hints', errors)) {
    if (input.hints.company !== undefined) checkString(input.hints.company, 'hints.company', errors, { max: 200 });
    if (input.hints.title !== undefined) checkString(input.hints.title, 'hints.title', errors, { max: 200 });
  }
  if (checkKeys(input.taxonomy, ['id', 'version'], 'taxonomy', errors)) {
    if (input.taxonomy.id !== TAXONOMY) errors.push(`taxonomy.id must equal ${TAXONOMY}`);
    if (input.taxonomy.version !== VERSION) errors.push(`taxonomy.version must equal ${VERSION}`);
  }
  return valid(errors, {
    contract_name: INPUT,
    contract_version: VERSION,
    schema_version: VERSION,
    source: {
      source_type: input.source?.source_type,
      source_id: input.source?.source_id ?? null,
      observed_at: input.source?.observed_at,
      canonical_url: input.source?.canonical_url === undefined ? null : canonicalHttpUrl(input.source.canonical_url),
      text: input.source?.text,
    },
    hints: { company: input.hints?.company ?? null, title: input.hints?.title ?? null },
    taxonomy: { id: TAXONOMY, version: VERSION },
  });
}

export function validateOpportunityNormalizationOutput(output) {
  const errors = [];
  if (!checkKeys(output, ['contract_name', 'contract_version', 'schema_version', 'status', 'opportunity', 'warnings', 'provenance'], 'output', errors)) {
    return { valid: false, errors };
  }
  if (output.contract_name !== OUTPUT) errors.push(`contract_name must equal ${OUTPUT}`);
  if (output.contract_version !== VERSION) errors.push(`contract_version must equal ${VERSION}`);
  if (output.schema_version !== VERSION) errors.push(`schema_version must equal ${VERSION}`);
  if (!['ok', 'review'].includes(output.status)) errors.push('status must equal ok or review');

  const opportunity = output.opportunity;
  if (checkKeys(opportunity, ['id', 'observed', 'normalized', 'inferred', 'unresolved'], 'opportunity', errors)) {
    checkString(opportunity.id, 'opportunity.id', errors, { max: 28, pattern: /^opp_[0-9a-f]{24}$/ });
    if (checkKeys(opportunity.observed, ['company', 'title', 'canonical_url'], 'opportunity.observed', errors)) {
      for (const key of ['company', 'title']) checkString(opportunity.observed[key], `opportunity.observed.${key}`, errors, { nullable: true, max: 200 });
      checkString(opportunity.observed.canonical_url, 'opportunity.observed.canonical_url', errors, { nullable: true, max: 2048 });
      if (opportunity.observed.canonical_url !== null && canonicalHttpUrl(opportunity.observed.canonical_url) !== opportunity.observed.canonical_url) {
        errors.push('opportunity.observed.canonical_url must be canonical');
      }
    }
    if (checkKeys(opportunity.normalized, ['company', 'title', 'canonical_url', 'requirements'], 'opportunity.normalized', errors)) {
      for (const key of ['company', 'title']) checkString(opportunity.normalized[key], `opportunity.normalized.${key}`, errors, { nullable: true, max: 200 });
      checkString(opportunity.normalized.canonical_url, 'opportunity.normalized.canonical_url', errors, { nullable: true, max: 2048 });
      if (opportunity.normalized.canonical_url !== null && canonicalHttpUrl(opportunity.normalized.canonical_url) !== opportunity.normalized.canonical_url) {
        errors.push('opportunity.normalized.canonical_url must be canonical');
      }
      checkStringArray(opportunity.normalized.requirements, 'opportunity.normalized.requirements', errors, { maxItems: 30 });
    }

    const inferred = opportunity.inferred;
    if (checkKeys(inferred, ['location', 'compensation', 'seniority', 'domains'], 'opportunity.inferred', errors)) {
      if (checkKeys(inferred.location, ['remote', 'hybrid', 'onsite', 'evidence'], 'opportunity.inferred.location', errors)) {
        for (const key of ['remote', 'hybrid', 'onsite']) if (typeof inferred.location[key] !== 'boolean') errors.push(`opportunity.inferred.location.${key} must be boolean`);
        checkStringArray(inferred.location.evidence, 'opportunity.inferred.location.evidence', errors, { maxLength: 200 });
      }
      if (checkKeys(inferred.compensation, ['currency', 'min', 'max', 'period', 'confidence', 'evidence', 'rule_id'], 'opportunity.inferred.compensation', errors)) {
        checkString(inferred.compensation.currency, 'opportunity.inferred.compensation.currency', errors, { nullable: true, max: 3, pattern: /^[A-Z]{3}$/ });
        checkNumber(inferred.compensation.min, 'opportunity.inferred.compensation.min', errors, { nullable: true });
        checkNumber(inferred.compensation.max, 'opportunity.inferred.compensation.max', errors, { nullable: true });
        checkString(inferred.compensation.period, 'opportunity.inferred.compensation.period', errors, { max: 20, allowed: PERIODS });
        checkString(inferred.compensation.confidence, 'opportunity.inferred.compensation.confidence', errors, { max: 20, allowed: CONFIDENCE });
        checkStringArray(inferred.compensation.evidence, 'opportunity.inferred.compensation.evidence', errors, { maxItems: 20, maxLength: 200 });
        checkString(inferred.compensation.rule_id, 'opportunity.inferred.compensation.rule_id', errors, { max: 100 });
      }
      inference(inferred.seniority, 'opportunity.inferred.seniority', errors, SENIORITY);
      if (!Array.isArray(inferred.domains)) errors.push('opportunity.inferred.domains must be an array');
      else {
        inferred.domains.forEach((entry, index) => inference(entry, `opportunity.inferred.domains[${index}]`, errors, DOMAINS));
        if (new Set(inferred.domains.map((entry) => entry?.value)).size !== inferred.domains.length) errors.push('opportunity.inferred.domains must not contain duplicates');
      }
    }

    if (!Array.isArray(opportunity.unresolved)) errors.push('opportunity.unresolved must be an array');
    else opportunity.unresolved.forEach((entry, index) => {
      const path = `opportunity.unresolved[${index}]`;
      if (checkKeys(entry, ['field', 'reason'], path, errors)) {
        checkString(entry.field, `${path}.field`, errors, { max: 100 });
        checkString(entry.reason, `${path}.reason`, errors, { max: 500 });
      }
    });
  }

  if (!Array.isArray(output.warnings)) errors.push('warnings must be an array');
  else output.warnings.forEach((entry, index) => {
    const path = `warnings[${index}]`;
    if (checkKeys(entry, ['code', 'message', 'path'], path, errors)) {
      for (const key of ['code', 'message', 'path']) checkString(entry[key], `${path}.${key}`, errors, { max: 500 });
    }
  });

  const provenance = output.provenance;
  if (checkKeys(provenance, ['source_type', 'source_id', 'observed_at', 'content_sha256', 'implementation', 'taxonomy'], 'provenance', errors)) {
    checkString(provenance.source_type, 'provenance.source_type', errors, { max: 20, allowed: SOURCES });
    checkString(provenance.source_id, 'provenance.source_id', errors, { nullable: true, max: 200 });
    if (!canonicalUtc(provenance.observed_at)) errors.push('provenance.observed_at must be canonical UTC');
    checkString(provenance.content_sha256, 'provenance.content_sha256', errors, { max: 64, pattern: /^[0-9a-f]{64}$/ });
    if (checkKeys(provenance.implementation, ['id', 'version'], 'provenance.implementation', errors)) {
      if (provenance.implementation.id !== INPUT || provenance.implementation.version !== VERSION) errors.push('provenance.implementation is invalid');
    }
    if (checkKeys(provenance.taxonomy, ['id', 'version'], 'provenance.taxonomy', errors)) {
      if (provenance.taxonomy.id !== TAXONOMY || provenance.taxonomy.version !== VERSION) errors.push('provenance.taxonomy is invalid');
    }
  }

  const expectedStatus = (opportunity?.unresolved?.length || output.warnings?.length) ? 'review' : 'ok';
  if (['ok', 'review'].includes(output.status) && output.status !== expectedStatus) errors.push(`status must equal ${expectedStatus}`);
  return valid(errors, output);
}

export const opportunityNormalizationContract = Object.freeze({
  inputContractName: INPUT,
  outputContractName: OUTPUT,
  contractVersion: VERSION,
  schemaVersion: VERSION,
  taxonomyId: TAXONOMY,
  taxonomyVersion: VERSION,
  maxSourceBytes: MAX_BYTES,
});

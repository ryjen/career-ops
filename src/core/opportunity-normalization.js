import { createHash } from 'node:crypto';
import {
  opportunityNormalizationContract,
  validateOpportunityNormalizationInput,
  validateOpportunityNormalizationOutput,
} from '../contracts/opportunity-normalization.js';

const DOMAIN_RULES = Object.freeze([
  ['ai', ['artificial intelligence', 'machine learning', 'llm', 'generative ai', 'ai']],
  ['backend', ['backend', 'api', 'service', 'microservice', 'server']],
  ['data', ['database', 'sql', 'analytics', 'data pipeline', 'warehouse']],
  ['frontend', ['frontend', 'front-end', 'web ui', 'browser', 'react']],
  ['infrastructure', ['infrastructure', 'cloud', 'kubernetes', 'container', 'observability', 'sre']],
  ['mobile', ['mobile', 'android', 'ios', 'kotlin', 'swift']],
  ['platform', ['platform', 'developer experience', 'devex', 'internal tooling']],
  ['quality', ['quality', 'test automation', 'testing', 'qa']],
  ['security', ['security', 'authentication', 'authorization', 'oauth', 'threat model']],
]);

const REQUIREMENT_KEYWORDS = [
  'architect', 'backend', 'build', 'cloud', 'data', 'design', 'develop', 'experience', 'frontend',
  'infrastructure', 'lead', 'mobile', 'platform', 'reliability', 'security', 'test',
];

function contractError(message, code) {
  const error = new TypeError(message);
  error.code = code;
  return error;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeText(value) {
  const lines = value.normalize('NFC').replace(/\r\n?/g, '\n').split('\n').map((line) => line.trimEnd());
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === '') lines.pop();
  return lines.join('\n');
}

function normalizeLabel(value) {
  if (value === null) return null;
  const normalized = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function extractPrefixedLine(text, prefix) {
  const matcher = new RegExp(`^${prefix}\\s*:\\s*(.+)$`, 'i');
  for (const line of text.split('\n')) {
    const match = line.trim().match(matcher);
    if (match) return normalizeLabel(match[1]);
  }
  return null;
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s<>{}\[\]"']+/i);
  if (!match) return null;
  const candidate = match[0].replace(/[),.;:!?]+$/, '');
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function lineEvidence(text, matcher, token) {
  const evidence = [];
  text.split('\n').forEach((line, index) => {
    if (matcher.test(line)) evidence.push(`source.text:line:${index + 1}:${token}`);
    matcher.lastIndex = 0;
  });
  return evidence;
}

function inferLocation(text) {
  const rules = [
    ['remote', /\bremote\b/gi],
    ['hybrid', /\bhybrid\b/gi],
    ['onsite', /\b(?:on[- ]?site|in[- ]office)\b/gi],
  ];
  const result = { remote: false, hybrid: false, onsite: false, evidence: [] };
  for (const [name, matcher] of rules) {
    const evidence = lineEvidence(text, matcher, name);
    result[name] = evidence.length > 0;
    result.evidence.push(...evidence);
  }
  result.evidence.sort();
  return result;
}

function numericAmount(value, suffix) {
  const amount = Number(value.replace(/,/g, ''));
  return suffix ? amount * 1000 : amount;
}

function inferCompensation(text) {
  const matcher = /(?:(CAD|USD)\s*)?(\$)?\s*([0-9][0-9,]*(?:\.\d+)?)\s*([kK])?\s*(?:-|–|to)\s*(?:(CAD|USD)\s*)?(\$)?\s*([0-9][0-9,]*(?:\.\d+)?)\s*([kK])?\s*(CAD|USD)?\s*(?:\/|per\s+)?(year|annum|annual|hour|hr)?/i;
  const match = text.match(matcher);
  if (!match) {
    return {
      currency: null,
      min: null,
      max: null,
      period: 'unknown',
      confidence: 'low',
      evidence: [],
      rule_id: 'compensation-range-v1',
    };
  }

  const explicitCurrencies = [match[1], match[5], match[9]].filter(Boolean).map((value) => value.toUpperCase());
  const uniqueCurrencies = [...new Set(explicitCurrencies)];
  const periodToken = match[10]?.toLowerCase();
  return {
    currency: uniqueCurrencies.length === 1 ? uniqueCurrencies[0] : null,
    min: numericAmount(match[3], match[4]),
    max: numericAmount(match[7], match[8]),
    period: ['hour', 'hr'].includes(periodToken) ? 'hourly' : ['year', 'annum', 'annual'].includes(periodToken) ? 'annual' : 'unknown',
    confidence: uniqueCurrencies.length === 1 && periodToken ? 'high' : 'medium',
    evidence: ['source.text:compensation-range'],
    rule_id: 'compensation-range-v1',
  };
}

function inferSeniority(title, text) {
  const rules = [
    ['principal', /\bprincipal\b/i],
    ['staff', /\bstaff\b/i],
    ['lead', /\blead\b/i],
    ['senior', /\b(?:senior|sr\.)\b/i],
    ['intermediate', /\bintermediate\b/i],
    ['junior', /\b(?:junior|jr\.)\b/i],
  ];
  for (const [value, matcher] of rules) {
    if (title && matcher.test(title)) {
      return { value, confidence: 'high', evidence: [`normalized.title:${value}`], rule_id: 'seniority-title-v1' };
    }
  }
  for (const [value, matcher] of rules) {
    const evidence = lineEvidence(text, new RegExp(matcher.source, 'gi'), value);
    if (evidence.length > 0) {
      return { value, confidence: 'medium', evidence, rule_id: 'seniority-source-v1' };
    }
  }
  return { value: 'unknown', confidence: 'low', evidence: [], rule_id: 'seniority-none-v1' };
}

function inferDomains(text) {
  const domains = [];
  for (const [value, keywords] of DOMAIN_RULES) {
    const evidence = [];
    for (const keyword of keywords) {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '\\s+');
      const matcher = new RegExp(`\\b${escaped}\\b`, 'gi');
      evidence.push(...lineEvidence(text, matcher, keyword.replace(/\s+/g, '-')));
    }
    const uniqueEvidence = [...new Set(evidence)].sort();
    if (uniqueEvidence.length > 0) {
      domains.push({
        value,
        confidence: uniqueEvidence.length >= 2 ? 'high' : 'medium',
        evidence: uniqueEvidence,
        rule_id: `domain-${value}-v1`,
      });
    }
  }
  return domains.sort((left, right) => left.value.localeCompare(right.value));
}

function collectRequirements(text) {
  const requirements = [];
  let truncated = false;
  text.split('\n').forEach((sourceLine) => {
    const trimmed = sourceLine.trim();
    if (!trimmed || /^(?:company|title|url)\s*:/i.test(trimmed)) return;
    const bullet = /^[-*•]\s+/.test(trimmed);
    const normalized = trimmed.replace(/^[-*•]\s+/, '').replace(/\s+/g, ' ').trim();
    const lower = normalized.toLowerCase();
    const keywordMatch = REQUIREMENT_KEYWORDS.some((keyword) => lower.includes(keyword));
    if (!bullet && !keywordMatch) return;
    if (requirements.includes(normalized)) return;
    if (requirements.length >= 30) {
      truncated = true;
      return;
    }
    requirements.push(normalized.slice(0, 500));
  });
  return { requirements, truncated };
}

function addUnresolved(unresolved, field, reason) {
  unresolved.push({ field, reason });
}

/**
 * Deterministically normalize an explicit opportunity source.
 *
 * @param {unknown} input
 * @returns {object}
 */
export function normalizeOpportunity(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    if (input.contract_name === opportunityNormalizationContract.inputContractName
      && (input.contract_version !== 1 || input.schema_version !== 1)) {
      throw contractError('unsupported opportunity-normalization contract or schema version', 'ERR_CONTRACT_VERSION');
    }
  }

  const validation = validateOpportunityNormalizationInput(input);
  if (!validation.valid) {
    const boundsFailure = validation.errors.some((message) => message.includes('byte limit'));
    throw contractError(
      `invalid opportunity-normalization input: ${validation.errors.join('; ')}`,
      boundsFailure ? 'ERR_INPUT_BOUNDS' : 'ERR_CONTRACT_VALIDATION',
    );
  }

  const value = validation.value;
  const text = normalizeText(value.source.text);
  const contentSha256 = sha256(text);
  const observed = {
    company: normalizeLabel(value.hints.company),
    title: normalizeLabel(value.hints.title),
    canonical_url: value.source.canonical_url,
  };
  const normalized = {
    company: observed.company ?? extractPrefixedLine(text, 'Company'),
    title: observed.title ?? extractPrefixedLine(text, 'Title'),
    canonical_url: observed.canonical_url ?? extractUrl(text),
    requirements: [],
  };

  const warnings = [];
  const unresolved = [];
  if (!normalized.company) addUnresolved(unresolved, 'company', 'No explicit hint or Company: source line was supplied.');
  if (!normalized.title) addUnresolved(unresolved, 'title', 'No explicit hint or Title: source line was supplied.');
  if (!normalized.canonical_url) addUnresolved(unresolved, 'canonical_url', 'No explicit or source-text http/https URL was found.');

  const location = inferLocation(text);
  const activeLocationSignals = ['remote', 'hybrid', 'onsite'].filter((key) => location[key]);
  if (activeLocationSignals.length > 1) {
    warnings.push({
      code: 'CONFLICTING_LOCATION_SIGNALS',
      message: 'The source contains multiple location-mode signals and requires review.',
      path: 'opportunity.inferred.location',
    });
  }

  const compensation = inferCompensation(text);
  if (compensation.min !== null && compensation.currency === null) {
    addUnresolved(unresolved, 'compensation.currency', 'A compensation range was found without one unambiguous currency.');
  }
  if (compensation.min !== null && compensation.period === 'unknown') {
    addUnresolved(unresolved, 'compensation.period', 'A compensation range was found without an annual or hourly period.');
  }

  const collected = collectRequirements(text);
  normalized.requirements = collected.requirements;
  if (collected.truncated) {
    warnings.push({
      code: 'REQUIREMENTS_TRUNCATED',
      message: 'More than 30 requirement candidates were found; only the first 30 are retained.',
      path: 'opportunity.normalized.requirements',
    });
  }

  const seniority = inferSeniority(normalized.title, text);
  if (seniority.value === 'unknown') addUnresolved(unresolved, 'seniority', 'No supported seniority signal was found.');

  unresolved.sort((left, right) => left.field.localeCompare(right.field));
  warnings.sort((left, right) => left.code.localeCompare(right.code));

  const identityPayload = {
    company: normalized.company,
    title: normalized.title,
    canonical_url: normalized.canonical_url,
    source_id: value.source.source_id,
    content_sha256: contentSha256,
  };

  const output = {
    contract_name: opportunityNormalizationContract.outputContractName,
    contract_version: opportunityNormalizationContract.contractVersion,
    schema_version: opportunityNormalizationContract.schemaVersion,
    status: unresolved.length > 0 || warnings.length > 0 ? 'review' : 'ok',
    opportunity: {
      id: `opp_${sha256(canonicalJson(identityPayload)).slice(0, 24)}`,
      observed,
      normalized,
      inferred: {
        location,
        compensation,
        seniority,
        domains: inferDomains(text),
      },
      unresolved,
    },
    warnings,
    provenance: {
      source_type: value.source.source_type,
      source_id: value.source.source_id,
      observed_at: value.source.observed_at,
      content_sha256: contentSha256,
      implementation: {
        id: 'career-ops.opportunity-normalization',
        version: 1,
      },
      taxonomy: value.taxonomy,
    },
  };

  const outputValidation = validateOpportunityNormalizationOutput(output);
  if (!outputValidation.valid) {
    throw contractError(`internal output contract failure: ${outputValidation.errors.join('; ')}`, 'ERR_INTERNAL_CONTRACT');
  }
  return output;
}

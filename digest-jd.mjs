#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, extname, isAbsolute, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));

const KEYWORD_TERMS = [
  'AI',
  'LLM',
  'agent',
  'agentic',
  'LangGraph',
  'RAG',
  'Python',
  'TypeScript',
  'JavaScript',
  'React',
  'React Native',
  'Node',
  'Java',
  'Kotlin',
  'Go',
  'AWS',
  'GCP',
  'Azure',
  'Docker',
  'Kubernetes',
  'Terraform',
  'SQL',
  'PostgreSQL',
  'MySQL',
  'NoSQL',
  'API',
  'REST',
  'GraphQL',
  'OAuth',
  'OIDC',
  'security',
  'AppSec',
  'CI/CD',
  'observability',
  'telemetry',
  'mobile',
  'backend',
  'full-stack',
  'platform',
  'architecture',
  'stakeholder',
  'healthcare',
  'financial',
];

function usage() {
  console.error('Usage: node digest-jd.mjs <jd-file> [output-file]');
  process.exit(1);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactLine(line) {
  return line.replace(/\s+/g, ' ').replace(/^[-*]\s*/, '').trim();
}

function detectKeywords(text) {
  const lower = text.toLowerCase();
  return KEYWORD_TERMS.filter((term) => {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}([^a-z0-9]|$)`);
    return pattern.test(lower);
  });
}

function extractLines(lines, patterns, limit = 12) {
  const seen = new Set();
  const results = [];
  for (const line of lines) {
    const text = compactLine(line.text);
    if (!text || text.length < 8) continue;
    if (!patterns.some((pattern) => pattern.test(text))) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ line: line.line, text });
    if (results.length >= limit) break;
  }
  return results;
}

function detectArchetype(text) {
  const lower = text.toLowerCase();
  const scores = [
    {
      archetype: 'AI Platform / LLMOps',
      terms: ['observability', 'eval', 'pipeline', 'monitoring', 'reliability', 'llmops'],
    },
    {
      archetype: 'Agentic / Automation',
      terms: ['agent', 'agentic', 'workflow', 'orchestration', 'human-in-the-loop', 'hitl', 'tool use'],
    },
    {
      archetype: 'Technical AI PM',
      terms: ['prd', 'roadmap', 'discovery', 'stakeholder', 'product manager'],
    },
    {
      archetype: 'AI Solutions Architect',
      terms: ['architecture', 'enterprise', 'integration', 'solution design', 'systems'],
    },
    {
      archetype: 'AI Forward Deployed',
      terms: ['client-facing', 'demo', 'rollout', 'prototype', 'field', 'customer'],
    },
    {
      archetype: 'AI Transformation',
      terms: ['change management', 'adoption', 'enablement', 'transformation'],
    },
  ].map((entry) => ({
    archetype: entry.archetype,
    score: entry.terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0),
  }));

  return scores
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.archetype);
}

function detectRole(lines) {
  const explicitRole = lines
    .map((line) => line.text.match(/^(role|title|position)\s*:\s*(.+)$/i))
    .find(Boolean);
  if (explicitRole) return compactLine(explicitRole[2]);

  const candidate = lines
    .slice(0, 12)
    .map((line) => compactLine(line.text).replace(/^#+\s*/, ''))
    .find((line) => /engineer|developer|architect|manager|director|lead|specialist/i.test(line));
  return candidate || null;
}

function detectCompany(lines) {
  const explicitCompany = lines
    .map((line) => line.text.match(/^(company|employer)\s*:\s*(.+)$/i))
    .find(Boolean);
  if (explicitCompany) return compactLine(explicitCompany[2]);

  const aboutIndex = lines.findIndex((line) => /^about\s+/i.test(compactLine(line.text)));
  if (aboutIndex >= 0) {
    return compactLine(lines[aboutIndex].text).replace(/^about\s+/i, '') || null;
  }
  return null;
}

function main() {
  const [input, outputArg] = process.argv.slice(2);
  if (!input) usage();

  const inputPath = input === '-' ? '-' : join(ROOT, input);
  if (inputPath !== '-' && !existsSync(inputPath)) {
    console.error(`JD file not found: ${input}`);
    process.exit(1);
  }

  const raw = inputPath === '-' ? readFileSync(0, 'utf8') : readFileSync(inputPath, 'utf8');
  const lines = raw.split(/\r?\n/).map((text, index) => ({ line: index + 1, text }));
  const compactText = raw.replace(/\s+/g, ' ').trim();
  const payRange = compactText.match(/(?:CA\$|C\$|\$)\s?\d{2,3}(?:,\d{3})?\s?(?:-|to|–)\s?(?:CA\$|C\$|\$)?\s?\d{2,3}(?:,\d{3})?/i);

  const digest = {
    generated_at: today(),
    source: input === '-' ? 'stdin' : input,
    role: detectRole(lines),
    company: detectCompany(lines),
    archetypes: detectArchetype(compactText),
    remote_signal: /remote/i.test(compactText)
      ? 'remote mentioned'
      : /hybrid/i.test(compactText)
        ? 'hybrid mentioned'
        : /onsite|on-site/i.test(compactText)
          ? 'onsite mentioned'
          : 'not specified',
    compensation: payRange ? payRange[0].replace(/\s+/g, ' ') : null,
    keywords: detectKeywords(compactText),
    requirements: extractLines(
      lines,
      [/required/i, /requirements/i, /experience/i, /proficient/i, /strong/i, /must/i, /responsibilities/i],
      14,
    ),
    nice_to_have: extractLines(lines, [/nice to have/i, /preferred/i, /bonus/i, /asset/i, /plus/i], 8),
    constraints: extractLines(lines, [/remote/i, /hybrid/i, /onsite/i, /visa/i, /sponsor/i, /timezone/i, /salary/i], 8),
  };

  const output = outputArg
    ? isAbsolute(outputArg)
      ? outputArg
      : join(ROOT, outputArg)
    : inputPath === '-'
      ? join(ROOT, 'jds/stdin.digest.yml')
      : inputPath.replace(new RegExp(`${escapeRegExp(extname(inputPath))}$`), '.digest.yml');

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, yaml.dump(digest, { lineWidth: 120, noRefs: true }), 'utf8');
  console.log(`Wrote ${output}`);
}

main();

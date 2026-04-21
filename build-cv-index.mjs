#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CV_PATH = join(ROOT, 'cv.md');
const OUT_PATH = join(ROOT, 'data/cv-index.yml');

const TECHNOLOGY_TERMS = [
  'Java',
  'Kotlin',
  'Python',
  'TypeScript',
  'JavaScript',
  'Go',
  'C/C++',
  'AWS',
  'Azure',
  'Docker',
  'Terraform',
  'GitHub Actions',
  'Linux',
  'React Native',
  'Expo',
  'Swift',
  'NestJS',
  'PostgreSQL',
  'MySQL',
  'SQLite',
  'Tomcat',
  'Servlets',
  'Tor',
  'OAuth2/OIDC',
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitHeading(value) {
  const parts = value.split(/\s+-\s+|\s+--\s+|\s+—\s+/);
  if (parts.length < 2) return { title: value.trim(), company: null };
  return {
    title: parts.slice(0, -1).join(' - ').trim(),
    company: parts[parts.length - 1].trim(),
  };
}

function sectionBounds(lines, heading) {
  const start = lines.findIndex((line) => line.text.trim() === heading);
  if (start === -1) return null;
  const next = lines.findIndex(
    (line, index) => index > start && /^##\s+/.test(line.text),
  );
  return { start, end: next === -1 ? lines.length : next };
}

function parseExperience(lines) {
  const bounds = sectionBounds(lines, '## Experience');
  if (!bounds) return [];

  const roles = [];
  let current = null;
  let subsection = null;

  for (const line of lines.slice(bounds.start + 1, bounds.end)) {
    const text = line.text.trim();
    const roleMatch = text.match(/^###\s+(.+)$/);
    if (roleMatch) {
      if (current) roles.push(current);
      const parsed = splitHeading(roleMatch[1]);
      current = {
        title: parsed.title,
        company: parsed.company,
        line: line.number,
        period: null,
        summary: null,
        highlights: [],
        technologies: [],
      };
      subsection = null;
      continue;
    }

    if (!current || !text) continue;

    if (!current.period && !text.startsWith('- ') && !text.startsWith('**')) {
      current.period = text;
      continue;
    }

    if (!current.summary && !text.startsWith('- ') && !text.startsWith('**')) {
      current.summary = { line: line.number, text };
      continue;
    }

    const subsectionMatch = text.match(/^\*\*(.+)\*\*$/);
    if (subsectionMatch) {
      subsection = subsectionMatch[1];
      continue;
    }

    if (text.startsWith('- ')) {
      current.highlights.push({
        line: line.number,
        area: subsection,
        text: text.slice(2).replace(/\.$/, ''),
      });
      continue;
    }

    if (text.startsWith('Technologies:')) {
      current.technologies = text
        .replace(/^Technologies:\s*/, '')
        .replace(/\.$/, '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (current) roles.push(current);
  return roles;
}

function parseBullets(lines, heading) {
  const bounds = sectionBounds(lines, heading);
  if (!bounds) return [];
  return lines
    .slice(bounds.start + 1, bounds.end)
    .map((line) => ({ line: line.number, text: line.text.trim() }))
    .filter((line) => line.text.startsWith('- '))
    .map((line) => {
      const text = line.text.slice(2);
      const label = text.match(/^\*\*(.+?):\*\*\s*(.+)$/);
      return label
        ? { line: line.line, name: label[1], text: label[2].replace(/\.$/, '') }
        : { line: line.line, text: text.replace(/\.$/, '') };
    });
}

function detectTechnologies(text) {
  return TECHNOLOGY_TERMS.filter((term) => {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}([^a-z0-9]|$)`);
    return pattern.test(text.toLowerCase());
  });
}

function main() {
  const raw = readFileSync(CV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).map((text, index) => ({
    number: index + 1,
    text,
  }));

  const nameLine = lines.find((line) => /^#\s+/.test(line.text));
  const headlineLine = lines.find((line) => /^##\s+/.test(line.text));
  const contactLine = lines.find((line) => line.number > 1 && line.text.includes('|'));

  const summaryStart = lines.findIndex((line) => /^Strategic axes:/i.test(line.text));
  const experienceStart = lines.findIndex((line) => line.text.trim() === '## Experience');
  const summaryLines = summaryStart >= 0 && experienceStart > summaryStart
    ? lines
        .slice(summaryStart, experienceStart)
        .filter((line) => line.text.trim())
        .map((line) => ({ line: line.number, text: line.text.trim() }))
    : [];

  const index = {
    generated_at: today(),
    source: 'cv.md',
    candidate: {
      name: nameLine ? nameLine.text.replace(/^#\s+/, '').trim() : null,
      headline: headlineLine ? headlineLine.text.replace(/^##\s+/, '').trim() : null,
      contact: contactLine ? contactLine.text.trim() : null,
    },
    summary: summaryLines,
    roles: parseExperience(lines),
    projects: parseBullets(lines, '## Projects'),
    education_certifications: parseBullets(lines, '## Education & Certifications'),
    strengths: parseBullets(lines, '## Selected Strengths'),
    technologies: detectTechnologies(raw),
    line_refs: {
      summary: summaryLines.map((line) => line.line),
      experience_start: experienceStart >= 0 ? experienceStart + 1 : null,
    },
  };

  writeFileSync(OUT_PATH, yaml.dump(index, { lineWidth: 120, noRefs: true }), 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
}

main();

#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(ROOT, 'reports');
const OUT_PATH = join(REPORTS_DIR, 'index.tsv');

function field(text, name) {
  const pattern = new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+)$`, 'im');
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

function splitTitle(text) {
  const match = text.match(/^#\s+(?:Evaluation|Evaluacion|Evaluación):\s+(.+)$/im);
  if (!match) return { company: '', role: '' };
  const value = match[1].trim();
  const parts = value.split(/\s+-\s+|\s+--\s+|\s+—\s+/);
  if (parts.length < 2) return { company: value, role: '' };
  return {
    company: parts[0].trim(),
    role: parts.slice(1).join(' - ').trim(),
  };
}

function keywords(text) {
  const match = text.match(/##\s+Keywords(?:\s+Extracted| extra[ií]das)?\s*\n([\s\S]+)$/i);
  if (!match) return '';
  return match[1]
    .replace(/[-*]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim();
}

function clean(value) {
  return String(value || '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ').trim();
}

function main() {
  if (!existsSync(REPORTS_DIR)) {
    console.error(`Reports directory not found: ${REPORTS_DIR}`);
    process.exit(1);
  }

  const rows = readdirSync(REPORTS_DIR)
    .filter((file) => /^\d{3}-.+\.md$/.test(file))
    .sort()
    .map((file) => {
      const text = readFileSync(join(REPORTS_DIR, file), 'utf8');
      const title = splitTitle(text);
      return {
        num: file.slice(0, 3),
        date: field(text, 'Date') || field(text, 'Fecha'),
        company: title.company,
        role: title.role,
        score: field(text, 'Score').replace(/\/5$/, ''),
        legitimacy: field(text, 'Legitimacy'),
        archetype: field(text, 'Archetype') || field(text, 'Arquetipo'),
        url: field(text, 'URL'),
        pdf: field(text, 'PDF'),
        report: `reports/${file}`,
        keywords: keywords(text),
      };
    });

  const header = ['num', 'date', 'company', 'role', 'score', 'legitimacy', 'archetype', 'url', 'pdf', 'report', 'keywords'];
  const body = rows.map((row) => header.map((name) => clean(row[name])).join('\t'));
  writeFileSync(OUT_PATH, `${header.join('\t')}\n${body.join('\n')}\n`, 'utf8');
  console.log(`Wrote ${OUT_PATH}`);
}

main();

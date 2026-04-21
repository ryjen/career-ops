#!/usr/bin/env node

import { readFileSync, readdirSync, existsSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OVERLAY_DIR = join(ROOT, 'data/resume-overlays');
const REGISTRY_PATH = join(OVERLAY_DIR, 'overlays.yml');

function usage() {
  console.error('Usage: node resolve-resume-overlay.mjs [--json] <jd-file>');
  console.error('       cat jd.txt | node resolve-resume-overlay.mjs [--json] -');
  process.exit(1);
}

function parseArgs(argv) {
  const args = [...argv];
  const json = args.includes('--json');
  const filtered = args.filter((arg) => arg !== '--json');
  if (filtered.length !== 1) usage();
  return { json, jdPath: filtered[0] };
}

function loadYaml(path) {
  return yaml.load(readFileSync(path, 'utf8'));
}

function loadStdin() {
  return readFileSync(0, 'utf8');
}

function normalize(text) {
  return String(text || '').toLowerCase();
}

function countKeyword(text, keyword) {
  const needle = normalize(keyword).trim();
  if (!needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'g');
  return [...normalize(text).matchAll(pattern)].length;
}

function loadRegistry() {
  if (existsSync(REGISTRY_PATH)) {
    return loadYaml(REGISTRY_PATH);
  }

  const overlays = readdirSync(OVERLAY_DIR)
    .filter((file) => file.endsWith('.yml') && file !== 'overlays.yml')
    .map((file) => ({ id: basename(file, '.yml'), file }));
  return {
    selection: { primary_min_score: 2, secondary_min_score: 2, max_secondary: 1 },
    overlays,
  };
}

function scoreOverlay(jdText, overlay) {
  const matches = [];
  for (const keyword of overlay.match_keywords || []) {
    const count = countKeyword(jdText, keyword);
    if (count > 0) {
      matches.push({ keyword, count });
    }
  }

  const score = matches.reduce((total, match) => total + match.count, 0);
  return {
    id: overlay.id,
    label: overlay.label || overlay.id,
    axis: overlay.primary_axis,
    score,
    matches,
    title: overlay.title?.value || null,
    strategic_axes: overlay.strategic_axes || [],
    status: overlay.status || 'unknown',
    file: overlay.__file,
  };
}

function main() {
  const { json, jdPath } = parseArgs(process.argv.slice(2));
  if (!existsSync(OVERLAY_DIR)) {
    console.error(`Overlay directory not found: ${OVERLAY_DIR}`);
    process.exit(1);
  }

  const jdText = jdPath === '-' ? loadStdin() : readFileSync(jdPath, 'utf8');
  const registry = loadRegistry();
  const entries = registry.overlays || [];

  const scored = entries
    .map((entry) => {
      const file = entry.file || `${entry.id}.yml`;
      const path = join(OVERLAY_DIR, file);
      const overlay = loadYaml(path);
      overlay.__file = file;
      return scoreOverlay(jdText, overlay);
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const selection = registry.selection || {};
  const primaryMin = selection.primary_min_score ?? 2;
  const secondaryMin = selection.secondary_min_score ?? 2;
  const maxSecondary = selection.max_secondary ?? 1;
  const primary = scored.find((item) => item.score >= primaryMin) || scored[0] || null;
  const secondary = scored
    .filter((item) => item.id !== primary?.id && item.score >= secondaryMin)
    .slice(0, maxSecondary);

  const result = {
    jd_file: jdPath,
    overlay_dir: 'data/resume-overlays',
    primary,
    secondary,
    custom_needed: primary ? primary.score < primaryMin : true,
    scores: scored,
    drift_checks: [
      'No fabricated skills',
      'No JD keyword mirroring',
      'No ownership inflation',
      'No contradiction between title, axes, summary, competencies, and bullets',
      'Keep generated PDF to 2 pages when possible',
    ],
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('Resume overlay resolution');
  console.log(`JD: ${jdPath}`);
  if (primary) {
    console.log(`Primary: ${primary.id} (${primary.score}) - ${primary.label}`);
    if (primary.title) console.log(`Title: ${primary.title}`);
    if (primary.strategic_axes.length) {
      console.log(`Axes: ${primary.strategic_axes.join(' | ')}`);
    }
    if (primary.matches.length) {
      console.log(`Matches: ${primary.matches.map((m) => `${m.keyword}:${m.count}`).join(', ')}`);
    }
  } else {
    console.log('Primary: none');
  }
  if (secondary.length) {
    console.log(`Secondary: ${secondary.map((item) => `${item.id} (${item.score})`).join(', ')}`);
  }
  console.log(`Custom needed: ${result.custom_needed ? 'yes' : 'no'}`);
}

main();

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const exact = (...parts) => new RegExp(parts.join(''), 'i');
const forbidden = [
  exact('career', '-', 'data'),
  exact('career', '-', 'workflows'),
  exact('ops', '-', 'cadence'),
  exact('GMAIL', '_'),
  exact('GOOGLE', '_', '(?:DRIVE|SHEETS|SERVICE_ACCOUNT)'),
  exact('CLOUDFLARE', '_'),
  exact('runs-on:', '\\s*', 'self-hosted'),
];
const javascriptFiles = [];
const textFiles = [];
const textExtensions = new Set(['.js', '.mjs', '.json', '.md', '.nix', '.toml', '.yml', '.yaml']);
const rootFiles = [
  '.gitignore', 'README.md', 'SECURITY.md', 'SUPPORT.md',
  'CONTRIBUTING.md', 'GOVERNANCE.md', 'CODE_OF_CONDUCT.md',
  'flake.nix', 'flake.lock', 'package.json', 'package-lock.json', 'mise.toml',
];

function addFile(file) {
  if (!textExtensions.has(path.extname(file)) && !rootFiles.includes(file)) return;
  textFiles.push(file);
  if (/\.(?:js|mjs)$/.test(file)) javascriptFiles.push(file);
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else addFile(target);
  }
}

for (const root of ['src', 'scripts', 'test', 'schemas', 'fixtures', 'release', 'docs', '.github']) if (fs.existsSync(root)) walk(root);
for (const file of rootFiles) if (fs.existsSync(file)) addFile(file);

for (const file of javascriptFiles) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
for (const file of textFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(content)) throw new Error(`${file} contains a forbidden private or provider reference`);
  }
}
console.log(`source checks passed (${javascriptFiles.length} JavaScript files, ${textFiles.length} public text files)`);

import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'schemas', 'fixtures', 'release', 'test', 'scripts', 'docs', '.github'];
const rootFiles = [
  '.gitignore', '.nvmrc', 'README.md', 'SECURITY.md', 'SUPPORT.md',
  'CONTRIBUTING.md', 'GOVERNANCE.md', 'CODE_OF_CONDUCT.md',
  'package.json', 'package-lock.json', 'mise.toml',
];
const extensions = new Set(['.js', '.mjs', '.json', '.md', '.toml', '.yml', '.yaml']);
const failures = [];

function checkFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.endsWith('\n')) failures.push(`${file}: missing final newline`);
  content.split('\n').forEach((line, index) => {
    if (/\s+$/.test(line)) failures.push(`${file}:${index + 1}: trailing whitespace`);
  });
  if (path.extname(file) === '.json') {
    try { JSON.parse(content); } catch (error) { failures.push(`${file}: invalid JSON: ${error.message}`); }
  }
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(relative);
    else if (extensions.has(path.extname(entry.name))) checkFile(relative);
  }
}

for (const root of roots) if (fs.existsSync(root)) walk(root);
for (const file of rootFiles) if (fs.existsSync(file)) checkFile(file);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('format checks passed');

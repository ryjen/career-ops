import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'schemas', 'fixtures', 'test', 'scripts', 'docs'];
const extensions = new Set(['.js', '.mjs', '.json', '.md']);
const failures = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(relative);
    else if (extensions.has(path.extname(entry.name))) {
      const content = fs.readFileSync(relative, 'utf8');
      if (!content.endsWith('\n')) failures.push(`${relative}: missing final newline`);
      content.split('\n').forEach((line, index) => {
        if (/\s+$/.test(line)) failures.push(`${relative}:${index + 1}: trailing whitespace`);
      });
      if (path.extname(entry.name) === '.json') {
        try { JSON.parse(content); } catch (error) { failures.push(`${relative}: invalid JSON: ${error.message}`); }
      }
    }
  }
}

for (const root of roots) if (fs.existsSync(root)) walk(root);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('format checks passed');

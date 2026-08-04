import fs from 'node:fs';
import { runSmoke } from '../src/index.js';

const fixture = JSON.parse(fs.readFileSync('fixtures/synthetic/smoke-input.json', 'utf8'));
const result = runSmoke(fixture);
if (result.contract_name !== 'career-ops.smoke-result') throw new Error('public package export smoke failed');
console.log('build/import checks passed');

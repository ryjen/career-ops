import fs from 'node:fs';
import { normalizeOpportunity, runSmoke } from '../src/index.js';

const smokeFixture = JSON.parse(fs.readFileSync('fixtures/synthetic/smoke-input.json', 'utf8'));
const smokeResult = runSmoke(smokeFixture);
if (smokeResult.contract_name !== 'career-ops.smoke-result') throw new Error('public package smoke export failed');

const opportunityFixture = JSON.parse(fs.readFileSync(
  'fixtures/synthetic/opportunity-normalization-input.v1.json',
  'utf8',
));
const opportunityResult = normalizeOpportunity(opportunityFixture);
if (opportunityResult.contract_name !== 'career-ops.opportunity-normalization-result') {
  throw new Error('public opportunity-normalization export failed');
}

console.log('build/import checks passed');

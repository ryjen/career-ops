import process from 'node:process';
import { validateRepository } from './workflow-policy.mjs';

const errors = validateRepository(process.cwd());
if (errors.length > 0) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('workflow policy checks passed\n');

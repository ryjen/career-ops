#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';
import { normalizeOpportunity, runSmoke } from './index.js';

function usage() {
  return 'Usage: career-ops <smoke|normalize-opportunity> [--input PATH|-] [--output PATH|-]';
}

function parseArgs(argv) {
  const command = argv[0];
  if (!['smoke', 'normalize-opportunity'].includes(command)) throw new Error(usage());
  const options = { command, input: '-', output: '-' };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--input' || argument === '--output') {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}\n${usage()}`);
    }
  }
  return options;
}

async function readInput(source) {
  if (source === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  }
  return fs.readFile(source, 'utf8');
}

async function writeOutput(destination, text) {
  if (destination === '-') {
    process.stdout.write(text);
    return;
  }
  await fs.writeFile(destination, text, { flag: 'wx' });
}

function exitCode(error) {
  if (error.code === 'ERR_CONTRACT_VALIDATION') return 2;
  if (error.code === 'ERR_CONTRACT_VERSION') return 3;
  if (error.code === 'ERR_INPUT_BOUNDS') return 4;
  return 1;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const raw = await readInput(options.input);
  const maximumBytes = options.command === 'smoke' ? 16_384 : 262_144;
  if (Buffer.byteLength(raw, 'utf8') > maximumBytes) {
    const error = new RangeError(`input exceeds the ${maximumBytes}-byte CLI limit`);
    error.code = 'ERR_INPUT_BOUNDS';
    throw error;
  }
  const parsed = JSON.parse(raw);
  const result = options.command === 'smoke' ? runSmoke(parsed) : normalizeOpportunity(parsed);
  await writeOutput(options.output, `${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({
    contract_name: 'career-ops.error',
    contract_version: 1,
    code: error.code || 'ERR_EXECUTION',
    message: error.message,
  })}\n`);
  process.exitCode = exitCode(error);
}

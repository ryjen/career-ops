#!/usr/bin/env node
import fs from 'node:fs/promises';
import process from 'node:process';
import { runSmoke } from './index.js';

function usage() {
  return 'Usage: career-ops smoke [--input PATH|-] [--output PATH|-]';
}

function parseArgs(argv) {
  if (argv[0] !== 'smoke') throw new Error(usage());
  const options = { input: '-', output: '-' };
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

try {
  const options = parseArgs(process.argv.slice(2));
  const raw = await readInput(options.input);
  if (Buffer.byteLength(raw, 'utf8') > 16_384) throw new Error('input exceeds the 16384-byte bootstrap limit');
  const result = runSmoke(JSON.parse(raw));
  await writeOutput(options.output, `${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.code === 'ERR_CONTRACT_VALIDATION' ? 2 : 1;
}

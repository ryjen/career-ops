import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ARCHIVE = 'ryjen-career-ops-0.1.0.tgz';

export function verifyDownloadedRelease(directory) {
  const archive = path.join(directory, ARCHIVE);
  const sums = path.join(directory, 'SHA256SUMS');
  if (!fs.existsSync(archive) || !fs.statSync(archive).isFile()) throw new Error(`missing release archive: ${ARCHIVE}`);
  if (!fs.existsSync(sums) || !fs.statSync(sums).isFile()) throw new Error('missing SHA256SUMS');

  const line = fs.readFileSync(sums, 'utf8').trim();
  const match = /^([a-f0-9]{64})  ryjen-career-ops-0\.1\.0\.tgz$/.exec(line);
  if (!match) throw new Error('SHA256SUMS must contain exactly the v0.1.0 archive checksum');
  const actual = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
  if (actual !== match[1]) throw new Error('downloaded release archive checksum mismatch');

  const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-release-consumer-'));
  try {
    fs.writeFileSync(path.join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
    run('npm', ['install', '--ignore-scripts', '--offline', '--no-audit', '--no-fund', '--package-lock=false', archive], consumer, 'published archive install');
    run(process.execPath, ['--input-type=module', '-e', "import { runSmoke } from '@ryjen/career-ops'; const value=runSmoke({contract_name:'career-ops.smoke',contract_version:1,message:'published'}); if(value.contract_name!=='career-ops.smoke-result') process.exit(2);"], consumer, 'published library import');
    const cli = path.join(consumer, 'node_modules', '@ryjen', 'career-ops', 'src', 'cli.js');
    const result = spawnSync(process.execPath, [cli, 'smoke'], {
      cwd: consumer,
      input: JSON.stringify({ contract_name: 'career-ops.smoke', contract_version: 1, message: 'published' }),
      encoding: 'utf8',
      env: { PATH: process.env.PATH, HOME: process.env.HOME },
    });
    if (result.status !== 0) throw new Error(`published CLI smoke failed with exit ${result.status}`);
    const parsed = JSON.parse(result.stdout);
    if (parsed.contract_name !== 'career-ops.smoke-result') throw new Error('published CLI returned unexpected contract');
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }

  return { status: 'pass', archive: ARCHIVE, sha256: actual, install: 'pass', library_import: 'pass', cli_smoke: 'pass' };
}

function run(command, args, cwd, label) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}`);
}

function main() {
  try {
    const directory = process.argv[2];
    if (!directory) throw new Error('usage: node scripts/verify-release-download.mjs <download-directory>');
    process.stdout.write(`${JSON.stringify(verifyDownloadedRelease(directory), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`release download verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

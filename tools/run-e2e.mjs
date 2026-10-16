#!/usr/bin/env node
// Runs every tests/e2e/*.e2e.mjs sequentially (each in its own node process).
//   npm run e2e                 → all scripts
//   npm run e2e -- smoke drag   → only scripts whose file name contains "smoke" or "drag"
// A script fails when it exits non-zero or exceeds E2E_TIMEOUT ms (default 300000).
// E2E_DIR overrides the script directory (used to test the runner itself).

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.resolve(process.env.E2E_DIR || path.join(ROOT, 'tests', 'e2e'));
const TIMEOUT = Number(process.env.E2E_TIMEOUT) || 300000;

function findScripts(filters) {
  let files = [];
  try {
    files = readdirSync(DIR).filter((f) => f.endsWith('.e2e.mjs')).sort();
  } catch {
    /* no e2e directory yet */
  }
  return filters.length ? files.filter((f) => filters.some((x) => f.includes(x))) : files;
}

// On POSIX each script gets its own process group so a timeout also kills its browser and servers.
const GROUP = process.platform !== 'win32';
let current = null;

function killTree(child) {
  try {
    if (GROUP) process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGKILL');
  } catch {
    /* already gone */
  }
}

function run(file) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(DIR, file)], { cwd: ROOT, stdio: 'inherit', detached: GROUP });
    current = child;
    const timer = setTimeout(() => {
      console.error(`\n[e2e] ${file} timed out after ${TIMEOUT} ms`);
      killTree(child);
    }, TIMEOUT);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      current = null;
      resolve({ file, ok: code === 0, code: code ?? signal, ms: Date.now() - started });
    });
  });
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (current) killTree(current);
    process.exit(130);
  });
}

async function main() {
  const scripts = findScripts(process.argv.slice(2));
  if (!scripts.length) {
    console.error('[e2e] no matching tests/e2e/*.e2e.mjs scripts found');
    process.exit(1);
  }
  const results = [];
  for (const file of scripts) {
    console.log(`\n[e2e] ▶ ${file}`);
    results.push(await run(file));
  }
  console.log('\n[e2e] summary');
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.file}  (${(r.ms / 1000).toFixed(1)} s${r.ok ? '' : `, exit ${r.code}`})`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`  ${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main();

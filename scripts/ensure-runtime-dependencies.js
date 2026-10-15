'use strict';

// GoDaddy can reuse a Preview node_modules tree without reinstalling changed
// root dependencies. Repair only when a required Day.js entrypoint is absent.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

function missingEntrypoints() {
  const missing = [];
  for (const name of ['dayjs', 'dayjs/plugin/utc']) {
    try { require.resolve(name, { paths: [root] }); }
    catch { missing.push(name); }
  }
  return missing;
}

function main() {
  const pkgPath = path.join(root, 'package.json');
  const lockPath = path.join(root, 'package-lock.json');
  if (!fs.existsSync(pkgPath) || !fs.existsSync(lockPath)) {
    throw new Error('Runtime dependency repair requires package.json and package-lock.json at the repository root.');
  }

  let missing = missingEntrypoints();
  if (missing.length === 0) {
    console.log('[SBC DEPENDENCY PREFLIGHT] PASS: dayjs and dayjs/plugin/utc resolve from the repository root.');
    return;
  }
  if (checkOnly) {
    throw new Error('Required Day.js runtime entrypoint(s) missing after locked dependency install: ' + missing.join(', '));
  }

  console.warn('[SBC DEPENDENCY PREFLIGHT] Missing ' + missing.join(', ') + '; repairing root dependencies from package-lock.json.');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: root,
    stdio: 'inherit',
    timeout: 180000,
    env: process.env
  });
  if (result.error) throw new Error('Locked dependency repair could not run npm ci: ' + result.error.message);
  if (result.status !== 0) throw new Error('Locked dependency repair failed; npm ci exit status=' + result.status + '.');

  missing = missingEntrypoints();
  if (missing.length) throw new Error('Day.js runtime entrypoint(s) still missing after npm ci: ' + missing.join(', '));
  console.log('[SBC DEPENDENCY PREFLIGHT] REPAIRED: locked root dependencies installed and Day.js UTC plugin resolves.');
}

try { main(); }
catch (error) {
  console.error('[SBC DEPENDENCY PREFLIGHT] FATAL:', error && error.stack ? error.stack : error);
  process.exitCode = 1;
}

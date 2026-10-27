'use strict';

const fs = require('fs');
const path = require('path');

function parseEnvFile(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!key || process.env[key] !== undefined) continue;
    out[key] = value;
  }
  return out;
}

function loadDotEnv({file = path.join(process.cwd(), '.env'), strictProduction = false} = {}) {
  if (!fs.existsSync(file)) return {loaded:false, file, keys:[]};
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error('SECURE_ENV_NOT_FILE');
  const raw = fs.readFileSync(file, 'utf8');
  const values = parseEnvFile(raw);
  const fileDeclaresProduction = String(values.NODE_ENV || process.env.NODE_ENV || '').toLowerCase() === 'production';
  if ((strictProduction || fileDeclaresProduction) && process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
    throw new Error('SECURE_ENV_PERMISSIONS_TOO_BROAD');
  }
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  return {loaded:true, file, keys:Object.keys(values)};
}

function boot() {
  const production = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  try {
    const result = loadDotEnv({strictProduction:production});
    if (result.loaded) console.log(`[SBC ENV] Loaded ${result.keys.length} non-overridden environment settings from private .env.`);
  } catch (err) {
    console.error(`[SBC ENV] ${err.message}`);
    if (production) process.exit(1);
  }
}

module.exports = {parseEnvFile, loadDotEnv, boot};

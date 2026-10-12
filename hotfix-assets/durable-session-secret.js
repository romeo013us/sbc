'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const KEY_FILE = 'sbc-session-signing.key';
const KEY_RE = /^[a-f0-9]{64}$/i;

function readExisting(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('SBC_SESSION_KEY_FILE_INVALID');
  }
  const value = fs.readFileSync(file, 'utf8').trim();
  if (!KEY_RE.test(value)) throw new Error('SBC_SESSION_KEY_FILE_INVALID');
  try { fs.chmodSync(file, 0o600); } catch {}
  return value;
}

function resolveSessionSecret({ env = process.env, dataDir } = {}) {
  const explicit = String(env.SBC_SESSION_SECRET || '').trim();
  if (explicit) return explicit;
  if (!dataDir) throw new Error('SBC_SESSION_KEY_STORAGE_REQUIRED');

  const dir = path.resolve(dataDir);
  const file = path.join(dir, KEY_FILE);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  try {
    return readExisting(file);
  } catch (error) {
    if (error && error.code !== 'ENOENT') throw error;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(file, generated + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    try { fs.chmodSync(file, 0o600); } catch {}
    return generated;
  } catch (error) {
    // Another process may have created the shared persistent key concurrently.
    if (error && error.code === 'EEXIST') return readExisting(file);
    throw new Error('SBC_SESSION_KEY_STORAGE_UNAVAILABLE');
  }
}

module.exports = { resolveSessionSecret, KEY_FILE };

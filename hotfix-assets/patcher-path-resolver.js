#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
function resolvePatcherAsset(rootDir = path.resolve(__dirname, '..')) {
  const sourcePatcher = path.join(__dirname, 'apply-v65118-webhook-patch.js');
  const scriptsDir = path.join(rootDir, 'scripts');
  const targetDestination = path.join(scriptsDir, 'apply-v65118-webhook-patch.js');
  if (!fs.existsSync(sourcePatcher) || !fs.statSync(sourcePatcher).isFile()) {
    throw new Error('WEBHOOK_PATCHER_SOURCE_MISSING');
  }
  fs.mkdirSync(scriptsDir, { recursive: true });
  const sourceHash = require('node:crypto').createHash('sha256').update(fs.readFileSync(sourcePatcher)).digest('hex');
  let targetHash = '';
  if (fs.existsSync(targetDestination)) targetHash = require('node:crypto').createHash('sha256').update(fs.readFileSync(targetDestination)).digest('hex');
  if (sourceHash !== targetHash) fs.copyFileSync(sourcePatcher, targetDestination);
  const copiedHash = require('node:crypto').createHash('sha256').update(fs.readFileSync(targetDestination)).digest('hex');
  if (copiedHash !== sourceHash) throw new Error('WEBHOOK_PATCHER_COPY_VERIFY_FAILED');
  return { ok: true, source: sourcePatcher, destination: targetDestination, sha256: sourceHash };
}
if (require.main === module) {
  try { const r = resolvePatcherAsset(path.resolve(__dirname, '..')); console.log('[SBC PATCHER PATH] PASS', JSON.stringify(r)); }
  catch (e) { console.error('[SBC PATCHER PATH] FAIL', e.message); process.exitCode = 1; }
}
module.exports = { resolvePatcherAsset };

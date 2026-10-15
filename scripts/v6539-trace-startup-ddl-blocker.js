'use strict';

/**
 * Diagnostic only: extract the committed baseline ZIP, apply the same source
 * patches as bootstrap.js, and show call sites that can explain
 * "production startup blocked: SBC_PREVIEW_DDL_BLOCKED".
 * This script never connects to MySQL and never deploys or mutates production.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const zip = path.join(root, 'SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6539-startup-trace-'));
const patchPaths = [
  'apply-v65116-hotfix.js',
  'hotfix-assets/apply-v6522-api-stabilization.js',
  'hotfix-assets/apply-v6523-read-query-cancel.js',
  'hotfix-assets/apply-v6524-single-writer.js',
  'hotfix-assets/apply-v6525-customer360-workspace.js',
  'hotfix-assets/apply-v6526-demo-studio.js',
  'hotfix-assets/apply-v6527-persistence-writer-lock.js',
  'hotfix-assets/apply-v6528-runtime-writer-lease.js',
  'hotfix-assets/apply-v6529-open-readiness.js',
  'hotfix-assets/apply-v6530-writer-lease-marker-fix.js',
  'hotfix-assets/apply-v6531-release-identity.js',
  'hotfix-assets/apply-v6533-startup-ddl-gate.js',
  'hotfix-assets/apply-v6534-price-consistency.js',
  'hotfix-assets/apply-v6535-writer-no-ddl-operational-startup.js',
  'hotfix-assets/apply-v6536-runtime-beacon.js',
  'hotfix-assets/apply-v6537-effective-runtime-role.js',
  'hotfix-assets/apply-v6538-writer-hydration-without-ddl.js',
  'hotfix-assets/apply-v6539-safe-no-ddl-startup.js'
];
const patterns = [
  /\[SBC STARTUP\].{0,100}production startup blocked/g,
  /SBC_PREVIEW_DDL_BLOCKED/g,
  /RUNTIME_GATE\.ensureSchema/g,
  /SBC_DDL_ENABLED/g,
  /SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL/g,
  /function startOperationalRuntime/g
];

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, result);
    else if (/\.(?:js|cjs|mjs)$/.test(entry.name)) result.push(full);
  }
  return result;
}

try {
  if (!fs.existsSync(zip)) throw new Error('required source ZIP is missing');
  execFileSync('unzip', ['-q', zip, '-d', temp], { stdio: 'pipe' });
  for (const rel of patchPaths) {
    const modulePath = path.join(root, rel);
    if (!fs.existsSync(modulePath)) throw new Error('missing source patch ' + rel);
    const patch = require(modulePath);
    if (typeof patch.apply !== 'function') throw new Error('patch has no apply(root): ' + rel);
    patch.apply(temp);
  }

  const hits = [];
  for (const file of walk(temp)) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const lines = text.split(/\r?\n/);
    for (const pattern of patterns) {
      for (let index = 0; index < lines.length; index++) {
        pattern.lastIndex = 0;
        if (!pattern.test(lines[index])) continue;
        const key = path.relative(temp, file) + ':' + (index + 1) + ':' + pattern.source;
        if (hits.some(hit => hit.key === key)) continue;
        hits.push({ key, file, line: index + 1, pattern: pattern.source, lines });
        if (hits.length >= 90) break;
      }
      if (hits.length >= 90) break;
    }
    if (hits.length >= 90) break;
  }

  // Inspect the full initMysql().then(...) segment before the listener/worker function.
  for (const file of walk(temp)) {
    if (path.basename(file) !== 'server.js') continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const startAt = lines.findIndex(line => /startOperationalRuntime\s*=\s*async\s*\(\)\s*=>\s*\{/.test(line));
    if (startAt >= 0) {
      let chainAt = -1;
      for (let j = 0; j < startAt; j++) if (/initMysql\(\)\.then/.test(lines[j])) chainAt = j;
      console.log('\n=== INIT MYSQL PROMISE CHAIN BEFORE OPERATIONAL RUNTIME === start=' + (chainAt + 1) + ' end=' + startAt);
      if (chainAt >= 0) {
        for (let j = chainAt; j < startAt; j++) {
          if (/await|ensureTables|ensureSchema|CREATE TABLE|ALTER TABLE|CREATE INDEX|migrat|RUNTIME_GATE|SBC_UNATTENDED_NOTIFICATIONS|SBC STARTUP|\.then\(|\.catch\(/.test(lines[j])) {
            console.log(String(j + 1).padStart(5) + ' [line_length=' + lines[j].length + '] ' + lines[j].slice(0, 6000));
          }
        }
      }
    }
  }

  // Print the preceding startup chain (which declares and invokes startOperationalRuntime)
  // so an earlier rejected initialization can be distinguished from worker startup failure.
  for (const file of walk(temp)) {
    if (path.basename(file) !== 'server.js') continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const startAt = lines.findIndex(line => /startOperationalRuntime\s*=\s*async\s*\(\)\s*=>\s*\{/.test(line));
    if (startAt >= 0) {
      console.log('\n=== PARENT STARTUP CHAIN BEFORE OPERATIONAL RUNTIME ===');
      for (let j = Math.max(0, startAt - 45); j < startAt; j++) {
        if (/initMysql|\.then\(|\.catch\(|SBC_UNATTENDED_NOTIFICATIONS|notifications scheduler|MYSQL_RECOVERY|sbcWriterLeaseReady|await|WebSocket setup|httpServer|RUNTIME_GATE|ensure|startOperational/.test(lines[j])) {
          console.log(String(j + 1).padStart(5) + ' [line_length=' + lines[j].length + '] ' + lines[j].slice(0, 5000));
        }
      }
    }
  }

  // Locate the worker-leader initializer invoked with await during operational startup.
  for (const file of walk(temp)) {
    const source = fs.readFileSync(file, 'utf8');
    if (!/acquireWorkerLeader/.test(source)) continue;
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!/acquireWorkerLeader/.test(lines[i])) continue;
      console.log('\n=== WORKER LEADER CALL/DEFINITION: ' + path.relative(temp, file) + ':' + (i + 1) + ' ===');
      for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 4); j++) {
        console.log(String(j + 1).padStart(5) + ' [line_length=' + lines[j].length + '] ' + lines[j].slice(0, 6000));
      }
    }
  }

  // Also print the beginning of startOperationalRuntime so we can identify the
  // earliest awaited operation that can reject the startup promise.
  for (const file of walk(temp)) {
    if (path.basename(file) !== 'server.js') continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const startAt = lines.findIndex(line => /startOperationalRuntime\s*=\s*async\s*\(\)\s*=>\s*\{/.test(line));
    if (startAt >= 0) {
      console.log('\n=== OPERATIONAL RUNTIME STARTUP BODY: ' + path.relative(temp, file) + ':' + (startAt + 1) + ' ===');
      for (let j = startAt; j < Math.min(lines.length, startAt + 100); j++) {
        if (j < startAt + 8 || /ensureTables|ensureSchema|CREATE TABLE|ensureEnterpriseSchema|migrat|mysqlPool\.query|RUNTIME_GATE|workerLeader|startup blocked|await/.test(lines[j])) {
          console.log(String(j + 1).padStart(5) + ' [line_length=' + lines[j].length + '] ' + lines[j].slice(0, 5000));
        }
      }
    }
  }

  // Emit the full startup promise chain around the production-blocked catch. These lines
  // contain source code only and are truncated only at 9000 chars per line.
  for (const file of walk(temp)) {
    let source;
    try { source = fs.readFileSync(file, 'utf8'); } catch { continue; }
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!/production startup blocked/.test(lines[i])) continue;
      console.log('\n=== FULL STARTUP FAILURE CHAIN: ' + path.relative(temp, file) + ':' + (i + 1) + ' ===');
      for (let j = Math.max(0, i - 6); j <= Math.min(lines.length - 1, i + 1); j++) {
        console.log(String(j + 1).padStart(5) + (j === i ? ' > ' : '   ') +
          '[line_length=' + lines[j].length + '] ' + lines[j].slice(0, 9000));
      }
    }
  }

  console.log('[SBC V65.1.39 DIAGNOSTIC] patched source trace; no database connection made.');
  if (!hits.length) {
    console.log('No matching startup / DDL-gate locations found in patched source.');
  }
  for (const hit of hits) {
    const rel = path.relative(temp, hit.file);
    console.log('\n--- ' + rel + ':' + hit.line + ' pattern=' + hit.pattern + ' ---');
    const start = Math.max(0, hit.line - 3);
    const end = Math.min(hit.lines.length, hit.line + 2);
    for (let i = start; i < end; i++) {
      const line = hit.lines[i];
      console.log(String(i + 1).padStart(5) + (i + 1 === hit.line ? ' > ' : '   ') +
        line.slice(0, 600));
    }
  }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

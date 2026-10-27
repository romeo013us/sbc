#!/usr/bin/env node
'use strict';
// Backwards-compatible entry point for the read-only reconciliation report.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.join(__dirname, 'diff-leads-reconciliation.js');
const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: 'inherit' });
if (result.error) { console.error(result.error.message); process.exit(2); }
process.exit(result.status ?? 2);

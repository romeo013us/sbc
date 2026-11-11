'use strict';
/* Fail closed when Command Center returns HTTP 2xx but declines the CRM write.
 * Synthetic only: does not send leads, mail, payments, or live HTTP requests.
 */
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const php = [
  "$_SERVER['REQUEST_METHOD']='GET'; $_GET=[]; ob_start(); require 'index.php'; ob_end_clean();",
  "$cases = [",
  " [201, ['ok'=>true,'leadId'=>'synthetic_lead'], '', true],",
  " [200, ['ok'=>true], '', true],",
  " [200, ['ok'=>false,'error'=>'DB_WRITE_FAILED'], '', false],",
  " [200, ['error'=>'DB_WRITE_FAILED'], '', false],",
  " [200, ['ok'=>'true'], '', false],",
  " [200, null, '', false],",
  " [503, ['ok'=>true], '', false],",
  " [200, ['ok'=>true], 'connection failed', false]",
  "];",
  "$actual = []; foreach ($cases as $case) { $actual[] = sbcCrmLeadAccepted($case[0], $case[1], $case[2]); }",
  "echo json_encode($actual);"
].join('\n');
const actual = JSON.parse(execFileSync('php', ['-r', php], {
  cwd: root, encoding: 'utf8', timeout: 15000
}));
assert.deepEqual(actual, [true, true, false, false, false, false, false, false],
  'Only a genuine 2xx + explicit boolean ok=true + no transport error can confirm CRM acceptance');
const page = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
assert.match(page, /sbcCrmLeadAccepted\(\$code,\s*\$json,\s*\$err\)/,
  'Production CRM bridge must call the tested acceptance predicate');
console.log('SBCMIA synthetic CRM ACK contract PASS: false-positive 2xx rejected.');

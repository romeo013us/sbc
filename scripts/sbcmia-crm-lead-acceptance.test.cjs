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
  " [201, ['ok'=>true,'id'=>'cust_synthetic'], '', true],",
  " [200, ['ok'=>true,'id'=>'cust_existing','duplicate'=>true], '', true],",
  " [202, ['ok'=>true,'accepted'=>false,'reason'=>'spam_filter'], '', false],",
  " [200, ['ok'=>true,'id'=>'cust_ignored','accepted'=>false], '', false],",
  " [200, ['ok'=>true], '', false],",
  " [201, ['ok'=>true,'id'=>'  '], '', false],",
  " [201, ['ok'=>true,'id'=>str_repeat('a',81)], '', false],",
  " [200, ['ok'=>false,'error'=>'DB_WRITE_FAILED'], '', false],",
  " [200, ['error'=>'DB_WRITE_FAILED'], '', false],",
  " [200, ['ok'=>'true'], '', false],",
  " [200, null, '', false],",
  " [503, ['ok'=>true,'id'=>'cust_unavailable'], '', false],",
  " [200, ['ok'=>true,'id'=>'cust_connection_failed'], 'connection failed', false]",
  "];",
  "$actual = []; foreach ($cases as $case) { $actual[] = sbcCrmLeadAccepted($case[0], $case[1], $case[2]); }",
  "echo json_encode($actual);"
].join('\n');
const actual = JSON.parse(execFileSync('php', ['-r', php], {
  cwd: root, encoding: 'utf8', timeout: 15000
}));
assert.deepEqual(actual, [true, true, false, false, false, false, false, false, false, false, false, false, false],
  'Only HTTP 200/201 with a positive application receipt and a valid lead ID confirms CRM acceptance');
const page = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
assert.match(page, /sbcCrmLeadAccepted\(\$code,\s*\$json,\s*\$err\)/,
  'Production CRM bridge must call the tested acceptance predicate');
console.log('SBCMIA synthetic CRM ACK contract PASS: false-positive 2xx rejected.');

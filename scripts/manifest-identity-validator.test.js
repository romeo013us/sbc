'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { audit } = require('./manifest-identity-validator');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-manifest-'));
function put(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function html() {
  return '<html><head><link rel="stylesheet" href="/sbc-v6574-draggable-nav-rail.css?v=66.0.1"></head><body><script src="/sbc-v6574-draggable-nav-rail.js?v=66.0.1"></script><span data-release-version="66.0.0"></span></body></html>';
}
try {
  put('package.json', JSON.stringify({ name: 'sbc-business-command-center', version: '66.0.0' }));
  for (const dir of ['public', 'browser_public']) {
    put(dir + '/index.html', html());
    put(dir + '/sbc-v6574-draggable-nav-rail.css', '/* nav rail */');
    put(dir + '/sbc-v6574-draggable-nav-rail.js', '/* nav rail */');
  }
  assert.equal(audit(root, '66.0.0'), true);
  put('browser_public/sbc-v6574-draggable-nav-rail.js', '');
  assert.throws(() => audit(root, '66.0.0'), /no matching generated asset/);
  put('browser_public/sbc-v6574-draggable-nav-rail.js', '/* nav rail */');
  put('public/index.html', '<html><head><link href="/app.css?v=65.1.61"></head><body></body></html>');
  assert.throws(() => audit(root, '66.0.0'), /stale v=65\.1\.61/);
  assert.throws(() => audit(root, '65.1.72'), /package version mismatch/);
  console.log('[SBC MANIFEST TEST] PASS: each entrypoint requires its own non-empty navigation assets.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
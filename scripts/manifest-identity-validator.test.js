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
try {
  put('package.json', JSON.stringify({ name: 'sbc-business-command-center', version: '65.1.73' }));
  put('public/index.html', '<html><head><link rel="stylesheet" href="/sbc-v6574-draggable-nav-rail.css?v=65.1.72-nav-rail"></head><body><script src="/sbc-v6574-draggable-nav-rail.js?v=65.1.72-nav-rail"></script><span data-release-version="65.1.73"></span></body></html>');
  put('public/sbc-v6574-draggable-nav-rail.css', '/* nav rail */');
  put('public/sbc-v6574-draggable-nav-rail.js', '/* nav rail */');
  assert.equal(audit(root, '65.1.73'), true);
  put('public/index.html', '<html><head><link href="/app.css?v=65.1.61"></head><body></body></html>');
  assert.throws(() => audit(root, '65.1.73'), /stale v=65\.1\.61/);
  assert.throws(() => audit(root, '65.1.72'), /package version mismatch/);
  console.log('[SBC MANIFEST TEST] PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

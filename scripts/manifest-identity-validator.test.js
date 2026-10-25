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
  // Reproduce the exact production path: V6600 registers the legacy nav CSS,
  // then V6636 folds it into a single hashed stylesheet while retaining the
  // disabled nav script compatibility registration.
  const { apply: bundleStyles } = require('../hotfix-assets/apply-v6636-canonical-shell-css-bundle');
  const extras = Array.from({ length: 66 }, (_, index) => 'sbc-test-' + index + '.css');
  for (const file of extras) put('public/' + file, '.sbc-test-' + file.replace('.css', '') + '{display:block}' + '\n');
  const allLinks = extras.concat('sbc-v6574-draggable-nav-rail.css')
    .map(file => '<link rel="stylesheet" href="/' + file + '">').join('\n');
  const preBundle = '<html><head>' + allLinks +
    '</head><body><script type="application/x-sbc-disabled" data-src="/sbc-v6574-draggable-nav-rail.js"></script>' +
    '<span data-release-version="66.0.0"></span></body></html>';
  for (const dir of ['public', 'browser_public']) {
    put(dir + '/index.html', preBundle);
    put(dir + '/sw.js', "const CACHE='sbc-prebundle-test';");
  }
  const bundled = bundleStyles(root);
  assert.equal(bundled.stylesheetsBefore, 67);
  assert.equal(bundled.stylesheetsAfter, 1);
  assert.equal(audit(root, '66.0.0'), true, 'real V6636 output must pass startup manifest audit');
  const bundleName = fs.readFileSync(path.join(root, 'browser_public/index.html'), 'utf8')
    .match(/href="\/(sbc-v6636-styles\.[a-f0-9]{16}\.css)"/)[1];
  const mirrorBundle = path.join(root, 'browser_public', bundleName);
  const pristineBundle = fs.readFileSync(mirrorBundle, 'utf8');
  put('browser_public/' + bundleName, pristineBundle + '\n/* tamper */');
  assert.throws(() => audit(root, '66.0.0'), /canonical stylesheet checksum mismatch/);
  put('browser_public/' + bundleName, pristineBundle);
  put('browser_public/sbc-v6574-draggable-nav-rail.css', '/* replaced after bundling */');
  assert.throws(() => audit(root, '66.0.0'), /canonical stylesheet does not contain navigation asset/);
  put('browser_public/sbc-v6574-draggable-nav-rail.css', '/* nav rail */');
  put('browser_public/sbc-v6574-draggable-nav-rail.js', '');
  assert.throws(() => audit(root, '66.0.0'), /no matching generated asset/);
  put('browser_public/sbc-v6574-draggable-nav-rail.js', '/* nav rail */');
  assert.equal(audit(root, '66.0.0'), true);
  put('public/index.html', '<html><head><link href="/app.css?v=65.1.61"></head><body></body></html>');
  assert.throws(() => audit(root, '66.0.0'), /stale v=65\.1\.61/);
  assert.throws(() => audit(root, '65.1.72'), /package version mismatch/);
  console.log('[SBC MANIFEST TEST] PASS: legacy nav registration and V6636 canonical CSS integrity verified in both entrypoints.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
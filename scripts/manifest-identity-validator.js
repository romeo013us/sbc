'use strict';
const fs = require('node:fs');
const path = require('node:path');

function audit(root, expectedVersion) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error('[SBC MANIFEST] package.json missing');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = String(expectedVersion || pkg.version || '');
  if (!/^\d+\.\d+\.\d+$/.test(version) || pkg.version !== version) {
    throw new Error('[SBC MANIFEST] package version mismatch: expected ' + version + ', found ' + pkg.version);
  }

  const htmlPaths = ['public/index.html', 'browser_public/index.html']
    .map(rel => ({ rel, file: path.join(root, rel) })).filter(item => fs.existsSync(item.file));
  if (!htmlPaths.length) throw new Error('[SBC MANIFEST] no generated HTML entrypoint found');

  const htmlCombined = htmlPaths.map(item => fs.readFileSync(item.file, 'utf8')).join('\n');
  if (/\bv=65\.1\.61(?:[&#"'\s]|$)/i.test(htmlCombined)) {
    throw new Error('[SBC MANIFEST] stale v=65.1.61 asset token remains in HTML');
  }
  if (/65\.1\.61/.test(htmlCombined) && /(?:release|version|build)[^\n]{0,80}65\.1\.61/i.test(htmlCombined)) {
    throw new Error('[SBC MANIFEST] HTML release identity still advertises V65.1.61');
  }

  const cssName = 'sbc-v6574-draggable-nav-rail.css';
  const jsName = 'sbc-v6574-draggable-nav-rail.js';
  for (const item of htmlPaths) {
    const html = fs.readFileSync(item.file, 'utf8');
    const assetDir = path.dirname(item.file);
    for (const name of [cssName, jsName]) {
      if (!html.includes('/' + name)) {
        throw new Error('[SBC MANIFEST] ' + item.rel + ' is missing navigation asset registration: ' + name);
      }
      const asset = path.join(assetDir, name);
      if (!fs.existsSync(asset) || !fs.statSync(asset).isFile() || fs.statSync(asset).size === 0) {
        throw new Error('[SBC MANIFEST] ' + item.rel + ' has no matching generated asset: ' + asset);
      }
    }
  }
  console.log('[SBC MANIFEST] PASS package=' + version + ', HTML=' + htmlPaths.length + ', per-entrypoint navigation assets registered');
  return true;
}

if (require.main === module && process.env.SBC_STAGING_DIAGNOSTICS === '1') {
  try { audit(process.argv[2] || path.resolve(__dirname, '..'), process.env.SBC_EXPECTED_VERSION); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { audit };
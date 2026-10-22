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
    .map(rel => path.join(root, rel)).filter(file => fs.existsSync(file));
  if (!htmlPaths.length) throw new Error('[SBC MANIFEST] no generated HTML entrypoint found');

  let htmlCombined = '';
  for (const file of htmlPaths) htmlCombined += '\n' + fs.readFileSync(file, 'utf8');
  if (/\bv=65\.1\.61(?:[&#"'\s]|$)/i.test(htmlCombined)) {
    throw new Error('[SBC MANIFEST] stale v=65.1.61 asset token remains in HTML');
  }
  if (/65\.1\.61/.test(htmlCombined) && /(?:release|version|build)[^\n]{0,80}65\.1\.61/i.test(htmlCombined)) {
    throw new Error('[SBC MANIFEST] HTML release identity still advertises V65.1.61');
  }
  const navCss = path.join(root, 'public/sbc-v6574-draggable-nav-rail.css');
  const navJs = path.join(root, 'public/sbc-v6574-draggable-nav-rail.js');
  if (!fs.existsSync(navCss) || !fs.existsSync(navJs) ||
      !htmlCombined.includes('/sbc-v6574-draggable-nav-rail.css') ||
      !htmlCombined.includes('/sbc-v6574-draggable-nav-rail.js')) {
    throw new Error('[SBC MANIFEST] draggable navigation rail is not fully registered in generated HTML/assets');
  }
  for (const file of [navCss, navJs]) {
    if (fs.statSync(file).size === 0) throw new Error('[SBC MANIFEST] empty navigation asset: ' + path.basename(file));
  }
  console.log('[SBC MANIFEST] PASS package=' + version + ', HTML=' + htmlPaths.length + ', navigation assets registered');
  return true;
}

if (require.main === module && process.env.SBC_STAGING_DIAGNOSTICS === '1') {
  try { audit(process.argv[2] || path.resolve(__dirname, '..'), process.env.SBC_EXPECTED_VERSION); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { audit };

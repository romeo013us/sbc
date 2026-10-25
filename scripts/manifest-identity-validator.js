'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');


function verifyBundledNavigationCss(item, html, cssName) {
  // V6636 intentionally reduces the shell to one stylesheet. Preserve the
  // no-drag V66 navigation compatibility asset without loading another link.
  const links = [...html.matchAll(/<link\b[^>]*\bid=(["'])sbc-v6636-canonical-styles\1[^>]*>/gi)];
  const stylesheetLinks = [...html.matchAll(/<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>/gi)];
  if (links.length !== 1 || stylesheetLinks.length !== 1) {
    throw new Error('[SBC MANIFEST] ' + item.rel + ' is missing navigation asset registration: ' + cssName + ' (canonical stylesheet not unique)');
  }
  const link = links[0][0];
  const asset = link.match(/\bhref=(["'])\/(sbc-v6636-styles\.([a-f0-9]{16})\.css)\1/i);
  const identity = link.match(/\bdata-sbc-v6636=(["'])([a-f0-9]{64})\1/i);
  if (!asset || !identity || asset[3].toLowerCase() !== identity[2].slice(0, 16).toLowerCase()) {
    throw new Error('[SBC MANIFEST] ' + item.rel + ' has invalid canonical stylesheet identity');
  }
  const dir = path.dirname(item.file);
  const bundleFile = path.join(dir, asset[2]);
  if (!fs.existsSync(bundleFile) || !fs.statSync(bundleFile).isFile()) {
    throw new Error('[SBC MANIFEST] ' + item.rel + ' has no canonical stylesheet asset: ' + asset[2]);
  }
  const bundle = fs.readFileSync(bundleFile, 'utf8');
  const actualHash = crypto.createHash('sha256').update(bundle).digest('hex');
  if (actualHash !== identity[2].toLowerCase()) {
    throw new Error('[SBC MANIFEST] ' + item.rel + ' canonical stylesheet checksum mismatch');
  }
  const originalCssFile = path.join(dir, cssName);
  if (!fs.existsSync(originalCssFile) || !fs.statSync(originalCssFile).isFile()) {
    throw new Error('[SBC MANIFEST] ' + item.rel + ' missing navigation CSS source asset: ' + cssName);
  }
  const original = fs.readFileSync(originalCssFile, 'utf8');
  const sourceSection = '\n/* source /' + cssName + ' */\n' + original + '\n';
  if (!original || !bundle.includes(sourceSection)) {
    throw new Error('[SBC MANIFEST] ' + item.rel + ' canonical stylesheet does not contain navigation asset: ' + cssName);
  }
}

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
        if (name === cssName) verifyBundledNavigationCss(item, html, cssName);
        else throw new Error('[SBC MANIFEST] ' + item.rel + ' is missing navigation asset registration: ' + name);
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
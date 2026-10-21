'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_V6568_RETIRE_STALE_FORCE_UNLOCK';
const FROM = '65.1.66';
const TO = '65.1.67';

function read(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, 'utf8');
}
function write(root, rel, source) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
}
function apply(root) {
  const pkg = JSON.parse(read(root, 'package.json'));
  const lock = JSON.parse(read(root, 'package-lock.json'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM ||
      lock.version !== FROM || lock.packages?.['']?.version !== FROM) {
    throw new Error(MARKER + ': expected package and lock identity ' + FROM);
  }

  let changedAssets = 0;
  for (const rel of ['public/app.js', 'browser_public/app.js']) {
    let source = read(root, rel);
    if (source === null) continue;
    const before = source;
    // Keep the legacy function definition for compatibility, but remove every invocation.
    source = source.replace(/(?<!function )\bsbcV6557OwnerForceUnlockOnce\s*\(\s*\)\s*;?/g,
      '/* ' + MARKER + ': obsolete client invocation removed */');
    // Also remove direct request statements for the retired endpoint when present.
    source = source.replace(/^[^\n]*(?:fetch|api|request)[^\n]*\/api\/owner\/recovery\/force-unlock[^\n]*;?[ \t]*$/gm,
      '/* ' + MARKER + ': obsolete recovery endpoint request removed */');
    if (source !== before) {
      if (!source.includes(MARKER)) throw new Error(MARKER + ': source edit marker missing');
      write(root, rel, source);
      changedAssets++;
    }
  }

  for (const rel of ['public/index.html', 'browser_public/index.html']) {
    let source = read(root, rel);
    if (source === null) continue;
    source = source.replace(/app\.js\?v=[^"' \t\r\n>]+/g, 'app.js?v=' + TO + '-stale-force-unlock-retired');
    if (!source.includes('SBC_V6568_ASSET_VERSION')) {
      source = source.replace('</head>', '<!-- SBC_V6568_ASSET_VERSION: cache-busted app bundle -->\n</head>');
    }
    write(root, rel, source);
  }

  for (const rel of ['public/sw.js', 'browser_public/sw.js']) {
    let source = read(root, rel);
    if (source === null) continue;
    if (!/const CACHE=['"][^'"]+['"]/.test(source)) {
      throw new Error(MARKER + ': service-worker cache anchor missing in ' + rel);
    }
    source = source.replace(/const CACHE=['"][^'"]+['"]/, "const CACHE='sbc-static-v65-1-67-force-unlock-retired'");
    if (!source.includes('SBC_V6568_CACHE_CLEANUP')) {
      source += "\n/* SBC_V6568_CACHE_CLEANUP */\nself.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)))))});\n";
    }
    write(root, rel, source);
  }

  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.67 retires the obsolete client-side force-unlock trigger and invalidates stale browser assets; server recovery, tenant isolation, and writer-lease safeguards remain fail-closed.';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6568-stale-force-unlock'] = 'node hotfix-assets/v6568-stale-force-unlock-test.js';
  if (!String(pkg.scripts['test:all'] || '').includes('v6568-stale-force-unlock-test.js')) {
    pkg.scripts['test:all'] = String(pkg.scripts['test:all'] || 'node bootstrap.js --verify') + ' && node hotfix-assets/v6568-stale-force-unlock-test.js';
  }
  write(root, 'package.json', JSON.stringify(pkg, null, 2) + '\n');
  lock.version = TO;
  lock.packages[''].version = TO;
  lock.packages[''].description = pkg.description;
  lock.packages[''].scripts = pkg.scripts;
  write(root, 'package-lock.json', JSON.stringify(lock, null, 2) + '\n');

  return { marker: MARKER, version: TO, changedAssets, retiredInvocation: true,
    cacheBusted: true, oldStaticCachesPurgedOnActivation: true,
    recoveryAndWriterLeaseGuardsChanged: false };
}
module.exports = { apply, MARKER, FROM, TO };

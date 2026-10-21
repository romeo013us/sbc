'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_V6566_STATE_PRESERVING_CIRCUIT_BREAKER';
const VERSION = '65.1.65';

function replaceOnce(source, from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) throw new Error(MARKER + ': expected exactly one ' + label + ' anchor, found ' + count);
  return source.replace(from, to);
}
function apply(rootDir) {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== '65.1.64') {
    throw new Error(MARKER + ': expected validated V65.1.64 input, found ' + pkg.name + '@' + pkg.version);
  }
  const js = fs.readFileSync(path.join(__dirname, 'v6566-state-preserving-circuit-breaker.js'), 'utf8');
  for (const rel of ['public/index.html', 'browser_public/index.html']) {
    const file = path.join(rootDir, rel);
    if (!fs.existsSync(file)) {
      if (rel.startsWith('browser_public/')) continue;
      throw new Error(MARKER + ': missing ' + rel);
    }
    let html = fs.readFileSync(file, 'utf8');
    if (!html.includes(MARKER)) {
      html = replaceOnce(html, '</head>', '<script defer src="/sbc-v6566-state-preserving-circuit-breaker.js?v=' + VERSION + '"></script>\n<!-- ' + MARKER + ' -->\n</head>', rel + ' head');
      fs.writeFileSync(file, html);
    }
  }
  for (const rel of ['public/sbc-v6566-state-preserving-circuit-breaker.js', 'browser_public/sbc-v6566-state-preserving-circuit-breaker.js']) {
    const file = path.join(rootDir, rel);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, js);
  }
  pkg.version = VERSION;
  pkg.description = 'SBC OS V65.1.65 adds a state-preserving API circuit breaker and guarded standby diagnostics; existing recovery and tenant protections remain enabled.';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6566-circuit-breaker'] = 'node hotfix-assets/v6566-state-preserving-circuit-breaker-test.js';
  if (!String(pkg.scripts['test:all'] || '').includes('v6566-state-preserving-circuit-breaker-test.js')) {
    pkg.scripts['test:all'] = String(pkg.scripts['test:all'] || 'node bootstrap.js --verify') + ' && node hotfix-assets/v6566-state-preserving-circuit-breaker-test.js';
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const lockPath = path.join(rootDir, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = VERSION;
  lock.packages[''].version = VERSION;
  lock.packages[''].description = pkg.description;
  lock.packages[''].scripts = pkg.scripts;
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
  return {version:VERSION, marker:MARKER};
}
module.exports = {apply, MARKER};

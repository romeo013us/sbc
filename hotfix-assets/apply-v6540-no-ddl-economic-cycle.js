'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'SBC_V6540_NO_DDL_ECONOMIC_CYCLE';
const FROM = '65.1.39';
const TO = '65.1.40';

function once(source, needle, replacement, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(MARKER + ': ' + label + ' anchor count ' + count);
  return source.replace(needle, replacement);
}
function write(root, rel, value) {
  fs.writeFileSync(path.join(root, rel), value);
}
function read(root, rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(MARKER + ': missing ' + rel);
  return fs.readFileSync(p, 'utf8');
}
function apply(root) {
  const rel = 'enterprise/v56220-economic-control.js';
  let source = read(root, rel);
  if (!source.includes(MARKER)) {
    if (!/runEconomicControlCycle\s*\(\s*ctx\s*\)/.test(source)) {
      throw new Error(MARKER + ': runEconomicControlCycle(ctx) anchor missing; refusing an unverified patch');
    }
    source = once(source, "'use strict';",
      "'use strict';\n\n// " + MARKER + ": schema-changing economic mutations require explicit DDL opt-in.\nconst SBC_V6540_DDL_ENABLED = String(process.env.ENABLE_DDL || '').trim().toLowerCase() === 'true';",
      'module strict-mode header');
    source = once(source, 'return await executePrimaryEconomicMutations(ctx);',
      "if (!SBC_V6540_DDL_ENABLED) return {ok:true,suppressed:true,reason:'NO_DDL_RUNTIME_PROFILE'};\n  return await executePrimaryEconomicMutations(ctx);",
      'primary economic mutation call');
    if (!source.includes(MARKER) || !source.includes("reason:'NO_DDL_RUNTIME_PROFILE'")) {
      throw new Error(MARKER + ': mutation suppression verification failed');
    }
    write(root, rel, source);
  } else if (!source.includes("reason:'NO_DDL_RUNTIME_PROFILE'") ||
             !source.includes('SBC_V6540_DDL_ENABLED')) {
    throw new Error(MARKER + ': marker exists but suppression guard is incomplete');
  }

  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(read(root, 'package.json'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM) {
    throw new Error(MARKER + ': expected source package ' + FROM + '; found ' + pkg.version);
  }
  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.40 suppresses economic mutation cycles without explicit DDL opt-in';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6540-no-ddl-economic-cycle'] = 'node hotfix-assets/v6540-no-ddl-economic-cycle-test.js';
  if (!String(pkg.scripts['test:all'] || '').includes('v6540-no-ddl-economic-cycle-test.js')) {
    pkg.scripts['test:all'] = String(pkg.scripts['test:all'] || 'node bootstrap.js --verify') + ' && node hotfix-assets/v6540-no-ddl-economic-cycle-test.js';
  }
  write(root, 'package.json', JSON.stringify(pkg, null, 2) + '\n');

  const lock = JSON.parse(read(root, 'package-lock.json'));
  if (lock.name !== pkg.name || lock.version !== FROM || !lock.packages || !lock.packages[''] || lock.packages[''].version !== FROM) {
    throw new Error(MARKER + ': package-lock identity mismatch');
  }
  lock.version = TO;
  lock.packages[''].version = TO;
  lock.packages[''].description = pkg.description;
  lock.packages[''].scripts = pkg.scripts;
  write(root, 'package-lock.json', JSON.stringify(lock, null, 2) + '\n');

  let identity = read(root, 'config/release-identity.js');
  identity = identity.replace(/const RELEASE_VERSION = '65\.1\.39';/, "const RELEASE_VERSION = '65.1.40';");
  identity = identity.replace(/patch:39/, 'patch:40');
  if (!identity.includes("const RELEASE_VERSION = '65.1.40';") || !identity.includes('patch:40')) {
    throw new Error(MARKER + ': release identity did not advance from V65.1.39');
  }
  identity = identity.replace(/const RELEASE_NAME = '[^']*';/, "const RELEASE_NAME = 'NO_DDL_ECONOMIC_CYCLE_SUPPRESSION';");
  write(root, 'config/release-identity.js', identity);

  let html = read(root, 'public/index.html');
  html = once(html, '<title>SBC Business Command Center — V65.1.39</title>',
    '<title>SBC Business Command Center — V65.1.40</title>', 'browser title');
  write(root, 'public/index.html', html);

  let sw = read(root, 'public/sw.js');
  sw = once(sw, "const CACHE='sbc-static-v65-1-39';", "const CACHE='sbc-static-v65-1-40';", 'service-worker cache');
  if (!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)")) {
    throw new Error(MARKER + ': service-worker old-cache purge guard missing');
  }
  write(root, 'public/sw.js', sw);

  const testSource = path.join(__dirname, 'v6540-no-ddl-economic-cycle-test.js');
  if (!fs.existsSync(testSource)) throw new Error(MARKER + ': regression test source missing');
  const testTarget = path.join(root, 'hotfix-assets', 'v6540-no-ddl-economic-cycle-test.js');
  fs.mkdirSync(path.dirname(testTarget), {recursive:true});
  fs.copyFileSync(testSource, testTarget);
  return {marker:MARKER, version:TO, noDdlSuppressesEconomicMutation:true, existingDdlGatePreserved:true};
}
module.exports = {apply, MARKER, FROM, TO};

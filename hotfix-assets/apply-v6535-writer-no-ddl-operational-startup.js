'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_V6535_WRITER_NO_DDL_OPERATIONAL_STARTUP';
const FROM = '65.1.34';
const TO = '65.1.35';
function onceText(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(MARKER + ': ' + label + ' anchor count ' + count);
  return source.replace(oldText, newText);
}
function edit(root, rel, fn) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(MARKER + ': missing ' + rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  fs.writeFileSync(p, after);
  return after;
}
function apply(root) {
  edit(root, 'server.js', source => {
    if (source.includes(MARKER)) {
      if (!source.includes('!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady')) {
        throw new Error(MARKER + ': marker exists but operational worker guard is incomplete');
      }
      return source;
    }
    source = onceText(
      source,
      "initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){console.log('[SBC_V6524_SINGLE_WRITER_PREVIEW] read-only runtime: skipping notifications, seed/repair writes, and all automation startup.');return;}",
      "initMysql().then(async()=>{if(SBC_RUNTIME_READ_ONLY || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[" + MARKER + "] startup workers held: read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
      'notification and automation startup guard'
    );
    source = onceText(
      source,
      "}).then(async()=>{if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){console.log('SBC_V6524_SINGLE_WRITER_PREVIEW read-only runtime: autonomous sweep and all background mutation timers skipped.');return;}",
      "}).then(async()=>{if(SBC_RUNTIME_READ_ONLY || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[" + MARKER + "] autonomous sweep held: read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
      'autonomous sweep startup guard'
    );
    source = onceText(
      source,
      "else storageMode='mysql-relational-read-only';",
      "else storageMode=SBC_RUNTIME_READ_ONLY?'mysql-relational-read-only':'mysql-relational';",
      'writable storage mode after successful writer hydration'
    );
    return source + '\n// ' + MARKER + ': DDL remains opt-in; verified Published writer can run existing-schema operations without ENABLE_DDL.\n';
  });

  edit(root, 'public/index.html', source => onceText(source, '<title>SBC Business Command Center — V65.1.34</title>', '<title>SBC Business Command Center — V65.1.35</title>', 'browser release title'));
  edit(root, 'public/sw.js', source => {
    source = onceText(source, "const CACHE='sbc-static-v65-1-34';", "const CACHE='sbc-static-v65-1-35';", 'service worker cache namespace');
    if (!source.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)")) {
      throw new Error(MARKER + ': service worker legacy cache purge guard missing');
    }
    return source;
  });

  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM) {
    throw new Error(MARKER + ': expected source package ' + FROM + '; found ' + pkg.version);
  }
  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.35 verified writer operations without startup DDL opt-in';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6535-writer-no-ddl'] = 'node hotfix-assets/v6535-writer-no-ddl-operational-startup-test.js';
  if (!String(pkg.scripts['test:all'] || '').includes('v6535-writer-no-ddl-operational-startup-test.js')) {
    pkg.scripts['test:all'] = (pkg.scripts['test:all'] || 'node bootstrap.js --verify') + ' && node hotfix-assets/v6535-writer-no-ddl-operational-startup-test.js';
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const lockPath = path.join(root, 'package-lock.json');
  if (!fs.existsSync(lockPath)) throw new Error(MARKER + ': package-lock.json missing');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (lock.name !== 'sbc-business-command-center' || lock.version !== FROM) {
    throw new Error(MARKER + ': expected lockfile ' + FROM + '; found ' + lock.version);
  }
  lock.version = TO;
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = TO;
    lock.packages[''].description = pkg.description;
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

  const identPath = path.join(root, 'config', 'release-identity.js');
  edit(root, 'config/release-identity.js', source => {
    source = onceText(source, "const RELEASE_VERSION = '65.1.34';", "const RELEASE_VERSION = '65.1.35';", 'runtime release version');
    source = onceText(source, "const RELEASE_NAME = 'PRICE_CONSISTENCY_AND_CHECKOUT_GUARD';", "const RELEASE_NAME = 'WRITER_NO_DDL_OPERATIONAL_STARTUP';", 'runtime release name');
    return onceText(source, 'major:65,minor:1,patch:34', 'major:65,minor:1,patch:35', 'runtime semantic version');
  });

  const testSource = path.join(__dirname, 'v6535-writer-no-ddl-operational-startup-test.js');
  const testTarget = path.join(root, 'hotfix-assets', 'v6535-writer-no-ddl-operational-startup-test.js');
  if (!fs.existsSync(testSource)) throw new Error(MARKER + ': regression test source missing');
  fs.mkdirSync(path.dirname(testTarget), { recursive: true });
  fs.copyFileSync(testSource, testTarget);
  return { marker: MARKER, version: TO, ddlStillOptIn: true, writerOperationsDoNotRequireDdlFlag: true };
}
module.exports = { apply, MARKER, FROM, TO };

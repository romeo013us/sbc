'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'SBC_V6539_SAFE_NO_DDL_STARTUP';
const FROM = '65.1.38';
const TO = '65.1.39';

function once(source, needle, replacement, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(MARKER + ': ' + label + ' anchor count ' + count);
  return source.replace(needle, replacement);
}
function read(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(MARKER + ': missing ' + rel);
  return fs.readFileSync(file, 'utf8');
}
function write(root, rel, value) {
  fs.writeFileSync(path.join(root, rel), value);
}
function apply(root) {
  let server = read(root, 'server.js');
  if (!server.includes(MARKER)) {
    server = once(server,
      "if(SBC_RUNTIME_READ_ONLY || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6535_WRITER_NO_DDL_OPERATIONAL_STARTUP] startup workers held: read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
      "if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6539_SAFE_NO_DDL_STARTUP] startup workers held: DDL opt-in absent, read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
      'primary MySQL worker startup guard');
    server = once(server,
      "if(SBC_RUNTIME_READ_ONLY || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6535_WRITER_NO_DDL_OPERATIONAL_STARTUP] autonomous sweep held: read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
      "if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6539_SAFE_NO_DDL_STARTUP] autonomous sweep held: DDL opt-in absent, read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
      'autonomous worker startup guard');
    const entry = "const startOperationalRuntime=async()=>{if(SBC_RUNTIME_READ_ONLY){console.log('[SBC_V6524_SINGLE_WRITER_PREVIEW] read-only runtime: background workers and WebSockets not started.');return;}";
    server = once(server, entry, entry +
      "if(!SBC_DDL_ENABLED){console.warn('[SBC_V6539_SAFE_NO_DDL_STARTUP] Published HTTP/API listener remains available; schema-dependent startup workers and WebSockets are deferred because ENABLE_DDL is not true.');return;}",
      'operational runtime safe-mode gate');
    if (!server.includes('MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady')) {
      throw new Error(MARKER + ': recovery and exclusive writer lease guards were lost');
    }
    write(root, 'server.js', server);
  } else if (!server.includes('Published HTTP/API listener remains available') ||
             (server.match(/SBC_V6539_SAFE_NO_DDL_STARTUP/g) || []).length < 3) {
    throw new Error(MARKER + ': marker exists but startup gates are incomplete');
  }

  const pkg = JSON.parse(read(root, 'package.json'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM) {
    throw new Error(MARKER + ': expected package ' + FROM + '; found ' + pkg.version);
  }
  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.39 prevents schema-dependent startup from running without explicit DDL opt-in';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6539-safe-no-ddl-startup'] = 'node hotfix-assets/v6539-safe-no-ddl-startup-test.js';
  if (!String(pkg.scripts['test:all'] || '').includes('v6539-safe-no-ddl-startup-test.js')) {
    pkg.scripts['test:all'] = String(pkg.scripts['test:all'] || 'node bootstrap.js --verify') + ' && node hotfix-assets/v6539-safe-no-ddl-startup-test.js';
  }
  write(root, 'package.json', JSON.stringify(pkg, null, 2) + '\n');

  const lock = JSON.parse(read(root, 'package-lock.json'));
  if (lock.name !== pkg.name || lock.version !== FROM || !lock.packages || !lock.packages[''] || lock.packages[''].version !== FROM) {
    throw new Error(MARKER + ': package-lock root identity mismatch');
  }
  lock.version = TO;
  lock.packages[''].version = TO;
  lock.packages[''].description = pkg.description;
  lock.packages[''].scripts = pkg.scripts;
  write(root, 'package-lock.json', JSON.stringify(lock, null, 2) + '\n');

  let identity = read(root, 'config/release-identity.js');
  identity = once(identity, "const RELEASE_VERSION = '65.1.38';", "const RELEASE_VERSION = '65.1.39';", 'release version');
  identity = once(identity, "const RELEASE_NAME = 'WRITER_HYDRATION_WITHOUT_DDL';", "const RELEASE_NAME = 'SAFE_NO_DDL_STARTUP';", 'release name');
  identity = once(identity, 'major:65,minor:1,patch:38', 'major:65,minor:1,patch:39', 'semantic version');
  write(root, 'config/release-identity.js', identity);

  let html = read(root, 'public/index.html');
  html = once(html, '<title>SBC Business Command Center — V65.1.38</title>', '<title>SBC Business Command Center — V65.1.39</title>', 'browser title');
  write(root, 'public/index.html', html);

  let sw = read(root, 'public/sw.js');
  sw = once(sw, "const CACHE='sbc-static-v65-1-38';", "const CACHE='sbc-static-v65-1-39';", 'service worker cache');
  if (!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)")) {
    throw new Error(MARKER + ': service worker cache cleanup guard missing');
  }
  write(root, 'public/sw.js', sw);

  const testSource = path.join(__dirname, 'v6539-safe-no-ddl-startup-test.js');
  if (!fs.existsSync(testSource)) throw new Error(MARKER + ': regression test source missing');
  const testTarget = path.join(root, 'hotfix-assets', 'v6539-safe-no-ddl-startup-test.js');
  fs.mkdirSync(path.dirname(testTarget), {recursive:true});
  fs.copyFileSync(testSource, testTarget);

  return {marker:MARKER, version:TO, ddlRemainsOptIn:true, recoveryAndLeaseGuardsPreserved:true, startupWorkersHeldWithoutDdl:true};
}
module.exports = {apply, MARKER, FROM, TO};

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const patch = require('./apply-v6538-writer-hydration-without-ddl');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6538-writer-hydration-'));

function put(rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function get(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

try {
  put('server.js', [
    "console.log('[SBC ROLE SOURCE CHECK] env=' + String(process.env.SBC_RUNTIME_ROLE || '<absent>') + ' effective=' + SBC_RUNTIME_ROLE + ' readOnly=' + SBC_RUNTIME_READ_ONLY);",
    "if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){",
    "      // SBC_V6533_STARTUP_DDL_GATE: no startup DDL unless explicitly enabled; hydrate existing tables only.",
    "      // Do not run migrations, seeders, or repairs in this mode.",
    "      try{ await readRelational(); MYSQL_RECOVERY_EVALUATED=true; }catch(e){ MYSQL_RECOVERY_REQUIRED=true; MYSQL_RECOVERY_EVALUATED=true; }",
    "      return true;",
    "    }",
    "    console.log('[SBC_V6528_RUNTIME_WRITER_LEASE] process writer lease acquired; connectionId='+sbcWriterLeaseConnectionId);",
    "    console.log('[SBC_V6524_SINGLE_WRITER_PREVIEW] runtime role=writer; this Published runtime owns MySQL mutations.');",
    "    console.log('[SBC_V6533_STARTUP_DDL_GATE] dedicated durable-session pool initialized; maxConnections=2.');",
    "    await RUNTIME_GATE.ensureSchema();",
    "    // Migration ledger is created/reconciled by ensureEnterpriseSchema() below.",
    "    if(!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady) return;",
    ""
  ].join('\n'));

  put('package.json', JSON.stringify({
    name: 'sbc-business-command-center',
    version: '65.1.37',
    description: 'old',
    scripts: { 'test:all': 'node bootstrap.js --verify' }
  }, null, 2) + '\n');

  put('package-lock.json', JSON.stringify({
    name: 'sbc-business-command-center',
    version: '65.1.37',
    lockfileVersion: 3,
    packages: {
      '': {
        name: 'sbc-business-command-center',
        version: '65.1.37',
        dependencies: {}
      }
    }
  }, null, 2) + '\n');

  put('config/release-identity.js', [
    "const RELEASE_VERSION = '65.1.37';",
    "const RELEASE_NAME = 'EFFECTIVE_RUNTIME_ROLE_SOURCE_FIX';",
    "const RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:37});"
  ].join('\n') + '\n');
  put('public/index.html', '<title>SBC Business Command Center — V65.1.37</title>');
  put('public/sw.js', "const CACHE='sbc-static-v65-1-37';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('hotfix-assets/v6538-writer-hydration-without-ddl-test.js', '// test source copied to built runtime');

  const result = patch.apply(root);
  const server = get('server.js');

  assert.equal(result.version, '65.1.38');
  assert.equal(result.leaseBeforeHydration, true);
  assert.equal(result.ddlOptInPreserved, true);

  assert.match(server,
    /if\(SBC_RUNTIME_READ_ONLY\)\{\n\s*\/\/ SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL:/,
    'only Preview/read-only role should take the read-only branch');
  assert.doesNotMatch(server,
    /if\(SBC_RUNTIME_READ_ONLY \|\| !SBC_DDL_ENABLED\)/,
    'disabled DDL must not convert the Published writer into Preview');

  const leaseAt = server.indexOf('process writer lease acquired; boot_id=');
  const hydrateAt = server.indexOf('if(!SBC_DDL_ENABLED){');
  const ddlAt = server.indexOf('await RUNTIME_GATE.ensureSchema();');
  assert.ok(leaseAt >= 0 && hydrateAt > leaseAt,
    'writer lease is acquired before no-DDL hydration');
  assert.ok(ddlAt > hydrateAt,
    'schema initialization remains after the no-DDL early return');

  const hydrateBlock = server.slice(hydrateAt, ddlAt);
  assert.match(hydrateBlock, /await readRelational\(\)/);
  assert.match(hydrateBlock, /SELECT DATABASE\(\) AS database_name/);
  assert.match(hydrateBlock, /VERIFIED_PRE_CORRUPTION_CRM_COUNT/);
  assert.match(hydrateBlock, /MYSQL_RECOVERY_EVALUATED=true/);
  assert.match(hydrateBlock, /writer hydration failed closed/);
  assert.match(hydrateBlock, /return true;/);
  assert.match(server, /!MYSQL_RECOVERY_EVALUATED \|\| MYSQL_RECOVERY_REQUIRED \|\| !sbcWriterLeaseReady/,
    'operational workers remain protected by recovery and lease gates');
  assert.match(server, /\[SBC ROLE SOURCE CHECK\] boot_id=.*pid=.*port=/,
    'role diagnostic is correlated to a unique boot, PID, and port');
  assert.match(server, /process writer lease acquired; boot_id=.*pid=.*port=.*connectionId=/,
    'lease acquisition has the same boot correlation fields');

  const pkg = JSON.parse(get('package.json'));
  const lock = JSON.parse(get('package-lock.json'));
  assert.equal(pkg.version, '65.1.38');
  assert.equal(lock.version, '65.1.38');
  assert.equal(lock.packages[''].version, '65.1.38');
  assert.match(pkg.scripts['test:all'], /v6538-writer-hydration-without-ddl-test\.js/);
  assert.match(get('config/release-identity.js'), /patch:38/);
  assert.match(get('public/index.html'), /V65\.1\.38/);
  assert.match(get('public/sw.js'), /sbc-static-v65-1-38/);
  assert.ok(fs.existsSync(path.join(root, 'hotfix-assets', 'v6538-writer-hydration-without-ddl-test.js')));

  console.log('[SBC V65.1.38] writer-lease-before-hydration regression PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

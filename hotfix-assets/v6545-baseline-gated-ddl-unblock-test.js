'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const patch = require('./apply-v6545-baseline-gated-ddl-unblock');

assert.equal(patch.shouldAutoEnableDdl({
  envMissing:true, customers:248, minimum:248,
  recoveryRequired:false, recoveryEvaluated:true, writerLeaseReady:true
}), true, 'missing secret is bypassed only after baseline, recovery, and writer lease are verified');
for (const scenario of [
  {envMissing:false, customers:300, minimum:248, recoveryRequired:false, recoveryEvaluated:true, writerLeaseReady:true},
  {envMissing:true, customers:247, minimum:248, recoveryRequired:false, recoveryEvaluated:true, writerLeaseReady:true},
  {envMissing:true, customers:300, minimum:248, recoveryRequired:true, recoveryEvaluated:true, writerLeaseReady:true},
  {envMissing:true, customers:300, minimum:248, recoveryRequired:false, recoveryEvaluated:false, writerLeaseReady:true},
  {envMissing:true, customers:300, minimum:248, recoveryRequired:false, recoveryEvaluated:true, writerLeaseReady:false},
  {envMissing:true, customers:NaN, minimum:248, recoveryRequired:false, recoveryEvaluated:true, writerLeaseReady:true}
]) {
  assert.equal(patch.shouldAutoEnableDdl(scenario), false, 'unsafe or incomplete state must remain gated');
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v6545-ddl-gate-'));
function put(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function get(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

try {
  put('server.js', [
    "const SBC_DDL_ENABLED = String(process.env.ENABLE_DDL || '').trim().toLowerCase() === 'true'; // SBC_V6533_STARTUP_DDL_GATE",
    "    if(!SBC_DDL_ENABLED){",
    "      // SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL: the writer lease is already acquired; do not run startup DDL without explicit opt-in.",
    "      try{",
    "        await mysqlPool.query('SELECT DATABASE() AS database_name');",
    "        await readRelational();",
    "        const [[counts]]=await mysqlPool.query('SELECT (SELECT COUNT(*) FROM sbc_customers) AS customers,(SELECT COUNT(*) FROM sbc_quotes) AS quotes,(SELECT COUNT(*) FROM sbc_orders) AS orders,(SELECT COUNT(*) FROM sbc_renewals) AS renewals');",
    "        if(Number(counts?.customers||0)<VERIFIED_PRE_CORRUPTION_CRM_COUNT){MYSQL_RECOVERY_REQUIRED=true;storageMode='mysql-recovery-required';}",
    "        else storageMode='mysql-relational';",
    "        MYSQL_RECOVERY_EVALUATED=true;",
    "        console.log('[SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL] boot_id='+String(process.env.SBC_BOOT_ID||'<not-set>')+' pid='+process.pid+' writer lease held; existing-schema hydration complete; startup DDL/migrations/seeds skipped.');",
    "      }catch(e){",
    "        MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';",
    "        console.error('[SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL] boot_id='+String(process.env.SBC_BOOT_ID||'<not-set>')+' pid='+process.pid+' writer hydration failed closed:',String(e?.message||e));",
    "      }",
    "      return true;",
    "    }",
    "    await RUNTIME_GATE.ensureSchema();",
    "    // Migration ledger is created/reconciled by ensureEnterpriseSchema() below.",
    "if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6539_SAFE_NO_DDL_STARTUP] startup workers held: DDL opt-in absent, read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
    "if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED || !MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){console.warn('[SBC_V6539_SAFE_NO_DDL_STARTUP] autonomous sweep held: DDL opt-in absent, read-only runtime, recovery not evaluated/required, or exclusive writer lease unavailable.');return;}",
    "const startOperationalRuntime=async()=>{if(SBC_RUNTIME_READ_ONLY){return;}if(!SBC_DDL_ENABLED){return;}await SBC_GOD_EVENTS.ensureTables();}",
    "if(!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady){return;}",
    "await RUNTIME_GATE.ensureSchema();"
  ].join('\n'));

  put('package.json', JSON.stringify({
    name:'sbc-business-command-center', version:'65.1.43', description:'old',
    scripts:{'test:all':'node bootstrap.js --verify'}, dependencies:{}
  }, null, 2)+'\n');
  put('package-lock.json', JSON.stringify({
    name:'sbc-business-command-center', version:'65.1.43', lockfileVersion:3,
    packages:{'':{name:'sbc-business-command-center',version:'65.1.43',description:'old',dependencies:{},scripts:{}}}
  }, null, 2)+'\n');
  put('config/release-identity.js', "const RELEASE_VERSION = '65.1.43';\nconst RELEASE_NAME = 'LEAD_IMPORT_COMMIT_CONTRACT';\nconst RELEASE = Object.freeze({version:RELEASE_VERSION,name:RELEASE_NAME,major:65,minor:1,patch:43});\n");
  put('public/index.html', '<title>SBC Business Command Center — V65.1.43</title><script src="/sbc-ask-kim-drag-v6544.js?v=65.1.43-kim-drag"></script>');
  put('public/sw.js', "const CACHE='sbc-static-v65-1-44-kim-drag';const keys=await caches.keys();await Promise.all(keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE).map(k=>caches.delete(k)));");
  put('hotfix-assets/v6545-baseline-gated-ddl-unblock-test.js', '// test source copied to built runtime');

  const result = patch.apply(root);
  const server = get('server.js');
  assert.equal(result.version, '65.1.44');
  assert.equal(result.requiresNoAdditionalSecret, true);
  assert.equal(result.baselineRecoveryAndExclusiveWriterChecksPreserved, true);
  assert.match(server, /let SBC_DDL_ENABLED = String\(process\.env\.ENABLE_DDL/);
  assert.match(server, /const SBC_DDL_ENV_MISSING = !String\(process\.env\.ENABLE_DDL/);
  assert.match(server, /function sbcMayAutoEnableDdl/);
  assert.match(server, /customers:verifiedCustomerCount,minimum:VERIFIED_PRE_CORRUPTION_CRM_COUNT/);
  assert.match(server, /recoveryRequired:MYSQL_RECOVERY_REQUIRED,recoveryEvaluated:MYSQL_RECOVERY_EVALUATED,writerLeaseReady:sbcWriterLeaseReady/);
  assert.match(server, /process.env.ENABLE_DDL='true'/);
  assert.match(server, /verified customer baseline is short/);
  assert.match(server, /startup schema work remains gated/);
  assert.match(server, /await RUNTIME_GATE\.ensureSchema\(\);/);
  assert.match(server, /!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady/);
  assert.match(server, /SBC_V6539_SAFE_NO_DDL_STARTUP/);
  assert.ok(server.includes('const startOperationalRuntime=async()=>{if(SBC_RUNTIME_READ_ONLY){return;}if(!SBC_DDL_ENABLED){return;}await SBC_GOD_EVENTS.ensureTables();}'), 'schema-dependent operations remain guarded behind the DDL and read-only conditions');
  assert.equal(JSON.parse(get('package.json')).version, '65.1.44');
  assert.equal(JSON.parse(get('package-lock.json')).version, '65.1.44');
  assert.equal(JSON.parse(get('package-lock.json')).packages[''].version, '65.1.44');
  assert.match(get('config/release-identity.js'), /patch:44/);
  assert.match(get('public/index.html'), /V65.1.44/);
  assert.match(get('public/index.html'), /v=65.1.44-baseline-ddl/);
  assert.match(get('public/sw.js'), /sbc-static-v65-1-44-baseline-ddl/);
  assert.ok(fs.existsSync(path.join(root, 'hotfix-assets', 'v6545-baseline-gated-ddl-unblock-test.js')));
  console.log('[SBC V65.1.44] baseline-gated DDL activation and retained recovery/writer protections PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'SBC_V6545_BASELINE_GATED_DDL_UNBLOCK';
const FROM = '65.1.43';
const TO = '65.1.44';

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
function shouldAutoEnableDdl({ envMissing, customers, minimum, recoveryRequired, recoveryEvaluated, writerLeaseReady }) {
  return Boolean(envMissing) &&
    Number.isFinite(Number(customers)) &&
    Number(customers) >= Number(minimum) &&
    recoveryEvaluated === true &&
    recoveryRequired !== true &&
    writerLeaseReady === true;
}

function apply(root) {
  let server = read(root, 'server.js');

  if (!server.includes(MARKER)) {
    server = once(
      server,
      "const SBC_DDL_ENABLED = String(process.env.ENABLE_DDL || '').trim().toLowerCase() === 'true'; // SBC_V6533_STARTUP_DDL_GATE",
      "let SBC_DDL_ENABLED = String(process.env.ENABLE_DDL || '').trim().toLowerCase() === 'true';\nconst SBC_DDL_ENV_MISSING = !String(process.env.ENABLE_DDL || '').trim(); // " + MARKER,
      'make runtime DDL state refreshable without adding a GoDaddy secret'
    );

    const oldHydration = [
      '    if(!SBC_DDL_ENABLED){',
      '      // SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL: the writer lease is already acquired; do not run startup DDL without explicit opt-in.',
      '      try{',
      "        await mysqlPool.query('SELECT DATABASE() AS database_name');",
      '        await readRelational();',
      "        const [[counts]]=await mysqlPool.query('SELECT (SELECT COUNT(*) FROM sbc_customers) AS customers,(SELECT COUNT(*) FROM sbc_quotes) AS quotes,(SELECT COUNT(*) FROM sbc_orders) AS orders,(SELECT COUNT(*) FROM sbc_renewals) AS renewals');",
      "        if(Number(counts?.customers||0)<VERIFIED_PRE_CORRUPTION_CRM_COUNT){MYSQL_RECOVERY_REQUIRED=true;storageMode='mysql-recovery-required';}",
      "        else storageMode='mysql-relational';",
      '        MYSQL_RECOVERY_EVALUATED=true;',
      "        console.log('[SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL] boot_id='+String(process.env.SBC_BOOT_ID||'<not-set>')+' pid='+process.pid+' writer lease held; existing-schema hydration complete; startup DDL/migrations/seeds skipped.');",
      '      }catch(e){',
      "        MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';",
      "        console.error('[SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL] boot_id='+String(process.env.SBC_BOOT_ID||'<not-set>')+' pid='+process.pid+' writer hydration failed closed:',String(e?.message||e));",
      '      }',
      '      return true;',
      '    }',
      '    await RUNTIME_GATE.ensureSchema();'
    ].join('\n');

    const newHydration = [
      '    if(!SBC_DDL_ENABLED){',
      '      // ' + MARKER + ': no extra secret slot is needed; enable startup schema work only after baseline, recovery, and exclusive writer checks.',
      '      try{',
      "        await mysqlPool.query('SELECT DATABASE() AS database_name');",
      '        await readRelational();',
      "        const [[counts]]=await mysqlPool.query('SELECT (SELECT COUNT(*) FROM sbc_customers) AS customers,(SELECT COUNT(*) FROM sbc_quotes) AS quotes,(SELECT COUNT(*) FROM sbc_orders) AS orders,(SELECT COUNT(*) FROM sbc_renewals) AS renewals');",
      '        const verifiedCustomerCount=Number(counts?.customers||0);',
      '        if(verifiedCustomerCount<VERIFIED_PRE_CORRUPTION_CRM_COUNT){',
      "          MYSQL_RECOVERY_REQUIRED=true;storageMode='mysql-recovery-required';MYSQL_RECOVERY_EVALUATED=true;",
      "          console.error('[" + MARKER + "] startup schema work held: verified customer baseline is short; customers='+verifiedCustomerCount+' required='+VERIFIED_PRE_CORRUPTION_CRM_COUNT+'. Restore authoritative records; do not fabricate rows.');",
      '          return true;',
      '        }',
      "        storageMode='mysql-relational';",
      '        MYSQL_RECOVERY_EVALUATED=true;',
      '        if(sbcMayAutoEnableDdl({envMissing:SBC_DDL_ENV_MISSING,customers:verifiedCustomerCount,minimum:VERIFIED_PRE_CORRUPTION_CRM_COUNT,recoveryRequired:MYSQL_RECOVERY_REQUIRED,recoveryEvaluated:MYSQL_RECOVERY_EVALUATED,writerLeaseReady:sbcWriterLeaseReady})){',
      "          process.env.ENABLE_DDL='true';",
      '          SBC_DDL_ENABLED=true;',
      "          console.warn('[" + MARKER + "] ENABLE_DDL secret was absent; enabling Published-writer startup schema work after existing-schema hydration, verified customer baseline, clear recovery state, and exclusive writer lease.');",
      '        } else {',
      "          console.warn('[" + MARKER + "] startup schema work remains gated: explicit DDL opt-out, recovery lock, or exclusive writer lease check failed.');",
      '          return true;',
      '        }',
      '      }catch(e){',
      "        MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';",
      "        console.error('[" + MARKER + "] existing-schema hydration/recovery check failed closed:',String(e?.message||e));",
      '        return true;',
      '      }',
      '    }',
      '    await RUNTIME_GATE.ensureSchema();'
    ].join('\n');

    server = once(server, oldHydration, newHydration, 'replace unconditional no-DDL early return with baseline-gated activation');

    // Existing recovery and single-writer protections must remain in the executable runtime.
    for (const required of [
      'sbcWriterLeaseReady',
      'VERIFIED_PRE_CORRUPTION_CRM_COUNT',
      '!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady',
      'SBC_READ_ONLY_RUNTIME',
      'ENABLE_DDL',
      'SBC_V6539_SAFE_NO_DDL_STARTUP'
    ]) {
      if (!server.includes(required)) throw new Error(MARKER + ': required runtime guard missing: ' + required);
    }
    server = once(
      server,
      "const SBC_DDL_ENV_MISSING = !String(process.env.ENABLE_DDL || '').trim(); // " + MARKER,
      "const SBC_DDL_ENV_MISSING = !String(process.env.ENABLE_DDL || '').trim(); // " + MARKER + "\nfunction sbcMayAutoEnableDdl({envMissing,customers,minimum,recoveryRequired,recoveryEvaluated,writerLeaseReady}){return Boolean(envMissing)&&Number.isFinite(Number(customers))&&Number(customers)>=Number(minimum)&&recoveryEvaluated===true&&recoveryRequired!==true&&writerLeaseReady===true;}",
      'add narrow baseline-gate predicate'
    );
    write(root, 'server.js', server);
  } else {
    for (const required of [
      'SBC_DDL_ENV_MISSING',
      'function sbcMayAutoEnableDdl',
      'verified customer baseline is short',
      'startup schema work remains gated',
      'sbcWriterLeaseReady',
      'SBC_V6539_SAFE_NO_DDL_STARTUP'
    ]) {
      if (!server.includes(required)) throw new Error(MARKER + ': marker exists but runtime guard is incomplete: ' + required);
    }
  }

  const pkg = JSON.parse(read(root, 'package.json'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM) {
    throw new Error(MARKER + ': expected package ' + FROM + '; found ' + pkg.version);
  }
  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.44 removes the extra ENABLE_DDL secret-slot blocker with baseline-gated Published-writer startup';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6545-baseline-gated-ddl-unblock'] = 'node hotfix-assets/v6545-baseline-gated-ddl-unblock-test.js';
  if (!String(pkg.scripts['test:all'] || '').includes('v6545-baseline-gated-ddl-unblock-test.js')) {
    pkg.scripts['test:all'] = String(pkg.scripts['test:all'] || 'node bootstrap.js --verify') + ' && node hotfix-assets/v6545-baseline-gated-ddl-unblock-test.js';
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
  identity = once(identity, "const RELEASE_VERSION = '65.1.43';", "const RELEASE_VERSION = '65.1.44';", 'release version');
  identity = once(identity, "const RELEASE_NAME = 'LEAD_IMPORT_COMMIT_CONTRACT';", "const RELEASE_NAME = 'BASELINE_GATED_DDL_UNBLOCK';", 'release name');
  identity = once(identity, 'major:65,minor:1,patch:43', 'major:65,minor:1,patch:44', 'semantic version');
  write(root, 'config/release-identity.js', identity);

  let html = read(root, 'public/index.html');
  html = once(html, 'SBC Business Command Center — V65.1.43', 'SBC Business Command Center — V65.1.44', 'browser release title');
  if (html.includes('sbc-ask-kim-drag-v6544.js?v=65.1.43-kim-drag')) {
    html = once(html, 'sbc-ask-kim-drag-v6544.js?v=65.1.43-kim-drag', 'sbc-ask-kim-drag-v6544.js?v=65.1.44-baseline-ddl', 'Ask Kim cache-busting URL');
  }
  write(root, 'public/index.html', html);

  let sw = read(root, 'public/sw.js');
  const cache = sw.match(/const CACHE='[^']+'/);
  if (!cache) throw new Error(MARKER + ': service-worker cache declaration missing');
  sw = sw.replace(cache[0], "const CACHE='sbc-static-v65-1-44-baseline-ddl'");
  if (!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)")) {
    throw new Error(MARKER + ': old-cache purge guard missing');
  }
  write(root, 'public/sw.js', sw);

  const testSource = path.join(__dirname, 'v6545-baseline-gated-ddl-unblock-test.js');
  if (!fs.existsSync(testSource)) throw new Error(MARKER + ': regression test source missing');
  const testTarget = path.join(root, 'hotfix-assets', 'v6545-baseline-gated-ddl-unblock-test.js');
  fs.mkdirSync(path.dirname(testTarget), { recursive: true });
  fs.copyFileSync(testSource, testTarget);

  const versionPath = path.join(root, 'VERSION');
  if (fs.existsSync(versionPath)) {
    const version = read(root, 'VERSION');
    write(root, 'VERSION', version.replace(/65\.1\.43/g, '65.1.44'));
  }

  return {marker:MARKER,version:TO,requiresNoAdditionalSecret:true,baselineRecoveryAndExclusiveWriterChecksPreserved:true};
}

module.exports = { apply, MARKER, FROM, TO, shouldAutoEnableDdl };

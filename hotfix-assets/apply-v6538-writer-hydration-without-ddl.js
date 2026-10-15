'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL';
const FROM = '65.1.37';
const TO = '65.1.38';

function onceText(source, needle, replacement, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) {
    throw new Error(MARKER + ': ' + label + ' anchor count ' + count);
  }
  return source.replace(needle, replacement);
}

function replaceOne(source, pattern, replacement, label) {
  const matches = source.match(pattern) || [];
  if (matches.length !== 1) {
    throw new Error(MARKER + ': ' + label + ' match count ' + matches.length);
  }
  return source.replace(pattern, replacement);
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function apply(root) {
  const serverPath = path.join(root, 'server.js');
  let server = fs.readFileSync(serverPath, 'utf8');

  if (!server.includes(MARKER)) {
    const ddlCoupledPreviewBranch =
      "if(SBC_RUNTIME_READ_ONLY || !SBC_DDL_ENABLED){\n" +
      "      // SBC_V6533_STARTUP_DDL_GATE: no startup DDL unless explicitly enabled; hydrate existing tables only.\n" +
      "      // Do not run migrations, seeders, or repairs in this mode.";

    const roleOnlyPreviewBranch =
      "if(SBC_RUNTIME_READ_ONLY){\n" +
      "      // " + MARKER + ": only the explicit Preview/read-only role takes the Preview hydration path.\n" +
      "      // Published writer reaches lease acquisition even when startup DDL is disabled.";

    server = onceText(
      server,
      ddlCoupledPreviewBranch,
      roleOnlyPreviewBranch,
      'separate Preview role from DDL opt-in'
    );

    const schemaAnchor =
      "    await RUNTIME_GATE.ensureSchema();\n" +
      "    // Migration ledger is created/reconciled by ensureEnterpriseSchema() below.";

    const existingSchemaHydration =
      "    if(!SBC_DDL_ENABLED){\n" +
      "      // " + MARKER + ": this block is reached only after the writer-lease acquisition path.\n" +
      "      // Hydrate and evaluate recovery using SELECTs only; never run DDL, migrations, seeds, or repairs here.\n" +
      "      try{\n" +
      "        await mysqlPool.query('SELECT DATABASE() AS database_name');\n" +
      "        await readRelational();\n" +
      "        const [[counts]]=await mysqlPool.query('SELECT (SELECT COUNT(*) FROM sbc_customers) AS customers,(SELECT COUNT(*) FROM sbc_quotes) AS quotes,(SELECT COUNT(*) FROM sbc_orders) AS orders,(SELECT COUNT(*) FROM sbc_renewals) AS renewals');\n" +
      "        if(Number(counts?.customers||0)<VERIFIED_PRE_CORRUPTION_CRM_COUNT){MYSQL_RECOVERY_REQUIRED=true;storageMode='mysql-recovery-required';}\n" +
      "        else storageMode='mysql-relational';\n" +
      "        MYSQL_RECOVERY_EVALUATED=true;\n" +
      "        console.log('[" + MARKER + "] writer lease held; existing-schema hydration complete; DDL/migrations/seeds skipped.');\n" +
      "      }catch(e){\n" +
      "        MYSQL_RECOVERY_REQUIRED=true;MYSQL_RECOVERY_EVALUATED=true;storageMode='mysql-recovery-required';\n" +
      "        console.error('[" + MARKER + "] writer hydration failed closed:',String(e?.message||e));\n" +
      "      }\n" +
      "      return true;\n" +
      "    }\n" +
      schemaAnchor;

    server = onceText(
      server,
      schemaAnchor,
      existingSchemaHydration,
      'insert no-DDL writer hydration after lease path and before schema initialization'
    );

    // The writer lease patch must remain before this no-DDL hydration branch.
    const leaseLog = "process writer lease acquired; connectionId=";
    if (!server.includes(leaseLog)) {
      throw new Error(MARKER + ': writer lease acquisition diagnostic missing');
    }
    if (server.indexOf(leaseLog) > server.indexOf("if(!SBC_DDL_ENABLED){")) {
      throw new Error(MARKER + ': no-DDL hydration appears before the writer lease path');
    }
    fs.writeFileSync(serverPath, server);
  } else {
    if (!server.includes("if(!SBC_DDL_ENABLED){") ||
        !server.includes("SBC_V6538_WRITER_HYDRATION_WITHOUT_DDL") ||
        !server.includes("writer hydration failed closed")) {
      throw new Error(MARKER + ': marker exists but no-DDL writer hydration is incomplete');
    }
  }

  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM) {
    throw new Error(MARKER + ': expected package ' + FROM + '; found ' + pkg.version);
  }
  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.38 Published writer hydration with startup DDL safely opt-in';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6538-writer-hydration'] = 'node hotfix-assets/v6538-writer-hydration-without-ddl-test.js';
  const testAll = String(pkg.scripts['test:all'] || '');
  if (!testAll.includes('v6538-writer-hydration-without-ddl-test.js')) {
    pkg.scripts['test:all'] = testAll + ' && node hotfix-assets/v6538-writer-hydration-without-ddl-test.js';
  }
  writeJson(pkgPath, pkg);

  const lockPath = path.join(root, 'package-lock.json');
  if (!fs.existsSync(lockPath)) throw new Error(MARKER + ': package-lock.json missing');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (lock.name !== pkg.name || lock.version !== FROM) {
    throw new Error(MARKER + ': expected lockfile ' + FROM + '; found ' + lock.version);
  }
  lock.version = TO;
  lock.packages = lock.packages || {};
  lock.packages[''] = lock.packages[''] || {};
  lock.packages[''].name = pkg.name;
  lock.packages[''].version = TO;
  lock.packages[''].description = pkg.description;
  lock.packages[''].scripts = pkg.scripts;
  writeJson(lockPath, lock);

  const identityPath = path.join(root, 'config', 'release-identity.js');
  let identity = fs.readFileSync(identityPath, 'utf8');
  identity = replaceOne(identity, /const RELEASE_VERSION = '65\.1\.37';/,
    "const RELEASE_VERSION = '65.1.38';", 'release version');
  identity = replaceOne(identity, /const RELEASE_NAME = 'EFFECTIVE_RUNTIME_ROLE_SOURCE_FIX';/,
    "const RELEASE_NAME = 'WRITER_HYDRATION_WITHOUT_DDL';", 'release name');
  identity = replaceOne(identity, /major:65,minor:1,patch:37/,
    'major:65,minor:1,patch:38', 'semantic version');
  fs.writeFileSync(identityPath, identity);

  const htmlPath = path.join(root, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = replaceOne(html, /<title>SBC Business Command Center — V65\.1\.37<\/title>/,
    '<title>SBC Business Command Center — V65.1.38</title>', 'browser title');
  fs.writeFileSync(htmlPath, html);

  const swPath = path.join(root, 'public', 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = replaceOne(sw, /const CACHE='sbc-static-v65-1-37';/,
    "const CACHE='sbc-static-v65-1-38';", 'service worker cache namespace');
  if (!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)")) {
    throw new Error(MARKER + ': service-worker old-cache purge guard missing');
  }
  fs.writeFileSync(swPath, sw);

  const testSource = path.join(__dirname, 'v6538-writer-hydration-without-ddl-test.js');
  const testTarget = path.join(root, 'hotfix-assets', 'v6538-writer-hydration-without-ddl-test.js');
  if (!fs.existsSync(testSource)) throw new Error(MARKER + ': regression test source missing');
  fs.mkdirSync(path.dirname(testTarget), { recursive: true });
  fs.copyFileSync(testSource, testTarget);

  return { marker: MARKER, version: TO, writerLeaseBeforeHydration: true, ddlOptInPreserved: true };
}

module.exports = { apply, MARKER, FROM, TO };

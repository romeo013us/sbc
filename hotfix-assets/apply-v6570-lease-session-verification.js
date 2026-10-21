'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_V6570_LEASE_SESSION_VERIFICATION';
const FROM = '65.1.68';
const TO = '65.1.70';

function read(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(MARKER + ': missing ' + rel);
  return fs.readFileSync(file, 'utf8');
}
function write(root, rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}
function apply(root) {
  const pkg = JSON.parse(read(root, 'package.json'));
  const lock = JSON.parse(read(root, 'package-lock.json'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM ||
      lock.version !== FROM || lock.packages?.['']?.version !== FROM) {
    throw new Error(MARKER + ': expected package and lock identity ' + FROM);
  }

  let server = read(root, 'server.js');
  if (!server.includes(MARKER)) {
    // The preceding lease patch may already have added CONNECTION_ID(). Support
    // both the original query and that already-upgraded query without duplicating SQL.
    const originalQuery = /([A-Za-z_$][\w$]*)\.query\(\s*(['"])SELECT\s+IS_USED_LOCK\(\?\)\s+(?:AS\s+)?owner\2/gi;
    server = server.replace(originalQuery, (_match, conn, quote) =>
      conn + '.query(' + quote + 'SELECT CONNECTION_ID() AS sessionId, IS_USED_LOCK(?) AS owner' + quote);

    // Match the row alias and lease-ID variable used by each concrete guard.
    const guard = /if\s*\(\s*Number\s*\(\s*([A-Za-z_$][\w$]*)\s*&&\s*\1\.owner\s*\)\s*!==\s*([A-Za-z_$][\w$]*)\s*\)\s*throw[^;]*;/g;
    let guardCount = 0;
    server = server.replace(guard, (_match, row, leaseId) => {
      guardCount += 1;
      return "if(Number(" + row + "&&" + row + ".sessionId)!==" + leaseId + ")throw Object.assign(new Error('writer lease session identity changed'),{code:'SBC_WRITER_LEASE_SESSION_CHANGED'});if(Number(" + row + "&&" + row + ".owner)!==" + leaseId + ")throw Object.assign(new Error('writer lease ownership changed'),{code:'SBC_WRITER_LEASE_OWNERSHIP_CHANGED'});";
    });
    const lockQueryCount = (server.match(/IS_USED_LOCK\s*\(\s*\?\s*\)\s+(?:AS\s+)?owner/gi) || []).length;
    const sessionQueryCount = (server.match(/CONNECTION_ID\s*\(\s*\)\s+AS\s+sessionId/gi) || []).length;
    if (guardCount < 1) {
      const nearby = (server.match(/.{0,80}IS_USED_LOCK.{0,140}/g) || []).slice(0, 4).join(' | ');
      throw new Error(MARKER + ': no lease ownership guards found; lock queries=' + lockQueryCount + '; nearby=' + (nearby || '<none>'));
    }
    if (lockQueryCount !== guardCount || sessionQueryCount < guardCount) {
      throw new Error(MARKER + ': query/guard/session counts mismatch: queries=' + lockQueryCount + ', guards=' + guardCount + ', sessionQueries=' + sessionQueryCount);
    }
    server = server.replace(
      "console.error('['+MARKER+'] lease heartbeat/reconnect failed; writes remain recovery-gated; retry scheduled:',String(e&&e.message||e),'retryDelayMs='+sbcWriterLeaseRetryDelayMs);",
      "console.error('[SBC_V6564_MYSQL_LEASE_LIFECYCLE] lease heartbeat/reconnect failed; writes remain recovery-gated; retry scheduled:',JSON.stringify({code:String(e&&e.code||'UNKNOWN').slice(0,80),errno:Number.isFinite(Number(e&&e.errno))?Number(e.errno):null,sqlState:String(e&&e.sqlState||'').slice(0,16)||null,message:String(e&&e.message||e).slice(0,240),retryDelayMs:sbcWriterLeaseRetryDelayMs}));"
    );
    if (!server.includes('CONNECTION_ID() AS sessionId') || !server.includes('SBC_WRITER_LEASE_SESSION_CHANGED')) {
      throw new Error(MARKER + ': session-identity verification not installed');
    }
    write(root, 'server.js', server);
  }

  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.70 verifies dedicated MySQL lease session identity and advisory-lock ownership on the same connection; recovery gates and tenant boundaries remain fail-closed.';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6570-lease-session-verification'] = 'node hotfix-assets/v6570-lease-session-verification-test.js';
  if (!String(pkg.scripts['test:all'] || '').includes('v6570-lease-session-verification-test.js')) {
    pkg.scripts['test:all'] = String(pkg.scripts['test:all'] || 'node bootstrap.js --verify') + ' && node hotfix-assets/v6570-lease-session-verification-test.js';
  }
  write(root, 'package.json', JSON.stringify(pkg, null, 2) + '\n');
  lock.version = TO;
  lock.packages[''].version = TO;
  lock.packages[''].description = pkg.description;
  lock.packages[''].scripts = pkg.scripts;
  write(root, 'package-lock.json', JSON.stringify(lock, null, 2) + '\n');

  const assets = path.join(root, 'hotfix-assets');
  fs.mkdirSync(assets, { recursive: true });
  fs.copyFileSync(__filename, path.join(assets, 'apply-v6570-lease-session-verification.js'));
  fs.copyFileSync(path.join(__dirname, 'v6570-lease-session-verification-test.js'), path.join(assets, 'v6570-lease-session-verification-test.js'));
  return { marker: MARKER, version: TO, sameSessionConnectionIdChecked: true, advisoryLockOwnerChecked: true, recoveryGateChanged: false, tenantIsolationChanged: false };
}
module.exports = { apply, MARKER, FROM, TO };

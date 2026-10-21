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
function replaceMatches(source, pattern, replacer, label) {
  let count = 0;
  const result = source.replace(pattern, (...args) => {
    count += 1;
    return replacer(...args);
  });
  if (count < 1) {
    const nearby = (source.match(/.{0,70}IS_USED_LOCK.{0,100}/g) || []).slice(0, 4).join(' | ');
    throw new Error(MARKER + ': expected at least one ' + label + ' anchor, found 0; nearby lock-query text=' + (nearby || '<none>'));
  }
  return { source: result, count };
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
    // Match the SQL call independent of spacing, quote style, alias casing,
    // connection-variable name, or formatting of the argument list.
    const queryResult = replaceMatches(
      server,
      /([A-Za-z_$][\w$]*)\.query\(\s*(['"])SELECT\s+IS_USED_LOCK\(\?\)\s+(?:AS\s+)?owner\2/gi,
      (_match, conn, quote) => conn + '.query(' + quote + 'SELECT CONNECTION_ID() AS sessionId, IS_USED_LOCK(?) AS owner' + quote + ',[SBC_RUNTIME_WRITER_LOCK_NAME])',
      'dedicated-session ownership query'
    );
    server = queryResult.source;
    const ownerResult = replaceMatches(
      server,
      /if\s*\(\s*Number\(r\s*&&\s*r\.owner\)\s*!==\s*leaseId\s*\)\s*throw new Error\(['"]writer lease ownership changed['"]\);/g,
      "if(Number(r&&r.sessionId)!==leaseId)throw Object.assign(new Error('writer lease session identity changed'),{code:'SBC_WRITER_LEASE_SESSION_CHANGED'});if(Number(r&&r.owner)!==leaseId)throw Object.assign(new Error('writer lease ownership changed'),{code:'SBC_WRITER_LEASE_OWNERSHIP_CHANGED'});",
      'session and advisory-lock verification'
    );
    if (queryResult.count !== ownerResult.count) {
      throw new Error(MARKER + ': lease query/owner anchor counts differ: ' + queryResult.count + '/' + ownerResult.count);
    }
    server = ownerResult.source;
    server = server.replace(
      "console.error('['+MARKER+'] lease heartbeat/reconnect failed; writes remain recovery-gated; retry scheduled:',String(e&&e.message||e),'retryDelayMs='+sbcWriterLeaseRetryDelayMs);",
      "console.error('[SBC_V6564_MYSQL_LEASE_LIFECYCLE] lease heartbeat/reconnect failed; writes remain recovery-gated; retry scheduled:',JSON.stringify({code:String(e&&e.code||'UNKNOWN').slice(0,80),errno:Number.isFinite(Number(e&&e.errno))?Number(e.errno):null,sqlState:String(e&&e.sqlState||'').slice(0,16)||null,message:String(e&&e.message||e).slice(0,240),retryDelayMs:sbcWriterLeaseRetryDelayMs}));"
    );
    if (!server.includes('SELECT CONNECTION_ID() AS sessionId, IS_USED_LOCK(?) AS owner')) {
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

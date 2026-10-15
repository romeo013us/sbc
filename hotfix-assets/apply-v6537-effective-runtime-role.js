'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'SBC_V6537_EFFECTIVE_RUNTIME_ROLE';
const FROM = '65.1.36';
const TO = '65.1.37';

function replaceOne(source, regex, replacement, label) {
  const matches = source.match(regex) || [];
  if (matches.length !== 1) {
    throw new Error(MARKER + ': ' + label + ' expected exactly one match, found ' + matches.length);
  }
  return source.replace(regex, replacement);
}

function apply(root) {
  const serverPath = path.join(root, 'server.js');
  let server = fs.readFileSync(serverPath, 'utf8');

  // V65.1.24's patch treated the presence of its marker as proof that the
  // role declaration was already correct. This patch independently enforces
  // the effective role from the actual process environment.
  const rolePattern = /^\s*(?:const|let|var)\s+SBC_RUNTIME_ROLE\s*=\s*[^;\n]*;\s*$/gm;
  const roleMatches = server.match(rolePattern) || [];
  const roleDeclaration = "const SBC_RUNTIME_ROLE = String(process.env.SBC_RUNTIME_ROLE || 'readonly').trim().toLowerCase();";
  if (roleMatches.length === 1) {
    server = replaceOne(server, rolePattern, roleDeclaration, 'runtime role declaration');
  } else if (roleMatches.length === 0) {
    server = replaceOne(server, /^let mysqlPool = null;$/m,
      "let mysqlPool = null;\n// " + MARKER + ": effective role comes from the Published/Preview process environment.\n" + roleDeclaration,
      'runtime role insertion anchor');
  } else {
    throw new Error(MARKER + ': multiple SBC_RUNTIME_ROLE declarations; refusing ambiguous patch');
  }

  const readOnlyPattern = /^\s*(?:const|let|var)\s+SBC_RUNTIME_READ_ONLY\s*=\s*[^;\n]*;\s*$/gm;
  const readOnlyMatches = server.match(readOnlyPattern) || [];
  const readOnlyDeclaration = "const SBC_RUNTIME_READ_ONLY = SBC_RUNTIME_ROLE !== 'writer';";
  if (readOnlyMatches.length === 1) {
    server = replaceOne(server, readOnlyPattern, readOnlyDeclaration, 'read-only role derivation');
  } else if (readOnlyMatches.length === 0) {
    server = replaceOne(server, /^const SBC_RUNTIME_ROLE = String\(process\.env\.SBC_RUNTIME_ROLE \|\| 'readonly'\)\.trim\(\)\.toLowerCase\(\);$/m,
      roleDeclaration + "\nif (!['writer', 'readonly'].includes(SBC_RUNTIME_ROLE)) throw new Error('" + MARKER + ": SBC_RUNTIME_ROLE must be writer or readonly.');\n" + readOnlyDeclaration,
      'read-only role insertion');
  } else {
    throw new Error(MARKER + ': multiple SBC_RUNTIME_READ_ONLY declarations; refusing ambiguous patch');
  }

  const hasRoleValidation = /if\\s*\\(\\s*!\\s*\\[\\s*['\"]writer['\"]\\s*,\\s*['\"]readonly['\"]\\s*\\]\\.includes\\(SBC_RUNTIME_ROLE\\)\\s*\\)/.test(server);\n  if (!hasRoleValidation) {
    server = replaceOne(server,
      /^const SBC_RUNTIME_ROLE = String\(process\.env\.SBC_RUNTIME_ROLE \|\| 'readonly'\)\.trim\(\)\.toLowerCase\(\);$/m,
      roleDeclaration + "\nif (!['writer', 'readonly'].includes(SBC_RUNTIME_ROLE)) throw new Error('" + MARKER + ": SBC_RUNTIME_ROLE must be writer or readonly.');",
      'role validation insertion');
  }

  // Emit a redacted effective-role diagnostic at the point the app evaluates
  // its role. Do not print secrets or database connection values.
  if (!server.includes('[SBC ROLE SOURCE CHECK]')) {
    const startupAnchor = "initMysql().then(async()=>{";
    server = replaceOne(server, new RegExp(startupAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 
      "console.log('[SBC ROLE SOURCE CHECK] env=' + String(process.env.SBC_RUNTIME_ROLE || '<absent>') + ' effective=' + SBC_RUNTIME_ROLE + ' readOnly=' + SBC_RUNTIME_READ_ONLY);\n" + startupAnchor,
      'runtime role diagnostic insertion');
  }

  // Assert critical write protections remain in the transformed server.
  for (const required of [
    'SBC_RUNTIME_WRITER_LEASE_REQUIRED',
    'SBC_RUNTIME_WRITER_LEASE_LOST',
    '!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED || !sbcWriterLeaseReady',
    'SBC_READ_ONLY_RUNTIME'
  ]) {
    if (!server.includes(required)) throw new Error(MARKER + ': required safety guard missing: ' + required);
  }
  fs.writeFileSync(serverPath, server);

  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM) {
    throw new Error(MARKER + ': expected package ' + FROM + '; found ' + pkg.version);
  }
  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.37 effective runtime-role source fix; writer lease and recovery gates preserved';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const lockPath = path.join(root, 'package-lock.json');
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
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

  const htmlPath = path.join(root, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = replaceOne(html, /<title>SBC Business Command Center — V65\.1\.36<\/title>/,
    '<title>SBC Business Command Center — V65.1.37</title>', 'browser title');
  fs.writeFileSync(htmlPath, html);

  const swPath = path.join(root, 'public', 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = replaceOne(sw, /const CACHE='sbc-static-v65-1-36';/, "const CACHE='sbc-static-v65-1-37';", 'service worker cache namespace');
  if (!sw.includes('keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)')) {
    throw new Error(MARKER + ': service-worker old-cache purge guard missing');
  }
  fs.writeFileSync(swPath, sw);

  const identityPath = path.join(root, 'config', 'release-identity.js');
  let identity = fs.readFileSync(identityPath, 'utf8');
  identity = replaceOne(identity, /const RELEASE_VERSION = '65\.1\.36';/, "const RELEASE_VERSION = '65.1.37';", 'release version');
  identity = replaceOne(identity, /const RELEASE_NAME = 'RUNTIME_BEACON_DEPLOYMENT_PROOF';/, "const RELEASE_NAME = 'EFFECTIVE_RUNTIME_ROLE_SOURCE_FIX';", 'release name');
  identity = replaceOne(identity, /major:65,minor:1,patch:36/, 'major:65,minor:1,patch:37', 'semantic version');
  fs.writeFileSync(identityPath, identity);

  return { marker: MARKER, version: TO, roleDerivedFromProcessEnvironment: true, safetyGatesPreserved: true };
}

module.exports = { apply, MARKER, FROM, TO };

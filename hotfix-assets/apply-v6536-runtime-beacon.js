'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'SBC_V6536_RUNTIME_BEACON_RELEASE';
const FROM = '65.1.35';
const TO = '65.1.36';
const RELEASE_NAME = 'RUNTIME_BEACON_DEPLOYMENT_PROOF';

function replaceOnce(source, oldValue, newValue, label) {
  const count = source.split(oldValue).length - 1;
  if (count !== 1) {
    throw new Error(MARKER + ': ' + label + ' expected one occurrence, found ' + count);
  }
  return source.replace(oldValue, newValue);
}

function apply(root) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.name !== 'sbc-business-command-center' || pkg.version !== FROM) {
    throw new Error(MARKER + ': expected source package ' + FROM + '; found ' + pkg.version);
  }

  // Keep the source bundle's visible identity aligned with the root launcher's
  // expected version. This is a release stamp only; it does not change runtime
  // role, DDL permissions, recovery decisions, or writer-lease checks.
  const htmlPath = path.join(root, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = replaceOnce(
    html,
    '<title>SBC Business Command Center — V65.1.35</title>',
    '<title>SBC Business Command Center — V65.1.36</title>',
    'browser title'
  );
  fs.writeFileSync(htmlPath, html);

  const swPath = path.join(root, 'public', 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = replaceOnce(sw, "const CACHE='sbc-static-v65-1-35';", "const CACHE='sbc-static-v65-1-36';", 'service worker cache namespace');
  if (!sw.includes('keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)')) {
    throw new Error(MARKER + ': service worker old-cache purge guard missing');
  }
  fs.writeFileSync(swPath, sw);

  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.36 runtime-beacon deployment identity; writer and recovery gates unchanged';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  // The root repository's test suite exercises this release patch. The extracted
  // production package keeps its existing tests/scripts unchanged.

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
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

  const identityPath = path.join(root, 'config', 'release-identity.js');
  let identity = fs.readFileSync(identityPath, 'utf8');
  identity = replaceOnce(
    identity,
    "const RELEASE_VERSION = '65.1.35';",
    "const RELEASE_VERSION = '65.1.36';",
    'runtime release version'
  );
  identity = replaceOnce(
    identity,
    "const RELEASE_NAME = 'WRITER_NO_DDL_OPERATIONAL_STARTUP';",
    "const RELEASE_NAME = '" + RELEASE_NAME + "';",
    'runtime release name'
  );
  identity = replaceOnce(identity, 'major:65,minor:1,patch:35', 'major:65,minor:1,patch:36', 'runtime semantic version');
  fs.writeFileSync(identityPath, identity);

  const testSource = path.join(__dirname, 'v6536-runtime-beacon-test.js');
  const testTarget = path.join(root, 'hotfix-assets', 'v6536-runtime-beacon-test.js');
  if (!fs.existsSync(testSource)) throw new Error(MARKER + ': regression test source missing');
  fs.mkdirSync(path.dirname(testTarget), { recursive: true });
  fs.copyFileSync(testSource, testTarget);

  return { marker: MARKER, version: TO, releaseStampOnly: true };
}

module.exports = { apply, MARKER, FROM, TO, RELEASE_NAME };

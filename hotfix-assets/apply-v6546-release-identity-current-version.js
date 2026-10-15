'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'SBC_V6546_RELEASE_IDENTITY_CURRENT_VERSION';
const FROM = '65.1.44';
const TO = '65.1.45';
const PINNED_BASELINE = '65.1.18';

function once(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(MARKER + ': ' + label + ' anchor count ' + count);
  return source.replace(oldText, newText);
}
function read(root, rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(MARKER + ': missing ' + rel);
  return fs.readFileSync(file, 'utf8');
}
function write(root, rel, value) {
  fs.writeFileSync(path.join(root, rel), value);
}
function walkJavaScript(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'data' || entry.name === 'backups' ||
        entry.name.startsWith('.sbc-runtime-') || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJavaScript(full, out);
    else if (/\.(?:js|cjs|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}
function alignReleaseIdentityGuard(root) {
  const markerFiles = walkJavaScript(root).filter(file => {
    const source = fs.readFileSync(file, 'utf8');
    return source.includes('RELEASE_IDENTITY_MISMATCH');
  });
  if (!markerFiles.length) throw new Error(MARKER + ': release identity guard source was not found.');
  let changedFiles = 0;
  let replacements = 0;
  for (const file of markerFiles) {
    let source = fs.readFileSync(file, 'utf8');
    const count = source.split(PINNED_BASELINE).length - 1;
    if (count > 0) {
      source = source.split(PINNED_BASELINE).join(TO);
      fs.writeFileSync(file, source);
      changedFiles++;
      replacements += count;
    }
  }
  if (!replacements) {
    const found = markerFiles.map(file => path.relative(root, file)).join(', ');
    throw new Error(MARKER + ': release identity guard was found but its pinned baseline anchor was not. Files: ' + found);
  }
  // Prove the old pin no longer remains in any release-identity guard source.
  for (const file of markerFiles) {
    const source = fs.readFileSync(file, 'utf8');
    if (source.includes(PINNED_BASELINE)) {
      throw new Error(MARKER + ': stale pinned release version remains in ' + path.relative(root, file));
    }
  }
  return { changedFiles, replacements };
}

function apply(root) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(read(root, 'package.json'));
  if (pkg.name !== 'sbc-business-command-center') throw new Error(MARKER + ': unexpected package name.');

  if (pkg.version === TO) {
    const marker = read(root, 'server.js');
    if (!marker.includes(MARKER)) throw new Error(MARKER + ': version is already bumped but runtime patch marker is missing.');
    return { marker: MARKER, version: TO, alreadyApplied: true };
  }
  if (pkg.version !== FROM) throw new Error(MARKER + ': expected package ' + FROM + '; found ' + pkg.version);

  const guard = alignReleaseIdentityGuard(root);
  let server = read(root, 'server.js');
  if (!server.includes(MARKER)) {
    server = server + '\n// ' + MARKER + ': release allowlist aligned with the version built and served by the Published runtime.\n';
    write(root, 'server.js', server);
  }

  pkg.version = TO;
  pkg.description = 'SBC OS V65.1.45 aligns the runtime release-identity allowlist with the deployed package version';
  pkg.scripts = pkg.scripts || {};
  pkg.scripts['test:v6546-release-identity-current-version'] = 'node hotfix-assets/v6546-release-identity-current-version-test.js';
  if (!String(pkg.scripts['test:all'] || '').includes('v6546-release-identity-current-version-test.js')) {
    pkg.scripts['test:all'] = String(pkg.scripts['test:all'] || 'node bootstrap.js --verify') + ' && node hotfix-assets/v6546-release-identity-current-version-test.js';
  }
  write(root, 'package.json', JSON.stringify(pkg, null, 2) + '\n');

  const lock = JSON.parse(read(root, 'package-lock.json'));
  if (lock.name !== pkg.name || lock.version !== FROM || lock.packages?.['']?.version !== FROM) {
    throw new Error(MARKER + ': package-lock root identity mismatch.');
  }
  lock.version = TO;
  lock.packages[''].version = TO;
  lock.packages[''].description = pkg.description;
  lock.packages[''].scripts = pkg.scripts;
  write(root, 'package-lock.json', JSON.stringify(lock, null, 2) + '\n');

  const identityPath = path.join(root, 'config', 'release-identity.js');
  let identity = read(root, 'config/release-identity.js');
  identity = once(identity, "const RELEASE_VERSION = '65.1.44';", "const RELEASE_VERSION = '65.1.45';", 'release version');
  identity = once(identity, "const RELEASE_NAME = 'BASELINE_GATED_DDL_UNBLOCK';", "const RELEASE_NAME = 'RELEASE_IDENTITY_CURRENT_VERSION';", 'release name');
  identity = once(identity, 'major:65,minor:1,patch:44', 'major:65,minor:1,patch:45', 'semantic release version');
  write(root, 'config/release-identity.js', identity);

  let html = read(root, 'public/index.html');
  if (!html.includes('65.1.44')) throw new Error(MARKER + ': published HTML release marker missing.');
  html = html.split('65.1.44').join('65.1.45');
  write(root, 'public/index.html', html);

  let sw = read(root, 'public/sw.js');
  if (!/const CACHE='[^']+'/.test(sw)) throw new Error(MARKER + ': service-worker cache marker missing.');
  sw = sw.replace(/const CACHE='[^']+'/, "const CACHE='sbc-static-v65-1-45-release-identity'");
  if (!sw.includes("keys.filter(k=>/^sbc-static-v/.test(k)&&k!==CACHE)")) {
    throw new Error(MARKER + ': old service-worker cache purge guard missing.');
  }
  write(root, 'public/sw.js', sw);

  const testSource = path.join(__dirname, 'v6546-release-identity-current-version-test.js');
  if (!fs.existsSync(testSource)) throw new Error(MARKER + ': regression test source missing.');
  const testTarget = path.join(root, 'hotfix-assets', 'v6546-release-identity-current-version-test.js');
  fs.mkdirSync(path.dirname(testTarget), { recursive: true });
  fs.copyFileSync(testSource, testTarget);
  fs.copyFileSync(__filename, path.join(root, 'hotfix-assets', 'apply-v6546-release-identity-current-version.js'));

  const versionPath = path.join(root, 'VERSION');
  if (fs.existsSync(versionPath)) write(root, 'VERSION', read(root, 'VERSION').replace(/65\.1\.44/g, '65.1.45'));

  const finalIdentity = read(root, 'config/release-identity.js');
  if (!finalIdentity.includes("const RELEASE_VERSION = '65.1.45';") ||
      !read(root, 'package.json').includes('"version": "65.1.45"')) {
    throw new Error(MARKER + ': release identity values failed post-write verification.');
  }

  const integrityPath = path.join(root, 'enterprise', 'v4341-kim-resilience-control.js');
  if (fs.existsSync(integrityPath)) {
    delete require.cache[require.resolve(integrityPath)];
    const integrity = require(integrityPath);
    if (typeof integrity.integrityManifest === 'function') integrity.integrityManifest();
    if (typeof integrity.verifyIntegrity === 'function') {
      const check = integrity.verifyIntegrity();
      if (!check.ok) throw new Error(MARKER + ': runtime integrity manifest mismatch: ' + JSON.stringify(check.mismatches || []));
    }
  }

  return { marker: MARKER, version: TO, releaseGuardFilesChanged: guard.changedFiles, releaseGuardReplacements: guard.replacements, rollbackGatePreserved: true };
}
module.exports = { apply, MARKER, FROM, TO, alignReleaseIdentityGuard };

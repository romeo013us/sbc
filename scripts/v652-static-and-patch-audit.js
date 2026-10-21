'use strict';

// Read-only audit of the source bundle and the V65.1.64 lease patch.
// All extraction and patch writes happen in an OS temp directory, never in the checkout.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MARKER = 'SBC_V6564_MYSQL_LEASE_LIFECYCLE';
const TIMER_PATTERN = /sbcWriterLeaseTimer\\s*=\\s*setInterval\\(async\\(\\)=>\\{[\\s\\S]*?\\},10000\\);/g;
const GENERAL_TIMER_PATTERN = /sbcWriterLeaseTimer\\s*=\\s*setInterval\\(/g;
const SAFE_RELATIVE = (name) => !!name && !name.startsWith('/') && !/^[A-Za-z]:/.test(name) &&
  !name.replace(/\\\\/g, '/').split('/').includes('..');

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function readReleaseZip(root) {
  const bootstrapPath = path.join(root, 'bootstrap.js');
  if (!fs.existsSync(bootstrapPath)) throw new Error('bootstrap.js not found; run from the repository root.');
  const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');
  const match = bootstrap.match(/const RELEASE_ZIP = path\\.join\\(__dirname, '([^']+)'\\);/);
  if (!match) throw new Error('Could not resolve RELEASE_ZIP from bootstrap.js.');
  const zipPath = path.join(root, match[1]);
  if (!fs.existsSync(zipPath)) throw new Error('Source ZIP missing: ' + zipPath);
  return zipPath;
}

function safeExtract(zipPath, targetDir) {
  // Validate archive entry names before extraction; reject path traversal.
  const names = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).split(/\\r?\\n/).filter(Boolean);
  const unsafe = names.filter(name => !SAFE_RELATIVE(name));
  if (unsafe.length) throw new Error('Unsafe ZIP entry path(s): ' + unsafe.slice(0, 5).join(', '));
  execFileSync('unzip', ['-q', zipPath, '-d', targetDir], { stdio: 'pipe' });
}

function runStaticAndPatchAudit(repoRoot = process.cwd()) {
  const root = path.resolve(repoRoot);
  const patchPath = path.join(root, 'hotfix-assets', 'apply-v6564-mysql-lease-lifecycle.js');
  if (!fs.existsSync(patchPath)) throw new Error('Lease lifecycle patch not found: ' + patchPath);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-v652-timer-audit-'));
  try {
    const extracted = path.join(tempRoot, 'source');
    const dryRun = path.join(tempRoot, 'dry-run');
    fs.mkdirSync(extracted, { recursive: true });
    fs.mkdirSync(dryRun, { recursive: true });

    const zipPath = readReleaseZip(root);
    safeExtract(zipPath, extracted);

    const serverPath = path.join(extracted, 'server.js');
    const packagePath = path.join(extracted, 'package.json');
    if (!fs.existsSync(serverPath) || !fs.existsSync(packagePath)) {
      throw new Error('Extracted source ZIP must contain server.js and package.json.');
    }

    const source = fs.readFileSync(serverPath, 'utf8');
    const staticMetrics = {
      exactLegacyHeartbeatBlocks: countMatches(source, TIMER_PATTERN),
      generalHeartbeatRegistrations: countMatches(source, GENERAL_TIMER_PATTERN)
    };

    // Build an isolated patch fixture. The patch may write only inside dryRun.
    fs.copyFileSync(serverPath, path.join(dryRun, 'server.js'));
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    fs.writeFileSync(path.join(dryRun, 'package.json'), JSON.stringify(pkg, null, 2) + '\\n');
    fs.mkdirSync(path.join(dryRun, 'hotfix-assets'), { recursive: true });

    // The patch implementation reads its regression test relative to its own location.
    // Requiring the checked-in patch preserves that implementation, while apply() receives
    // only the disposable dry-run root as its target.
    const patchModule = require(patchPath);
    if (!patchModule || typeof patchModule.apply !== 'function') {
      throw new Error('Patch module does not export apply(root).');
    }

    const patchMetadata = patchModule.apply(dryRun);
    const patched = fs.readFileSync(path.join(dryRun, 'server.js'), 'utf8');
    const patchedMetrics = {
      exactLegacyHeartbeatBlocks: countMatches(patched, TIMER_PATTERN),
      generalHeartbeatRegistrations: countMatches(patched, GENERAL_TIMER_PATTERN),
      hardenedHeartbeatRegistrations: (patched.match(/sbcWriterLeaseTimer\\s*=\\s*setInterval\\(async\\(\\)=>\\{[\\s\\S]*?\\},5000\\);/g) || []).length
    };

    const result = {
      marker: MARKER,
      sourceZip: path.basename(zipPath),
      staticMetrics,
      patchedMetrics,
      patchMetadata,
      note: 'This is a static source + patch dry run, not proof of live GoDaddy timer allocations.'
    };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try {
    runStaticAndPatchAudit(process.argv[2] || process.cwd());
  } catch (error) {
    console.error('[SBC V652 TIMER AUDIT FAILED]', error && error.stack || error);
    process.exitCode = 1;
  }
}

module.exports = { runStaticAndPatchAudit };

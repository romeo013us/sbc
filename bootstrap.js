'use strict';

// GoDaddy repository-root launcher for SBC OS V66.0.0.
// Application source is stored in the adjacent source ZIP. GoDaddy installs the
// listed runtime dependencies at this repository root; extracted modules resolve
// upward to that node_modules directory.

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const zlib = require('zlib');

const RELEASE_ZIP = path.join(__dirname, 'SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip');
const EXPECTED_NAME = 'sbc-business-command-center';
const SOURCE_VERSION = '65.1.13';
const EXPECTED_VERSION = '66.0.0';
const HOTFIX_PATCH_ID = 'v6617-writer-lease-heartbeat-repair';
const MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function safeEntryPath(root, rawName) {
  const name = rawName.replace(/\\/g, '/');
  if (!name || name.startsWith('/') || /^[A-Za-z]:/.test(name)) throw new Error(`Unsafe ZIP path: ${rawName}`);
  const parts = name.split('/');
  if (parts.some(p => p === '..')) throw new Error(`Unsafe ZIP path: ${rawName}`);
  const resolved = path.resolve(root, ...parts.filter(Boolean));
  const prefix = path.resolve(root) + path.sep;
  if (resolved !== path.resolve(root) && !resolved.startsWith(prefix)) throw new Error(`Unsafe ZIP path: ${rawName}`);
  return resolved;
}

function extractZip(zipBuffer, targetDir) {
  const minEocd = Math.max(0, zipBuffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = zipBuffer.length - 22; i >= minEocd; i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP end-of-central-directory record not found.');
  const diskNo = zipBuffer.readUInt16LE(eocd + 4);
  const centralDisk = zipBuffer.readUInt16LE(eocd + 6);
  const diskEntries = zipBuffer.readUInt16LE(eocd + 8);
  const totalEntries = zipBuffer.readUInt16LE(eocd + 10);
  const centralSize = zipBuffer.readUInt32LE(eocd + 12);
  const centralOffset = zipBuffer.readUInt32LE(eocd + 16);
  const commentLen = zipBuffer.readUInt16LE(eocd + 20);
  if (diskNo !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) throw new Error('Multi-disk ZIP files are not supported.');
  if (totalEntries === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) throw new Error('ZIP64 source bundles are not supported.');
  if (eocd + 22 + commentLen > zipBuffer.length || centralOffset + centralSize > eocd) throw new Error('Malformed ZIP central directory.');

  fs.mkdirSync(targetDir, { recursive: true });
  let cursor = centralOffset;
  let totalUncompressed = 0;
  const seen = new Set();

  for (let i = 0; i < totalEntries; i++) {
    if (cursor + 46 > zipBuffer.length || zipBuffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Malformed ZIP central entry ${i}.`);
    const flags = zipBuffer.readUInt16LE(cursor + 8);
    const method = zipBuffer.readUInt16LE(cursor + 10);
    const expectedCrc = zipBuffer.readUInt32LE(cursor + 16);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(cursor + 24);
    const nameLen = zipBuffer.readUInt16LE(cursor + 28);
    const extraLen = zipBuffer.readUInt16LE(cursor + 30);
    const entryCommentLen = zipBuffer.readUInt16LE(cursor + 32);
    const extAttr = zipBuffer.readUInt32LE(cursor + 38);
    const localOffset = zipBuffer.readUInt32LE(cursor + 42);
    const endCentral = cursor + 46 + nameLen + extraLen + entryCommentLen;
    if (endCentral > zipBuffer.length) throw new Error(`Truncated ZIP central entry ${i}.`);
    const rawName = zipBuffer.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    cursor = endCentral;

    if (flags & 0x1) throw new Error(`Encrypted ZIP entry is not supported: ${rawName}`);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw new Error(`ZIP64 entry is not supported: ${rawName}`);
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error('Source ZIP exceeds the unpack safety limit.');

    const isDir = rawName.endsWith('/') || (((extAttr >>> 16) & 0xf000) === 0x4000);
    const unixModeType = (extAttr >>> 16) & 0xf000;
    if (unixModeType === 0xa000) throw new Error(`Symbolic links are not allowed in source ZIP: ${rawName}`);
    const dest = safeEntryPath(targetDir, rawName);
    if (seen.has(dest)) throw new Error(`Duplicate ZIP path: ${rawName}`);
    seen.add(dest);
    if (isDir) { fs.mkdirSync(dest, { recursive: true }); continue; }
    if (method !== 0 && method !== 8) throw new Error(`Unsupported ZIP compression method ${method}: ${rawName}`);
    if (localOffset + 30 > zipBuffer.length || zipBuffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Malformed local ZIP header: ${rawName}`);
    const localNameLen = zipBuffer.readUInt16LE(localOffset + 26);
    const localExtraLen = zipBuffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > zipBuffer.length) throw new Error(`Truncated ZIP entry: ${rawName}`);
    const compressed = zipBuffer.subarray(dataStart, dataEnd);
    let data;
    try { data = method === 0 ? Buffer.from(compressed) : zlib.inflateRawSync(compressed, { maxOutputLength: Math.max(1, uncompressedSize) }); }
    catch (err) { throw new Error(`Unable to decompress ZIP entry ${rawName}: ${err.message}`); }
    if (data.length !== uncompressedSize) throw new Error(`ZIP size check failed: ${rawName}`);
    if (crc32(data) !== expectedCrc) throw new Error(`ZIP CRC check failed: ${rawName}`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data, { mode: 0o644 });
  }
  if (cursor !== centralOffset + centralSize) throw new Error('ZIP central directory length mismatch.');
}

function verifyExtracted(dir, expectedVersion = EXPECTED_VERSION) {
  const packagePath = path.join(dir, 'package.json');
  const serverPath = path.join(dir, 'server.js');
  for (const f of [packagePath, serverPath]) {
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) throw new Error(`SBC source bundle is missing required file: ${path.basename(f)}`);
  }
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (pkg.name !== EXPECTED_NAME || pkg.version !== expectedVersion) throw new Error(`Unexpected SBC bundle identity: ${pkg.name}@${pkg.version}`);
  return pkg;
}

function verifyPatchedSyntax(dir) {
  const files = ['server.js','enterprise/sbc-agent-operating-system-v56-25-3.js','enterprise/sbc-growth-os-v650.js','enterprise/revenue-autopilot-supervisor-v552.js','enterprise/v56134-god-tier-revenue.js','enterprise/v56134-ten-brain.js','public/app.js','public/v10.js','public/sbc-agent-os-v56-25-3.js','public/v56240-growth-hardening.js','public/sbc-lead-import-v6541.js','enterprise/durable-session-secret.js','enterprise/v56170-six-phase-autopilot.js','enterprise/v56133-mysql-query-guard.js','enterprise/sbc-revenue-closer-v5611.js','enterprise/sbc-revenue-growth-v56122.js','enterprise/sbc-elite-closer-v5612.js','enterprise/automatic-lead-sale-execution.js','enterprise/sbc-commercial-os-v602.js','enterprise/v56220-economic-control.js','enterprise/v567-nine-nine.js','enterprise/v56140-90day-revenue-command.js','browser_public/app.js','browser_public/v56140-90day-revenue-command.js','public/v56140-90day-revenue-command.js','enterprise/v56-autonomous-operations.js','enterprise/training-system-v2.js','enterprise/v56210-commercial-readiness.js','hotfix-assets/apply-v6545-baseline-gated-ddl-unblock.js','hotfix-assets/v6545-baseline-gated-ddl-unblock-test.js','hotfix-assets/apply-v6546-release-identity-current-version.js','hotfix-assets/v6546-release-identity-current-version-test.js','hotfix-assets/apply-v6547-tenant-propagation.js','hotfix-assets/v6547-tenant-propagation-test.js','hotfix-assets/apply-v6553-command-center-redesign.js','hotfix-assets/v6553-command-center-redesign-test.js','hotfix-assets/apply-v6554-stark-cockpit.js','hotfix-assets/v6554-stark-cockpit-test.js','hotfix-assets/apply-v6555-theme-contrast.js','hotfix-assets/v6555-theme-contrast-test.js','hotfix-assets/apply-v6556-twilio-voice-sdk.js','hotfix-assets/v6556-twilio-voice-sdk-test.js','hotfix-assets/apply-v6557-owner-force-unlock.js','hotfix-assets/v6557-owner-force-unlock-test.js','hotfix-assets/apply-v6558-economic-control-ddl-gate.js','hotfix-assets/v6558-economic-control-ddl-gate-test.js','hotfix-assets/apply-v6559-launch-phone-theme-layout.js','hotfix-assets/v6559-launch-phone-theme-layout-test.js','hotfix-assets/apply-v6560-live-call-notes.js','hotfix-assets/v6560-live-call-notes-test.js','hotfix-assets/apply-v6561-brand-system.js','hotfix-assets/v6561-brand-system-test.js','hotfix-assets/apply-v6562-executive-dashboard.js','hotfix-assets/v6562-executive-dashboard-test.js','hotfix-assets/apply-v6563-sales-operating-model.js','hotfix-assets/v6563-sales-operating-model-test.js','hotfix-assets/apply-v6564-mysql-lease-lifecycle.js','hotfix-assets/v6564-mysql-lease-lifecycle-test.js','public/sbc-v6563-sales-operating-model.js','browser_public/sbc-v6563-sales-operating-model.js','public/sbc-v6559-ui.js','browser_public/sbc-v6559-ui.js','hotfix-assets/apply-v6565-dashboard-stability.js','hotfix-assets/v6565-dashboard-stability-test.js','hotfix-assets/apply-v6568-stale-force-unlock.js','hotfix-assets/v6568-stale-force-unlock-test.js','hotfix-assets/apply-v6569-growth-503-sentry.js','hotfix-assets/v6569-growth-503-sentry-test.js','hotfix-assets/apply-v6570-lease-session-verification.js','hotfix-assets/v6570-lease-session-verification-test.js','hotfix-assets/apply-v6571-bilingual-sales-ops.js','hotfix-assets/v6571-bilingual-sales-ops-test.js','scripts/query-guard-cleanup-regression.test.js','hotfix-assets/v6571-bilingual-sales-ops.js','public/sbc-v6571-bilingual-sales-ops.js' ,'public/sbc-v6566-state-preserving-circuit-breaker.js','public/sbc-v6567-marketing-hub.js','browser_public/sbc-v6567-marketing-hub.js','public/sbc-v6574-draggable-nav-rail.js'];
  const execFileSync = require('child_process').execFileSync;
  for (const rel of files) {
    const target = path.join(dir, rel);
    if (!fs.existsSync(target)) throw new Error('Patched source file missing: ' + rel);
    try { execFileSync(process.execPath, ['--check', target], {stdio:'pipe'}); }
    catch (e) { throw new Error('Syntax verification failed for ' + rel + ': ' + String(e.stderr || e.message || e)); }
  }
}

function loadManifestValidator() {
  const candidates = [
    path.join(__dirname, 'scripts', 'manifest-identity-validator.js'),
    path.join(process.cwd(), 'scripts', 'manifest-identity-validator.js')
  ];
  const file = candidates.find(candidate => fs.existsSync(candidate));
  if (!file) {
    throw new Error('[SBC ROOT BOOTSTRAP] FATAL: manifest validator not found in launcher or project root; checked: ' + candidates.join(', '));
  }
  return require(file);
}

function verifyOnly() {
  if (!fs.existsSync(RELEASE_ZIP)) throw new Error(`Required SBC source ZIP missing: ${path.basename(RELEASE_ZIP)}`);
  const bytes = fs.readFileSync(RELEASE_ZIP);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-root-build-verify-'));
  try {
    extractZip(bytes, temp);
    verifyExtracted(temp, SOURCE_VERSION);
    const hotfix = require(path.join(__dirname, 'apply-v65116-hotfix.js'));
    hotfix.apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6522-api-stabilization.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6523-read-query-cancel.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6524-single-writer.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6525-customer360-workspace.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6526-demo-studio.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6527-persistence-writer-lock.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6528-runtime-writer-lease.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6529-open-readiness.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6530-writer-lease-marker-fix.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6531-release-identity.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6533-startup-ddl-gate.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6534-price-consistency.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6535-writer-no-ddl-operational-startup.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6536-runtime-beacon.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6537-effective-runtime-role.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6538-writer-hydration-without-ddl.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6539-safe-no-ddl-startup.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6541-lead-import.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6542-voice-call-diagnostics.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6543-lead-import-commit-contract.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6544-ask-kim-drag.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6545-baseline-gated-ddl-unblock.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6546-release-identity-current-version.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6547-tenant-propagation.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6548-lead-import-cache-contract.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6549-lorna-least-privilege.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6550-remove-floating-ask-kim.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6553-command-center-redesign.js')).apply(temp);
     require(path.join(__dirname, 'hotfix-assets', 'apply-v6554-stark-cockpit.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6555-theme-contrast.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6556-twilio-voice-sdk.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6557-owner-force-unlock.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6558-economic-control-ddl-gate.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6559-launch-phone-theme-layout.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6560-live-call-notes.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6561-brand-system.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6562-executive-dashboard.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6563-sales-operating-model.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6564-mysql-lease-lifecycle.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6565-dashboard-stability.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6566-state-preserving-circuit-breaker.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6567-marketing-hub.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6568-stale-force-unlock.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6569-growth-503-sentry.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6570-lease-session-verification.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6571-bilingual-sales-ops.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6572-dashboard-layout-stability.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6575-normalize-html-asset-identity.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'v6575-normalize-html-asset-identity-test.js'));
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6600-release-layout.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6601-master-prospect-list.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6602-layout-containment.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6603-polling-layout-lock-guard.js')).apply(temp);
    require(path.join(__dirname, 'hotfix-assets', 'v6601-master-prospect-list-test.js'));
    require(path.join(__dirname, 'hotfix-assets', 'v6600-release-layout-test.js'));
    require(path.join(__dirname, 'hotfix-assets', 'v6602-layout-containment-test.js'));
    loadManifestValidator().audit(temp, EXPECTED_VERSION);
    require(path.join(__dirname, 'scripts', 'manifest-identity-validator.test.js'));
    require(path.join(temp, 'scripts', 'query-guard-cleanup-regression.test.js'));
    verifyPatchedSyntax(temp);
    const pkg = verifyExtracted(temp, EXPECTED_VERSION);
    console.log(`[SBC ROOT BUILD] PASS: ${pkg.name}@${pkg.version}; operational hotfix, release identity, session store, and source entrypoint verified.`);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

function ensureRootRuntimeDependencies() {
  // GoDaddy may invoke the package entrypoint directly, bypassing npm's prestart
  // lifecycle. Repair a stale node_modules tree before the extracted server imports
  // Day.js (including its bundled UTC plugin).
  try {
    require.resolve('dayjs/plugin/utc', { paths: [__dirname] });
    require.resolve('dayjs', { paths: [__dirname] });
    console.log('[SBC DEPENDENCY PREFLIGHT] PASS: Day.js and UTC plugin resolve.');
    return;
  } catch (_) {
    console.warn('[SBC DEPENDENCY PREFLIGHT] Day.js UTC plugin is missing; repairing from package-lock.json.');
  }

  const repairScript = path.join(__dirname, 'scripts', 'ensure-runtime-dependencies.js');
  if (!fs.existsSync(repairScript)) {
    throw new Error('Day.js UTC plugin is missing and the locked dependency repair script is unavailable.');
  }
  const result = require('child_process').spawnSync(process.execPath, [repairScript], {
    cwd: __dirname,
    stdio: 'inherit',
    timeout: 240000,
    env: process.env
  });
  if (result.error) throw new Error('Day.js dependency repair could not run: ' + result.error.message);
  if (result.status !== 0) throw new Error('Day.js dependency repair failed with exit status ' + result.status + '.');
  require.resolve('dayjs/plugin/utc', { paths: [__dirname] });
  require.resolve('dayjs', { paths: [__dirname] });
  console.log('[SBC DEPENDENCY PREFLIGHT] PASS: locked repair verified Day.js UTC plugin.');
}

function launch() {
  ensureRootRuntimeDependencies();
  if (!fs.existsSync(RELEASE_ZIP)) throw new Error(`Required SBC source ZIP missing: ${path.basename(RELEASE_ZIP)}`);
  const bytes = fs.readFileSync(RELEASE_ZIP);
  const sourceHash = crypto.createHash('sha256').update(bytes).digest('hex');
  const runtimeDir = path.join(__dirname, `.sbc-runtime-v${EXPECTED_VERSION}-${sourceHash.slice(0, 12)}`);
  const marker = path.join(runtimeDir, '.sbc-bootstrap-ready.json');
  let validRuntime = false;
  try {
    const m = JSON.parse(fs.readFileSync(marker, 'utf8'));
    validRuntime = m.sourceHash === sourceHash && m.version === EXPECTED_VERSION && m.patchId === HOTFIX_PATCH_ID && fs.existsSync(path.join(runtimeDir, 'server.js'));
    if (validRuntime) verifyExtracted(runtimeDir, EXPECTED_VERSION);
  } catch { validRuntime = false; }
  const persistState = require(path.join(__dirname, 'persistent-state.js')).persistState;
  if (!validRuntime) {
    // V65.1.19: adopt any live state BEFORE the folder is deleted, so a rebuild can never wipe it.
    if (fs.existsSync(runtimeDir)) persistState(__dirname, runtimeDir, { reused: true });
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    extractZip(bytes, runtimeDir);
    verifyExtracted(runtimeDir, SOURCE_VERSION);
    const hotfix = require(path.join(__dirname, 'apply-v65116-hotfix.js'));
    hotfix.apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6522-api-stabilization.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6523-read-query-cancel.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6524-single-writer.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6525-customer360-workspace.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6526-demo-studio.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6527-persistence-writer-lock.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6528-runtime-writer-lease.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6529-open-readiness.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6530-writer-lease-marker-fix.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6531-release-identity.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6533-startup-ddl-gate.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6534-price-consistency.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6535-writer-no-ddl-operational-startup.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6536-runtime-beacon.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6537-effective-runtime-role.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6538-writer-hydration-without-ddl.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6539-safe-no-ddl-startup.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6541-lead-import.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6542-voice-call-diagnostics.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6543-lead-import-commit-contract.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6544-ask-kim-drag.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6545-baseline-gated-ddl-unblock.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6546-release-identity-current-version.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6547-tenant-propagation.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6548-lead-import-cache-contract.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6549-lorna-least-privilege.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6550-remove-floating-ask-kim.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6553-command-center-redesign.js')).apply(runtimeDir);
     require(path.join(__dirname, 'hotfix-assets', 'apply-v6554-stark-cockpit.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6555-theme-contrast.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6556-twilio-voice-sdk.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6557-owner-force-unlock.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6558-economic-control-ddl-gate.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6559-launch-phone-theme-layout.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6560-live-call-notes.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6561-brand-system.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6562-executive-dashboard.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6563-sales-operating-model.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6564-mysql-lease-lifecycle.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6565-dashboard-stability.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6566-state-preserving-circuit-breaker.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6567-marketing-hub.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6568-stale-force-unlock.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6569-growth-503-sentry.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6570-lease-session-verification.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6571-bilingual-sales-ops.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6572-dashboard-layout-stability.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6575-normalize-html-asset-identity.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6600-release-layout.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6601-master-prospect-list.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6602-layout-containment.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6603-polling-layout-lock-guard.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6605-crm-tenant-barrier.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6606-crm-edits.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6607-lead-revision-guard.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6609-safe-lead-create.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6611-lead-editor-load-guard.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6612-nav-geometry.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6613-safe-payment-links.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6614-voice-call-log-integrity.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6615-call-log-durable.js')).apply(runtimeDir);
    require(path.join(__dirname, 'hotfix-assets', 'apply-v6617-writer-lease-heartbeat.js')).apply(runtimeDir);
    loadManifestValidator().audit(runtimeDir, EXPECTED_VERSION);
    verifyPatchedSyntax(runtimeDir);
    const pkg = verifyExtracted(runtimeDir, EXPECTED_VERSION);
    fs.writeFileSync(marker, JSON.stringify({ sourceHash, version: pkg.version, patchId: HOTFIX_PATCH_ID, readyAt: new Date().toISOString() }, null, 2));
  }
  // V65.1.19: data/ and backups/ live in one permanent folder outside every hashed runtime folder.
  persistState(__dirname, runtimeDir, { reused: validRuntime });
  process.chdir(runtimeDir);
  // Correlate role, writer-lease, recovery, and worker decisions to this process instance.
  const sbcBootId = Date.now().toString(36) + '-' + process.pid + '-' + crypto.randomBytes(4).toString('hex');
  process.env.SBC_BOOT_ID = sbcBootId;
  console.log(`[SBC BOOT CORRELATION] boot_id=${sbcBootId} pid=${process.pid} port=${process.env.PORT || '<absent>'} role_env=${String(process.env.SBC_RUNTIME_ROLE || '<absent>')}`);
  console.log(`[SBC ROOT BOOTSTRAP] Launching SBC ${EXPECTED_VERSION} from checked source bundle.`);
  console.log(require(path.join(__dirname, 'runtime-env-beacon.js')).buildBeaconLine(process.env, os.hostname()));
  // V65.1.34: fail closed on tenantless background rejections without masking other fatal errors.
  require(path.join(__dirname, 'tenant-rejection-guard.js')).installTenantRejectionGuard(process, console);
  require(path.join(runtimeDir, 'server.js'));
}

try {
  if (process.argv.includes('--verify')) verifyOnly();
  else launch();
} catch (error) {
  console.error('[SBC ROOT BOOTSTRAP] FATAL:', error && error.stack ? error.stack : error);
  process.exitCode = 1;
}

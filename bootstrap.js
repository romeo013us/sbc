'use strict';

// GoDaddy repository-root launcher for SBC OS V65.1.35.
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
const EXPECTED_VERSION = '65.1.35';
const HOTFIX_PATCH_ID = 'writer-no-ddl-operational-startup-v6535';
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
  const files = ['server.js','enterprise/sbc-agent-operating-system-v56-25-3.js','enterprise/sbc-growth-os-v650.js','enterprise/revenue-autopilot-supervisor-v552.js','enterprise/v56134-god-tier-revenue.js','enterprise/v56134-ten-brain.js','public/app.js','public/v10.js','public/sbc-agent-os-v56-25-3.js','public/v56240-growth-hardening.js','enterprise/durable-session-secret.js','enterprise/v56170-six-phase-autopilot.js','enterprise/v56133-mysql-query-guard.js','enterprise/sbc-revenue-closer-v5611.js','enterprise/sbc-revenue-growth-v56122.js','enterprise/sbc-elite-closer-v5612.js','enterprise/automatic-lead-sale-execution.js','enterprise/sbc-commercial-os-v602.js','enterprise/v56220-economic-control.js','enterprise/v56140-90day-revenue-command.js','browser_public/v56140-90day-revenue-command.js','public/v56140-90day-revenue-command.js','enterprise/v56-autonomous-operations.js','enterprise/training-system-v2.js','enterprise/v56210-commercial-readiness.js'];
  const execFileSync = require('child_process').execFileSync;
  for (const rel of files) {
    const target = path.join(dir, rel);
    if (!fs.existsSync(target)) throw new Error('Patched source file missing: ' + rel);
    try { execFileSync(process.execPath, ['--check', target], {stdio:'pipe'}); }
    catch (e) { throw new Error('Syntax verification failed for ' + rel + ': ' + String(e.stderr || e.message || e)); }
  }
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
    verifyPatchedSyntax(temp);
    const pkg = verifyExtracted(temp, EXPECTED_VERSION);
    console.log(`[SBC ROOT BUILD] PASS: ${pkg.name}@${pkg.version}; operational hotfix, release identity, session store, and source entrypoint verified.`);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

function launch() {
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
    verifyPatchedSyntax(runtimeDir);
    const pkg = verifyExtracted(runtimeDir, EXPECTED_VERSION);
    fs.writeFileSync(marker, JSON.stringify({ sourceHash, version: pkg.version, patchId: HOTFIX_PATCH_ID, readyAt: new Date().toISOString() }, null, 2));
  }
  // V65.1.19: data/ and backups/ live in one permanent folder outside every hashed runtime folder.
  persistState(__dirname, runtimeDir, { reused: validRuntime });
  process.chdir(runtimeDir);
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

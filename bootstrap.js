'use strict';

// GoDaddy repository-root launcher for SBC OS V65.1.13.
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
const EXPECTED_VERSION = '65.1.14';
const HOTFIX_PATCH_ID = 'recovery-session-unlock-1';
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

function verifyOnly() {
  if (!fs.existsSync(RELEASE_ZIP)) throw new Error(`Required SBC source ZIP missing: ${path.basename(RELEASE_ZIP)}`);
  const bytes = fs.readFileSync(RELEASE_ZIP);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbc-root-build-verify-'));
  try {
    extractZip(bytes, temp);
    verifyExtracted(temp, SOURCE_VERSION);
    const hotfix = require(path.join(__dirname, 'apply-v65114-hotfix.js'));
    hotfix.apply(temp);
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
  if (!validRuntime) {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
    extractZip(bytes, runtimeDir);
    verifyExtracted(runtimeDir, SOURCE_VERSION);
    const hotfix = require(path.join(__dirname, 'apply-v65114-hotfix.js'));
    hotfix.apply(runtimeDir);
    const pkg = verifyExtracted(runtimeDir, EXPECTED_VERSION);
    fs.writeFileSync(marker, JSON.stringify({ sourceHash, version: pkg.version, patchId: HOTFIX_PATCH_ID, readyAt: new Date().toISOString() }, null, 2));
  }
  process.chdir(runtimeDir);
  console.log(`[SBC ROOT BOOTSTRAP] Launching SBC ${EXPECTED_VERSION} from checked source bundle.`);
  require(path.join(runtimeDir, 'server.js'));
}

try {
  if (process.argv.includes('--verify')) verifyOnly();
  else launch();
} catch (error) {
  console.error('[SBC ROOT BOOTSTRAP] FATAL:', error && error.stack ? error.stack : error);
  process.exitCode = 1;
}

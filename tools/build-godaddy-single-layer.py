#!/usr/bin/env python3
"""Build a GoDaddy-uploadable single-layer app from the verified V66 prebuilt runtime.

Only release packaging/startup are changed. Business logic remains byte-identical
to the verified compiled runtime. No production data, API calls, or secrets touched.
"""
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ZIP = ROOT / "SBC-V66-PREBUILT-RUNTIME.zip"
RECEIPT = ROOT / "SBC-V66-PREBUILT-RUNTIME.json"
DEST = ROOT / "dist" / "SBC-GoDaddy-SINGLE-LAYER-APP.zip"
PRIVATE_CSV = ROOT / "hotfix-assets" / "sbc-leads-oct-26-27-2026-31.csv"
ENTRY = """'use strict';
// Preserve V66 root launcher data persistence, tenant process guards and boot beacon.
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const root = __dirname;
const {persistState} = require('./persistent-state.js');
const state = persistState(root, root, {reused:false});
if (state.ephemeral) throw Error('SBC flat runtime rejects ephemeral customer state');
const bootId = Date.now().toString(36)+'-'+process.pid+'-'+crypto.randomBytes(4).toString('hex');
process.env.SBC_BOOT_ID = bootId;
console.log('[SBC FLAT STARTUP] boot_id='+bootId+' port='+(process.env.PORT||'<absent>')+' role_env='+String(process.env.SBC_RUNTIME_ROLE||'<absent>'));
console.log(require('./runtime-env-beacon.js').buildBeaconLine(process.env,os.hostname()));
require('./tenant-rejection-guard.js').installTenantRejectionGuard(process,console);
require(path.join(root,'server.js'));
"""

def sha(data):
    return hashlib.sha256(data).hexdigest()

def fail(message):
    raise SystemExit("SBC SINGLE-LAYER PACKAGE FAIL: " + message)

manifest = json.loads(RECEIPT.read_text())
raw = ZIP.read_bytes()
if manifest.get("generatedBy") != "isolated-github-ci" or sha(raw) != manifest.get("archiveSha256"):
    fail("compiled artifact does not match its isolated CI receipt")
if not PRIVATE_CSV.is_file():
    fail("private October 26/27 lead intake CSV missing")
with PRIVATE_CSV.open(encoding="utf-8-sig", newline="") as f:
    if len(list(csv.DictReader(f))) != 31:
        fail("31-lead CSV identity mismatch")

files = {}
with zipfile.ZipFile(io.BytesIO(raw)) as src:
    if src.testzip():
        fail("compiled runtime failed ZIP CRC")
    for info in src.infolist():
        name = info.filename
        if name.endswith("/"):
            continue
        if name.startswith("/") or "\\" in name or ".." in name.split("/"):
            fail("unsafe compiled ZIP path " + name)
        if name in files:
            fail("duplicate compiled entry " + name)
        if ((info.external_attr >> 16) & 0o170000) == 0o120000:
            fail("compiled runtime contains symlink " + name)
        if "node_modules" in name.split("/") or name.lower().endswith((".zip",".tgz",".tar",".rar")):
            fail("compiled runtime contains forbidden archive or dependencies " + name)
        files[name] = src.read(info)
required = {"server.js", "package.json", "package-lock.json", "public/index.html", "browser_public/index.html"}
if not required.issubset(files):
    fail("compiled runtime missing root or browser files")
original_server_hash = sha(files["server.js"])
pkg = json.loads(files["package.json"])
if pkg.get("main") != "server.js" or pkg["scripts"].get("start") != "node server.js":
    fail("unexpected compiled runtime entrypoint")
if pkg["scripts"].get("build") != "echo build" or pkg.get("engines",{}).get("node") != "22.x":
    fail("runtime does not match GoDaddy build and Node 22 requirements")
pkg["main"] = "sbc-godaddy-flat-entrypoint.cjs"
pkg["scripts"]["start"] = "node sbc-godaddy-flat-entrypoint.cjs"
files["package.json"] = (json.dumps(pkg,indent=2) + "\n").encode()
files["sbc-godaddy-flat-entrypoint.cjs"] = ENTRY.encode()
for name in ("persistent-state.js", "tenant-rejection-guard.js", "runtime-env-beacon.js"):
    if name in files: fail("launcher path conflict "+name)
    files[name] = (ROOT/name).read_bytes()
csv_path = "hotfix-assets/sbc-leads-oct-26-27-2026-31.csv"
if csv_path in files: fail("lead CSV path conflict")
files[csv_path] = PRIVATE_CSV.read_bytes()
DEST.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(DEST, "w", zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=False) as dst:
    for name in sorted(files):
        entry = zipfile.ZipInfo(name,(2026,10,27,4,0,0))
        entry.external_attr = 0o100644 << 16
        entry.compress_type = zipfile.ZIP_DEFLATED
        dst.writestr(entry, files[name], compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
with zipfile.ZipFile(DEST) as check:
    if check.testzip() is not None:
        fail("generated ZIP CRC failed")
    if set(check.namelist()) != set(files):
        fail("unexpected generated ZIP inventory")
    if sha(check.read("server.js")) != original_server_hash:
        fail("compiled server modified by packaging")
    if len([n for n in check.namelist() if n.startswith("data/")]) != 5:
        fail("not exactly five approved seed catalog files")
(DEST.parent/(DEST.name+".sha256")).write_text(sha(DEST.read_bytes())+"  "+DEST.name+"\n")
print("[SBC SINGLE-LAYER] PASS",DEST,"files",len(files),"bytes",DEST.stat().st_size,
      "compiled server SHA",original_server_hash,"source fingerprint",manifest["sourceFingerprint"])

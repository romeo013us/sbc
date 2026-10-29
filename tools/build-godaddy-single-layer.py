#!/usr/bin/env python3
"""Build a GoDaddy-uploadable single-layer app from the verified V66 prebuilt runtime.

Only release packaging/startup are changed. Business logic remains byte-identical
to the verified compiled runtime. No production data, API calls, or secrets touched.
"""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ZIP = ROOT / "SBC-V66-PREBUILT-RUNTIME.zip"
RECEIPT = ROOT / "SBC-V66-PREBUILT-RUNTIME.json"
DEST = ROOT / "dist" / "SBC-GoDaddy-SINGLE-LAYER-APP.zip"
ENTRY = """'use strict';
// Preserve V66 root launcher data persistence, tenant process guards and boot beacon.
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const fs = require('node:fs');
const root = __dirname;
// Verified identity is generated from the same isolated CI runtime used by this build.
const release = require('./SBC-FLAT-RELEASE-IDENTITY.json');
if(release.schema!==1||! /^[a-f0-9]{40}$/.test(release.sourceCommit||'')||
   ! /^[a-f0-9]{64}$/.test(release.sourceFingerprint||'')||
   ! /^[a-f0-9]{64}$/.test(release.serverSha256||'')||
   ! /^[a-f0-9]{64}$/.test(release.inventorySha256||'')) {
  throw Error('[SBC DEPLOY IDENTITY] invalid pinned release identity');
}
const serverSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'server.js'))).digest('hex');
if(serverSha!==release.serverSha256)throw Error('[SBC DEPLOY IDENTITY] packaged server has changed since verification');
require('./sbc-flat-integrity.cjs').verifyFlatIntegrity(root,release);
const receiptPath = path.join(root,'SBC-DEPLOY-RECEIPT.json');
const hasReceipt = fs.existsSync(receiptPath);
if(hasReceipt){
 const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
 if(receipt.sourceCommit!==release.sourceCommit||receipt.sourceFingerprint!==release.sourceFingerprint){
  throw Error('[SBC DEPLOY IDENTITY] GitHub deployment receipt does not match running server');
 }
}
console.log('[SBC DEPLOY IDENTITY] entry=flat source_commit='+release.sourceCommit+' source_fingerprint='+release.sourceFingerprint+' receipt='+(hasReceipt?'VERIFIED':'ZIP_INSTALL'));
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
VERIFY = """'use strict';
// SBC V66 clean deployment: verify all packaged application code and assets.
// Fail closed on missing, substituted or partially-extracted release files.
// Does not read/modify MySQL, session files, backups or persistent data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function digest(b){return crypto.createHash('sha256').update(b).digest('hex');}
function verifyFlatIntegrity(root,release){
 const file=path.join(root,'SBC-FLAT-FILE-INVENTORY.json');
 const bytes=fs.readFileSync(file);
 if(digest(bytes)!==release.inventorySha256)
  throw Error('[SBC FLAT INTEGRITY] manifest hash mismatch; mixed/incomplete deployment');
 const m=JSON.parse(bytes.toString('utf8'));
 if(m.schema!==1||m.version!==release.version||m.sourceFingerprint!==release.sourceFingerprint||
    !Array.isArray(m.files)||m.files.length<200||m.files.length>5000)
  throw Error('[SBC FLAT INTEGRITY] malformed source-bound inventory');
 let total=0;
 const seen=new Set();
 for(const item of m.files){
  const rel=item.path;
  if(typeof rel!=='string'||!rel||rel.startsWith('/')||rel.includes('\\\\')||
     rel.split('/').some(s=>!s||s==='.'||s==='..')||seen.has(rel)||
     /^(?:data|backups|sbc-persistent|node_modules|\\.git)\\//.test(rel)||
     !/^[a-f0-9]{64}$/.test(item.sha256||'')||
     !Number.isSafeInteger(item.size)||item.size<0||item.size>50*1024*1024)
   throw Error('[SBC FLAT INTEGRITY] unsafe inventory entry');
  seen.add(rel);
  const target=path.join(root,rel);
  let actual;
  try{actual=fs.readFileSync(target);}
  catch{throw Error('[SBC FLAT INTEGRITY] required packaged file missing: '+rel);}
  if(actual.length!==item.size)
   throw Error('[SBC FLAT INTEGRITY] wrong packaged file type/size: '+rel);
  if(digest(actual)!==item.sha256)
   throw Error('[SBC FLAT INTEGRITY] packaged file altered: '+rel);
  total+=item.size;
  if(total>256*1024*1024)throw Error('[SBC FLAT INTEGRITY] release size exceeds limit');
 }
 for(const required of ['server.js','package.json','bootstrap.js','sbc-godaddy-flat-entrypoint.cjs',
                         'sbc-flat-integrity.cjs','persistent-state.js',
                         'tenant-rejection-guard.js','runtime-env-beacon.js',
                         'public/index.html','public/app.js','browser_public/index.html']){
  if(!seen.has(required))throw Error('[SBC FLAT INTEGRITY] critical runtime asset not pinned: '+required);
 }
 console.log('[SBC FLAT INTEGRITY] PASS source='+release.sourceCommit.slice(0,12)+' files='+seen.size+' bytes='+total);
 return {ok:true,files:seen.size};
}
module.exports={verifyFlatIntegrity};
if(require.main===module)verifyFlatIntegrity(__dirname,require('./SBC-FLAT-RELEASE-IDENTITY.json'));
"""

# Embed the same byte-checking verifier into the launcher itself. The
# startup-parity contract intentionally permits no extra startup imports.
# Standalone verifier remains available for offline tamper regression tests.
inline_verify = VERIFY.split("function digest(b)",1)[1].split("module.exports=",1)[0]
ENTRY = ENTRY.replace(
    "require('./sbc-flat-integrity.cjs').verifyFlatIntegrity(root,release);",
    "function digest(b)" + inline_verify + "\nverifyFlatIntegrity(root,release);"
)

BOOTSTRAP_COMPAT = """'use strict';
// SBC V66.73 GoDaddy backwards-compatible startup only.
// If GoDaddy preserved a legacy `node bootstrap.js` command, launch the same
// verified flat runtime rather than a second compiler or database writer.
console.log('[SBC DEPLOY STARTUP COMPAT] legacy bootstrap.js -> verified flat entrypoint');
require('./sbc-godaddy-flat-entrypoint.cjs');
"""

def sha(data):
    return hashlib.sha256(data).hexdigest()

def fail(message):
    raise SystemExit("SBC SINGLE-LAYER PACKAGE FAIL: " + message)

# Enforce the SAME source fingerprint and ZIP checksum as the Node/GoDaddy
# startup gate, including when an owner runs this Python packager directly.
# A receipt that merely names an old successful CI build is not deployable.
def verify_source_matched_prebuilt():
    verifier = (
        "const item=require('./scripts/prebuilt-runtime.cjs').readManifest(process.cwd());"
        "if(!item||item.manifest.generatedBy!=='isolated-github-ci')"
        "throw Error('Release lacks verified isolated CI provenance');"
    )
    try:
        result = subprocess.run(
            ["node", "-e", verifier], cwd=ROOT, capture_output=True,
            text=True, check=False, timeout=90
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        fail("cannot verify source-bound release: " + str(exc))
    if result.returncode:
        fail("source-matched prebuilt gate rejected this checkout: "
             + (result.stderr.strip() or result.stdout.strip())[-600:])

verify_source_matched_prebuilt()
manifest = json.loads(RECEIPT.read_text())
raw = ZIP.read_bytes()
if manifest.get("generatedBy") != "isolated-github-ci" or sha(raw) != manifest.get("archiveSha256"):
    fail("compiled artifact does not match its isolated CI receipt")

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
        # Compiled application archives may include legacy CI workflow files.
        # They are not runtime inputs and must never be published to a deploy branch.
        if name.startswith(".github/"):
            continue
        if name in files:
            fail("duplicate compiled entry " + name)
        if ((info.external_attr >> 16) & 0o170000) == 0o120000:
            fail("compiled runtime contains symlink " + name)
        if "node_modules" in name.split("/") or name.lower().endswith((".zip",".tgz",".tar",".rar")):
            fail("compiled runtime contains forbidden archive or dependencies " + name)
        if name.lower().endswith(".csv"):
            fail("refusing personal or prospect CSV in verified prebuilt: " + name)
        if name.startswith("starter-leads/"):
            fail("refusing historic prospect backup directory: " + name)
        files[name] = src.read(info)
required = {"server.js", "package.json", "package-lock.json", "public/index.html", "browser_public/index.html"}
if not required.issubset(files):
    fail("compiled runtime missing root or browser files")
# Add one UI-only Kim Chief of Staff entrypoint to each compiled public mirror.
# No changes to the verified server, tenant guards, recovery logic or existing Kim dialog.
kim_asset = ROOT / "ui-overlays" / "sbc-kim-chief-of-staff-page.js"
if not kim_asset.is_file():
    fail("Kim Chief of Staff UI source missing")
kim_bytes = kim_asset.read_bytes()
if b"window.sbcKimCanonical" not in kim_bytes or b"startKimVoice" not in kim_bytes:
    fail("Kim UI must reuse the existing canonical chat and voice methods")
kim_entry = b'<script src="/sbc-kim-chief-of-staff-page.js?v=66.81.0" defer></script>'
voice_entry = b'<link rel="stylesheet" href="/kim-voice.css?v=66.81.0">\n<script src="/kim-voice.js?v=66.81.0" defer></script>'
for html_name, js_name in (
    ("public/index.html", "public/sbc-kim-chief-of-staff-page.js"),
    ("browser_public/index.html", "browser_public/sbc-kim-chief-of-staff-page.js"),
):
    prefix = html_name.split("/")[0]
    if prefix+"/kim-voice.js" not in files or prefix+"/kim-voice.css" not in files:
        fail("Verified runtime is missing the existing Kim voice transport and styles")
    if js_name in files or kim_entry in files[html_name]:
        fail("Kim UI overlay already exists; refuse duplicate")
    source = files[html_name]
    if source.count(b"</body>") != 1:
        fail("Unexpected Kim UI injection boundary: " + html_name)
    files[html_name] = source.replace(b"</body>", voice_entry + b"\n" + kim_entry + b"\n</body>")
    files[js_name] = kim_bytes

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
# The artifact is safe under npm start and any previously persisted
# GoDaddy `node bootstrap.js` serve command. Never compile a second runtime.
if "bootstrap.js" in files: fail("compiled runtime conflicts with GoDaddy compatibility launcher")
files["bootstrap.js"] = BOOTSTRAP_COMPAT.encode()
for name in ("persistent-state.js", "tenant-rejection-guard.js", "runtime-env-beacon.js"):
    if name in files: fail("launcher path conflict "+name)
    files[name] = (ROOT/name).read_bytes()
if "sbc-flat-integrity.cjs" in files: fail("integrity verifier path conflict")
files["sbc-flat-integrity.cjs"] = VERIFY.encode()
# Do not pin files that GoDaddy's package manager owns or the app writes.
# Every executable and browser asset remains checksum-pinned.
mutable = {"package-lock.json"}
def inventory_pinned(name):
    return (name not in mutable and
            name not in {"SBC-FLAT-RELEASE-IDENTITY.json","SBC-FLAT-FILE-INVENTORY.json"} and
            not name.startswith(("data/","backups/","sbc-persistent/",".airo/")))
inventory = {
    "schema": 1, "version": manifest["version"],
    "sourceFingerprint": manifest["sourceFingerprint"],
    "files": [{"path": name, "sha256": sha(files[name]), "size": len(files[name])}
              for name in sorted(files) if inventory_pinned(name)]
}
if len(inventory["files"]) < 200: fail("application inventory unexpectedly small")
inventory_bytes=(json.dumps(inventory,separators=(",",":"),sort_keys=True)+"\n").encode()
files["SBC-FLAT-FILE-INVENTORY.json"]=inventory_bytes
identity = {
    "schema":1,
    "version":manifest["version"],
    "sourceCommit":manifest["sourceCommit"],
    "sourceFingerprint":manifest["sourceFingerprint"],
    "serverSha256":original_server_hash,
    "inventorySha256":sha(inventory_bytes),
    "uiOverlays":{"kimChiefOfStaffSha256":sha(kim_bytes)}
}
if "SBC-FLAT-RELEASE-IDENTITY.json" in files: fail("compiled release identity path collision")
files["SBC-FLAT-RELEASE-IDENTITY.json"] = (json.dumps(identity,indent=2)+"\n").encode()
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
    if sha(check.read("public/sbc-kim-chief-of-staff-page.js")) != sha(kim_bytes):
        fail("packaged Kim page differs from reviewed source")
    if check.read("browser_public/sbc-kim-chief-of-staff-page.js") != kim_bytes:
        fail("browser mirror Kim page differs from reviewed source")
    if (kim_entry not in check.read("public/index.html") or kim_entry not in check.read("browser_public/index.html") or
        voice_entry not in check.read("public/index.html") or voice_entry not in check.read("browser_public/index.html")):
        fail("Kim page is not linked in both compiled frontends")
    if sha(check.read("server.js")) != original_server_hash:
        fail("compiled server modified by packaging")
    if sha(check.read("SBC-FLAT-FILE-INVENTORY.json")) != identity["inventorySha256"]:
        fail("release file inventory mutated")
    if not all(sha(check.read(item["path"]))==item["sha256"] for item in inventory["files"]):
        fail("packaged inventory file mismatch")
    if "sbc-flat-integrity.cjs" not in check.namelist():
        fail("runtime inventory verifier missing")
    if check.read("bootstrap.js") != BOOTSTRAP_COMPAT.encode():
        fail("legacy startup compatibility launcher changed")
    if json.loads(check.read("SBC-FLAT-RELEASE-IDENTITY.json")) != identity:
        fail("release identity not pinned to compiled source")
    if len([n for n in check.namelist() if n.startswith("data/")]) != 5:
        fail("not exactly five approved seed catalog files")
(DEST.parent/(DEST.name+".sha256")).write_text(sha(DEST.read_bytes())+"  "+DEST.name+"\n")
print("[SBC SINGLE-LAYER] PASS",DEST,"files",len(files),"bytes",DEST.stat().st_size,
      "compiled server SHA",original_server_hash,"source fingerprint",manifest["sourceFingerprint"])

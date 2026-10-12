'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6522-test-'));
try {
  const srcZip=path.join(root,'SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip');
  if (process.platform === 'win32') {
    // Windows does not ship the Unix `unzip` command. Use the built-in
    // PowerShell archive extractor; escape single quotes in literal paths.
    const psQuote = value => String(value).replace(/'/g, "''");
    const ps = `$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '${psQuote(srcZip)}' -DestinationPath '${psQuote(temp)}' -Force`;
    cp.execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {stdio: 'inherit'});
  } else {
    cp.execFileSync('unzip',['-q',srcZip,'-d',temp]);
  }
  const patch=require('./apply-v6522-api-stabilization.js');
  patch.apply(temp);
  const server=fs.readFileSync(path.join(temp,'server.js'),'utf8');
  const growth=fs.readFileSync(path.join(temp,'routes/v56240-autonomous-growth-hardening.js'),'utf8');
  const ui=fs.readFileSync(path.join(temp,'public/v32-9-enterprise.js'),'utf8');
  const pkg=JSON.parse(fs.readFileSync(path.join(temp,'package.json'),'utf8'));
  assert.equal(pkg.version,'65.1.22');
  for(const rel of ['server.js','routes/v56240-autonomous-growth-hardening.js','public/v32-9-enterprise.js']) cp.execFileSync(process.execPath,['--check',path.join(temp,rel)]);
  assert(server.includes('Promise.race([syncV329CanonicalLeadMesh()'));
  assert(server.includes("res.status(sync.dataStatus==='UNAVAILABLE_TIMEOUT'?503:200)"));
  assert(server.includes('no CRM writes were performed'));
  assert(growth.includes('GROWTH_STATUS_TIMEOUT'));
  assert(growth.includes('recoverySafe:true,readOnly:true'));
  assert(ui.includes("'unknown'"));
  assert(ui.includes('Counts are unknown; no data was changed.'));
  console.log('V65.1.22 API stabilization tests: PASS — bounded summary/growth responses; unknown CRM counts are not fabricated; recovery/read-only declarations preserved.');
} finally {fs.rmSync(temp,{recursive:true,force:true});}

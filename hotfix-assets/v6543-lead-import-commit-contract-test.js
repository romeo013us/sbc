'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6543-import-test-'));
try{
 const zip=path.join(root,'SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip');
 if(process.platform==='win32'){const q=v=>String(v).replace(/'/g,"''");cp.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',"$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '"+q(zip)+"' -DestinationPath '"+q(temp)+"' -Force"],{stdio:'inherit'});}else cp.execFileSync('unzip',['-q',zip,'-d',temp]);
 require('../apply-v65116-hotfix.js').apply(temp);
 for(const file of ['apply-v6522-api-stabilization.js','apply-v6523-read-query-cancel.js','apply-v6524-single-writer.js','apply-v6525-customer360-workspace.js','apply-v6526-demo-studio.js','apply-v6527-persistence-writer-lock.js','apply-v6528-runtime-writer-lease.js','apply-v6529-open-readiness.js','apply-v6530-writer-lease-marker-fix.js','apply-v6531-release-identity.js','apply-v6533-startup-ddl-gate.js','apply-v6534-price-consistency.js','apply-v6535-writer-no-ddl-operational-startup.js','apply-v6536-runtime-beacon.js','apply-v6537-effective-runtime-role.js','apply-v6538-writer-hydration-without-ddl.js','apply-v6539-safe-no-ddl-startup.js'])require('./'+file).apply(temp);
 require('./apply-v6541-lead-import.js').apply(temp);
 require('./apply-v6542-voice-call-diagnostics.js').apply(temp);
 const result=require('./apply-v6543-lead-import-commit-contract.js').apply(temp);
 const server=fs.readFileSync(path.join(temp,'server.js'),'utf8'),ui=fs.readFileSync(path.join(temp,'public/sbc-lead-import-v6541.js'),'utf8'),html=fs.readFileSync(path.join(temp,'public/index.html'),'utf8'),sw=fs.readFileSync(path.join(temp,'public/sw.js'),'utf8'),pkg=JSON.parse(fs.readFileSync(path.join(temp,'package.json'),'utf8')),lock=JSON.parse(fs.readFileSync(path.join(temp,'package-lock.json'),'utf8')),identity=fs.readFileSync(path.join(temp,'config/release-identity.js'),'utf8');
 assert.equal(result.version,'65.1.43');assert.equal(pkg.version,'65.1.43');assert.equal(lock.packages[''].version,'65.1.43');
 assert(server.includes("requestedDryRun===false||String(requestedDryRun).toLowerCase()==='false'||req.body?.mode==='import'"));
 assert(server.includes("No new records were written; '+duplicateCount+' duplicate(s) were skipped."));
 assert(ui.includes("request({mode:'import',dryRun:false,rows})"));assert(ui.includes('result.dryRun!==false'));assert(ui.includes('server returned preview mode instead of committing records'));assert(ui.includes("Import request failed')+' (HTTP '+response.status+')"));
 assert(html.includes('/sbc-lead-import-v6541.js?v=65.1.43-import-contract'));assert(sw.includes("const CACHE='sbc-static-v65-1-43'"));
 assert(identity.includes("const RELEASE_VERSION = '65.1.43';"));assert(identity.includes("const RELEASE_NAME = 'LEAD_IMPORT_COMMIT_CONTRACT';"));
 cp.execFileSync(process.execPath,['--check',path.join(temp,'server.js')]);cp.execFileSync(process.execPath,['--check',path.join(temp,'public/sbc-lead-import-v6541.js')]);
 console.log('V65.1.43 lead-import contract tests: PASS — explicit commit mode, zero-write clarity, HTTP diagnostics, and browser cache invalidation.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

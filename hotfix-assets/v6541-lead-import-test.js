'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6541-lead-import-'));
try{
 const zip=path.join(root,'SBC-OS-V65.1.13-ROOT-FIXED-LOCKFILE-BLOCKED.zip');
 if(process.platform==='win32'){const q=v=>String(v).replace(/'/g,"''");cp.execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',"$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '"+q(zip)+"' -DestinationPath '"+q(temp)+"' -Force"],{stdio:'inherit'});}else cp.execFileSync('unzip',['-q',zip,'-d',temp]);
 const patch=require('./apply-v6541-lead-import.js'),result=patch.apply(temp),server=fs.readFileSync(path.join(temp,'server.js'),'utf8'),html=fs.readFileSync(path.join(temp,'public/index.html'),'utf8'),ui=fs.readFileSync(path.join(temp,'public/sbc-lead-import-v6541.js'),'utf8'),pkg=JSON.parse(fs.readFileSync(path.join(temp,'package.json'),'utf8')),lock=JSON.parse(fs.readFileSync(path.join(temp,'package-lock.json'),'utf8'));
 assert.equal(result.version,'65.1.41');assert.equal(pkg.version,'65.1.41');assert.equal(lock.packages[''].version,'65.1.41');
 assert(server.includes("app.post('/api/crm/leads/import',auth,ownerOnly"));assert(server.includes('SBC_RUNTIME_READ_ONLY||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady'));
 assert(server.includes("SHOW COLUMNS FROM sbc_customers LIKE 'tenant_id'"));assert(server.includes('dryRun'));assert(server.includes('await conn.rollback()'));assert(server.includes('tenant_id,business_name,contact_name,phone,email'));
 assert(html.includes('/sbc-lead-import-v6541.js?v=65.1.41-lead-import'));assert(ui.includes('Preview import'));assert(ui.includes('Duplicate'));assert(ui.includes('No records were written'));
 for(const f of ['server.js','public/sbc-lead-import-v6541.js'])cp.execFileSync(process.execPath,['--check',path.join(temp,f)]);
 console.log('V65.1.41 Lead Import tests: PASS — authenticated route, tenant-scoped duplicate checks, read-only preview, recovery/writer gates, rollback, and UI syntax.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

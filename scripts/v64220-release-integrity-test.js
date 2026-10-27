
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..'); const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')); const rel=require(path.join(root,'config/release-identity.js'));
const adapter=fs.readFileSync(path.join(root,'enterprise/integration/sbc-adapter.js'),'utf8'); const server=fs.readFileSync(path.join(root,'server.js'),'utf8'); const ui=fs.readFileSync(path.join(root,'public/index.html'),'utf8'); const fin=fs.readFileSync(path.join(root,'public/v56251-ui-finalize.js'),'utf8'); const v10=fs.readFileSync(path.join(root,'public/v10.js'),'utf8');
const ok=(c,m)=>{if(!c)throw new Error(m);console.log('PASS '+m)};
ok(pkg.version===require('../package.json').version&&rel.RELEASE_VERSION===pkg.version,'package and authoritative release identity 65.1.26');
ok(adapter.includes('export class SBCAdapter')&&adapter.includes('export class SbcPersistenceAdapter')&&adapter.includes('async dispatch(action)'),'Kevin adapter contract restored');
ok(server.includes('const projectedCustomers=db.customers')&&server.includes('recoveryProjection:MYSQL_RECOVERY_REQUIRED?recoveryProjection:[]'),'recovery candidates never promoted to authoritative CRM');
ok(server.includes("if(MYSQL_RECOVERY_REQUIRED){return res.json({ok:true,version:BUILD_VERSION,commercial:SBC_COMMERCIAL.VERSION,recoveryRequired:true,readOnly:true"),'commercial summary is recovery-safe');
ok(ui.includes('V65.1.26 · DEMO STUDIO')&&fin.includes("__SBC_UI_RELEASE__='65.1.26'"),'frontend release identity 65.1.26'); const integrity=require('../enterprise/v4341-kim-resilience-control.js').verifyIntegrity(); ok(integrity.ok,'runtime integrity manifest matches updated release files');
ok(v10.includes('RECOVERY LEAD CANDIDATES')&&v10.includes('AUTHORITATIVE CRM LEADS'),'lead UI distinguishes recovery evidence from CRM truth');
cp.execFileSync(process.execPath,['--check',path.join(root,'enterprise/kevin/kevin-core.js')]); cp.execFileSync(process.execPath,['--check',path.join(root,'enterprise/integration/sbc-adapter.js')]); console.log('V65.1.26 release integrity test: PASS');

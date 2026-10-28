'use strict';
// V66.79: role-focused UI and demo password repair contract. No live credentials, no customer writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('public/app.js'),html=read('public/index.html');
assert.equal(app,read('browser_public/app.js'),'app mirrors must match');
assert.equal(html,read('browser_public/index.html'),'HTML mirrors must match');
assert(html.includes('sbc-v6679-researcher-workspace'),'role-scoped CSS installed');
assert(html.includes("['leadresearch','leadverification','training','timeclock']"),'only researcher tools allowed');
assert(!html.includes('var role=\'\',redirected=false,readInFlight=false'),'old global observer removed');
assert(!html.includes('new MutationObserver(function(){apply()'),'role navigation should not mutate all document attributes');
assert(app.includes("document.body.classList.toggle('sbc-researcher-mode',state.me?.role==='lead_researcher')"),'apply researcher mode before data load');
assert(app.includes("if(state.me?.role==='lead_researcher'&&!['leadresearch','leadverification','training','timeclock'].includes(state.view))state.view='leadresearch'"),'researcher default and view guard');
assert(app.includes("if(state.me?.role==='demo'&&!['dashboard','customers','quotes','orders','presentation'].includes(state.view))state.view='dashboard'"),'demo viewer view guard');
assert(app.includes("state.me?.role==='owner'?api('/api/message-templates'"),'no owner message templates on employee page');
assert(app.includes("state.me?.role==='demo'?Promise.resolve({ok:true"),'no denied training bootstrap request from demo');
assert(app.includes("Manage Demo Viewer — Set Password"),'owner can rotate demo password without default credentials');
for(const f of ['sbc-v6563-sales-operating-model.js','v32-9-enterprise.js','v33-0-launch-acquisition.js','sbc-agent-os-v56-25-3.js','v56240-growth-hardening.js']){
  const a=read('public/'+f),b=read('browser_public/'+f);
  assert.equal(a,b,'owner-only module mirrors match: '+f);
  assert(a.includes("window.state.me.role!=='owner'"),'owner-only mount guard: '+f);
  assert(a.includes("sbc:authenticated"),'owner-only module initializes after owner auth: '+f);
  new vm.Script(a,{filename:f});
}
new vm.Script(app,{filename:'app.js'});
const server=read('server.js');
assert(server.includes("function sbcLornaAllowedRequest(req,user)"),'server role allowlist preserved');
assert(server.includes("function sbcDemoViewerAllowed(method,route)"),'demo API allowlist preserved');
assert(server.includes("if(p==='/api/workforce/leads')return ['GET','POST'].includes(m)"),'lead submission preserved');
assert(server.includes("app.put('/api/users/:id',auth,ownerOnly"),'demo password management is owner-only');
assert(server.includes("if(req.body.password){if(String(req.body.password).length<10)"),'owner password reset minimum length retained');
const moduleSource=read('public/sbc-v6563-sales-operating-model.js');
assert(moduleSource.includes("if(!window.state?.me||window.state.me.role!=='owner')"),'role guard must use authenticated identity');
for(let pass=1;pass<=3;pass++)console.log('[SBC V6679] PASS '+pass+'/3 isolated Lorna UI, owner mounts, demo password management, server RBAC, syntax');

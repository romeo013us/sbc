'use strict';
// SBC V66.74: The importer must be discoverable by the owner, not floated
// over every workspace or exposed to non-owner accounts.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('public/app.js'),mirror=read('browser_public/app.js');
const html=read('public/index.html'),server=read('server.js');
const owner=read('public/sbc-v6667-private-owner-import.js');
assert.equal(app,mirror,'Published and Preview dashboard JavaScript must match');
assert(app.includes('SBC_V6674_OWNER_IMPORT_ENTRY'));
assert(html.includes('SBC_V6632_REMOVE_FLOATING_LEAD_IMPORT'),'floating overlay must remain suppressed on dashboard');
assert(!html.includes('<script src="/sbc-v6667-private-owner-import.js'),'private owner importer must not be globally injected');
assert(server.includes("app.get('/owner/lead-import',auth,ownerOnly"),'import page must require owner authentication');
assert(server.includes("app.get('/api/owner/lead-import/packaged-batch',auth,ownerOnly"),'batch must require owner authentication');
assert(owner.includes('Load Oct 26–27 batch (31 leads)'),'owner importer must offer the packaged 31-lead batch');
const start=app.indexOf('function dashboard(){'),end=app.indexOf('\nfunction ',start+12);
assert(start>0&&end>start,'production dashboard function must exist');
const dashboard=new vm.Script(app.slice(start,end)+'\ndashboard()',{filename:'sbc-dashboard.js'});
function render(role){
 return dashboard.runInNewContext({
  state:{view:'dashboard',data:{customers:[],quotes:[],orders:[],renewals:[],activities:[]},catalog:{packages:[],services:[]},me:{role},aiBriefing:null},
  esc:x=>String(x??''),money:n=>'$'+Number(n||0).toFixed(2),today:()=>'',dt:x=>String(x??'')
 },{timeout:2500});
}
for(let pass=1;pass<=3;pass++){
 const visible=render('owner');
 assert.equal(visible.split('data-sbc-owner-lead-import="true"').length-1,1,'exactly one owner import link');
 assert(visible.includes('href="/owner/lead-import"'),'owner link must open the authenticated import page');
 assert(visible.includes('Import 31 Leads'),'batch action must be clearly labeled');
 assert(visible.includes('+ New Lead')&&visible.includes('Create Quote'),'existing owner actions must remain');
 for(const role of ['manager','lead_researcher','caller','demo']){
  const hidden=render(role);
  assert(!hidden.includes('data-sbc-owner-lead-import'),'non-owner dashboard must not advertise owner import');
  assert(hidden.includes('+ New Lead')&&hidden.includes('Create Quote'),'normal dashboard actions must remain');
 }
 console.log('[SBC V6674] PASS '+pass+'/3 owner-visible, non-owner-hidden, existing actions retained');
}
new vm.Script(app,{filename:'public/app.js'});
console.log('[SBC V6674] PASS private route and 31-lead staging retained; no import executed');

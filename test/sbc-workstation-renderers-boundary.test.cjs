'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createWorkstationRenderers}=require('../routes/sbc-workstation-renderers-v1.cjs');
const fs=require('node:fs'),path=require('node:path');
test('demo renderer keeps provider request behind approved and checkout-enabled state',()=>{
 const calls=[];
 const renderer=createWorkstationRenderers(()=>({SBC_PROSPECT_SITE:{renderPage:(demo,page)=>{calls.push(page);return '<html><body>private site</body></html>';}}}));
 const draft={slug:'bad<script>token',customer:{businessName:'Test & Co'},requestedPage:'services',status:'Draft',checkoutEnabled:true};
 assert.equal(renderer.buildDemoHtml(draft),'<html><body>private site</body></html>');
 assert.equal(renderer.buildDemoHtml({...draft,status:'Approved',checkoutEnabled:false}),'<html><body>private site</body></html>');
 const approved=renderer.buildDemoHtml({...draft,status:'Approved'});
 assert.match(approved,/data-sbc-checkout/);assert.match(approved,/const slug='badscript token'|const slug='badscripttoken'/);
 assert(!approved.includes('bad<script>token'));assert.deepEqual(calls,['services','services','services']);
});
test('presentation token is sanitized and existing password and access rails remain',()=>{
 const renderer=createWorkstationRenderers(()=>({}));
 const output=renderer.v437PublicHtml('x_1-<bad>');
 assert.match(output,/const token="x_1-bad"/);assert.match(output,/type="password"/);
 assert.match(output,/\/api\/public\/presentation\//);assert.match(output,/Authorization/);
});
test('executive page uses request-time release context and owner route remains protected',()=>{
 let version='fixture-A';const renderer=createWorkstationRenderers(()=>({BUILD_VERSION:version}));
 assert.match(renderer.executiveCommandHtml(),/fixture-A/);version='fixture-B';assert.match(renderer.executiveCommandHtml(),/fixture-B/);
 const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
 assert(server.includes("app.get('/executive-command',auth,ownerOnly,(req,res)=>res.send(SBC_WORKSTATION_RENDERERS.executiveCommandHtml()));"));
});

test('new employee accounts explicitly choose one of the four retained roles; no legacy caller default',()=>{
 const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
 const begin=server.indexOf("app.post('/api/users',auth,ownerOnly"),end=server.indexOf("app.put('/api/users/:id'",begin);
 const route=server.slice(begin,end);assert.match(route,/WORKFORCE_ROLE_REQUIRED/);
 assert.match(route,/\['account_manager','lead_researcher','fulfillment','hr_manager'\]/);
 assert.doesNotMatch(route,/\?'caller'|:'caller'/);
 for(const dir of ['public','browser_public']){
  const js=fs.readFileSync(path.resolve(__dirname,'../'+dir+'/app.js'),'utf8');
  const form=js.slice(js.indexOf('function newCallerUser(){'),js.indexOf('function editCallerUser('));
  assert.match(form,/name="role"/);
  for(const role of ['account_manager','lead_researcher','fulfillment','hr_manager'])assert.ok(form.includes('value="'+role+'"'),role);
  assert.doesNotMatch(form,/value="(?:caller|manager|sales_manager)"/);
 }
});

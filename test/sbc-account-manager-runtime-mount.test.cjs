'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const endpoints=[
 'GET /api/v6606/crm/account-portfolios/mine',
 'GET /api/v6606/crm/account-portfolios/launch-readiness',
 'GET /api/v6606/crm/account-portfolios/summary',
 'POST /api/v6606/crm/account-portfolios/assign-batch',
 'POST /api/v6606/crm/account-portfolios/:id/transfer',
 'POST /api/v6606/crm/account-portfolios/:id/note',
 'POST /api/v6606/crm/account-portfolios/:id/follow-up',
 'POST /api/v6606/crm/account-portfolios/:id/interaction'
];
test('real CRM route registry mounts working V4–V7 Account Manager portfolio endpoints',()=>{
 const registerCRM=require('../routes/crm.js');
 const seen=[];
 const app={
  get:(route,...handlers)=>seen.push(['GET',route,handlers]),
  post:(route,...handlers)=>seen.push(['POST',route,handlers])
 };
 const auth=(req,res,next)=>next();
 registerCRM(app,{auth,getContext:()=>({db:{users:[],customers:[]},mysqlPool:null,
  recoveryRequired:()=>true})});
 for(const key of endpoints){
  const match=seen.filter(x=>x[0]+' '+x[1]===key);
  assert.equal(match.length,1,'Account Manager endpoint not mounted exactly once: '+key);
  assert.equal(match[0][2][0],auth,'route missing authenticated middleware: '+key);
 }
 assert(!seen.some(x=>x[1]==='/api/account-social/v1/portfolio'),
  'Social Studio remains separately gated and must not silently publish new permissions');
});
test('staged GoDaddy ZIP must include role authorization and employee onboarding, not just unmounted source files',()=>{
 const workflow=read('.github/workflows/sbc-v6606-staged-release.yml');
 const stagingStep="node scripts/stage-account-manager-role-v2.cjs";
 assert.equal(workflow.split(stagingStep).length,2,'exactly one stage patch invocation required');
 const stageAt=workflow.indexOf(stagingStep),receiptAt=workflow.indexOf('Generate honest staged release identity');
 assert(stageAt>0&&receiptAt>stageAt,'must activate Account Manager role before compiled server receipt');
 assert(workflow.includes('SBC_EXPECT_ACCOUNT_MANAGER_STAGED=1 node --test test/sbc-account-manager-runtime-mount.test.cjs'),
  'CI must verify staged server AFTER role patch, not only test the patch helper');
 const server=read('server.js');
 if(process.env.SBC_EXPECT_ACCOUNT_MANAGER_STAGED==='1'){
  for(const token of [
   'SBC_ACCOUNT_MANAGER_ROLE_V2','SBC_ACCOUNT_MANAGER_ROLE_GATE.allowAccountManager',
   "if(u?.role==='account_manager')return res.redirect(302,'/sbc-account-manager-v1.html')",
   "if(u?.role==='fulfillment')return res.redirect(302,'/sbc-production-workstation.html')",
   "if(u?.role==='hr_manager')return res.redirect(302,'/hr-workstation.html')",
   'WORKFORCE_ROLE_REQUIRED'
  ])assert(server.includes(token),'missing compiled role token: '+token);
  const create=server.slice(server.indexOf("app.post('/api/users',auth,ownerOnly"),server.indexOf("app.put('/api/users/:id'"));
  const roles=create.match(/const role=String\(b\.role\|\|''\);if\(!\[([^\]]+)\]\.includes\(role\)\)/);
  assert(roles,'compiled employee provisioning requires an explicit role');
  assert.deepEqual(roles[1].split(',').map(x=>x.trim().replaceAll("'","")).sort(),['account_manager','fulfillment','hr_manager','lead_researcher']);
  for(const dir of ['public','browser_public'])for(const file of ['sbc-production-workstation.html','sbc-production-workstation.js'])assert(fs.existsSync(path.join(ROOT,dir,file)),'missing production workstation asset '+dir+'/'+file);
 }
 const gate=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 assert(gate.allowed('POST','/api/v6606/crm/account-portfolios/c7/interaction'));
 assert(!gate.allowed('GET','/api/v6606/crm/account-portfolios/launch-readiness'));
 assert(!gate.allowed('POST','/api/v6606/crm/account-portfolios/assign-batch'));
 assert(fs.existsSync(path.join(ROOT,'public/sbc-account-manager-v1.html')));
 assert(fs.existsSync(path.join(ROOT,'public/sbc-account-manager-v1.js')));
});

test('account manager sign-out is visible even when optional services fail and uses the authenticated server logout',()=>{
 for(const dir of ['public','browser_public']){
  const html=read(dir+'/sbc-account-manager-v1.html'),js=read(dir+'/sbc-account-manager-v1.js');
  assert.match(html,/<button[^>]*id="amSignOut"[^>]*>/);
  assert.match(js,/\$\('amSignOut'\)\.addEventListener\('click',signOut\)/);
  assert.match(js,/fetch\('\/api\/logout',[\s\S]*?method:'POST'/);
  assert.match(js,/signedOut!==true/);
  assert.match(js,/location\.replace\('\/'\)/);
 }
});
test('optional research and social errors remain local to their panels, not the CRM authorization state',()=>{
 for(const dir of ['public','browser_public']){
  const js=read(dir+'/sbc-account-manager-v1.js');
  const load=js.slice(js.indexOf('async function load(){'),js.indexOf('function openAccount('));
  assert.match(load,/renderAccountGrid\(\)/);
  assert.match(load,/void loadHandoffs\(\)/);
  assert.doesNotMatch(load,/await api\('\/api\/account-social\/v1\/research\/queue'\)/);
  assert.doesNotMatch(load,/await socialLoad\(\)/);
  assert.match(js,/handoffStatus='unavailable'/);
  assert.match(js,/Research handoffs unavailable/);
 }
});

test('sign-out sends one POST and returns to login only after confirmed success',async()=>{
 const vm=require('node:vm');
 const js=read('public/sbc-account-manager-v1.js');
 const fn=js.slice(js.indexOf('async function signOut(){'),js.indexOf('async function load(){'));
 assert(fn.startsWith('async function signOut(){'));
 for(const scenario of ['success','unconfirmed','network','activeCall']){
  const button={disabled:false},workspace={hidden:false},requests=[],locations=[],messages=[];
  const state={role:'account_manager',accounts:[{id:'account1'}],handoffs:[],channels:[],posts:[],accountAppointments:[],lang:'en'};
  const sandbox={state,pendingQuick:null,$:()=>button,document:{getElementById:()=>workspace},
   window:{SBCCallCommandLiveV3:{isBusy:()=>scenario==='activeCall'},SBCCallCommand:{clear(){}}},
   location:{replace:url=>locations.push(url)},message:msg=>messages.push(msg),
   fetch:async(url,options)=>{requests.push([url,options]);if(scenario==='network')throw Error('offline');
    return {ok:true,json:async()=>({ok:true,signedOut:scenario==='success'})};}};
  await vm.runInNewContext(fn+';signOut()',sandbox);
  assert.equal(requests.length,scenario==='activeCall'?0:1);
  if(requests.length){assert.equal(requests[0][0],'/api/logout');assert.equal(requests[0][1].method,'POST');}
  assert.equal(workspace.hidden,scenario==='success');
  assert.deepEqual(locations,scenario==='success'?['/']:[]);
  assert.equal(state.role,scenario==='success'?'':'account_manager');
  if(scenario!=='success'){assert.equal(button.disabled,false);assert.equal(messages.length,1);}
 }
});

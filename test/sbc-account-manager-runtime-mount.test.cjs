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
   "'caller','account_manager','lead_researcher'",
   "const role=['caller','account_manager','lead_researcher'"
  ])assert(server.includes(token),'missing compiled role token: '+token);
 }
 const gate=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 assert(gate.allowed('POST','/api/v6606/crm/account-portfolios/c7/interaction'));
 assert(!gate.allowed('GET','/api/v6606/crm/account-portfolios/launch-readiness'));
 assert(!gate.allowed('POST','/api/v6606/crm/account-portfolios/assign-batch'));
 assert(fs.existsSync(path.join(ROOT,'public/sbc-account-manager-v1.html')));
 assert(fs.existsSync(path.join(ROOT,'public/sbc-account-manager-v1.js')));
});

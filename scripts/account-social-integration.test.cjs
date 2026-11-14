'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {registerAccountSocialIntegration}=require('../routes/sbc-account-social-integration-v1.cjs');
function app(){return {routes:[],get(path,...handlers){this.routes.push(['get',path,handlers])},put(path,...handlers){this.routes.push(['put',path,handlers])},post(path,...handlers){this.routes.push(['post',path,handlers])}}}
test('integration remains completely unmounted until explicit feature activation',()=>{
 const a=app();const v=registerAccountSocialIntegration(a,{auth:(req,res,next)=>next(),getContext:()=>({})});
 assert.equal(v,false);assert.equal(a.routes.length,0);
});
test('integration requires a session auth middleware and context, never a mocked public identity',()=>{
 assert.throws(()=>registerAccountSocialIntegration(app(),{enabled:true,getContext:()=>({})}),/AUTH_MIDDLEWARE_REQUIRED/);
 assert.throws(()=>registerAccountSocialIntegration(app(),{enabled:true,auth:()=>{}}),/RUNTIME_CONTEXT_PROVIDER_REQUIRED/);
});
test('integration creates owner-facing routes but cannot write without strict writer proof',async()=>{
 const a=app(),queries=[];const ctx={mysqlPool:{query:async(sql,args)=>(queries.push([sql,args]),[[]])}};
 const out=registerAccountSocialIntegration(a,{enabled:true,auth:(req,res,next)=>next(),getContext:()=>ctx,resolveSessionActor:()=>({id:'owner',role:'owner',tenantId:1}),requireTenant:()=>({tenantId:'1'})});
 assert.equal(out.routesEnabled,true);assert.equal(out.publishingEnabled,false);assert(a.routes.some(x=>x[1]==='/api/account-social/v1/portfolio'));
 const entry=a.routes.find(x=>x[1]==='/api/account-social/v1/accounts/:customerId/manager');
 let code=200,resp;const res={status(s){code=s;return this},json(x){resp=x;return this},setHeader(){}};
 await entry[2][1]({params:{customerId:'c1'},body:{managerId:'manager1'}},res);
 assert.equal(code,423);assert.equal(resp.error,'WRITER_NOT_READY');assert.equal(queries.length,0,'no SQL writes without writer proof');
});

test('optional integration registers independent Lorna handoff routes without extending legacy CRM permissions',()=>{
 const a=app();const ctx={mysqlPool:{query:async()=>[[]],getConnection:async()=>{throw Error('writer must remain disabled')}}};
 const out=registerAccountSocialIntegration(a,{enabled:true,auth:(req,res,next)=>next(),getContext:()=>ctx,resolveSessionActor:()=>({id:'lorna',role:'lead_researcher',tenantId:1}),requireTenant:()=>({tenantId:'1'})});
 assert.equal(out.routesEnabled,true);
 assert(a.routes.some(x=>x[1]==='/api/account-social/v1/research/handoffs'));
 assert(a.routes.some(x=>x[1]==='/api/account-social/v1/research/feedback'));
 assert.equal(out.publishingEnabled,false);
});

test('database projection recognizes real SBC auto verification and Sales Ready fields, never promotes unknown rows',()=>{
 const {projectCustomerEvidence}=require('../routes/sbc-account-social-integration-v1.cjs');
 const verified=projectCustomerEvidence({id:'c1',tenant_id:1,businessName:'Barber',assignedTo:'lorna',status:'Lead',lead_intelligence_json:JSON.stringify({autoVerificationStatus:'AUTO_VERIFIED',verificationStatus:'Sales Ready',researchSubmittedBy:'lorna'})});
 assert.equal(verified.leadAssistStatus,'AUTO_VERIFIED');
 assert.equal(verified.verificationStatus,'Sales Ready');
 assert.equal(verified.assignedTo,'lorna');
 const human=projectCustomerEvidence({id:'c2',tenant_id:1,businessName:'Store',status:'Lead',lead_intelligence_json:{autoVerificationStatus:'HUMAN_APPROVED',verificationStatus:'Sales Ready'}});
 assert.equal(human.leadAssistStatus,'HUMAN_APPROVED');
 assert.equal(human.verificationStatus,'Sales Ready');
 const failed=projectCustomerEvidence({id:'c3',tenant_id:1,lead_intelligence_json:'{INVALID'});
 assert.notEqual(failed.leadAssistStatus,'AUTO_VERIFIED');
 assert.notEqual(failed.verificationStatus,'Sales Ready');
});

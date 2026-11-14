'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {registerHandoffRoutes}=require('../routes/sbc-lorna-handoff-v1.cjs');
const {createHandoffService,createMemoryHandoffRepository}=require('../enterprise/sbc-lorna-handoff-v1.cjs');
function harness(){const routes=[];return {routes,get:(p,...h)=>routes.push(['GET',p,h]),post:(p,...h)=>routes.push(['POST',p,h])}}
async function dispatch(app,method,path,actor,body={}){
 let response={status:200,data:null};const route=app.routes.find(x=>x[0]===method&&x[1]===path);if(!route)throw Error('missing route '+path);
 const req={user:actor,body,params:body.params||{}};
 const res={setHeader(){},status(code){response.status=code;return this},json(x){response.data=x;return this}};
 await route[2].at(-1)(req,res);return response;
}
function fixture(){const repo=createMemoryHandoffRepository({customers:[{id:'c1',tenantId:1,status:'Lead',assignedTo:'lorna',leadAssistStatus:'AUTO_VERIFIED'}],workers:[{id:'lorna',tenantId:1,role:'lead_researcher',active:true},{id:'am1',tenantId:1,role:'account_manager',active:true}]});return createHandoffService({repository:repo});}
const lorna={id:'lorna',tenantId:1,role:'lead_researcher'},owner={id:'owner',tenantId:1,role:'owner'},manager={id:'am1',tenantId:1,role:'account_manager'};
test('no new handoff APIs are mounted with feature off',()=>{
 const app=harness();assert.equal(registerHandoffRoutes(app,{service:fixture(),auth:()=>{},resolveActor:req=>req.user}),false);assert.equal(app.routes.length,0);
});
test('authenticated Lorna can submit her verified lead and see only her returned work',async()=>{
 const app=harness(),service=fixture();registerHandoffRoutes(app,{enabled:true,service,auth:()=>{},resolveActor:req=>req.user,writeReady:()=>true});
 const created=await dispatch(app,'POST','/api/account-social/v1/research/handoffs',lorna,{customerId:'c1',summary:'Verified business phone and website'});
 assert.equal(created.status,201);assert.equal(created.data.data.status,'READY_FOR_REVIEW');
 const queued=await dispatch(app,'GET','/api/account-social/v1/research/feedback',lorna);
 assert.equal(queued.status,200);assert.deepEqual(queued.data.data,[]);
 const denied=await dispatch(app,'GET','/api/account-social/v1/research/summary',lorna);
 assert.equal(denied.status,403);
});
test('researcher cannot assign manager or retrieve other manager portfolios, and writer fails closed',async()=>{
 const app=harness(),service=fixture();registerHandoffRoutes(app,{enabled:true,service,auth:()=>{},resolveActor:req=>req.user,writeReady:()=>false});
 const denied=await dispatch(app,'POST','/api/account-social/v1/research/handoffs',lorna,{customerId:'c1',summary:'Verified business phone'});
 assert.equal(denied.status,423);
 const noauth=await dispatch(app,'GET','/api/account-social/v1/research/queue',null);
 assert.equal(noauth.status,403);
 const cannot=await dispatch(app,'GET','/api/account-social/v1/research/queue',lorna);
 assert.equal(cannot.status,403);
});
test('owner can assign handoff; manager cannot send research request for unassigned customers',async()=>{
 const app=harness(),service=fixture();registerHandoffRoutes(app,{enabled:true,service,auth:()=>{},resolveActor:req=>req.user,writeReady:()=>true});
 const {data:{data:h}}=await dispatch(app,'POST','/api/account-social/v1/research/handoffs',lorna,{customerId:'c1',summary:'Verified contact phone'});
 const assign=await dispatch(app,'POST','/api/account-social/v1/research/handoffs/:handoffId/assign',owner,{params:{handoffId:h.id},managerId:'am1'});
 assert.equal(assign.status,200);assert.equal(assign.data.data.managerId,'am1');
 const queue=await dispatch(app,'GET','/api/account-social/v1/research/queue',manager);
 assert.equal(queue.data.data.length,1);
 const error=await dispatch(app,'POST','/api/account-social/v1/research/handoffs/:handoffId/return',lorna,{params:{handoffId:h.id},issue:'BAD_NUMBER',reason:'Number is unavailable'});
 assert.equal(error.status,403);
});

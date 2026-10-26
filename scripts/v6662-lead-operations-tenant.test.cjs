'use strict';
// Source-matched synthetic two-tenant operational route checks, no providers.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const s=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert.match(s,/SBC_V6662_LEAD_OPERATIONS_TENANT_SCOPE/);
new vm.Script(s,{filename:'server.js'});
const customer1={id:'customer-1',tenantId:1,status:'Lead',email:'one@example.test',phone:'3055550101',website:'https://one.example',verificationStatus:'Owner Review'};
const customer2={id:'customer-2',tenantId:2,status:'Lead',email:'two@example.test',phone:'3055550202',website:'https://two.example',verificationStatus:'Owner Review'};
const db={customers:[customer1,customer2],leadAssistQueue:[{customerId:'customer-1',status:'QUEUED'},{customerId:'customer-2',status:'QUEUED'}]};
let saves=0,processed=0,selected=[];
const routeMap={};
const ctx={db,String,Number,Array,Date,Set,Math,
 app:{get:(p,...f)=>routeMap['GET '+p]=f,post:(p,...f)=>routeMap['POST '+p]=f},
 auth:()=>{},now:()=>new Date().toISOString(),
 requireRequestTenant:req=>{if(!Number.isInteger(req.tenantId)||req.tenantId<=0)throw Error('TENANT_CONTEXT_REQUIRED');return req.tenantId},
 leadAssistQueue:()=>db.leadAssistQueue,
 webLeadHits:new Map(),
 BUILD_VERSION:'synthetic',secretValue:()=>'',audit:()=>{},saveData:async()=>{saves++},
 enqueueLeadAssist:(id)=>{selected.push(id)},
 processLeadAssistQueue:async(limit,tenant)=>{processed++;assert.equal(tenant,1);return {processed:1,results:[],pending:1}},
};
const marker=s.indexOf('// SBC_V6662_LEAD_OPERATIONS_TENANT_SCOPE');
const start=s.lastIndexOf('\n//',marker),end=s.indexOf("\napp.post('/api/lead-intelligence/enrich/:customerId'",marker);
assert.ok(start>=0&&end>start);
vm.runInNewContext(s.slice(start,end),ctx,{timeout:3000});
function result(){return {code:200,status(c){this.code=c;return this},json(j){this.body=j;return this}}}
async function call(method,route,req){
 const actions=routeMap[method+' '+route];assert.ok(actions,'registered '+route);
 const res=result();let allowed=false;
 const guarded=actions.find(fn=>fn.name==='SBC_V6662_LEAD_TENANT');
 assert.ok(guarded,'tenant check before handler on '+route);
 guarded(req,res,()=>{allowed=true});
 if(allowed)await actions.at(-1)(req,res);
 return res;
}
(async()=>{
 const missing=await call('GET','/api/lead-assist/summary',{user:{role:'manager'},tenantId:null});
 assert.equal(missing.code,403);
 const summary=await call('GET','/api/lead-assist/summary',{user:{role:'manager'},tenantId:1});
 assert.equal(summary.code,200);
 assert.equal(summary.body.counts.total,1);
 assert.equal(summary.body.counts.queued,1);
 const foreign=await call('GET','/api/lead-assist/:customerId',{user:{role:'manager'},tenantId:1,params:{customerId:'customer-2'}});
 assert.equal(foreign.code,404);
 const rejected=await call('POST','/api/lead-assist/:customerId/review',{user:{role:'manager'},tenantId:1,params:{customerId:'customer-2'},body:{action:'approve'}});
 assert.equal(rejected.code,404);assert.equal(saves,0);
 const run=await call('POST','/api/lead-assist/run',{user:{role:'manager'},tenantId:1,body:{limit:5}});
 assert.equal(run.code,200);assert.equal(processed,1);assert.equal(selected.length,1);assert.equal(selected[0],'customer-1');
 assert.equal(customer2.verificationStatus,'Owner Review');
 const m=s.match(/app.get\('\/api\/next-operations\/dial-queue',auth,\(req,res\)=>\{[\s\S]*?\n\}\);/);
 assert.ok(m,'compiled dial-queue route');
 let dial;
 const dialCtx={app:{get:(p,auth,cb)=>dial=cb},auth:()=>{},db,now:()=>new Date().toISOString(),
  nextOpsGuard:()=>true,nextOpsState:()=>({employeeMetrics:[]}),
  NEXTOPS:{tenantContext:req=>req.tenantId,rankDialQueue:rows=>rows.map(x=>x.id)},
  Number,String};
 vm.runInNewContext(m[0],dialCtx);
 const dialRes=result();await dial({tenantId:1,user:{role:'caller'}},dialRes);
 assert.equal(dialRes.code,200);assert.equal(dialRes.body.queue.length,1);assert.equal(dialRes.body.queue[0],'customer-1');
 const workflowSource=s.match(/app.post\('\/api\/next-operations\/workflows\/:id\/step',auth,async\(req,res\)=>\{[\s\S]*?\n\}\);/);
 assert.ok(workflowSource,'compiled workflow mutation route');
 let workflow;let writes=0;
 const w={app:{post:(p,auth,cb)=>workflow=cb},auth:()=>{},nextOpsGuard:()=>true,
  nextOpsState:()=>({workflowRuns:[{id:'foreign',tenantId:2,state:'Pending'}]}),
  NEXTOPS:{tenantContext:req=>req.tenantId,workflowStep:()=>{writes++}},
  saveNextOps:async()=>{writes++},Number,String};
 vm.runInNewContext(workflowSource[0],w);
 const wRes=result();await workflow({tenantId:1,params:{id:'foreign'},body:{state:'Done'}},wRes);
 assert.equal(wRes.code,404);assert.equal(writes,0);
 for(const route of ['/api/lead-intelligence/enrich/:customerId','/api/lead-intelligence/enrich-batch','/api/lead-intelligence/demo-brief/:customerId','/api/lead-intelligence/:customerId'])
  assert.ok(s.includes("'"+route+"',auth,SBC_V6662_LEAD_TENANT,"),'research route requires selected tenant '+route);
 console.log('[SBC V6662 LEAD TENANT] PASS '+String(process.env.SBC_AUDIT_PASS||'1')+
  ': cross-tenant lead read/review denied, no foreign queue jobs, dial and workflow scoping preserved');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});

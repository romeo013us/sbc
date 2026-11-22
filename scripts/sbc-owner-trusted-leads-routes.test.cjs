'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const MOD=require('../routes/sbc-owner-trusted-leads-v1.cjs');
const mk=(id,tenant=1,other={})=>({id,tenantId:tenant,status:'Lead',verificationStatus:'Needs Verification',businessName:'Business '+id,phone:'305555'+String(id).padStart(4,'0'),leadTemperature:'Warm',...other});
function harness({recovery=false,missingDb=false}={}){
 const handlers={},records=new Map(),db={customers:[mk('1001'),mk('1002'),mk('2002',2)]};
 let writes=0,audits=0,transaction=0;
 for(const c of db.customers)records.set(c.tenantId+':'+c.id,{
  id:c.id,status:c.status,tenant_id:c.tenantId,business_name:c.businessName,phone:c.phone,email:c.email||'',
  notes:c.notes||'',lead_intelligence_json:JSON.stringify({verificationStatus:c.verificationStatus})
 });
 const pool=missingDb?null:{async getConnection(){return{
  async beginTransaction(){transaction++},async commit(){transaction--},async rollback(){transaction--},release(){},
  async query(sql,args){
   if(sql.startsWith('SELECT')&&sql.includes('FOR UPDATE')){const row=records.get(args[0]+':'+args[1]);return [[row||null].filter(Boolean)];}
   if(sql.startsWith('UPDATE sbc_customers')){writes++;const row=records.get(args[2]+':'+args[3]);row.lead_intelligence_json=args[0];return [{affectedRows:1}];}
   throw Error('Unexpected SQL: '+sql);
  }
 }}};
 MOD.register({get:(p,_a,_b,f)=>handlers['GET '+p]=f,post:(p,_a,_b,f)=>handlers['POST '+p]=f},
 {auth:(req,res,next)=>next?.(),ownerOnly:(req,res,next)=>next?.(),
  getContext:()=>({db,mysqlPool:pool,recoveryRequired:()=>recovery}),
  tenantForRead:req=>req.tenantId,writer:()=>{if(recovery)throw Object.assign(Error('WRITER_RECOVERY_HOLD'),{status:423})},
  audit:()=>{audits++}});
 async function request(method,path,role='owner',body={}){
  let status=200,data;const res={setHeader(){},status(n){status=n;return this},json(v){data=v;return this}};
  await handlers[method+' '+path]({tenantId:1,user:{id:'owner1',role,tenantId:1,active:true},body},res);
  return {status,data};
 }
 return {request,db,records,get writes(){return writes},get audits(){return audits},get transaction(){return transaction}};
}
test('owner read-only preview counts all eligible existing tenant leads',async()=>{
 const h=harness(),r=await h.request('GET','/api/owner/trusted-leads/preview');
 assert.equal(r.status,200);
 assert.equal(r.data.totalTenant,2);
 assert.equal(r.data.approvable,2);
 assert.equal(h.writes,0);
});
test('owner bulk accepts existing valid leads with independent-verification=false and leaves other tenants',async()=>{
 const h=harness(),r=await h.request('POST','/api/owner/trusted-leads/approve-batch','owner',{confirm:'OWNER_TRUSTED_ALL_EXISTING'});
 assert.equal(r.status,200);assert.equal(r.data.approved,2);assert.equal(h.writes,2);
 assert.equal(h.db.customers[0].verificationStatus,'Sales Ready');
 const data=JSON.parse(h.records.get('1:1001').lead_intelligence_json);
 assert.equal(data.ownerTrust.outboundConsentGranted,false);
 assert.equal(h.db.customers[2].verificationStatus,'Needs Verification');
 const again=await h.request('POST','/api/owner/trusted-leads/approve-batch','owner',{confirm:'OWNER_TRUSTED_ALL_EXISTING'});
 assert.equal(again.data.approved,0);assert.equal(h.writes,2);assert.equal(h.transaction,0);
});
test('suppression, cross-tenant and researcher access never elevated',async()=>{
 const h=harness();h.db.customers[0].doNotContact=true;
 const denied=await h.request('POST','/api/owner/trusted-leads/approve-batch','lead_researcher',{confirm:'OWNER_TRUSTED_ALL_EXISTING'});
 assert.equal(denied.status,403);assert.equal(h.writes,0);
 const ok=await h.request('POST','/api/owner/trusted-leads/approve-batch','owner',{confirm:'OWNER_TRUSTED_ALL_EXISTING'});
 assert.equal(ok.data.approved,1);assert.equal(h.db.customers[0].verificationStatus,'Needs Verification');
});
test('preview mode and missing database do not mutate accounts',async()=>{
 const h=harness({missingDb:true});
 const r=await h.request('POST','/api/owner/trusted-leads/approve-batch','owner',{confirm:'OWNER_TRUSTED_ALL_EXISTING'});
 assert.equal(r.status,503);assert.equal(h.writes,0);
 const recovery=harness({recovery:true});
 const hold=await recovery.request('POST','/api/owner/trusted-leads/approve-batch','owner',{confirm:'OWNER_TRUSTED_ALL_EXISTING'});
 assert.equal(hold.status,423);assert.equal(recovery.writes,0);
});
test('confirmation required and strict batch size cap',async()=>{
 const h=harness();
 assert.equal((await h.request('POST','/api/owner/trusted-leads/approve-batch','owner',{})).status,422);
 assert.equal((await h.request('POST','/api/owner/trusted-leads/approve-batch','owner',{confirm:'OWNER_TRUSTED_ALL_EXISTING',limit:501})).status,422);
 assert.equal(h.writes,0);
});

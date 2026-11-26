'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createLegacyRenewalHandlers}=require('../routes/sbc-legacy-renewals-v1.cjs');
function fixture(){
 const db={customers:[{id:'local',tenantId:1},{id:'foreign',tenantId:2}],renewals:[{id:'same',tenantId:2,status:'Upcoming'},{id:'same',tenantId:1,status:'Upcoming',createdAt:'original'},{id:'foreign-only',tenantId:2},{id:'legacy-unscoped'}]};
 let writes=0;const service=createLegacyRenewalHandlers(()=>({db,requireRequestTenant:req=>req.tenantId,id:()=> 'new',now:()=> 'now',addActivity(){},saveData:async()=>{writes++}}));
 async function call(method,id,body={},tenantId=1){const res={code:200,status(n){this.code=n;return this},json(x){this.body=x;return this}};await service[method]({tenantId,params:{id},body},res);return res;}
 return {db,call,writes:()=>writes};
}
test('cross-tenant and unscoped update/delete fail closed without writes',async()=>{
 const f=fixture(),before=JSON.stringify(f.db);
 for(const id of ['foreign-only','legacy-unscoped'])for(const method of ['update','remove'])assert.equal((await f.call(method,id,{status:'Paid'})).code,404);
 assert.equal(f.writes(),0);assert.equal(JSON.stringify(f.db),before);
});
test('same ID across tenants updates and deletes only the authenticated tenant',async()=>{
 const f=fixture();const r=await f.call('update','same',{status:'Contacted',tenantId:2,id:'changed',createdAt:'changed',providerReceipt:'fake'});
 assert.equal(r.body.tenantId,1);assert.equal(r.body.id,'same');assert.equal(r.body.createdAt,'original');assert.equal(r.body.providerReceipt,undefined);
 assert.equal(f.db.renewals[0].status,'Upcoming');assert.equal(r.body.status,'Contacted');
 await f.call('remove','same');assert.equal(f.db.renewals.filter(x=>x.id==='same').length,1);assert.equal(f.db.renewals[0].tenantId,2);assert.equal(f.writes(),2);
});
test('foreign customer association is rejected on create and update; manual local renewal remains supported',async()=>{
 const f=fixture(),body={customerName:'Fixture',service:'Domain',dueDate:'2027-01-01',customerId:'foreign'};
 assert.equal((await f.call('create','',body)).code,404);assert.equal((await f.call('update','same',{customerId:'foreign'})).code,404);assert.equal(f.writes(),0);
 const r=await f.call('create','',{...body,customerId:'local'});assert.equal(r.code,201);assert.equal(r.body.tenantId,1);assert.equal(f.writes(),1);
});

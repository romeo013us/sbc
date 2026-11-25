'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {planReplenishment,assertActor,receiptStatus}=require('../enterprise/sbc-social-creative-ledger.cjs');
const {slots}=require('../enterprise/sbc-social-asset-engine.cjs');
const now=Date.parse('2026-11-25T17:00:00Z');
test('rolling plan counts only usable future approved slots; keeps drafts for review',()=>{
 const [expired,first,second,third]=slots('2026-11-25');
 const rows=[{key:expired.key,state:'APPROVED'},{key:first.key,state:'APPROVED'},{key:second.key,state:'DRAFT'},{key:third.key,state:'REVOKED'}];
 const p=planReplenishment(now,rows);
 assert.equal(p.approved,1);assert.equal(p.drafts,1);assert.equal(p.missing.length,12);
 assert.equal(p.slots.length,14);assert.equal(p.low,true);
 assert(!p.missing.some(x=>x.key===second.key));
 assert(p.missing.some(x=>x.key===third.key));
});
test('only corporate owner or authorized system context may access inventory',()=>{
 assert.throws(()=>assertActor({tenantId:2,id:'a',role:'owner'},1,['owner']));
 assert.throws(()=>assertActor({tenantId:1,id:'a',role:'account_manager'},1,['owner']));
 assert.equal(assertActor({tenantId:1,id:'owner',role:'owner'},1,['owner']).id,'owner');
});
test('readback confirms post, not artwork unless independently verified hash matches',()=>{
 const claim={provider_id:'123',asset_sha256:'a'.repeat(64),day_et:'2026-11-25',platform:'facebook',slot:'PM',scheduled_at:'2026-11-26T03:00:00.000Z'};
 const proof={provider_id:'123',verified_at:'2026-11-26 03:01:00',published_at:'2026-11-26T03:00:00.000Z',day_et:claim.day_et,platform:claim.platform,slot:claim.slot};
 assert.equal(receiptStatus(claim,proof),'POST_VERIFIED_ARTWORK_UNVERIFIED');
 assert.equal(receiptStatus(claim,{...proof,platform:'linkedin'}),'UNVERIFIED');
 assert.equal(receiptStatus(claim,{...proof,verified_at:null}),'UNVERIFIED');
 assert.equal(receiptStatus(claim,proof,'b'.repeat(64)),'ARTWORK_MISMATCH');
 assert.equal(receiptStatus(claim,proof,claim.asset_sha256),'PUBLISHED_VERIFIED');
});

test('owner inventory routes fail closed for other tenants and read-only mutations',async()=>{
 const {registerCreativeInventory}=require('../routes/sbc-creative-inventory.cjs');
 const routes=new Map(),app={get:(p,...h)=>routes.set('GET '+p,h.at(-1)),post:(p,...h)=>routes.set('POST '+p,h.at(-1))};
 let writes=0;
 const ledger={snapshot:async()=>({approved:1,assets:[]}),approve:async()=>{writes++;return {approved:true}},artwork:async()=>Buffer.from('test')};
 registerCreativeInventory(app,{auth:()=>{},ownerOnly:()=>{},tenantOf:req=>req.tenantId,corporateTenant:1,getPool:()=>({}),canWrite:()=>false,ledgerFactory:()=>ledger});
 async function invoke(method,url,req){
  const res={code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this},send(v){this.body=v;return this}};
  await routes.get(method+' '+url)(req,res);return res;
 }
 const request={tenantId:1,user:{id:'owner',role:'owner'},params:{sha:'a'.repeat(64)}};
 assert.equal((await invoke('GET','/api/marketing/creative-inventory',request)).body.approved,1);
 assert.equal((await invoke('GET','/api/marketing/creative-inventory',{...request,tenantId:2})).code,403);
 assert.equal((await invoke('POST','/api/marketing/creative-inventory/:sha/approve',request)).code,423);
 assert.equal(writes,0);
});

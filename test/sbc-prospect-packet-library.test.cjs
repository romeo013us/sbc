'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {register,PATH}=require('../enterprise/sbc-prospect-packet-library.cjs');
const H=require('../public/sbc-prospect-handoff-v2.js');
const AT=Date.parse('2026-11-16T18:00:00Z');
function packet(){
 const src='Google PageSpeed Insights (Lighthouse lab)';
 return H.createPacket({ownerApproved:true,business:{businessName:'Fixture Barber',industry:'Barber',website:'https://barber.example.org/'},
  audit:{status:'measured',website:'https://barber.example.org/',source:src,measuredAt:new Date(AT-60000).toISOString(),
   scores:{performance:74,seo:85,accessibility:91,bestPractices:95},findings:[{id:'meta-description',label:'Meta description',result:'opportunity',source:src}]},
  preparedAt:AT});
}
const requestId='sbc-handoff-1234567890abcdef1234567890abcdef';
function harness({writer=true,saveOk=true}={}){
 const endpoints={},calls=[];let store={};let queue=Promise.resolve();
 const app={get:(path,...f)=>endpoints['GET '+path]=f,post:(path,...f)=>endpoints['POST '+path]=f};
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false});
 register(app,{
  auth,ownerOnly,requireTenant:req=>req.user?.tenantId,
  getStore:()=>store,saveStore:async next=>{calls.push(next);if(saveOk)store=next;return {ok:saveOk}},
  writerReady:()=>writer,serializeSiteMutation:fn=>{const r=queue.then(fn);queue=r.catch(()=>{});return r},
  clock:()=>AT
 });
 async function req(method,body={},user={id:'ownerA',role:'owner',tenantId:7}){
  const chain=endpoints[method+' '+PATH];assert(chain);
  const result={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(data){this.body=data;return this}};
  const input={body,user};
  for(let i=0;i<chain.length;i++){let advance=false;await chain[i](input,result,()=>{advance=true});if(i<chain.length-1&&!advance)break}
  return result;
 }
 return {req,calls:()=>calls.length,store:()=>store};
}
test('research library is connected to existing owner tenant store and not workforce mutation routes',()=>{
 const integration=fs.readFileSync('enterprise/sbc-website-production-routes.cjs','utf8');
 assert.match(integration,/ProspectPacketLibrary\.register\(app,/);
 assert.match(fs.readFileSync('public/sbc-prospect-intelligence.js','utf8'),/Save to owner Research Library/);
});
test('only owner with same tenant can read or write curated research; no automatic staff access',async()=>{
 const h=harness();
 assert.equal((await h.req('POST',{requestId,packet:packet()},null)).statusCode,401);
 assert.equal((await h.req('POST',{requestId,packet:packet()},{id:'researcher',role:'lead_researcher',tenantId:7})).statusCode,403);
 assert.equal((await h.req('POST',{requestId,packet:packet()},{id:'owner',role:'owner',tenantId:0})).statusCode,403);
 const saved=await h.req('POST',{requestId,packet:packet()});
 assert.equal(saved.statusCode,201);assert.equal(saved.body.record.packet.business.businessName,'Fixture Barber');
 assert.equal((await h.req('GET')).body.records.length,1);
 assert.equal((await h.req('GET',{}, {id:'other',role:'owner',tenantId:7})).body.records.length,0);
 assert.equal((await h.req('GET',{}, {id:'ownerA',role:'owner',tenantId:8})).body.records.length,0);
 assert.equal((await h.req('GET')).headers['Cache-Control'],'no-store');
});
test('duplicate research save is idempotent, conflicting same id rejected, and no CRM arrays touched',async()=>{
 const h=harness();assert.equal((await h.req('POST',{requestId,packet:packet()})).statusCode,201);
 const duplicate=await h.req('POST',{requestId,packet:packet()});assert.equal(duplicate.statusCode,200);assert.equal(duplicate.body.duplicate,true);
 assert.equal(h.calls(),1);
 const other={...packet(),business:{...packet().business,businessName:'Different Barber'}};
 assert.equal((await h.req('POST',{requestId,packet:other})).statusCode,409);
 assert.equal(h.store().customers,undefined);assert.equal(h.store().orders,undefined);
});
test('invalid packets, writer lock, and storage failures fail closed',async()=>{
 const h=harness(),broken={...packet(),secret:'leak'};
 assert.equal((await h.req('POST',{requestId,packet:broken})).statusCode,422);
 assert.equal((await h.req('POST',{requestId:'other',packet:packet()})).statusCode,422);
 assert.equal((await harness({writer:false}).req('POST',{requestId,packet:packet()})).statusCode,423);
 const failed=harness({saveOk:false});assert.equal((await failed.req('POST',{requestId,packet:packet()})).statusCode,503);
 assert.equal((await failed.req('GET')).body.records.length,0);
});

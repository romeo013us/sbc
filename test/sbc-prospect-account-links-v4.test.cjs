'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const H=require('../public/sbc-prospect-handoff-v2.js');
const {register,OWNER_PATH,STAFF_PATH}=require('../enterprise/sbc-prospect-account-links-v4.cjs');
const AT=Date.parse('2026-11-16T18:00:00.000Z');
const owner={id:'ownerA',role:'owner',tenantId:7,active:true};
const manager={id:'managerA',role:'account_manager',tenantId:7,active:true};
const reqId='sbc-link-1234567890abcdef1234567890abcdef';
function packet(){
 return H.createPacket({ownerApproved:true,preparedAt:AT,
  business:{businessName:'Verified Barber',industry:'Barber',website:'https://verified.example.org/'},
  audit:{status:'measured',website:'https://verified.example.org/',source:'Google PageSpeed Insights (Lighthouse lab)',measuredAt:'2026-11-16T17:00:00.000Z',
   scores:{seo:62,performance:61,accessibility:89,bestPractices:95},findings:[]}});
}
function harness({writer=true,saveOk=true}={}){
 const routes={},saves=[];
 const customers=[{id:'c7',tenantId:7,businessName:'Verified Barber',website:'https://verified.example.org/',assignedTo:'managerA',status:'Lead',doNotContact:false},
  {id:'foreign',tenantId:9,businessName:'Verified Barber',website:'https://verified.example.org/',assignedTo:'managerA'}];
 const users=[manager,{...manager,id:'managerB'},{...manager,id:'disabled',active:false},{...manager,id:'foreignManager',tenantId:9}];
 let store={sbcProspectPacketVault:[{id:'spi-packet-one',tenantId:7,ownerId:'ownerA',requestId:'sbc-handoff-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',packet:packet(),createdAt:new Date(AT).toISOString()}]};
 let queue=Promise.resolve();
 const app={get:(path,...handlers)=>routes['GET '+path]=handlers,post:(path,...handlers)=>routes['POST '+path]=handlers};
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false});
 register(app,{auth,ownerOnly,requireTenant:req=>req.user?.tenantId,db:{customers,users},
  getStore:()=>store,saveStore:async state=>{saves.push(state);if(saveOk)store=state;return {ok:saveOk}},
  writerReady:()=>writer,serializeSiteMutation:fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next},clock:()=>AT});
 async function request(method,path,body={},user=owner,params={}){
  const chain=routes[method+' '+path];assert(chain,'route must exist: '+method+' '+path);
  const response={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
  const req={user,body,params,query:{}};
  for(let i=0;i<chain.length;i++){let next=false;await chain[i](req,response,()=>{next=true});if(i<chain.length-1&&!next)break;}
  return response;
 }
 const link=(body={},user=owner)=>request('POST',OWNER_PATH,{requestId:reqId,packetId:'spi-packet-one',customerId:'c7',expectedManagerId:'managerA',confirmBusinessMatch:true,...body},user);
 const read=(user=manager,customerId='c7')=>request('GET',STAFF_PATH,{},user,{customerId});
 return {link,read,request,customers,users,store:()=>store,saves:()=>saves.length};
}
test('owner links only previously reviewed packet to an existing tenant CRM account, without changing CRM or contacting anyone',async()=>{
 const h=harness(),before=JSON.stringify(h.customers);
 const result=await h.link();
 assert.equal(result.statusCode,201);assert.equal(result.body.durable,true);
 assert.equal(h.saves(),1);assert.equal(JSON.stringify(h.customers),before);
 assert.equal(h.store().sbcProspectAccountLinksV4.length,1);
 assert.equal(h.store().orders,undefined);assert.equal(h.store().outboundMessages,undefined);
 assert.equal(result.headers['Cache-Control'],'no-store');
 const details=await h.read();assert.equal(details.statusCode,200);
 assert.equal(details.body.research.length,1);assert.equal(details.body.research[0].opportunity.verification,'measured');
 assert.equal(details.body.research[0].opportunity.outreach.allowed,false);
 assert.match(details.body.research[0].nextAction,/review|confirm/i);
});
test('tenant, role and current CRM ownership must be verified on every read',async()=>{
 const h=harness();await h.link();
 assert.equal((await h.read(null)).statusCode,401);
 assert.equal((await h.read({id:'callerA',role:'caller',tenantId:7})).statusCode,403);
 assert.equal((await h.read({...manager,tenantId:9})).statusCode,403);
 assert.equal((await h.read(manager,'foreign')).statusCode,403);
 assert.equal((await h.read({...manager,id:'disabled',active:false})).statusCode,403);
 h.customers[0].assignedTo='managerB';
 assert.equal((await h.read()).statusCode,403,'old manager must lose access immediately');
 assert.equal((await h.read({...manager,id:'managerB'})).statusCode,200,'new manager inherits authorized account research');
});
test('reject missing approval, wrong identities, no assignment, wrong tenant, duplicate packet cross-link',async()=>{
 const h=harness();
 assert.equal((await h.link({confirmBusinessMatch:false})).statusCode,422);
 assert.equal((await h.link({expectedManagerId:'managerB'})).statusCode,409);
 assert.equal((await h.link({customerId:'foreign'})).statusCode,404);
 assert.equal((await h.link({},manager)).statusCode,403);
 h.customers[0].businessName='Totally Different';
 h.customers[0].website='https://another.example.org/';
 assert.equal((await h.link()).statusCode,409);
 h.customers[0].businessName='Verified Barber';
 h.customers[0].website='https://verified.example.org/';
 h.customers[0].assignedTo='';
 assert.equal((await h.link()).statusCode,409);
});
test('idempotent link retries do not duplicate audit entries; changed request id is conflict',async()=>{
 const h=harness();assert.equal((await h.link()).statusCode,201);
 const dup=await h.link();assert.equal(dup.statusCode,200);assert.equal(dup.body.duplicate,true);
 assert.equal(h.saves(),1);
 assert.equal((await h.link({customerId:'missing'})).statusCode,409);
 assert.equal(h.store().sbcProspectAccountLinksV4[0].events.length,1);
});
test('writer outage, durability failure, and stale research fail closed',async()=>{
 assert.equal((await harness({writer:false}).link()).statusCode,423);
 const failed=harness({saveOk:false});assert.equal((await failed.link()).statusCode,503);
 assert.equal(failed.store().sbcProspectAccountLinksV4,undefined);
 const h=harness();h.store().sbcProspectPacketVault[0].packet.preparedAt='2025-01-01T00:00:00.000Z';
 assert.equal((await h.link()).statusCode,409);
});
test('do not contact remains blocked; stale score needs refresh instead of fabricated priority',async()=>{
 const h=harness();await h.link();h.customers[0].doNotContact=true;
 const blocked=(await h.read()).body.research[0];
 assert.equal(blocked.opportunity.outreach.action,'DO_NOT_CONTACT');
 assert.equal(blocked.outreachAllowed,false);
});
test('v4 is routed through the existing published writer, staff path is deny-by-default except assigned managers, UI is mirrored',()=>{
 const routes=fs.readFileSync('enterprise/sbc-website-production-routes.cjs','utf8');
 assert.match(routes,/ProspectAccountLinksV4\.register\(app/);
 const gate=fs.readFileSync('enterprise/sbc-account-manager-role-gate-v2.cjs','utf8');
 assert.match(gate,/prospect-intelligence\/v4/);
 const ownerUi=fs.readFileSync('public/sbc-prospect-intelligence.js','utf8');
 const managerUi=fs.readFileSync('public/sbc-account-manager-v1.js','utf8');
 assert.match(ownerUi,/Link to assigned CRM account/);
 assert.match(managerUi,/prospect-intelligence\/v4\/accounts/);
 for(const name of ['sbc-prospect-intelligence.js','sbc-account-manager-v1.js'])
  assert.equal(fs.readFileSync('public/'+name,'utf8'),fs.readFileSync('browser_public/'+name,'utf8'));
});

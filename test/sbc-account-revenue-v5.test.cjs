'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const H=require('../public/sbc-prospect-handoff-v2.js');
const {register,OWNER_PATH,MANAGER_PATH,buildPlan}=require('../enterprise/sbc-account-revenue-v5.cjs');
const NOW=Date.parse('2026-11-16T18:00:00Z');
const owner={id:'ownerA',role:'owner',active:true,tenantId:7};
const manager={id:'managerA',role:'account_manager',active:true,tenantId:7};
function makePacket(at=NOW-3600000){
 return H.createPacket({ownerApproved:true,preparedAt:at,
  business:{businessName:'Fixture Barber',industry:'Barber',website:'https://barber.example.org/'},
  audit:{status:'measured',source:'Google PageSpeed Insights (Lighthouse lab)',website:'https://barber.example.org/',
   measuredAt:new Date(at).toISOString(),scores:{seo:62,performance:55,accessibility:86,bestPractices:93},findings:[]}});
}
function fixture(){
 const routes={},db={
  customers:[{id:'c7',tenantId:7,businessName:'Fixture Barber',website:'https://barber.example.org/',status:'Customer',
   assignedTo:'managerA',followUp:'2026-12-10',doNotContact:false},
   {id:'c9',tenantId:9,businessName:'Foreign Customer',status:'Lead',assignedTo:'managerA'}],
  users:[manager,{...manager,id:'managerB'},{...manager,id:'disabled',active:false},{...manager,id:'foreignManager',tenantId:9}]
 };
 const store={sbcProspectAccountLinksV4:[{id:'spi-link-one',tenantId:7,ownerId:'ownerA',customerId:'c7',packetId:'spi-packet-one',packet:makePacket(),createdAt:new Date(NOW-1000).toISOString(),
  events:[{kind:'OWNER_APPROVED_ACCOUNT_RESEARCH_LINK',at:new Date(NOW-1000).toISOString()}]}]};
 const app={get:(path,...handlers)=>routes['GET '+path]=handlers};
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false,code:'AUTH_REQUIRED'});
 const ownerOnly=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false,code:'OWNER_REQUIRED'});
 let reads=0;
 register(app,{auth,ownerOnly,requireTenant:req=>req.user?.tenantId,db,getStore:()=>{reads++;return store},writerReady:()=>true,clock:()=>NOW});
 async function get(path,user,customerId='c7'){
  const chain=routes['GET '+path];assert(chain,'V5 route missing: '+path);
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;return this},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};
  const req={user,params:{customerId}};
  for(let i=0;i<chain.length;i++){let called=false;await chain[i](req,res,()=>{called=true});if(i<chain.length-1&&!called)break}
  return res;
 }
 return {db,store,get,reads:()=>reads};
}
test('V5 plans only existing owner-approved verified research and does not fabricate revenue',async()=>{
 const h=fixture(),r=await h.get(MANAGER_PATH,manager);
 assert.equal(r.statusCode,200);assert.equal(r.headers['Cache-Control'],'no-store');
 assert.equal(r.body.ok,true);assert.equal(r.body.plan.roleModel,'ACCOUNT_MANAGER_FIRST');
 assert.equal(r.body.plan.customerStage,'EXISTING_CUSTOMER');
 assert.equal(r.body.plan.auditStatus,'measured');
 assert.equal(r.body.plan.nextFollowUp,'2026-12-10');
 assert(r.body.plan.actions.some(a=>a.code==='REVIEW_MEASURED_WEBSITE_FINDINGS'));
 assert.equal(r.body.plan.projectedRevenue,null);
 assert.equal(r.body.plan.outreachAuthorized,false);
 assert.equal(r.body.plan.quoteAuthorized,false);
 assert.equal(r.body.plan.paymentAuthorized,false);
 assert.equal(r.body.plan.automaticActions,0);
 assert(!/conversion probability|guaranteed revenue|estimated sale|\$[0-9]/i.test(JSON.stringify(r.body.plan)));
});
test('owner and assigned manager permitted; caller, unassigned, inactive, cross-tenant rejected',async()=>{
 const h=fixture();
 assert.equal((await h.get(OWNER_PATH,owner)).statusCode,200);
 assert.equal((await h.get(OWNER_PATH,manager)).statusCode,403);
 assert.equal((await h.get(MANAGER_PATH,null)).statusCode,401);
 assert.equal((await h.get(MANAGER_PATH,{...manager,role:'caller'})).statusCode,403);
 assert.equal((await h.get(MANAGER_PATH,{...manager,active:false})).statusCode,403);
 assert.equal((await h.get(MANAGER_PATH,{...manager,id:'disabled',active:false})).statusCode,403);
 assert.equal((await h.get(MANAGER_PATH,{...manager,tenantId:9})).statusCode,403);
 assert.equal((await h.get(MANAGER_PATH,manager,'c9')).statusCode,403);
 assert.equal((await h.get(OWNER_PATH,{...owner,tenantId:9},'c7')).statusCode,404);
 h.db.customers[0].assignedTo='managerB';
 assert.equal((await h.get(MANAGER_PATH,manager)).statusCode,403,'previous account manager instantly loses access');
 assert.equal((await h.get(MANAGER_PATH,{...manager,id:'managerB'})).statusCode,200);
});
test('do not contact or opt-out always produces internal-only plan, no scheduled outreach',async()=>{
 const h=fixture();h.db.customers[0].doNotContact=true;
 let r=await h.get(MANAGER_PATH,manager);
 assert.equal(r.body.plan.auditStatus,'measured');
 assert.equal(r.body.plan.contactStatus,'SUPPRESSED');
 assert(r.body.plan.actions.every(a=>a.internalOnly===true));
 assert.equal(r.body.plan.outreachAuthorized,false);
 h.db.customers[0].doNotContact=false;h.db.customers[0].status='Do Not Call';
 r=await h.get(MANAGER_PATH,manager);assert.equal(r.body.plan.contactStatus,'SUPPRESSED');
});
test('expired evidence cannot produce high-priority revenue or false verified recommendations',async()=>{
 const h=fixture();const expired=makePacket(NOW-50*86400000);
 h.store.sbcProspectAccountLinksV4[0].packet=expired;
 const r=await h.get(MANAGER_PATH,manager);
 assert.equal(r.body.plan.auditStatus,'expired');
 assert.equal(r.body.plan.researchPriority,null);
 assert(!r.body.plan.actions.some(a=>a.code==='REVIEW_MEASURED_WEBSITE_FINDINGS'));
 assert(r.body.plan.actions.some(a=>a.code==='REFRESH_PUBLIC_AUDIT'));
});
test('no approved research returns verification-only plan; never scores missing data as zero',async()=>{
 const h=fixture();h.store.sbcProspectAccountLinksV4=[];
 const r=await h.get(MANAGER_PATH,manager);
 assert.equal(r.statusCode,200);
 assert.equal(r.body.plan.auditStatus,'unverified');
 assert.equal(r.body.plan.researchPriority,null);
 assert.equal(r.body.plan.sourcePacketIds.length,0);
 assert(r.body.plan.actions.some(a=>a.code==='OWNER_RESEARCH_REVIEW'));
});
test('V5 is read-only and role model changes only future assignment targets',()=>{
 const result=buildPlan({customer:{id:'s',status:'Lead',businessName:'Sample'},links:[],now:NOW});
 assert.equal(result.projectedRevenue,null);assert.equal(result.customerStage,'PROSPECT');
 const route=fs.readFileSync('enterprise/sbc-website-production-routes.cjs','utf8');
 assert.match(route,/AccountRevenueV5\.register\(app/);
 const managerGate=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 assert.equal(managerGate.allowed('GET','/api/prospect-intelligence/v5/accounts/c7/plan'),true);
 assert.equal(managerGate.allowed('POST','/api/prospect-intelligence/v5/accounts/c7/plan'),false);
 assert.equal(managerGate.allowed('GET','/api/prospect-intelligence/v5/accounts/%2e%2e/plan'),false);
 const portfolios=fs.readFileSync('routes/account-portfolios-v1.cjs','utf8');
 assert.match(portfolios,/m\.role!=='account_manager'/);
 assert.match(portfolios,/\['owner','caller','account_manager'\]/);
 assert.match(fs.readFileSync('public/sbc-account-portfolios-v1.js','utf8'),/u\.role==='account_manager'/);
 assert.match(fs.readFileSync('public/sbc-account-manager-v1.js','utf8'),/prospect-intelligence\/v5\/accounts/);
 for(const name of ['sbc-account-manager-v1.js','sbc-account-portfolios-v1.js'])
  assert.equal(fs.readFileSync('public/'+name,'utf8'),fs.readFileSync('browser_public/'+name,'utf8'));
});

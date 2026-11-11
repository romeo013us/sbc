'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('./v66149-stage-hr-workstation.cjs');
const P=require('../enterprise/v66149-hr-workstation-policy.cjs');
const src=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
const staged=S.patchServer(src);
assert.equal(S.patchServer(staged),staged);
assert(staged.includes(S.MARK));
assert(staged.includes("const SBC_V66149_HR_POLICY=require('./enterprise/v66149-hr-workstation-policy.cjs');"));
assert(staged.includes("SBC_V66149_HR_POLICY.allowed(req.method,req.path)"));
assert(staged.includes("['caller','lead_researcher','fulfillment','manager','sales_manager','hr_manager']"));
assert(staged.includes("u?.role==='hr_manager')return res.redirect(302,'/hr-workstation.html')"));
assert(staged.includes("app.post('/api/hr/drafts/:id/decision',auth,ownerOnly"));
assert(staged.includes("app.post('/api/hr/payout-preferences/:userId/decision',auth,ownerOnly"));
assert(!staged.includes("app.post('/api/hr/transfer'"),'never add a transfer route');
new vm.Script(staged,{filename:'v66149-staged-server.js'});
if(process.argv.includes('--staged'))assert.equal(src,staged,'compiled GoDaddy runtime must contain HR routes');
const routes={};
const app={
 get:(route,...args)=>{routes['GET '+route]={middleware:args.slice(0,-1),fn:args.at(-1)}},
 post:(route,...args)=>{routes['POST '+route]={middleware:args.slice(0,-1),fn:args.at(-1)}}
};
const users=[
 {id:'owner',tenantId:1,role:'owner',name:'Owner',active:true},
 {id:'lorna',tenantId:1,role:'lead_researcher',name:'Lorna',active:true},
 {id:'foreign',tenantId:2,role:'caller',name:'Foreign Staff',active:true}];
const db={users,settings:{v9:{timeEntries:[],onboarding:{lorna:{country:'Philippines',status:'Submitted'}},
  compensation:{lorna:{payRate:4,payPeriod:'Monthly'}},hrOps:{drafts:[],preferences:{},reviewLog:[]}}}};
const context={app,auth:'AUTH',ownerOnly:'OWNER_ONLY',db,SBC_V66149_HR_POLICY:P,
 requireRequestTenant:req=>req.tenantId||1,v9data:()=>db.settings.v9,
 v9save:async v=>{db.settings.v9=v;return {ok:true}},
 now:()=>new Date().toISOString()};
vm.runInNewContext(S.ROUTES,context,{filename:'v66149-hr-routes.js'});
const expectRoutes=['GET /api/hr/overview','GET /api/hr/drafts','POST /api/hr/drafts',
 'POST /api/hr/payout-preferences','POST /api/hr/drafts/:id/decision',
 'POST /api/hr/payout-preferences/:userId/decision'];
for(const r of expectRoutes)assert(routes[r],r);
assert.deepEqual(Array.from(routes['POST /api/hr/drafts/:id/decision'].middleware),['AUTH','OWNER_ONLY']);
assert.deepEqual(Array.from(routes['POST /api/hr/payout-preferences/:userId/decision'].middleware),['AUTH','OWNER_ONLY']);
const reply=()=>({code:200,out:null,headers:{},
 setHeader(k,v){this.headers[k]=v;return this},status(v){this.code=v;return this},
 json(v){this.out=v;return this}});
const hrUser={id:'hr',role:'hr_manager',tenantId:1,name:'HR Manager',active:true};
(async()=>{
 const req={tenantId:1,user:hrUser,query:{},body:{},params:{}};
 let res=reply();
 await routes['GET /api/hr/overview'].fn(req,res);
 assert.equal(res.code,200);assert.equal(res.out.people.length,1);
 assert(!JSON.stringify(res.out).includes('Foreign Staff'));
 assert.equal(res.out.people[0].name,'Lorna');
 const input={workerId:'lorna',periodStart:'2026-11-01',periodEnd:'2026-11-10',
  hours:30,proposedUsd:120,provider:'Remitly Business',note:'Invoice checked'};
 res=reply();await routes['POST /api/hr/drafts'].fn({...req,body:input},res);
 assert.equal(res.code,201);assert.equal(res.out.transferInitiated,false);
 assert.equal(db.settings.v9.hrOps.drafts.length,1);
 res=reply();await routes['POST /api/hr/payout-preferences'].fn({...req,body:{workerId:'lorna',provider:'Payoneer'}},res);
 assert.equal(res.code,200);assert.equal(res.out.status,'Awaiting Owner Review');
 res=reply();await routes['POST /api/hr/drafts'].fn({...req,body:{...input,workerId:'foreign'}},res);
 assert.equal(res.code,404,'tenant2 cannot create draft for foreign staff');
 const owner={...req,user:users[0],body:{decision:'approve'},params:{id:db.settings.v9.hrOps.drafts[0].id}};
 res=reply();await routes['POST /api/hr/drafts/:id/decision'].fn(owner,res);
 assert.equal(res.code,200);assert.equal(res.out.draft.status,'Owner Approved - Manual Transfer Required');
 assert.equal(res.out.transferInitiated,false);assert.equal(res.out.providerPaid,false);
 const after=JSON.stringify(db.settings.v9);
 assert(!after.includes('paymentAccount'),'no bank identifiers collected');
 assert(!after.includes('password'));
 res=reply();await routes['POST /api/hr/payout-preferences/:userId/decision'].fn({...owner,params:{userId:'lorna'}},res);
 assert.equal(res.code,200);assert.equal(res.out.status,'Owner Approved');
 console.log('PASS V66.149: scoped HR API, owner-only approvals, tenant-safe drafts, no external payments, compiled server syntax');
})().catch(e=>{console.error(e);process.exitCode=1});

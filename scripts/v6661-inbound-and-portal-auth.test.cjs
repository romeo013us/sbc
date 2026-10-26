'use strict';
// Synthetic, no external provider calls, production data or real lead creation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
for(const m of ['SBC_V6661_WEB_INQUIRY_CONTACT_INTEGRITY','SBC_V6661_PORTAL_SESSION_REVOCATION'])assert.ok(server.includes(m));
new vm.Script(server,{filename:'server.js'});
const begin=server.indexOf('const webLeadHits=new Map()'),finish=server.indexOf("app.disable('x-powered-by')",begin);
assert.ok(begin>=0&&finish>begin);
const db={customers:[{id:'original',tenantId:1,businessName:'Safe Existing Client',contactName:'Legitimate Contact',phone:'3055551111',email:'real@example.test',leadScore:85,leadTemperature:'Hot',verificationStatus:'Verified',pipelineStage:'Sales Ready',assignedTo:'owner-1',status:'Customer'},{id:'other',tenantId:2,businessName:'Other Tenant',email:'shared@example.test',phone:'3055552222'}]};
const audit=[];let assignCalls=0,saveCalls=0,seq=0;
const routes={};
const ctx={
 db,Map,Set,Date,Math,Number,String,Array,JSON,
 app:{use:()=>{},post:(p,...args)=>{routes[p]=args.at(-1)}},
 express:{json:()=>()=>{}},apiRateLimiter:()=>{},
 PORTAL_ORIGINS:new Set(['https://sbcmia.com']),now:()=>new Date().toISOString(),id:()=> 'ci-lead-'+(++seq),
 addActivity:(...a)=>audit.push(a),saveData:async()=>{saveCalls++},
 normalizeLeadQuality:c=>{c.leadScore=82;c.leadTemperature='Hot';c.verificationStatus='Sales Ready';return c},
 assignLeadAutomatically:()=>{assignCalls++},
 sbcVerifiedWebsiteTenant:req=>{if(req.signed!==true)throw Object.assign(Error('NO_SIGNATURE'),{code:'NO_SIGNATURE'});return Number(req.tenantId||1)},
 leadDuplicateMatches:c=>db.customers.map(x=>{const r=[];if(x.email&&x.email===c.email)r.push('email');if(x.phone&&x.phone===c.phone)r.push('phone');if(x.businessName&&x.businessName===c.businessName)r.push('business');return {customer:x,reasons:r}}).filter(x=>x.reasons.length)
};
vm.runInNewContext(server.slice(begin,finish),ctx,{timeout:3000});
assert.equal(typeof routes['/api/web-lead'],'function');
async function lead(payload,{signed=true,tenantId=1,ip='192.0.2.3'}={}){
 const req={signed,tenantId,ip,headers:{origin:'https://sbcmia.com'},body:payload};
 const res={code:200,status(n){this.code=n;return this},json(v){this.body=v;return this}};
 await routes['/api/web-lead'](req,res);return res;
}
(async()=>{
 // A forged duplicate form must not overwrite established identity, quality or assignment.
 const original=JSON.stringify(db.customers[0]);
 const r=await lead({businessName:'Safe Existing Client',contactName:'Attacker',email:'real@example.test',phone:'9990000000',message:'Please change the account'});
 assert.equal(r.code,200);assert.equal(r.body.duplicate,true);assert.equal(r.body.verificationRequired,true);
 for(const k of ['businessName','contactName','email','phone','status','leadScore','leadTemperature','verificationStatus','pipelineStage','assignedTo'])
  assert.equal(db.customers[0][k],JSON.parse(original)[k],k+' must not change');
 assert.equal(db.customers[0].webLeadPendingReview,true);
 assert.equal(db.customers[0].webLeadInquiries.length,1);
 // A business-name-only collision must not assume the visitor owns that business.
 const nameOnly=await lead({businessName:'Safe Existing Client',contactName:'Different Contact',email:'new@example.test',phone:'1231231234'});
 assert.equal(nameOnly.code,201);assert.equal(nameOnly.body.verificationRequired,true);
 const created=db.customers[0];
 assert.equal(created.verificationStatus,'Needs Verification');
 assert.equal(created.leadTemperature,'Cold');
 assert.ok(created.leadScore<50);
 assert.equal(created.webLeadPendingReview,true);
 assert.equal(assignCalls,0,'no unverified public inquiry can create an outbound call task');
 const foreign=await lead({businessName:'Other Tenant',contactName:'Public Person',email:'shared@example.test',phone:'8880009999'});
 assert.equal(foreign.code,201,'cross-tenant match must not associate another tenant contact');
 assert.equal(db.customers.find(x=>x.id==='other').email,'shared@example.test');
 // Unauthenticated flood cannot fill a valid website's rate counter.
 for(let i=0;i<20;i++){const u=await lead({businessName:'Spam '+i,phone:'1111111111'},{signed:false,ip:'198.51.100.4'});assert.equal(u.code,403);}
 const still=await lead({businessName:'Legit',phone:'5551112222'},{ip:'198.51.100.4'});
 assert.equal(still.code,201,'unsigned attackers cannot exhaust signed website quota');
 // Portal tokens: strong secret, constant-time HMAC, logout invalidation, missing key fail closed.
 const start=server.indexOf('const PORTAL_SECRET ='),end=server.indexOf('function portalSafeCustomer(',start);
 assert.ok(start>=0&&end>start);
 const accounts=[{id:'acct-1',customerId:'cust-1',portalSessionVersion:0,active:true}];
 const pDb={customerAccounts:accounts,customers:[{id:'cust-1',tenantId:1}]};
 function portalContext(secret){
  const v={crypto,Buffer,Date,JSON,Number,String,Set,process:{env:secret?{SBC_PORTAL_SECRET:secret}:{ }},ADMIN_PASSWORD:'',db:pDb};
  vm.runInNewContext(server.slice(start,end)+'\nthis.handlers={makePortalToken,portalAccount,sbcPortalSessionsConfigured,portalSign,b64u};',v,{timeout:3000});
  return v.handlers;
 }
 const secret='5b5d7e8f9a1b3c4d5e6f0a2b4c6d8e9f5b5d7e8f9a1b3c4d5e6f0a2b4c6d8e9f';
 const p=portalContext(secret);
 assert.equal(p.sbcPortalSessionsConfigured(),true);
 const token=p.makePortalToken(accounts[0]);
 assert.equal(p.portalAccount({headers:{authorization:'Bearer '+token}}).id,'acct-1');
 assert.equal(p.portalAccount({headers:{authorization:'Bearer '+token+'x'}}),null,'tamper denied');
 const legacy=p.b64u(JSON.stringify({sub:'acct-1',cid:'cust-1',exp:Date.now()+3600000}));
 assert.equal(p.portalAccount({headers:{authorization:'Bearer '+legacy+'.'+p.portalSign(legacy)}}),null,'old nonrevocable tokens must expire');
 assert.equal(portalContext('').sbcPortalSessionsConfigured(),false);
 assert.equal(portalContext('').portalAccount({headers:{authorization:'Bearer '+token}}),null);
 const logout=server.match(/app.post\('\/api\/portal\/logout',portalAuth,async\(req,res\)=>\{[^\n]+\}\);/);
 assert.ok(logout,'logout now requires auth and increments revocation version');
 let doLogout;let persisted=0;
 vm.runInNewContext(logout[0],{app:{post:(route,auth,handler)=>doLogout=handler},portalAuth:()=>{},Number,saveData:async()=>{persisted++}},{timeout:2000});
 let response=null;
 await doLogout({portalAccount:accounts[0]},{json:x=>response=x});
 assert.equal(response.revoked,true);assert.equal(persisted,1);
 assert.equal(accounts[0].portalSessionVersion,1);
 assert.equal(p.portalAccount({headers:{authorization:'Bearer '+token}}),null,'logout invalidates old token');
 const refreshed=p.makePortalToken(accounts[0]);
 assert.equal(p.portalAccount({headers:{authorization:'Bearer '+refreshed}}).id,'acct-1');
 console.log('[SBC V6661] PASS: multi-tenant inbound lead truth; no verified contact overwrite; no auto-qualified calls; portal session revocation');
})().catch(e=>{console.error('[SBC V6661] FAIL',e.stack||e);process.exitCode=1});

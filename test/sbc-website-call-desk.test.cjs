'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {project,recordOutcome,register,createCallScript}=require('../enterprise/sbc-website-call-desk.cjs');
const owner={id:'owner1',role:'owner',tenantId:1,active:true,name:'Owner Person'};
const caller={id:'seller1',role:'caller',tenantId:1,active:true,name:'Sales Person'};
const lorna={id:'research1',role:'lead_researcher',tenantId:1,active:true};
const customer=(id,extra={})=>({id,tenantId:1,assignedTo:'seller1',businessName:'Synthetic '+id,contactName:'Business Owner',phone:'+13055550123',verificationStatus:'Sales Ready',leadIntelligence:{researchBrief:{websitePresence:'not_found',googleBusinessPresence:'found',ownerContactVerified:true}},...extra});
const website=(id,cId,status='Approved',other={})=>({id,tenantId:1,customerId:cId,status,slug:'test-site-'+id,offerTier:'starter',updatedAt:'2026-11-12T21:00:00Z',...other});
const now='2026-11-12T22:00:00.000Z';
const data=()=>({
 customers:[
  customer('ready'),customer('needsite'),customer('review'),customer('unknown',{verificationStatus:'Unverified',leadIntelligence:{researchBrief:{websitePresence:'not_checked',googleBusinessPresence:'not_checked'}}}),
  customer('bad',{phone:'unavailable'}),customer('suppressed',{doNotContact:true}),customer('another',{assignedTo:'other1'}),customer('foreign',{tenantId:2,businessName:'Foreign Secret'}),customer('already',{leadIntelligence:{researchBrief:{websitePresence:'found',googleBusinessPresence:'found'}}})
 ],
 sites:[website('readyweb','ready'),website('reviewweb','review','Draft'),website('alreadyweb','already')],
 appointments:[],calls:[]
});
test('real readiness: Lorna verified, owner-approved 85%-built site, phone, tenant and assigned salesperson',()=>{
 const d=data(),p=project({...d,actor:caller,tenantId:1,now});
 assert.equal(p.ok,true);
 const byId=new Map(p.rows.map(r=>[r.customerId,r]));
 assert.equal(byId.get('ready').stage,'READY_TO_CALL');
 assert.equal(byId.get('needsite').stage,'BUILD_WEBSITE');
 assert.equal(byId.get('review').stage,'REVIEW_WEBSITE');
 assert.equal(byId.get('unknown').stage,'RESEARCH_REQUIRED');
 assert.equal(byId.get('bad').stage,'CONTACT_UNVERIFIED');
 assert.equal(byId.get('suppressed').stage,'SUPPRESSED');
 assert.equal(byId.get('already').stage,'READY_TO_CALL');
 assert(!byId.has('another'));assert(!byId.has('foreign'));
 assert.equal(byId.get('ready').websiteUrl,'/demo/test-site-readyweb');
 assert.equal(byId.get('review').websiteUrl,'');
 assert.equal(byId.get('ready').aiVoiceOutboundEnabled,false);
 assert.match(byId.get('ready').script,/Do you already have a website\?/i);
 assert.match(byId.get('ready').script,/I (?:went ahead and )?built/i);
 assert.match(byId.get('ready').script,/today or tomorrow/i);
 assert.match(byId.get('ready').script,/\$199/);
 assert.doesNotMatch(byId.get('needsite').script,/I (?:went ahead and )?built/i);
 assert.doesNotMatch(byId.get('already').script,/noticed you (?:had|didn't have) (?:a )?website/i);
 assert(!JSON.stringify(p).includes('Foreign Secret'));
});
test('script avoids invented Google Business Profile research and premature website claims',()=>{
 const notVerified=customer('x',{leadIntelligence:{researchBrief:{googleBusinessPresence:'not_checked'}}});
 const s=createCallScript(notVerified,website('w','x'));
 assert.doesNotMatch(s,/I was (?:on|looking at) your Google Business Profile/i);
 assert.match(s,/looking up your business online/i);
 const noWeb=createCallScript(notVerified,null);
 assert.doesNotMatch(noWeb,/built a website/i);
 assert.match(noWeb,/I can prepare a website/i);
});
test('outcome handling: no-answer, no-contact, and invalid numbers leave reliable sales notes; bad number cooldown 15 days',()=>{
 const c=customer('ready'),d=website('w','ready');
 const no=recordOutcome({customer:c,site:d,actor:caller,tenantId:1,kind:'NO_ANSWER',now});
 assert.equal(no.kind,'NO_ANSWER');
 assert.equal(no.customerPatch.doNotContact,undefined);
 const bad=recordOutcome({customer:c,site:d,actor:caller,tenantId:1,kind:'BAD_NUMBER',now});
 assert.equal(bad.customerPatch.websiteSalesBadNumberUntil,'2026-11-27T22:00:00.000Z');
 const optout=recordOutcome({customer:c,site:d,actor:caller,tenantId:1,kind:'DO_NOT_CALL',now});
 assert.equal(optout.customerPatch.doNotCall,true);
 assert.equal(optout.customerPatch.salesSuppressed,true);
 assert.equal(optout.record.outboundTriggered,false);
 assert.throws(()=>recordOutcome({customer:c,site:d,actor:lorna,tenantId:1,kind:'NO_ANSWER',now}),/NOT_AUTHORIZED/);
 assert.throws(()=>recordOutcome({customer:{...c,tenantId:2},site:d,actor:caller,tenantId:1,kind:'NO_ANSWER',now}),/NOT_AUTHORIZED/);
 assert.throws(()=>recordOutcome({customer:c,site:d,actor:caller,tenantId:1,kind:'UNKNOWN',now}),/INVALID_OUTCOME/);
});
test('owner and assigned caller only; GET creates no history; POST records no calls, texts or Zoom links',async()=>{
 let d=data();let store={websiteDemos:d.sites,websiteSalesCalls:[]},saves=0;
 const db={customers:d.customers,appointments:d.appointments};
 const app=express();app.use(express.json());
 app.use((req,res,next)=>{const role=req.header('x-role');req.user=role==='owner'?owner:role==='caller'?caller:role==='research'?lorna:role==='foreign'?{...caller,tenantId:2}:null;next()});
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 register(app,{auth,requireTenant:req=>req.user.tenantId,db,getStore:()=>store,
  saveStore:async next=>{store=next;saves++;return {ok:true}},writerReady:()=>true,now:()=>now});
 const srv=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 const call=async(method,url,role,body)=>{
  const res=await fetch('http://127.0.0.1:'+srv.address().port+url,{method,headers:{'content-type':'application/json',...(role?{'x-role':role}:{})},body:body?JSON.stringify(body):undefined});
  return {status:res.status,body:await res.json()}
 };
 try{
  assert.equal((await call('GET','/api/website-production/call-desk',null)).status,401);
  assert.equal((await call('GET','/api/website-production/call-desk','research')).status,403);
  const foreignView=await call('GET','/api/website-production/call-desk','foreign');
  assert.equal(foreignView.body.rows.length,1);
  assert.equal(foreignView.body.rows[0].customerId,'foreign');
  assert(!JSON.stringify(foreignView.body).includes('Synthetic ready'));

  const view=await call('GET','/api/website-production/call-desk','caller');
  assert.equal(view.status,200);assert.equal(saves,0);
  assert.equal((await call('POST','/api/website-production/call-desk/another/outcome','caller',{kind:'NO_ANSWER'})).status,404);
  assert.equal((await call('POST','/api/website-production/call-desk/ready/outcome','research',{kind:'NO_ANSWER'})).status,403);
  const out=await call('POST','/api/website-production/call-desk/ready/outcome','caller',{kind:'NO_ANSWER'});
  assert.equal(out.status,201);assert.equal(saves,1);
  assert.equal(store.websiteSalesCalls.length,1);
  assert.equal(store.websiteSalesCalls[0].outboundTriggered,false);
  const dnc=await call('POST','/api/website-production/call-desk/ready/outcome','caller',{kind:'DO_NOT_CALL'});
  assert.equal(dnc.status,201);assert.equal(db.customers.find(c=>c.id==='ready').doNotCall,true);
  const blocked=await call('GET','/api/website-production/call-desk','caller');
  assert.equal(blocked.body.rows.find(r=>r.customerId==='ready').stage,'SUPPRESSED');
 }finally{await new Promise(resolve=>srv.close(resolve))}
});
test('staged GoDaddy release integrates isolated call desk without mutating signed source',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const {patchServer,MARK}=require('../scripts/v66-stage-website-call-desk.cjs');
 const staged=patchServer(src);assert(staged.includes(MARK));assert.equal(patchServer(staged),staged);
 new vm.Script(staged);
 if(process.env.SBC_CALL_DESK_EXPECT_STAGED==='YES')assert.equal(staged,src);
 assert.match(staged,/sbc-website-call-desk\.cjs/);
});
test('full Website Call Desk is available to owner and assigned sales staff, no AI voice auto-dial',()=>{
 const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
 const ui=read('public/sbc-website-call-desk-v1.js');
 assert.equal(ui,read('browser_public/sbc-website-call-desk-v1.js'));
 assert.match(ui,/SBC Website Call Desk/);
 assert.match(ui,/\/api\/website-production\/call-desk/);
 assert.match(ui,/SBC_WEBSITE_PRODUCTION\.openExisting/);
 assert.match(ui,/SBC_WEBSITE_PRODUCTION\.openExisting\(id,current\(\)\)/);
 assert.match(ui,/SBC_WEBSITE_PRODUCTION\.build\(id,'essentials',current\(\)\)/);
 const production=read('public/sbc-website-production-v1.js');
 assert.equal(production,read('browser_public/sbc-website-production-v1.js'));
 assert.match(production,/const salesCustomer =/);
 assert.match(production,/doNotContact:true,doNotCall:true,salesSuppressed:true/);
 assert.match(production,/async function buildWebsite\(customerId,defaultTier='essentials',hint\)/);
 assert.match(production,/async function openExisting\(customerId,hint\)/);

 assert.match(ui,/NO_ANSWER/);
 assert.match(ui,/DO_NOT_CALL/);
 assert.match(ui,/AI call coach/);
 assert.doesNotMatch(ui,/twilio.*calls.*create|autoDial|startAIVoiceCall/i);
 for(const name of ['public/index.html','browser_public/index.html'])assert.match(read(name),/sbc-website-call-desk-v1\.js/);
});

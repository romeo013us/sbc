'use strict';
/* Stage research-quality goal accounting in CI only after existing role/identity safeguards.
   Does NOT run in the already deployed GoDaddy runtime or weaken other permissions. */
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_RESEARCH_QUALITY_GOAL_V3';
const ROUTE="\napp.get('/api/workforce/research-progress',auth,async(req,res)=>{\n  res.setHeader('Cache-Control','no-store');\n  if(!sbcLornaRole(req.user))return res.status(403).json({ok:false,error:'Researcher access required.'});\n  try{\n    const tenantId=requireRequestTenant(req);\n    if(!mysqlPool||MYSQL_RECOVERY_REQUIRED)return res.status(503).json({ok:false,code:'RESEARCH_STATS_UNAVAILABLE',error:'Verified CRM progress is temporarily unavailable.'});\n    const customerMap=new Map((db.customers||[]).filter(c=>Number(c.tenantId)===Number(tenantId)).map(c=>[String(c.id),c]));\n    const [sqlEvents]=await mysqlPool.query(\n      \"SELECT id,event_type,meta_json,created_at FROM sbc_audit_log WHERE user_id=? AND event_type IN ('workforce_lead_created','lead_verification_update') ORDER BY created_at ASC LIMIT 20000\",\n      [String(req.user.id)]\n    );\n    const wanted=new Set(['workforce_lead_created','lead_verification_update']);\n    const events=[...(sqlEvents||[]).map(r=>({id:r.id,type:r.event_type,meta:r.meta_json,createdAt:r.created_at})),\n      ...(db.auditLog||[]).filter(e=>String(e.userId)===String(req.user.id)&&wanted.has(String(e.eventType))).map(e=>({id:e.id,type:e.eventType,meta:e.meta,createdAt:e.createdAt}))];\n    events.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));\n    const seenEvents=new Set(),created=new Map(),qualified=new Map();\n    const etParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});\n    const etDate=value=>{\n      const date=new Date(value);\n      if(!Number.isFinite(date.getTime()))return '';\n      const parts=Object.fromEntries(etParts.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));\n      return parts.year+'-'+parts.month+'-'+parts.day;\n    };\n    for(const event of events){\n      const eventId=String(event.id||'');\n      if(!eventId||seenEvents.has(eventId))continue;\n      seenEvents.add(eventId);\n      let meta=event.meta;\n      if(typeof meta==='string'){try{meta=JSON.parse(meta)}catch{continue}}\n      const customerId=String(meta?.customerId||'');\n      if(!customerId)continue;\n      const customer=customerMap.get(customerId);\n      if(!customer||isSbcSyntheticTestRecord(customer))continue;\n      const day=etDate(event.createdAt);\n      if(!day)continue;\n      if(event.type==='workforce_lead_created'){\n        if(!created.has(customerId))created.set(customerId,{id:customerId,day});\n      }else if(event.type==='lead_verification_update'){\n        // Only a first documented transition into Verified counts; saving again never adds work units.\n        if(meta?.researchVerified!==true||String(meta?.verificationStatus)!=='Verified'||qualified.has(customerId))continue;\n        if(!['Verified','Sales Ready'].includes(String(customer.verificationStatus||'')))continue;\n        qualified.set(customerId,{id:customerId,day});\n      }\n    }\n    const saved=[...created.values()],verified=[...qualified.values()].map(r=>({...r,kind:created.get(r.id)?.day===r.day?'new':'existing'}));\n    const today=etDate(new Date()),days=[];\n    for(let offset=6;offset>=0;offset--){\n      const date=new Date(Date.parse(today+'T12:00:00Z')-offset*86400000).toISOString().slice(0,10);\n      days.push({date,count:verified.filter(r=>r.day===date).length});\n    }\n    const current=verified.filter(r=>r.day===today);\n    const newVerifiedToday=current.filter(r=>r.kind==='new').length;\n    const existingVerifiedToday=current.length-newVerifiedToday;\n    res.json({ok:true,date:today,timeZone:'America/New_York',goalMin:16,goalMax:20,\n      todayCount:current.length,verifiedTodayCount:current.length,\n      newVerifiedToday,existingVerifiedToday,\n      rawSavedTodayCount:saved.filter(r=>r.day===today).length,\n      last7Count:days.reduce((sum,d)=>sum+d.count,0),allTimeCount:verified.length,rawSavedAllTimeCount:saved.length,\n      last7Days:days,submittedLeadIds:saved.map(r=>r.id).slice(-1000),source:'qualified-crm-audit',limitReached:(sqlEvents||[]).length>=20000});\n  }catch(err){\n    console.error('[SBC RESEARCH PROGRESS] secure read failed:',String(err?.code||err?.message||'unknown'));\n    res.status(503).json({ok:false,code:'RESEARCH_STATS_UNAVAILABLE',error:'Verified CRM progress is temporarily unavailable.'});\n  }\n});\n";
function patchSource(src){
 if(src.includes(MARKER))return src;
 const start="app.get('/api/workforce/research-progress',auth,async(req,res)=>{";
 const end="app.get('/api/v9/lead-verification',auth,(req,res)=>{";
 const i=src.indexOf(start),j=src.indexOf(end,i+start.length);
 if(i<0||j<0||src.indexOf(start,i+1)!==-1||j<i)throw Error('[SBC RESEARCH QUALITY GOAL] unsafe progress route anchors');
 let out=src.slice(0,i)+'// '+MARKER+'\n'+ROUTE+'\n'+src.slice(j);
 const verifyStart="app.post('/api/v9/lead-verification/:id',auth,async(req,res)=>{";
 const verifyEnd="app.post('/api/v9/assign',auth,ownerOnly,async(req,res)=>{";
 const a=out.indexOf(verifyStart),b=out.indexOf(verifyEnd,a);
 if(a<0||b<0||out.indexOf(verifyStart,a+1)!==-1)throw Error('[SBC RESEARCH QUALITY GOAL] unsafe verification route anchors');
 let section=out.slice(a,b);
 function once(oldPart,newPart){
  if(section.split(oldPart).length!==2)throw Error('[SBC RESEARCH QUALITY GOAL] missing verification guard: '+oldPart.slice(0,90));
  section=section.replace(oldPart,newPart);
 }
 once("  const b=req.body||{};","  const priorVerificationStatus=String(c.verificationStatus||'Needs Verification');\n  const b=req.body||{};");
 once("  for(const k of ['businessName'","  if(researcher&&String(b.verificationStatus||'')==='Verified'){\n    const business=String(b.businessName??c.businessName??'').trim();\n    const contact=String(b.phone??c.phone??'').trim()||String(b.email??c.email??'').trim()||String(b.website??c.website??'').trim();\n    const evidence=String(b.verificationSource??c.verificationSource??'').trim();\n    if(!business||!contact||!evidence)return res.status(422).json({error:'To verify a lead, confirm its business name, a phone/email/website, and your research source.'});\n  }\n  for(const k of ['businessName'");
 once("verificationStatus:c.verificationStatus,leadTemperature:c.leadTemperature,assignedTo:c.assignedTo||''","verificationStatus:c.verificationStatus,previousVerificationStatus:priorVerificationStatus,researchVerified:Boolean(researcher&&c.verificationStatus==='Verified'&&!['Verified','Sales Ready'].includes(priorVerificationStatus)),verificationSource:c.verificationSource||'',leadTemperature:c.leadTemperature,assignedTo:c.assignedTo||''");
 out=out.slice(0,a)+section+out.slice(b);
 if(!out.includes("source:'qualified-crm-audit'")||!out.includes("researchVerified:Boolean(researcher"))throw Error('[SBC RESEARCH QUALITY GOAL] partial staged patch');
 return out;
}
function apply(root){
 const file=path.join(root,'server.js'),before=fs.readFileSync(file,'utf8'),after=patchSource(before);
 if(before!==after)fs.writeFileSync(file,after);
 return {marker:MARKER,applied:before!==after,bytes:after.length};
}
if(require.main===module){
 if(process.argv[2]!=='--apply')throw Error('Use --apply only in verified candidate CI.');
 console.log('[SBC RESEARCH QUALITY GOAL] '+JSON.stringify(apply(path.resolve(__dirname,'..'))));
}
module.exports={MARKER,patchSource,apply};

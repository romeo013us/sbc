'use strict';
/* Stage Lorna's automatic verification handoff and research-intake metrics only
 * inside the rehashed, integrity-checked GoDaddy candidate release. Do not touch
 * pinned source server.js before CI regenerates hashes and receipt.
 */
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_RESEARCH_AUTO_HANDOFF_V4';
const ROUTE="\n// SBC_RESEARCH_AUTO_HANDOFF_V4: employee productivity is measured at research intake.\n// The existing Lead Assist / Revenue verifier decides whether a prospect is auto-verified.\napp.get('/api/workforce/research-progress',auth,async(req,res)=>{\n res.setHeader('Cache-Control','no-store');\n if(!sbcLornaRole(req.user))return res.status(403).json({ok:false,error:'Researcher access required.'});\n try{\n  const tenantId=requireRequestTenant(req);\n  if(!mysqlPool||MYSQL_RECOVERY_REQUIRED)return res.status(503).json({ok:false,code:'RESEARCH_STATS_UNAVAILABLE',error:'CRM research metrics are temporarily unavailable.'});\n  const customerMap=new Map((db.customers||[]).filter(c=>Number(c.tenantId)===Number(tenantId)).map(c=>[String(c.id),c]));\n  const [sqlEvents]=await mysqlPool.query(\n   \"SELECT id,meta_json,created_at FROM sbc_audit_log WHERE user_id=? AND event_type='workforce_lead_created' ORDER BY created_at DESC LIMIT 20000\",\n   [String(req.user.id)]\n  );\n  const source=[...(sqlEvents||[]).map(r=>({id:r.id,meta:r.meta_json,createdAt:r.created_at})),\n   ...(db.auditLog||[]).filter(e=>String(e.userId)===String(req.user.id)&&e.eventType==='workforce_lead_created').map(e=>({id:e.id,meta:e.meta,createdAt:e.createdAt}))];\n  source.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));\n  const seenEvents=new Set(),saved=new Map();\n  const etParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});\n  const etDate=value=>{\n   const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';\n   const parts=Object.fromEntries(etParts.formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));\n   return parts.year+'-'+parts.month+'-'+parts.day;\n  };\n  for(const e of source){\n   const eventId=String(e.id||'');\n   if(!eventId||seenEvents.has(eventId))continue;\n   seenEvents.add(eventId);\n   let meta=e.meta;\n   if(typeof meta==='string'){try{meta=JSON.parse(meta)}catch{continue}}\n   const id=String(meta?.customerId||''),customer=customerMap.get(id);\n   if(!id||!customer||saved.has(id)||isSbcSyntheticTestRecord(customer))continue;\n   const day=etDate(e.createdAt);if(!day)continue;\n   // Never infer quality from an AI verification status, or from raw CSV row count.\n   // The canonical intake independently checks name + contact + documented research source.\n   const complete=meta?.researchComplete===true;\n   const machineStatus=String(customer.leadAssist?.status||customer.leadIntelligence?.autoVerificationStatus||'NOT_CHECKED');\n   saved.set(id,{id,day,complete,machineStatus});\n  }\n  const all=[...saved.values()],qualified=all.filter(r=>r.complete);\n  const today=etDate(new Date()),current=qualified.filter(r=>r.day===today),days=[];\n  for(let offset=6;offset>=0;offset--){\n   const day=new Date(Date.parse(today+'T12:00:00Z')-offset*86400000).toISOString().slice(0,10);\n   days.push({date:day,count:qualified.filter(r=>r.day===day).length});\n  }\n  const autoVerifiedToday=current.filter(r=>r.machineStatus==='AUTO_VERIFIED').length;\n  const needsReviewToday=current.filter(r=>r.machineStatus==='NEEDS_HUMAN_REVIEW'||r.machineStatus==='FAILED').length;\n  const pendingToday=current.length-autoVerifiedToday-needsReviewToday;\n  res.json({ok:true,date:today,timeZone:'America/New_York',goalMin:16,goalMax:20,\n   todayCount:current.length,researchCompleteTodayCount:current.length,\n   rawSavedTodayCount:all.filter(r=>r.day===today).length,\n   autoVerifiedTodayCount:autoVerifiedToday,needsReviewTodayCount:needsReviewToday,pendingAutoTodayCount:pendingToday,\n   last7Count:days.reduce((n,d)=>n+d.count,0),allTimeCount:qualified.length,rawSavedAllTimeCount:all.length,\n   last7Days:days,submittedLeadIds:all.map(r=>r.id).slice(-1000),source:'research-intake-audit',\n   limitReached:(sqlEvents||[]).length>=20000});\n }catch(e){\n  console.error('[SBC RESEARCH INTAKE] read failed:',String(e?.code||e?.message||'unknown'));\n  res.status(503).json({ok:false,code:'RESEARCH_STATS_UNAVAILABLE',error:'CRM research metrics are temporarily unavailable.'});\n }\n});\n";
function patchSource(src){
 if(src.includes(MARKER)){
  if(!src.includes("source:'research-intake-audit'")||!src.includes("researchComplete:researchComplete"))
   throw Error('[SBC AUTO HANDOFF] incomplete staged patch');
  return src;
 }
 const start="app.get('/api/workforce/research-progress',auth,async(req,res)=>{";
 const end="app.get('/api/v9/lead-verification',auth,(req,res)=>{";
 const i=src.indexOf(start),j=src.indexOf(end,i+start.length);
 if(i<0||j<0||src.indexOf(start,i+1)!==-1)throw Error('[SBC AUTO HANDOFF] unsafe research API anchors');
 let out=src.slice(0,i)+ROUTE+'\n'+src.slice(j);
 const getStart="app.get('/api/v9/lead-verification',auth,(req,res)=>{";
 const getEnd="app.post('/api/v9/lead-verification/:id',auth,async(req,res)=>{";
 const a=out.indexOf(getStart),b=out.indexOf(getEnd,a);
 if(a<0||b<0)throw Error('[SBC AUTO HANDOFF] missing existing queue endpoint');
 let get=out.slice(a,b);
 const original="verificationStatus:c.verificationStatus||'Needs Verification',verificationSource:c.verificationSource||'',leadTemperature:c.leadTemperature||'',researcherId:c.researcherId||'',createdAt:c.createdAt||'',updatedAt:c.updatedAt||''";
 const replacement="verificationStatus:c.verificationStatus||'Needs Verification',verificationSource:c.verificationSource||'',leadTemperature:c.leadTemperature||'',researcherId:c.researcherId||'',createdAt:c.createdAt||'',updatedAt:c.updatedAt||'',leadAssistStatus:c.leadAssist?.status||c.leadIntelligence?.autoVerificationStatus||'NOT_CHECKED',leadAssistCheckedAt:c.leadAssist?.checkedAt||c.leadIntelligence?.autoVerificationCheckedAt||'',researchStatus:c.leadIntelligence?.researchStatus||'NOT_RECORDED',researchSource:c.leadIntelligence?.researchSource||''";
 if(get.split(original).length!==2)throw Error('[SBC AUTO HANDOFF] queue projection changed unexpectedly');
 get=get.replace(original,replacement);
 out=out.slice(0,a)+get+out.slice(b);
 const reviewStart="app.post('/api/v9/lead-verification/:id',auth,async(req,res)=>{";
 const reviewEnd="app.post('/api/v9/assign',auth,ownerOnly,async(req,res)=>{";
 const c=out.indexOf(reviewStart),d=out.indexOf(reviewEnd,c);
 if(c<0||d<0)throw Error('[SBC AUTO HANDOFF] research correction route missing');
 let review=out.slice(c,d);
 const oldGate="['Needs Verification','Verified','Owner Review'].includes(String(req.body.verificationStatus))";
 if(review.split(oldGate).length!==2)throw Error('[SBC AUTO HANDOFF] cannot restrict blind manual researcher verification');
 review=review.replace(oldGate,"['Needs Verification','Owner Review'].includes(String(req.body.verificationStatus))");
 const oldSave="  await saveData();\n  res.setHeader('Cache-Control','no-store');";
 if(review.split(oldSave).length!==2)throw Error('[SBC AUTO HANDOFF] correction save anchor missing');
 review=review.replace(oldSave,
  "  if(researcher)enqueueLeadAssist(c.id,'researcher_corrected_exception','high');\n"+oldSave);
 out=out.slice(0,c)+review+out.slice(d);
 const createStart="app.post('/api/workforce/leads',auth,async(req,res)=>{";
 const createEnd="// V55.19 — persistent Lorna/lead-research workspace drafts and structured lead editing.";
 const x=out.indexOf(createStart),y=out.indexOf(createEnd,x);
 if(x<0||y<0)throw Error('[SBC AUTO HANDOFF] canonical lead-create endpoint missing');
 let create=out.slice(x,y);
 function once(a,b){if(create.split(a).length!==2)throw Error('[SBC AUTO HANDOFF] lead create anchor missing: '+a.slice(0,75));create=create.replace(a,b);}
 once("  const tenantId=requireRequestTenant(req);",
  "  const rawSource=String(b.source||'').trim();\n"+
  "  const researchSource=String(b.verificationSource||b.researchSource||(!/^(Lead Research|Lead Research - Bulk Import|CSV Import)$/i.test(rawSource)?rawSource:'')||'').trim().slice(0,300);\n"+
  "  const contactComplete=Boolean(revenuePhoneShape(phone)||revenueEmailShape(email)||revenueWebsiteShape(b.website));\n"+
  "  const researchComplete=Boolean(business&&contactComplete&&researchSource);\n"+
  "  const tenantId=requireRequestTenant(req);");
 once("  if(mysqlPool){await mysqlPool.query(\`INSERT INTO sbc_customers",
  "  c.leadIntelligence.researchStatus=researchComplete?'RESEARCH_SUBMITTED':'NEEDS_RESEARCH';\n"+
  "  c.leadIntelligence.researchSource=researchSource;\n"+
  "  c.leadIntelligence.autoVerificationStatus='QUEUED';\n"+
  "  c.leadIntelligence.researchSubmittedBy=String(req.user.id);\n"+
  "  if(mysqlPool){await mysqlPool.query(\`INSERT INTO sbc_customers");
 once("researcherId:c.researcherId,source:c.source});",
      "researcherId:c.researcherId,source:c.source,researchComplete:researchComplete,researchSource:researchSource});");
 once("route:'workforce-leads-v1',message:'Lead saved to the central SBC CRM.'",
      "route:'workforce-leads-v1',researchComplete:researchComplete,leadAssist:{status:'QUEUED',message:'Saved in SBC CRM. Automatic Lead Assist verification queued.'},message:'Lead saved to the central SBC CRM and queued for automatic verification.'");
 out=out.slice(0,x)+create+out.slice(y);
 // Persist only minimal Lead Assist machine status in existing customer intelligence.
 // Persist the already-existing queue in the existing sbc_workspace JSON column.
 function durableOnce(a,b){
  if(out.split(a).length!==2)throw Error('[SBC AUTO HANDOFF] durable CRM anchor missing: '+a.slice(0,95));
  out=out.replace(a,b);
 }
 durableOnce("db=normalize({version:4,settings,megaOpsStore:megaOpsFromWorkspace,customers:",
   "db=normalize({version:4,settings,megaOpsStore:megaOpsFromWorkspace,leadAssistQueue:Array.isArray(extra.leadAssistQueue)?extra.leadAssistQueue:[],customers:");
 durableOnce("leadIntelligence:(()=>{try{return safeJsonParse(r.lead_intelligence_json, {})}catch{return {}}})(),createdAt:",
   "leadIntelligence:(()=>{try{return safeJsonParse(r.lead_intelligence_json, {})}catch{return {}}})(),verificationStatus:(()=>{try{return safeJsonParse(r.lead_intelligence_json, {}).verificationStatus||'Needs Verification'}catch{return 'Needs Verification'}})(),createdAt:");
 durableOnce("const extra={appointments:db.appointments||[],sequences:",
   "const extra={leadAssistQueue:(db.leadAssistQueue||[]).slice(0,5000),appointments:db.appointments||[],sequences:");
 durableOnce("      job.status='COMPLETE';job.result=",
   "      c.leadIntelligence=c.leadIntelligence||{};c.leadIntelligence.autoVerificationStatus=c.leadAssist.status;c.leadIntelligence.autoVerificationCheckedAt=c.leadAssist.checkedAt||now();c.leadIntelligence.verificationStatus=c.verificationStatus;\n      job.status='COMPLETE';job.result=");
 durableOnce("job.updatedAt=now();out.push({customerId:c.id,businessName:c.businessName,status:job.status,error:job.error});",
   "job.updatedAt=now();c.leadIntelligence=c.leadIntelligence||{};c.leadIntelligence.autoVerificationStatus=job.status;out.push({customerId:c.id,businessName:c.businessName,status:job.status,error:job.error});");
 durableOnce("const q=leadAssistQueue();const work=q.filter",
   "const q=leadAssistQueue();\n  const knownJobs=new Set(q.filter(j=>['QUEUED','PROCESSING','COMPLETE','FAILED'].includes(j.status)).map(j=>String(j.customerId)));\n  for(const c of (db.customers||[]))if(c.leadIntelligence?.autoVerificationStatus==='QUEUED'&&c.leadIntelligence?.researchSubmittedBy&&!knownJobs.has(String(c.id))){enqueueLeadAssist(c.id,'recover_research_auto_check','high');knownJobs.add(String(c.id));}\n  const work=q.filter");
 durableOnce("const work=q.filter(x=>x.status==='QUEUED'&&(",
   "const work=q.filter(x=>(x.status==='QUEUED'||(x.status==='PROCESSING'&&Date.now()-Date.parse(x.updatedAt||x.createdAt||0)>10*60*1000))&&(");
 // Editing a returned exception requeues the original verifier; do not self-certify.
 durableOnce("if(researcher)enqueueLeadAssist(c.id,'researcher_corrected_exception','high');",
  "if(researcher){c.leadIntelligence=c.leadIntelligence||{};c.leadIntelligence.autoVerificationStatus='QUEUED';enqueueLeadAssist(c.id,'researcher_corrected_exception','high');}");
 if(!out.includes(MARKER)||!out.includes("researchComplete:researchComplete")||!out.includes("['Needs Verification','Owner Review'].includes(String(req.body.verificationStatus))"))
  throw Error('[SBC AUTO HANDOFF] staged safety requirements missing');
 return out;
}
function apply(root){
 const file=path.join(root,'server.js'),before=fs.readFileSync(file,'utf8'),after=patchSource(before);
 if(before!==after)fs.writeFileSync(file,after);
 return {marker:MARKER,applied:before!==after,bytes:after.length};
}
if(require.main===module){
 if(process.argv[2]!=='--apply')throw Error('Only stage inside integrity-checked candidate CI.');
 console.log('[SBC AUTO HANDOFF] '+JSON.stringify(apply(path.resolve(__dirname,'..'))));
}
module.exports={MARKER,patchSource,apply};

'use strict';
// V66.137 — exact-anchor staged transform. Never mutate signed checkout production source.
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66137_PHONE_RECOVERY';
function replaceOnce(s,from,to,label){
  const p=s.indexOf(from);if(p<0||s.indexOf(from,p+from.length)>=0)throw Error('PHONE_RECOVERY_ANCHOR_INVALID:'+label);
  return s.slice(0,p)+to+s.slice(p+from.length);
}
function patchServer(input){
  let s=String(input||'');
  if(s.includes(MARK)){if(s.split(MARK).length!==2)throw Error('PHONE_RECOVERY_PARTIAL_STAGE');return s;}
  const terminal="const TERMINAL_SALES_OUTCOMES=new Set(['Not Interested','Bad Number','Do Not Call','Closed Business','Not Qualified','Duplicate']);";
  s=replaceOnce(s,terminal,
    "const SBC_PHONE_RECOVERY=require('./enterprise/sbc-phone-recovery-v66137.cjs');\n// "+MARK+"\n"+terminal,'recovery-import');
  s=replaceOnce(s,"if(terminalStatuses.has(String(c.status||'')))return false;",
    "if(terminalStatuses.has(String(c.status||''))||SBC_PHONE_RECOVERY.isHeld(c)||SBC_PHONE_RECOVERY.hasUnreachableLog(c,db.callLogs||[]))return false;",'queue-candidates');
  s=replaceOnce(s,
    "return c && !['Customer','Lost','Do Not Call','Closed','Duplicate','Not Qualified'].includes(String(c.status||''));",
    "return c && !SBC_PHONE_RECOVERY.isHeld(c) && !SBC_PHONE_RECOVERY.hasUnreachableLog(c,db.callLogs||[]) && !['Customer','Lost','Do Not Call','Closed','Duplicate','Not Qualified'].includes(String(c.status||''));",'queue-replenishment');
  s=replaceOnce(s,"if(TERMINAL_SALES_OUTCOMES.has(outcome)){",
    "if(outcome==='Bad Number'||outcome==='Bad number'){SBC_PHONE_RECOVERY.flag(c,{at:now(),actor:callerId});c.verificationStatus='Needs Verification';}else if(TERMINAL_SALES_OUTCOMES.has(outcome)){",'sales-disposition');
  const beforeLog="const previousAudit=(db.auditLog||[]).map(row=>({...row}));try{const b=req.body||{};";
  s=replaceOnce(s,beforeLog,"const previousAudit=(db.auditLog||[]).map(row=>({...row}));let sbcPhoneCustomer=null,sbcPhonePrior=null;try{const b=req.body||{};",'voice-backup');
  const outcome="const outcome=allowedOutcome.has(String(b.outcome||''))?String(b.outcome):String(log?.outcome||'Pending');const stamp=now();";
  const flag="if(customer&&!manualDial&&outcome==='Bad number'&&!SBC_PHONE_RECOVERY.isHeld(customer)){" +
    "sbcPhoneCustomer=customer;sbcPhonePrior={leadIntelligence:JSON.parse(JSON.stringify(customer.leadIntelligence||{})),salesQueueState:customer.salesQueueState,salesDisposition:customer.salesDisposition,salesNextAttemptAt:customer.salesNextAttemptAt,updatedAt:customer.updatedAt,verificationStatus:customer.verificationStatus};"+
    "SBC_PHONE_RECOVERY.flag(customer,{at:stamp,actor:String(req.user.id),callLogId:sessionId});customer.verificationStatus='Needs Verification';}";
  s=replaceOnce(s,outcome,outcome+flag,'voice-durable-phone-hold');
  const catchLog="catch(e){db.callLogs=previousLogs;db.activities=previousActivity;db.auditLog=previousAudit;";
  s=replaceOnce(s,catchLog,catchLog+"if(sbcPhoneCustomer&&sbcPhonePrior)Object.assign(sbcPhoneCustomer,sbcPhonePrior);",'voice-recovery-rollback');
  const report="db.callReports.unshift(r);if(String(r.outcome).trim().toLowerCase()==='do not call'){";
  s=replaceOnce(s,report,"db.callReports.unshift(r);if(String(r.outcome).trim().toLowerCase()==='bad number'){SBC_PHONE_RECOVERY.flag(c,{at:now(),actor:String(req.user.id)});c.verificationStatus='Needs Verification';}if(String(r.outcome).trim().toLowerCase()==='do not call'){",'workforce-call-report');
  const lornaRequest="if(p==='/api/v9/lead-verification')return m==='GET';";
  s=replaceOnce(s,lornaRequest,lornaRequest+"\n if(p==='/api/v9/phone-recovery')return m==='GET';\n if(m==='POST'&&/^\\/api\\/v9\\/phone-recovery\\/[^/]+\\/review$/.test(p))return true;",'lorna-recovery-access');
    const gate="const verdict=SBC_V6699_OUTBOUND_AUTH.authorize({from:req.body?.From,to:req.body?.To||req.body?.to,users:db.users||[],customers:db.customers||[],canLiveCall:v9CanLiveCall});";
  s=replaceOnce(s,gate,"const verdict=SBC_V6699_OUTBOUND_AUTH.authorize({from:req.body?.From,to:req.body?.To||req.body?.to,users:db.users||[],customers:db.customers||[],canLiveCall:v9CanLiveCall,badCallLogs:db.callLogs||[]});",'voice-signed-callback-hold');
  const ack="res.status(isNew?201:200).json({ok:true,durable:true,id:log.id,sessionId:log.sessionId,status:log.status,updatedAt:log.updatedAt})";
  s=replaceOnce(s,ack,"res.status(isNew?201:200).json({ok:true,durable:true,id:log.id,sessionId:log.sessionId,status:log.status,updatedAt:log.updatedAt,phoneHoldApplied:!!customer&&SBC_PHONE_RECOVERY.isHeld(customer)})",'voice-phone-hold-receipt');
  const beforeVerify="app.post('/api/v9/assign',auth,ownerOnly,async(req,res)=>{";
  const routes=[
    "// SBC PHONE RECOVERY: owner/researcher scoped. No phone calls or AI requests.",
    "app.get('/api/v9/phone-recovery',auth,(req,res)=>{",
    " try{const researcher=sbcLornaRole(req.user),owner=['owner','manager'].includes(String(req.user.role));",
    " if(!researcher&&!owner)return res.status(403).json({ok:false,error:'PHONE_RECOVERY_ROLE_DENIED'});",
    " const tenantId=requireRequestTenant(req),at=now();",
    " const rows=(db.customers||[]).filter(c=>Number(c.tenantId??c.tenant_id)===Number(tenantId)).filter(c=>{",
    "  if(!researcher)return true;",
    "  return [c.researcherId,c.leadIntelligence?.researchSubmittedBy].some(idv=>String(idv||'')===String(req.user.id));",
    " }).map(c=>{const p=SBC_PHONE_RECOVERY.recovery(c)||SBC_PHONE_RECOVERY.fromLogs(c,db.callLogs||[]);",
    "  return {id:String(c.id),businessName:String(c.businessName||'').slice(0,220),phone:String(c.phone||''),",
    "   state:String(p?.state||''),reviewAt:String(p?.reviewAt||''),flaggedAt:String(p?.flaggedAt||''),",
    "   candidatePhone:owner?String(p?.candidatePhone||''):'',candidateSource:owner?String(p?.candidateSource||''):'',",
    "   due:!!p&&p.state==='HOLD'&&Date.parse(p.reviewAt)<=Date.parse(at),",
    "   needsOwner:!!p&&p.state==='OWNER_REVIEW'};",
    " }).filter(c=>owner?(['HOLD','OWNER_REVIEW','ARCHIVED'].includes(c.state)):(c.due&&c.state==='HOLD')).slice(0,200);",
    " res.setHeader('Cache-Control','no-store');res.json({ok:true,rows,policy:{reviewDays:15,maxResearchMinutes:5,automaticRedial:false}});",
    " }catch(e){res.status(503).json({ok:false,error:'PHONE_RECOVERY_READ_UNAVAILABLE'});}",
    "});",
    "app.post('/api/v9/phone-recovery/:id/review',auth,async(req,res)=>{",
    " try{const researcher=sbcLornaRole(req.user),owner=['owner','manager'].includes(String(req.user.role));",
    " if(!researcher&&!owner)return res.status(403).json({ok:false,error:'PHONE_RECOVERY_ROLE_DENIED'});",
    " const tenantId=requireRequestTenant(req);const c=(db.customers||[]).find(x=>String(x.id)===String(req.params.id)&&Number(x.tenantId??x.tenant_id)===Number(tenantId));",
    " if(!c)return res.status(404).json({ok:false,error:'PHONE_RECOVERY_LEAD_NOT_FOUND'});",
    " if(researcher&&![c.researcherId,c.leadIntelligence?.researchSubmittedBy].some(idv=>String(idv||'')===String(req.user.id)))return res.status(403).json({ok:false,error:'PHONE_RECOVERY_NOT_YOUR_RESEARCH'});",
    " const existing=SBC_PHONE_RECOVERY.recovery(c);const old=JSON.parse(JSON.stringify(c));",
    " if(!existing){const derived=SBC_PHONE_RECOVERY.fromLogs(c,db.callLogs||[]);if(!derived)return res.status(409).json({ok:false,error:'PHONE_RECOVERY_NOT_FLAGGED'});c.leadIntelligence={...(c.leadIntelligence||{}),phoneRecovery:derived};}",
    " const result=SBC_PHONE_RECOVERY.review(c,{outcome:req.body?.outcome,candidatePhone:req.body?.candidatePhone,source:req.body?.source,notes:req.body?.notes,actor:req.user.id,at:now()});",
    " try{await saveData()}catch(e){Object.assign(c,old);throw e}",
    " audit(req.user,'phone_recovery_review','Phone recovery reviewed; no automatic redial',{customerId:c.id,state:result.state});",
    " res.json({ok:true,id:c.id,state:result.state,automaticRedial:false});",
    " }catch(e){res.status(/PHONE_RECOVERY_NOT_DUE|PHONE_RECOVERY_INVALID|PHONE_RECOVERY_NEW_NUMBER|PHONE_RECOVERY_NOT_FLAGGED/.test(String(e.message))?409:503).json({ok:false,error:String(e.message||'PHONE_RECOVERY_REVIEW_FAILED')});}",
    "});",
    "app.post('/api/v9/phone-recovery/:id/approve',auth,ownerOnly,async(req,res)=>{",
    " try{const tenantId=requireRequestTenant(req),c=(db.customers||[]).find(x=>String(x.id)===String(req.params.id)&&Number(x.tenantId??x.tenant_id)===Number(tenantId));",
    " if(!c)return res.status(404).json({ok:false,error:'PHONE_RECOVERY_LEAD_NOT_FOUND'});",
    " const old=JSON.parse(JSON.stringify(c));const result=SBC_PHONE_RECOVERY.approve(c,{actor:req.user.id,at:now()});",
    " try{await saveData()}catch(e){Object.assign(c,old);throw e}",
    " audit(req.user,'phone_recovery_approved','Owner approved a sourced replacement phone',{customerId:c.id});",
    " res.json({ok:true,id:c.id,state:result.state,phone:c.phone,autoCalled:false});",
    " }catch(e){res.status(409).json({ok:false,error:String(e.message||'PHONE_RECOVERY_APPROVAL_FAILED')});}",
    "});"
  ].join('\n')+'\n';
  s=replaceOnce(s,beforeVerify,routes+beforeVerify,'researcher-and-owner-routes');
  return s;
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),original=fs.readFileSync(file,'utf8'),staged=patchServer(original);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66137_ISOLATED_STAGE!=='YES')throw Error('PHONE_RECOVERY_STAGE_ONLY');
  fs.writeFileSync(file,staged);console.log('[SBC V66.137] Phone hold, queue gate, Lorna review routes staged');
 }else console.log('[SBC V66.137] exact-anchor preflight PASS; no files modified');
}
module.exports={patchServer,MARK};

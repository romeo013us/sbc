'use strict';
/* Staging ONLY: patch the isolated signed GoDaddy candidate server. Never write
   canonical server.js, bypass tenant/auth/writer lease, or alter checkout rails. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66163_OWNER_TRUSTED_RESEARCH';
const ENTRY="app.post('/api/workforce/leads',auth,async(req,res)=>{";
const RESEARCH="  c.leadIntelligence.researchSubmittedBy=String(req.user.id);";
const QUEUE="enqueueLeadAssist(c.id,'lead_submission','high');";
function patchServer(input){
 let s=String(input||'');
 if(s.includes('//'+MARK))return s;
 if(!s.includes(ENTRY)||!s.includes(RESEARCH)||!s.includes('SBC_V6649_REQUIRE_WRITER')||
 !s.includes("async function processLeadAssistQueue("))throw Error('TRUSTED_RESEARCH_UNSUPPORTED_SERVER');
 if(s.split(ENTRY).length!==2||s.split(RESEARCH).length!==2)throw Error('TRUSTED_RESEARCH_ANCHOR_NOT_UNIQUE');
 const registration=[
 '//'+MARK,
 "const SBC_TRUSTED_LEADS=require('./enterprise/sbc-trusted-research-v1.cjs');",
 "require('./routes/sbc-owner-trusted-leads-v1.cjs').register(app,{",
 ' auth,ownerOnly,',
 ' getContext:()=>({db,mysqlPool,recoveryRequired:()=>MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED}),',
 ' tenantForRead:req=>requireRequestTenant(req),',
 ' writer:()=>SBC_V6649_REQUIRE_WRITER(),',
 ' audit',
 '});',
 ''
 ].join('\n');
 s=s.replace(ENTRY,registration+ENTRY);
 s=s.replace(RESEARCH,RESEARCH+"\n  if(SBC_TRUSTED_LEADS.isLorna(req.user))SBC_TRUSTED_LEADS.trust(c,{actorId:req.user.id,basis:'LORNA_RESEARCH_SUBMISSION'});");
 if(s.split(QUEUE).length<3)throw Error('TRUSTED_RESEARCH_QUEUE_ANCHOR_MISSING');
 s=s.replaceAll(QUEUE,"if(!SBC_TRUSTED_LEADS.isTrusted(c))"+QUEUE);
 const processing="for(const job of work){const c=(db.customers||[]).find(x=>String(x.id)===String(job.customerId));if(!c){job.status='SKIPPED';job.error='Lead no longer exists.';continue;}job.status='PROCESSING';";
 const guarded="for(const job of work){const c=(db.customers||[]).find(x=>String(x.id)===String(job.customerId));if(!c){job.status='SKIPPED';job.error='Lead no longer exists.';continue;}if(SBC_TRUSTED_LEADS.isTrusted(c)){job.status='SKIPPED';job.reason='OWNER_TRUSTED_RESEARCH';job.updatedAt=now();continue;}job.status='PROCESSING';";
 if(s.split(processing).length!==2)throw Error('TRUSTED_RESEARCH_WORKER_ANCHOR');
 s=s.replace(processing,guarded);
 const response="leadAssist:{status:'QUEUED',message:'Saved in SBC CRM. Automatic Lead Assist verification queued.'},message:'Lead saved to the central SBC CRM and queued for automatic verification.'";
 const newResponse="leadAssist:SBC_TRUSTED_LEADS.isTrusted(c)?{status:'OWNER_TRUSTED_RESEARCH',message:'Lorna research accepted by owner policy. No second verification requested.'}:{status:'QUEUED',message:'Saved in SBC CRM. Automatic Lead Assist verification queued.'},message:SBC_TRUSTED_LEADS.isTrusted(c)?'Lead saved as owner-trusted research. Outreach remains separately controlled.':'Lead saved to the central SBC CRM and queued for automatic verification.'";
 if(s.split(response).length!==2)throw Error('TRUSTED_RESEARCH_RESPONSE_ANCHOR');
 s=s.replace(response,newResponse);
 return s;
}
if(require.main===module){
 const target=path.resolve(__dirname,'../server.js'),before=fs.readFileSync(target,'utf8'),after=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66163_ISOLATED_STAGE!=='YES')throw Error('TRUSTED_RESEARCH_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(target,after);
 }
 if(process.argv.includes('--verify-staged')&&before!==after)throw Error('TRUSTED_RESEARCH_NOT_STAGED');
 console.log('[SBC V66.163] '+(before===after?'ALREADY_STAGED':'SOURCE_READY'));
}
module.exports={MARK,patchServer};

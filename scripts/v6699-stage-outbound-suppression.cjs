'use strict';
/* V66.99 stage-only patch: preserve live Published data and existing Twilio flow.
 * Applies to disposable staged flat server.js after V66.97.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V6699_SIGNED_VOICE_SUPPRESSION';
function replaceOnce(s,needle,updated,tag){
 const count=s.split(needle).length-1;
 if(count!==1)throw Error('V6699_STAGE_ANCHOR_'+tag+'_'+count);
 return s.replace(needle,updated);
}
function patchServer(input){
 let s=String(input||'');const existing=s.includes(MARK);
 if(!existing){
 const route="app.post('/api/voice/twiml',sbcSignedTwimlV6619,(req,res)=>{";
 const reject="const SBC_V6699_OUTBOUND_AUTH=require('./enterprise/v6699-outbound-authorization.cjs');\n"+
  "// "+MARK+": signed Twilio callback performs fresh role, assignment and DNC validation.\n"+
  route+"const verdict=SBC_V6699_OUTBOUND_AUTH.authorize({from:req.body?.From,to:req.body?.To||req.body?.to,users:db.users||[],customers:db.customers||[],canLiveCall:v9CanLiveCall});"+
  "if(!verdict.allowed){console.warn('[SBC VOICE] blocked outbound request',verdict.code);return res.status(403).type('text/xml').send('<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say>This call is not permitted.</Say></Response>');}";
 s=replaceOnce(s,route,reject,'signed-callback');
 const from="function v9CustomerFor(u,idv){const c=db.customers.find(x=>String(x.id)===String(idv));if(!c)return null;if(u.role==='owner'||!c.assignedTo||c.assignedTo===u.id)return c;return null}";
 const to="function v9CustomerFor(u,idv){const c=db.customers.find(x=>String(x.id)===String(idv));if(!c)return null;"+
   "if(u.role==='caller')return String(c.assignedTo||'')===String(u.id)&&Number(c.tenantId??c.tenant_id)===Number(u.tenantId??u.tenant_id)?c:null;"+
   "if(u.role==='owner'||!c.assignedTo||c.assignedTo===u.id)return c;return null}";
 s=replaceOnce(s,from,to,'caller-lead-scope');
 const start=s.indexOf("app.post('/api/v9/call-report',auth,async(req,res)=>{"),end=s.indexOf("app.post('/api/v9/call-report/:id/approve'",start);
 if(start<0||end<0)throw Error('V6699_CALL_REPORT_MISSING');
 let report=s.slice(start,end);
 const old="db.callReports.unshift(r);if(b.websiteDemoUrl)";
 const updated="db.callReports.unshift(r);"+
  "if(String(r.outcome).trim().toLowerCase()==='do not call'){"+
  "c.doNotContact=true;c.salesSuppressed=true;c.status='Do Not Call';c.updatedAt=now();"+
  "audit(req.user,'dnc_suppression_requested','Customer requested no more sales calls',{customerId:c.id,callReportId:r.id});"+
  "}if(b.websiteDemoUrl)";
 report=replaceOnce(report,old,updated,'durable-dnc-report');
 report=replaceOnce(report,
  "}if(b.websiteDemoUrl)",
  "}if(b.websiteDemoUrl&&!c.doNotContact&&!c.salesSuppressed)",'do-not-create-demo-on-dnc');
 s=s.slice(0,start)+report+s.slice(end);
 }
 const approvalMark='SBC_V66100_DNC_APPROVAL_GUARD';
 if(s.includes(approvalMark))return s;
 const approveStart=s.indexOf("app.post('/api/v9/call-report/:id/approve'");
 const approveEnd=s.indexOf("app.post('/api/v9/users/:id/reset-certification'",approveStart);
 if(approveStart<0||approveEnd<=approveStart)throw Error('V6699_REPORT_APPROVAL_MISSING');
 let approval=s.slice(approveStart,approveEnd);
 approval=replaceOnce(approval,
 "if(r.outcome==='Interested'||r.outcome==='Appointment Requested'||r.orderReady)c.status=",
 "/*SBC_V66100_DNC_APPROVAL_GUARD*/if(!c.doNotContact&&!c.salesSuppressed&&String(c.status||'').trim().toLowerCase()!=='do not call'&&(r.outcome==='Interested'||r.outcome==='Appointment Requested'||r.orderReady))c.status=",
 'do-not-reactivate-suppressed-lead');
 approval=replaceOnce(approval,"if(r.callbackAt)c.followUp=","if(r.callbackAt&&!c.doNotContact&&!c.salesSuppressed)c.followUp=",'no-dnc-followup');
 approval=replaceOnce(approval,"if(r.callbackAt){const m=megaData();","if(r.callbackAt&&!c.doNotContact&&!c.salesSuppressed){const m=megaData();",'no-dnc-callback-work');
 approval=replaceOnce(approval,"if(r.websiteDemoUrl){const v=v9data();","if(r.websiteDemoUrl&&!c.doNotContact&&!c.salesSuppressed){const v=v9data();",'do-not-send-demo-after-dnc');
 return s.slice(0,approveStart)+approval+s.slice(approveEnd);
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),file=path.join(root,'server.js'),previous=fs.readFileSync(file,'utf8');
 const out=patchServer(previous);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V6699_ISOLATED_STAGE!=='YES')throw Error('V6699_STAGE_ONLY');
  fs.writeFileSync(file,out);
  console.log('[V66.99] Signed Twilio caller auth, assigned-only lead lookup and immediate DNC suppression staged');
 }else console.log('[V66.99] patch preflight PASS (no writes)');
}
module.exports={MARK,patchServer};

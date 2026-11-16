/* SBC Prospect Intelligence Workforce V2 · owner-attested public findings, no customer data sync. */
(function(root){
 'use strict';
 const SCHEMA='SBC-PROSPECT-HANDOFF-V2';
 const REVIEW='owner_marked_not_cryptographically_signed';
 const SOURCE='Google PageSpeed Insights (Lighthouse lab)';
 const MAX_AGE_MS=30*86400000;
 const ALLOWED_ROLES=new Set(['lead_researcher','researcher','lead_generator','prospector','caller','account_manager','owner']);
 const SCORE_KEYS=['performance','accessibility','seo','bestPractices'];
 const FINDING_RESULTS=new Set(['pass','opportunity','unverified']);
 const ISSUES=/(?:\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?:\+?1[\s().-]*)?\b\d{3}[\s().-]*\d{3}[\s.-]*\d{4}\b|(?:\b(?:password|secret|token|api[_-]?key)\s*[:=]\s*\S+))/i;
 const keysExact=(obj,allowed)=>Object.keys(obj||{}).every(x=>allowed.includes(x));
 function failure(code){throw Error(code)}
 function trim(value,n=180){
  if(typeof value!=='string')return '';
  return value.trim().replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').slice(0,n);
 }
 function text(value,n=180){const s=trim(value,n);if(ISSUES.test(s))failure('HANDOFF_SENSITIVE_TEXT');return s}
 function publicUrl(value){
  if(!value)return '';
  try{
   const u=new URL(value);
   const host=u.hostname.toLowerCase().replace(/\.$/,'');
   const labels=host.split('.');
   if(u.protocol!=='https:'||u.username||u.password||u.port||labels.length<2||labels.some(x=>!x||!(/^[a-z0-9-]+$/.test(x))||x.startsWith('-')||x.endsWith('-')))failure('BAD');
   if(!/^[a-z]{2,63}$/.test(labels.at(-1))||host==='localhost'||/\.(?:local|internal|localhost|invalid|test)$/.test(host)||/^\d+\.\d+\.\d+\.\d+$/.test(host))failure('BAD');
   return 'https://'+host+'/';
  }catch{failure('HANDOFF_PUBLIC_HTTPS_REQUIRED')}
 }
 function iso(value){const at=typeof value==='number'?value:Date.parse(value);if(!Number.isFinite(at))failure('HANDOFF_INVALID_DATE');return new Date(at).toISOString()}
 function scores(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||!keysExact(input,SCORE_KEYS))failure('HANDOFF_BAD_SCORES');
  return Object.fromEntries(SCORE_KEYS.map(key=>{
   const n=input[key];if(n!==null&&n!==undefined&&(!Number.isInteger(n)||n<0||n>100))failure('HANDOFF_BAD_SCORES');
   return [key,n==null?null:n];
  }));
 }
 function finding(row){
  if(!row||typeof row!=='object'||Array.isArray(row))failure('HANDOFF_BAD_FINDING');
  if(!keysExact(row,['id','label','result','source']))failure('HANDOFF_BAD_FINDING');
  if(!FINDING_RESULTS.has(row.result))failure('HANDOFF_BAD_FINDING');
  const id=text(row.id,50),label=text(row.label,85);
  if(!/^[a-z0-9-]{2,50}$/.test(id)||!label)failure('HANDOFF_BAD_FINDING');
  return {id,label,result:row.result,source:SOURCE};
 }
 function compactAudit(input,kind='main'){
  if(!input||input.status!=='measured'){
   return {status:'unavailable',website:'',source:SOURCE,measuredAt:null,scores:null,findings:[]};
  }
  const website=publicUrl(input.website);
  if(!website||input.source!==SOURCE)failure('HANDOFF_BAD_SOURCE');
  const data={status:'measured',website,source:SOURCE,measuredAt:iso(input.measuredAt),scores:scores(input.scores),findings:[]};
  if(!Array.isArray(input.findings)||input.findings.length>24)failure('HANDOFF_BAD_FINDING');
  data.findings=input.findings.slice(0,10).map(finding);
  return data;
 }
 function createPacket({business={},audit,competitors=[],ownerApproved=false,preparedAt=Date.now()}={}){
  if(ownerApproved!==true)failure('OWNER_REVIEW_REQUIRED');
  const businessName=text(business.businessName,140);
  if(!businessName)failure('HANDOFF_BUSINESS_REQUIRED');
  const details={businessName,industry:text(business.industry,100),website:publicUrl(business.website)};
  const time=iso(preparedAt);
  if(!Array.isArray(competitors)||competitors.length>2)failure('HANDOFF_TOO_MANY_COMPETITORS');
  return {
   schema:SCHEMA,reviewStatus:REVIEW,preparedAt:time,
   business:details,audit:compactAudit(audit),competitors:competitors.map(x=>compactAudit(x,'competitor')),
   limitations:'Owner-marked document, not cryptographically signed. No CRM contacts, payments, consent or assignments included. Confirm source and identity before use.'
  };
 }
 function validatePacket(content,now=Date.now()){
  if(typeof content!=='string'||content.length>30000)failure('HANDOFF_TOO_LARGE');
  let raw;try{raw=JSON.parse(content)}catch{failure('HANDOFF_INVALID_JSON')}
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!keysExact(raw,['schema','reviewStatus','preparedAt','business','audit','competitors','limitations']))
   failure('HANDOFF_SCHEMA_INVALID');
  if(raw.schema!==SCHEMA||raw.reviewStatus!==REVIEW)failure('HANDOFF_SCHEMA_INVALID');
  if(!raw.business||!keysExact(raw.business,['businessName','industry','website']))failure('HANDOFF_SCHEMA_INVALID');
  const when=Date.parse(raw.preparedAt),time=Number(now);
  if(!Number.isFinite(when)||!Number.isFinite(time)||when>time+300000||time-when>MAX_AGE_MS)failure('HANDOFF_EXPIRED_OR_FUTURE');
  for(const value of [raw.audit,...(Array.isArray(raw.competitors)?raw.competitors:[])]){
   if(!value||typeof value!=='object'||!keysExact(value,['status','website','source','measuredAt','scores','findings']))failure('HANDOFF_SCHEMA_INVALID');
   if(value.status==='measured'){
    if(value.source!==SOURCE||!Array.isArray(value.findings)||value.findings.length>10)failure('HANDOFF_SCHEMA_INVALID');
    for(const item of value.findings)if(!keysExact(item,['id','label','result','source']))failure('HANDOFF_SCHEMA_INVALID');
   }
  }
  const normalized=createPacket({business:raw.business,audit:raw.audit,competitors:raw.competitors,ownerApproved:true,preparedAt:when});
  if(JSON.stringify(normalized)!==JSON.stringify(raw))failure('HANDOFF_SCHEMA_INVALID');
  return normalized;
 }
 function opportunities(packet){
  return packet.audit.status==='measured'?packet.audit.findings.filter(x=>x.result==='opportunity').map(x=>x.label).slice(0,4):[];
 }
 function scoreLabel(packet){
  const s=packet.audit.scores;
  if(!s)return 'Website measurement unavailable';
  return SCORE_KEYS.map(k=>k+': '+(s[k]===null?'not verified':s[k]+'/100')).join(' · ');
 }
 function createOutreachDraft(packet,{contactPermission='unknown'}={}){
  if(contactPermission==='opt_out')return 'DO NOT CONTACT: Suppression or opt-out indicated. Do not draft or send an outreach message.';
  if(contactPermission!=='owner_confirmed_permission')return 'Review permission and applicable outreach rules with the owner before drafting or sending any business message. No message has been sent.';
  const issue=opportunities(packet)[0];
  return [
   'DRAFT ONLY — OWNER REVIEW REQUIRED — DO NOT AUTO-SEND',
   'Subject: A website opportunity for '+packet.business.businessName,
   'Hello,',
   'I work with Successful By Choice, helping businesses improve their websites and digital presence.',
   issue?'An initial public Lighthouse scan suggested reviewing '+issue.toLowerCase()+'.':'If you are interested, we can review your website and discuss practical improvements.',
   issue?'Source: '+packet.audit.website+' · Google PageSpeed Insights (Lighthouse lab), measured '+packet.audit.measuredAt+'.':'No website deficiencies have been verified.',
   'Would a short conversation be useful?',
   'SBC — Because Why Not?',
   'This is a draft only. Check consent, business identity, source freshness, and accuracy before any communication.'
  ].join('\n\n');
 }
 function buildRoleBrief(packet,role){
  if(!ALLOWED_ROLES.has(role))failure('ROLE_NOT_SUPPORTED');
  const research=['RESEARCH CHECKLIST','Confirm this company matches the assigned CRM account before entering anything.','Confirm the public website and audit timestamp.','Verify business identity, existing website ownership, contact permissions and basic services.','Send any corrections to the owner for review.'];
  const sales=['CALL PREPARATION — NO OUTREACH AUTHORIZATION','Check account assignment and do-not-contact status in Command Center before calling.','Verify contact details through the existing authorized workflow.','Ask the business what outcome they value most; do not promise rankings or conversions.','Use the audit findings only as discussion points after confirmation.'];
  const manager=['ACCOUNT EXPANSION — CUSTOMER REVIEW','Confirm this is an assigned customer and check current SBC orders/subscriptions.','Discuss measured opportunities as optional improvements, not confirmed deficiencies.','Confirm project scope, owner approval, vendor costs and recurring billing separately.','Avoid duplicate products or unsolicited renewal outreach.'];
  const tasks=role==='caller'?sales:role==='account_manager'?manager:role==='owner'?
   [...research,...sales.slice(1),...manager.slice(1)]:research;
  const issues=opportunities(packet);
  const comparison=packet.competitors.filter(x=>x.status==='measured').map(x=>
   x.website+' · mobile performance '+(x.scores.performance===null?'not verified':x.scores.performance+'/100')+
   ' · SEO '+(x.scores.seo===null?'not verified':x.scores.seo+'/100'));
  return [
   'SUCCESSFUL BY CHOICE · PROSPECT RESEARCH HANDOFF',
   'Prepared: '+packet.preparedAt,
   'Owner-marked research file; NOT cryptographically signed or an authorization to contact anyone.',
   'Business: '+packet.business.businessName,
   'Industry: '+(packet.business.industry||'not verified'),
   'Public website: '+(packet.business.website||'not verified'),
   'Source: '+SOURCE,
   packet.audit.status==='measured'?'Audit measured: '+packet.audit.measuredAt:'Audit: unavailable / not verified',
   'Lighthouse lab: '+scoreLabel(packet),
   'Observed opportunities: '+(issues.join('; ')||'No verified website issues available.'),
   'Competitor comparison (user-supplied websites, not a market ranking):',
   ...(comparison.length?comparison:['Not verified: no competitor website measurement in this packet.']),
   '',
   ...tasks,
   'Approval: VERIFY THE SOURCE WITH OWNER. No CRM notes, calling, texting, email, orders, or payment may be executed by this file.',
   'Method limit: this packet does not establish search rankings, sales conversions, competitive market share or Google Business Profile status.'
  ].join('\n');
 }
 const api=Object.freeze({createPacket,validatePacket,buildRoleBrief,createOutreachDraft,SCHEMA});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(!root||!root.document)return;
 root.SBCProspectHandoffV2=api;
 const doc=root.document;
 const roleForPage=()=>{
  const url=String(root.location?.pathname||'');
  if(/lead-research\.html$/.test(url))return new Set(['lead_researcher','researcher','lead_generator','prospector']);
  if(/sales-caller\.html$/.test(url))return new Set(['caller','owner']);
  if(/sbc-account-manager-v1\.html$/.test(url))return new Set(['owner','account_manager']);
  return null;
 };
 if(!roleForPage())return;
 let launcher=null,dialog=null,record=null,role='',ownerSession='';
 function safeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
 function status(t,bad=false){const el=doc.getElementById('sbc-handoff-msg');if(el){el.textContent=t;el.dataset.error=bad?'true':'false'}}
 function preview(){
  if(!record||!dialog)return;
  const summary=doc.getElementById('sbc-handoff-summary');
  summary.textContent='Owner-marked document: '+record.business.businessName+' · '+record.preparedAt+' · '+(record.audit.status==='measured'?'measured site audit':'no verified audit');
  doc.getElementById('sbc-handoff-brief').value=buildRoleBrief(record,role);
  doc.getElementById('sbc-handoff-outreach').value=createOutreachDraft(record,{contactPermission:doc.getElementById('sbc-handoff-permission').value});
 }
 function download(textValue){
  const blob=new Blob([textValue],{type:'text/plain;charset=utf-8'});
  const href=URL.createObjectURL(blob),a=doc.createElement('a');a.download='SBC-Research-Role-Brief.txt';a.href=href;a.click();root.setTimeout(()=>URL.revokeObjectURL(href),2000);
 }
 function setup(){
  if(dialog)return;
  dialog=doc.createElement('dialog');dialog.id='sbc-prospect-handoff-panel';dialog.setAttribute('aria-labelledby','sbc-handoff-title');
  dialog.innerHTML='<div class="sbc-handoff-head"><h2 id="sbc-handoff-title">✦ SBC Research Handoff</h2><button type="button" id="sbc-handoff-close" aria-label="Close without losing imported research">×</button></div>'+
   '<div class="sbc-handoff-body"><p>Use owner-reviewed public research across your assigned workflow. This does not open CRM accounts, send outreach, or call any AI provider.</p>'+
   '<p class="sbc-handoff-warning">Owner-marked files are <strong>not digitally signed</strong>. Confirm their source with the owner; imported data does not grant access to customers or permission to contact them.</p>'+
   '<label>Import research packet (JSON, up to 30 KB)<input id="sbc-handoff-file" type="file" accept=".json,application/json"></label>'+
   '<label>Confirm the business name from your assigned workspace<input id="sbc-handoff-confirm" type="text" autocomplete="off" maxlength="140" placeholder="Type the exact business name in the research packet"></label>'+
   '<p id="sbc-handoff-msg" role="status" aria-live="polite"></p>'+
   '<div id="sbc-handoff-result" hidden><p id="sbc-handoff-summary"></p>'+
   '<label>Role-specific research and sales brief<textarea id="sbc-handoff-brief" rows="13" readonly></textarea></label>'+
   '<label>Contact permission from existing authorized CRM process<select id="sbc-handoff-permission"><option value="unknown">Unknown — do not contact</option><option value="opt_out">Opted out / suppressed</option><option value="owner_confirmed_permission">Owner-confirmed permission — draft only</option></select></label>'+
   '<label>Owner-review outreach draft<textarea id="sbc-handoff-outreach" rows="9" readonly></textarea></label>'+
   '<div class="sbc-handoff-actions"><button type="button" id="sbc-handoff-copy">Copy role brief</button><button type="button" id="sbc-handoff-download">Download role brief</button><button type="button" id="sbc-handoff-reset">Clear imported research</button></div></div></div>';
  doc.body.appendChild(dialog);
  doc.getElementById('sbc-handoff-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(launcher)launcher.textContent=record?'↶ Resume Research Brief':'✦ Research Intelligence'});
  doc.getElementById('sbc-handoff-permission').addEventListener('change',preview);
  doc.getElementById('sbc-handoff-file').addEventListener('change',async e=>{
   const picked=e.target.files?.[0];if(!picked)return;
   record=null;doc.getElementById('sbc-handoff-result').hidden=true;
   if(picked.size>30000||picked.size<10){status('Research file size invalid; maximum 30 KB.',true);return}
   try{
    const text=await picked.text(),newRecord=validatePacket(text);
    record=newRecord;
    status('Packet structure validated. Type the exact business name and confirm this account is assigned to you.');
   }catch(ex){status(String(ex.message||'Invalid research file'),true)}
  });
  doc.getElementById('sbc-handoff-confirm').addEventListener('input',()=>{
   const name=doc.getElementById('sbc-handoff-confirm').value.trim();
   const matched=record&&name.toLocaleLowerCase()===record.business.businessName.toLocaleLowerCase();
   doc.getElementById('sbc-handoff-result').hidden=!matched;
   if(matched){preview();status('Business name matched the imported file. Verify assignment and source independently before use.')}
   else if(record)status('Type the exact business name shown in the research packet to unlock the role brief.');
  });
  doc.getElementById('sbc-handoff-copy').addEventListener('click',async()=>{
   try{await root.navigator.clipboard.writeText(doc.getElementById('sbc-handoff-brief').value);status('Brief copied for review; no CRM record changed.')}catch{status('Clipboard unavailable. Select text manually.',true)}
  });
  doc.getElementById('sbc-handoff-download').addEventListener('click',()=>download(doc.getElementById('sbc-handoff-brief').value));
  doc.getElementById('sbc-handoff-reset').addEventListener('click',()=>{
   if(record&&!root.confirm('Clear this imported research from the current session?'))return;
   record=null;doc.getElementById('sbc-handoff-file').value='';doc.getElementById('sbc-handoff-confirm').value='';
   doc.getElementById('sbc-handoff-result').hidden=true;status('Imported research cleared.');launcher.textContent='✦ Research Intelligence';
  });
 }
 function hide(){record=null;role='';ownerSession='';if(dialog){if(dialog.open)dialog.close();dialog.remove();dialog=null}if(launcher)launcher.hidden=true}
 async function checkRole(){
  try{
   const r=await root.fetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   const j=await r.json();const user=j.user||{},allowed=roleForPage();
   if(!r.ok||!(j.authenticated===true||j.ok===true)||!allowed.has(String(user.role||''))){hide();return}
   const nextSession=String(user.id||user.username||'')+'|'+String(user.tenantId??'');
   if(!String(user.id||user.username||'')){hide();return}
   if(ownerSession&&ownerSession!==nextSession){hide()}
   ownerSession=nextSession;role=user.role;
   if(!launcher){
    launcher=doc.createElement('button');launcher.type='button';launcher.id='sbc-prospect-handoff-launch';
    launcher.textContent='✦ Research Intelligence';launcher.hidden=true;doc.body.appendChild(launcher);
    launcher.addEventListener('click',()=>{setup();if(!dialog.open)dialog.showModal();});
   }
   launcher.hidden=false;
  }catch{hide()}
 }
 function init(){checkRole();doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')checkRole()})}
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:null);

/* SBC V66.21 — owner-only, read-only operational acceptance.
 * Evidence only: never auto-certify production, mutate records, initiate a charge
 * or call external website/Office Box handoffs. All requests use SBC auth.
 */
(function(){
 'use strict';
 if(window.__SBC_V6621_LAUNCH_READINESS__)return;
 window.__SBC_V6621_LAUNCH_READINESS__=true;
 const $=id=>document.getElementById(id);
 const owner=()=>String(window.state?.me?.role||'').toLowerCase()==='owner';
 const endpoints=[
  ['core','/api/owner/launch-gates'],
  ['staff','/api/users'],
  ['f4','/api/fantastic4/summary'],
  ['leads','/api/owner/lead-readiness?limit=0'],
  ['square','/api/payments/square/readiness']
 ];
 const text=(id,value)=>{const el=$(id);if(el)el.textContent=String(value);};
 const show=(name,status,detail)=>{
  text('sbc-launch-'+name,status);
  text('sbc-launch-'+name+'-detail',detail);
 };
 const number=x=>Number.isFinite(Number(x))?Number(x):0;
 function interpret(name,result){
  if(name==='core'){
   const c=result?.checks||{};
   const ok=result?.coreWritePrerequisitesVerified===true;
   return [ok?'Core write prerequisites observed':'Needs verification',
    'MySQL '+(c.mysqlReachable?'reachable':'not confirmed')+
    ' · Writer lease '+(c.writerLeaseSessionVerified?'verified':'not verified')+
    ' · Recovery '+(c.recoveryEvaluated&&c.recoveryClear?'clear':'not clear')+
    ' · Customers '+(result?.records?.customers??'unknown')+
    '. A successful GET does NOT prove quote save or payment.'];
  }
  if(name==='staff'){
   const users=Array.isArray(result)?result:Array.isArray(result?.users)?result.users:[];
   const active=r=>r&&r.active!==false;
   const researcher=users.some(r=>active(r)&&['lead_researcher','lead_generator','researcher'].includes(String(r.role||'').toLowerCase()));
   const demo=users.some(r=>active(r)&&String(r.role||'').toLowerCase()==='demo');
   return [researcher&&demo?'Accounts identified · login untested':'Account setup needs review',
    'Active researcher role: '+(researcher?'found':'not confirmed')+
    ' · Demo role: '+(demo?'found':'not confirmed')+
    '. Sign in independently to prove role restrictions; this screen never tests passwords.'];
  }
  if(name==='f4'){
   const gates=result?.providerGates||{};
   const names=['wordpress','hosting','vault','edgeCache'];
   const present=names.filter(k=>gates[k]===true);
   return ['Configuration evidence only',
    'Configured provider flags: '+present.length+'/'+names.length+
    ' ('+(present.join(', ')||'none')+'). Separate live checks required for Office Box, sbcmia.com, sbcwebsites.com and payment handoffs.'];
  }
  if(name==='leads'){
   const delta=result?.tenantHydrationDelta;
   const status=delta==null?'MySQL count comparison unavailable':
    Number(delta)===0?'Research queue review':'Visible CRM count discrepancy — compare record IDs';
   const counts=result?.sqlVisibleTenantRecords==null?'':
    ' · Visible MySQL records '+number(result.sqlVisibleTenantRecords)+
    ' · Deleted records retained '+number(result.sqlDeletedRecordTombstones);
   return [status,
    'Loaded CRM records '+number(result?.totalTenantRecords)+counts+
    ' · Human-verified call candidates '+number(result?.verifiedHumanCallReady)+
    ' · Records needing verification '+number(result?.needsRecordVerification)+
    ' · Suppressed/terminal '+number(result?.suppressedOrTerminal)+
    '. Verification alone is not calling/SMS consent; no outreach was sent.'];
  }
  if(name==='square'){
   const s=result?.triage||{};
   const blockers=Array.isArray(s.blockers)?s.blockers.map(x=>String(x.code||'Unknown')).slice(0,5):[];
   return [result?.preflightReady===true?'Square preflight ready · no live proof':'Square preflight blocked',
    'Environment '+String(result?.environment||'unknown')+
    ' · '+(blockers.length?'Blockers: '+blockers.join(', '):'No configured blockers detected')+
    '. Review existing Square payment and signed webhook evidence. Verify customer fulfillment separately.'];
  }
  return ['Unverified','Unknown read-only endpoint'];
 }
 window.sbcOpenLaunchReadiness=async function(){
  if(!owner())return window.toast?.('Owner access required.');
  if(typeof window.openModal!=='function'||typeof window.api!=='function')return window.toast?.('Command Center is not ready.');
  const rows=[
   ['core','1 · Writer / CRM integrity'],
   ['staff','2 · Researcher and demo accounts'],
   ['f4','3 · Fantastic 4 configuration'],
   ['leads','4 · Human-reviewed sales pipeline'],
   ['square','1 + 4 · Square payment preflight']
  ];
  window.openModal('SBC Launch Readiness — evidence only',
   '<div class="sbc-launch-surface"><p class="mini sbc-launch-intro">Read-only verification. This does not change records, create payments, contact leads, unlock recovery, or certify 9.5. Preview is intentionally read-only.</p>'+
   rows.map(([key,title])=>'<div class="detail-box" style="margin:10px 0"><strong>'+
    title+'</strong><p id="sbc-launch-'+key+'" class="mini" role="status">Not checked</p>'+
    '<p id="sbc-launch-'+key+'-detail" class="mini"></p></div>').join('')+
   '<p id="sbc-launch-footer" class="mini" role="status">Starting owner-only read checks…</p>'+
   '<p class="mini"><strong>Acceptance evidence:</strong> Published release identity, CRM record readback, independent researcher and demo logins, existing Square payment and webhook records, Fantastic 4 handoff, backup restoration, and customer delivery.</p></div>');
  if(!owner()){text('sbc-launch-footer','Owner session no longer verified. No checks were run.');return}
  for(const [name,url] of endpoints){
   if(!owner()){text('sbc-launch-footer','Owner session changed. Checks stopped.');return}
   try{
    const result=await window.api(url,{method:'GET',timeoutMs:10000});
    if(result?.ok===false)throw Error('Backend response not ready');
    const [status,detail]=interpret(name,result);
    show(name,status,detail);
   }catch(e){
    show(name,'Not confirmed',String(e?.message||'Read-only endpoint unavailable').slice(0,170)+'. No changes made.');
   }
  }
  text('sbc-launch-footer','Read-only checks complete. Production is NOT certified until the manual acceptance evidence passes.');
 };
})();

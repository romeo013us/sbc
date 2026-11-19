/* SBC V66.21 — owner-only, read-only operational acceptance.
 * Evidence only: never auto-certify production, mutate records, initiate a charge
 * or trigger paid Office Box handoffs. The optional signed federation probe
 * is read-only and owner-initiated. All requests use SBC auth.
 */
(function(){
 'use strict';
 if(window.__SBC_V6621_LAUNCH_READINESS__)return;
 window.__SBC_V6621_LAUNCH_READINESS__=true;
 const $=id=>document.getElementById(id);
 const owner=()=>String(window.state?.me?.role||'').toLowerCase()==='owner';
 // Four customer-journey gates are deliberately separate from public health checks.
 // Read-only GETs can verify the shared Office Box signing channel but cannot
 // certify a customer payment, tenant isolation or database provisioning.
 const sbcFourGateVerdicts=Object.freeze({
  initial:()=>({inquiry:{certified:false},portal:{certified:false},
    square:{certified:false},activation:{certified:false}}),
  federation:r=>({
   transportVerified:Boolean(r?.ok===true&&r?.authenticated===true&&r?.readOnly===true&&
    r?.chargeAmount===0&&r?.providerRequests===0&&r?.activationCreated===false&&
    r?.tenantCreated===false&&r?.entitlementChanged===false&&r?.ack==='ACTIVATION_NOT_FOUND'),
   activationCertified:false
  }),
  portal:r=>({accountCount:Array.isArray(r?.accounts)?r.accounts.length:null,
   loginCertified:false,tenantIsolationCertified:false}),
  square:r=>({preflightReady:r?.ok===true&&r?.preflightReady===true,
   providerPaymentCertified:false,duplicatePaymentCertified:false})
 });
 // No credentials or customer records are exported by this testable proof classifier.
 window.sbcFourGateVerdicts=sbcFourGateVerdicts;
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
   const temperatureObserved=Number.isFinite(Number(result?.temperaturePresent))&&
     Number.isFinite(Number(result?.temperatureMissing))&&typeof result?.temperatureCoverageState==='string';
   const missingAll=temperatureObserved&&result.temperatureCoverageState==='NONE_IN_SNAPSHOT'&&number(result.totalTenantRecords)>0;
   const discrepancy=delta!=null&&Number(delta)!==0;
   const status=discrepancy?'Visible CRM count discrepancy — compare record IDs':
     missingAll?'Lead temperature fields absent from snapshot':
     delta==null?'MySQL count comparison unavailable':'Research queue review';
   const tempEvidence=temperatureObserved?
     ' · Temperature assigned '+number(result.temperaturePresent)+'/'+number(result.totalTenantRecords)+
     (missingAll?' (no temperatures in this snapshot; not evidence of deleted leads)':''):'';
   const counts=result?.sqlVisibleTenantRecords==null?'':
    ' · Visible MySQL records '+number(result.sqlVisibleTenantRecords)+
    ' · Deleted records retained '+number(result.sqlDeletedRecordTombstones);
   return [status,
    'Loaded CRM records '+number(result?.totalTenantRecords)+counts+
    ' · Human-verified call candidates '+number(result?.verifiedHumanCallReady)+
    ' · Records needing verification '+number(result?.needsRecordVerification)+
    ' · Suppressed/terminal '+number(result?.suppressedOrTerminal)+tempEvidence+
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
   '<section aria-label="Four live customer-journey acceptance gates" style="border-top:1px solid var(--border,#64748b);padding-top:16px;margin-top:16px">'+
   '<h3>Final 4 · Customer journey verification</h3>'+
   '<p class="mini">Actual paid transactions and private customer records are never created by this checker. Each gate stays unverified until independent live evidence exists.</p>'+
   '<div class="detail-box" style="margin:10px 0"><strong>1 · Inquiry persistence</strong><p id="sbc-four-inquiry" role="status">NOT CERTIFIED · Submit a clearly labeled owner QA inquiry from <a target="_blank" rel="noopener noreferrer" href="https://sbcmia.com/contact.php">SBCMIA Contact</a> and verify its exact ID in the correct CRM tenant. This checker does not create fake leads.</p></div>'+
   '<div class="detail-box" style="margin:10px 0"><strong>2 · Customer tenant isolation</strong><p id="sbc-four-portal" role="status">NOT CERTIFIED · Sign into two independent test customer accounts and confirm each sees only its own orders and messages.</p></div>'+
   '<div class="detail-box" style="margin:10px 0"><strong>3 · Square real payment</strong><p id="sbc-four-square" role="status">NOT CERTIFIED · A $0 internal QA order is not provider payment proof. Verify signed webhook, Square readback, MySQL order and replay behavior on an authorized real or sandbox transaction.</p></div>'+
   '<div class="detail-box" style="margin:10px 0"><strong>4 · Office Box activation</strong><p id="sbc-four-activation" role="status">NOT CERTIFIED · Verify the shared signing channel, then independently test activation of an eligible paid customer workspace.</p></div>'+
   '<button id="sbc-four-readonly-check" type="button" class="btn primary">Verify connection &amp; read-only evidence</button>'+
   '<p id="sbc-four-status" role="status" class="mini">No network checks for these four gates have run yet.</p></section>'+
   '<p id="sbc-launch-footer" class="mini" role="status">Starting owner-only read checks…</p>'+
   '<p class="mini"><strong>Acceptance evidence:</strong> Published release identity, CRM record readback, independent researcher and demo logins, existing Square payment and webhook records, Fantastic 4 handoff, backup restoration, and customer delivery.</p></div>');
  const fourButton=$('sbc-four-readonly-check');
  fourButton?.addEventListener?.('click',async()=>{
   if(!owner()){
    text('sbc-four-status','Owner authentication required. No checks were performed.');return;
   }
   fourButton.disabled=true;
   text('sbc-four-status','Checking owner-only evidence without payments or customer writes…');
   // Inquiry proof requires a real QA submission and exact persisted customer/activity readback.
   text('sbc-four-inquiry','NOT CERTIFIED · Verify an owner-labeled website inquiry ID against the exact CRM tenant and activity ledger. No public form was submitted.');
   try{
    if(!owner())throw Error('Owner session changed');
    const p=await window.api('/api/portal/admin-summary',{method:'GET',timeoutMs:10000});
    const v=sbcFourGateVerdicts.portal(p);
    text('sbc-four-portal','NOT CERTIFIED · '+(v.accountCount==null?'Portal account summary unavailable':v.accountCount+' active portal account(s) exist in this tenant')+'. Two independent logins and cross-account access denial are still required.');
   }catch(_){text('sbc-four-portal','NOT CERTIFIED · Portal account evidence unavailable or owner session denied.');}
   try{
    if(!owner())throw Error('Owner session changed');
    const p=await window.api('/api/payments/square/readiness',{method:'GET',timeoutMs:10000});
    const v=sbcFourGateVerdicts.square(p);
    text('sbc-four-square','NOT CERTIFIED · Square preflight '+(v.preflightReady?'configured':'not verified')+'. No live provider charge, duplicate-payment readback or order fulfillment was tested.');
   }catch(_){text('sbc-four-square','NOT CERTIFIED · Square preflight unavailable or owner session denied.');}
   try{
    if(!owner())throw Error('Owner session changed');
    const p=await window.api('/api/owner/officebox/federation-preflight',{method:'GET',timeoutMs:15000});
    const v=sbcFourGateVerdicts.federation(p);
    text('sbc-four-activation',v.transportVerified?
     'SIGNED TRANSPORT VERIFIED · Office Box authenticated the read-only probe; paid subscription activation and tenant provisioning remain NOT CERTIFIED.':
     'NOT CERTIFIED · Office Box signed connection not verified; check the configured URL and shared webhook secret.');
   }catch(_){text('sbc-four-activation','NOT CERTIFIED · Office Box signed preflight unavailable, unauthorized or rejected.');}
   text('sbc-four-status','Read-only checks finished. All four paid/customer acceptance gates remain unverified until the separate customer and provider tests pass.');
   fourButton.disabled=false;
  });
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

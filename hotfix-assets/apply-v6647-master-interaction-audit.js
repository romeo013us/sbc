'use strict';
// Interaction-only repair applied to both compiled browser entrypoints, after
// canonical asset bundling. No database, payment, writer or recovery mutations.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6647_MASTER_INTERACTION_AUDIT';
function once(src,oldText,newText,name){
 const count=src.split(oldText).length-1;
 if(count!==1)throw Error(MARKER+': '+name+' anchor count '+count);
 return src.replace(oldText,newText);
}
const HELPERS=`  // ${MARKER}: never leave an owner-facing revenue action silent.\n  let sbcRevenueVerifyInFlight=false, sbcRevenueRefreshSequence=0;\n  function sbcRevenueActionStatus(message,kind){\n    const el=document.getElementById('f4RevenueActionStatus')||document.getElementById('sbcGuardianProductionStatus');\n    if(el){el.textContent=message;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.dataset.actionState=kind||'info';}\n    return message;\n  }\n  // Alert only when a simple inline onclick points to a missing global function.\n  // The capture listener does not issue requests or change valid handlers.\n  if(!window.__sbcV6647InlineClickGuard){\n    window.__sbcV6647InlineClickGuard=true;\n    document.addEventListener('click',function(event){\n      const target=event.target&&event.target.closest&&event.target.closest('button[onclick],a[onclick],[role=button][onclick]');\n      if(!target)return;\n      const expression=String(target.getAttribute('onclick')||'').trim();\n      const simple=expression.match(/^(?:return\\s+)?(?:window\\.)?([A-Za-z_$][\\w$]*)\\s*(?:\\?\\.)?\\s*\\(/);\n      if(!simple)return;\n      const name=simple[1];\n      if(['alert','confirm','prompt','setTimeout','setInterval'].includes(name))return;\n      if(typeof window[name]==='function')return;\n      event.preventDefault();event.stopImmediatePropagation();\n      const title=String(target.textContent||target.getAttribute('aria-label')||'This control').trim().slice(0,100);\n      alert(title+' is unavailable (missing controller: '+name+'). No action was performed. Reload the workspace.');\n    },true);\n  }\n  function sbcRevenueVerificationButton(disabled){\n    const b=document.querySelector('[data-sbc-action="revenue-verify"]');\n    if(b){b.disabled=Boolean(disabled);b.setAttribute('aria-busy',disabled?'true':'false');}\n  }\n`;
const REFRESH=`  async function f4RevenueRefresh(options){\n    const automatic=options&&options.automatic===true;\n    const seq=++sbcRevenueRefreshSequence;\n    if(!automatic)sbcRevenueActionStatus('Checking current revenue eligibility…','busy');\n    try{\n      const r=await get('/api/fantastic4/revenue/status');\n      if(!r||r.ok===false)throw Error(r?.error||'Revenue status was not available.');\n      if(seq!==sbcRevenueRefreshSequence)return r;\n      const breakdown=r.eligibilityBreakdown||{};\n      const el=document.getElementById('f4RevenueStatus');\n      const badge=document.getElementById('f4RevenueStatusBadge');\n      if(el)el.innerHTML=\`<div class="stat"><div class="label">ACTIONABLE LEADS</div><div class="value">\${esc(breakdown.actionable??r.eligibleLeads??0)}</div><div class="sub">Email + consented SMS + human call</div></div><div class="stat"><div class="label">EMAIL READY</div><div class="value">\${esc(breakdown.emailReady??0)}</div><div class="sub">Automated email path</div></div><div class="stat"><div class="label">SMS READY</div><div class="value">\${esc(breakdown.smsReady??0)}</div><div class="sub">Recorded consent required</div></div><div class="stat"><div class="label">HUMAN CALL READY</div><div class="value">\${esc(breakdown.humanCallReady??0)}</div><div class="sub">Creates caller task; no auto-call</div></div><div class="stat"><div class="label">NEEDS VERIFICATION</div><div class="value">\${esc(breakdown.needsVerification??0)}</div><div class="sub">Warm/Hot records awaiting checks</div></div><div class="stat"><div class="label">UNROUTABLE</div><div class="value">\${esc(breakdown.unroutable??0)}</div><div class="sub">Target: 0</div></div>\`;\n      if(badge){badge.textContent=r.productionOn?'🟢 PRODUCTION ON':'🟠 PRODUCTION OFF';badge.className='badge '+(r.productionOn?'green':'orange');}\n      if(!automatic)sbcRevenueActionStatus('Revenue status checked. Actionable: '+String(breakdown.actionable??r.eligibleLeads??0)+'; needs verification: '+String(breakdown.needsVerification??0)+'.','success');\n      return r;\n    }catch(e){\n      if(seq!==sbcRevenueRefreshSequence)return {ok:false,error:String(e.message||e)};\n      const badge=document.getElementById('f4RevenueStatusBadge');\n      if(badge){badge.textContent='🔴 STATUS ERROR';badge.className='badge red';}\n      const el=document.getElementById('f4RevenueStatus');\n      if(el)el.innerHTML=\`<div class="install-tip">\${esc(e.message||e)}</div>\`;\n      sbcRevenueActionStatus('Revenue status could not be checked: '+String(e.message||e),'error');\n      return {ok:false,error:String(e.message||e)};\n    }\n  }`;
const VERIFY=`  async function f4RevenueVerify(){\n    if(sbcRevenueVerifyInFlight){sbcRevenueActionStatus('Verification is already running. No second request was started.','busy');return {ok:false,alreadyRunning:true};}\n    sbcRevenueVerifyInFlight=true;\n    sbcRevenueVerificationButton(true);\n    sbcRevenueActionStatus('Verifying up to 250 warm/hot leads. This may take a little time…','busy');\n    try{\n      const r=await post('/api/fantastic4/revenue/verify',{limit:250});\n      if(!r||r.ok===false)throw Error(r?.error||'Verification did not finish.');\n      // Refresh the visible counts, but do not replace the page and erase feedback.\n      await f4RevenueRefresh({automatic:true});\n      const message='Lead verification complete. Checked: '+String(r.checked??0)+', sales ready: '+String(r.passed??0)+', need review: '+String(r.needsReview??0)+'.';\n      sbcRevenueActionStatus(message,'success');\n      alert('🔎 '+message);\n      return r;\n    }catch(e){\n      const message='Lead verification failed: '+String(e.message||e)+'. No success was recorded.';\n      sbcRevenueActionStatus(message,'error');\n      alert(message);\n      return {ok:false,error:String(e.message||e)};\n    }finally{sbcRevenueVerifyInFlight=false;sbcRevenueVerificationButton(false);}\n  }`;
function replaceLine(src,prefix,replacement,label){
 const lines=src.split('\n');const matches=lines.map((line,i)=>line.startsWith(prefix)?i:-1).filter(i=>i>=0);
 if(matches.length!==1)throw Error(MARKER+': '+label+' line count '+matches.length);
 lines[matches[0]]=replacement;return lines.join('\n');
}
function patchRevenue(src,rel){
 if(src.includes(MARKER))throw Error(MARKER+': duplicate '+rel);
 const marker='  async function render(){';
 src=once(src,marker,HELPERS+marker,'feedback helper install '+rel);
 src=once(src,'onclick="f4RevenueVerify()"','data-sbc-action="revenue-verify" onclick="f4RevenueVerify()"','verify button marker '+rel);
 const note='<div class="mini" style="margin-top:10px;">Verification checks the CRM record and contact infrastructure. It does not claim mailbox or identity ownership. Revenue PLAY never bypasses verification.</div>';
 src=once(src,note,note+'<div id="f4RevenueActionStatus" role="status" aria-live="polite" class="install-tip" style="margin-top:10px">Use Verify or Check Revenue Status to see an action result.</div>','revenue status surface '+rel);
 src=replaceLine(src,'  async function f4RevenueRefresh(){',REFRESH,'revenue refresh '+rel);
 src=replaceLine(src,'  async function f4RevenueVerify(){',VERIFY,'revenue verification '+rel);
 src=once(src,'  window.f4RevenueRefresh=f4RevenueRefresh; window.f4RevenuePlay=f4RevenuePlay; window.f4AutoSweep=f4RevenuePlay;',
   '  window.f4RevenueRefresh=f4RevenueRefresh; window.f4RevenueVerify=f4RevenueVerify; window.f4RevenuePlay=f4RevenuePlay; window.f4AutoSweep=f4RevenuePlay;',
   'global owner-action handler '+rel);
 new vm.Script(src,{filename:rel});return src;
}
function patchGuardian(src,rel){
 if(src.includes(MARKER))throw Error(MARKER+': guardian duplicate '+rel);
 const actions={
  "window.f4ProductionToggle?.()":"window.f4ProductionToggle ? window.f4ProductionToggle() : alert('Production controls are unavailable. Reload this page before retrying.')",
  "window.f4RevenuePlay?.()":"window.f4RevenuePlay ? window.f4RevenuePlay() : alert('Revenue Play is unavailable. Reload this page before retrying.')",
  "window.f4RevenueVerify?.()":"window.f4RevenueVerify ? window.f4RevenueVerify() : alert('Lead verification controls are unavailable. Reload this page before retrying.')",
  "window.f4RevenueRefresh?.()":"window.f4RevenueRefresh ? window.f4RevenueRefresh() : alert('Revenue status controls are unavailable. Reload this page before retrying.')"
 };
 // Replace only inline button attributes. Programmatic auto-refresh retains its own safe optional chaining.
 for(const [from,to] of Object.entries(actions)){
  src=once(src,'onclick="'+from+'"','onclick="'+to+'"','guardian button '+from+' '+rel);
 }
 src='// '+MARKER+' guardian fallback buttons report unavailable actions instead of doing nothing.\n'+src;
 new vm.Script(src,{filename:rel});return src;
}
function apply(root){
 const changed=[];
 for(const dir of ['public','browser_public']){
  for(const [filename,fn] of [['fantastic4-launch-os.js',patchRevenue],['sbc-critical-surfaces-guardian-v56-25-3.js',patchGuardian]]){
   const rel=dir+'/'+filename,source=path.join(root,rel);
   if(!fs.existsSync(source))throw Error(MARKER+': missing '+rel);
   const after=fn(fs.readFileSync(source,'utf8'),rel);
   fs.writeFileSync(source,after);changed.push(rel);
  }
 }
 return {marker:MARKER,changed,interactionOnly:true,providerCalls:false,databaseChanges:false,financialChanges:false,securityGuardsChanged:false};
}
module.exports={apply,MARKER,patchRevenue,patchGuardian};
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
 // V66.69: late Production Control responses must not overwrite a newer screen.
 // Guard asynchronous HTML injection and status refresh by navigation generation
 // and by ownership of the original placeholder node.
 src=once(src,
  '  const originalNavigate=window.sbcNavigate;',
  '  let sbcCriticalNavigationEpoch=0;\n  const originalNavigate=window.sbcNavigate;',
  'navigation generation counter '+rel);
 src=once(src,
  '  function setView(v){\n    if(!window.state||!content())return false;',
  '  function setView(v){\n    if(!window.state||!content())return false;\n    const renderEpoch=++sbcCriticalNavigationEpoch;',
  'capture generation per critical view '+rel);
 src=once(src,
  '      content().innerHTML=productionFallback();',
  '      const renderHost=content();renderHost.innerHTML=productionFallback();',
  'capture placeholder owner '+rel);
 src=once(src,
  'if(html && typeof html===\'string\' && /<section|<div/i.test(html) && !/Unexpected token|<!doctype|Section temporarily unavailable|RENDER ERROR/i.test(html)){ content().innerHTML=html; }',
  'if(renderEpoch===sbcCriticalNavigationEpoch && window.state?.view===v && content()===renderHost && renderHost.querySelector(\'#sbcProductionCriticalSurface\') && html && typeof html===\'string\' && /<section|<div/i.test(html) && !/Unexpected token|<!doctype|Section temporarily unavailable|RENDER ERROR/i.test(html)){ renderHost.innerHTML=html; }',
  'discard late production HTML after navigation '+rel);
 src=once(src,
  '        try{window.f4RevenueRefresh?.();}catch(e){}',
  '        try{if(renderEpoch===sbcCriticalNavigationEpoch && window.state?.view===v && content()===renderHost)window.f4RevenueRefresh?.();}catch(e){}',
  'suppress stale revenue status refresh '+rel);
 src=once(src,
  '    return typeof originalNavigate===\'function\'?originalNavigate(v):false;',
  '    sbcCriticalNavigationEpoch++;\n    return typeof originalNavigate===\'function\'?originalNavigate(v):false;',
  'invalidate old critical render on normal navigation '+rel);
 src='// '+MARKER+' guardian fallback buttons report unavailable actions instead of doing nothing.\n'+src;
 new vm.Script(src,{filename:rel});return src;
}
// SBC_V6672_CATALOG_BOOTSTRAP_TRUTH: do not render from a null catalog during
// Published bootstrap or advertise unverified external provider readiness.
const CATALOG_MARKER='SBC_V6672_CATALOG_BOOTSTRAP_TRUTH';
function patchCatalogBootstrap(src,rel){
 if(src.includes(CATALOG_MARKER))throw Error(CATALOG_MARKER+': already applied '+rel);
 src=once(src,
  'catalog:null,trainingCourse:null',
  'catalog:{packages:[],services:[]},trainingCourse:null',
  'safe initial catalog '+rel);
 const target='state.catalog.packages.map(';
 const count=src.split(target).length-1;
 if(count!==3)throw Error(CATALOG_MARKER+': catalog .map count '+count+' '+rel);
 src=src.split(target).join('(Array.isArray(state.catalog?.packages)?state.catalog.packages:[]).map(');
 const statuses=[
  ['<div class="label">SQUARE</div><div class="value">READY</div>',
   '<div class="label">SQUARE</div><div class="value">VERIFY</div>'],
  ['<div class="label">TWILIO</div><div class="value">READY</div>',
   '<div class="label">TWILIO</div><div class="value">VERIFY</div>']
 ];
 for(const [oldText,newText] of statuses)src=once(src,oldText,newText,'provider status not presumed '+rel);
 src='// '+CATALOG_MARKER+'\n'+src;
 new vm.Script(src,{filename:rel});
 return src;
}
// SBC_V6674_OWNER_IMPORT_ENTRY: visible owner-only dashboard route.
// Floating import stays hidden; the authenticated owner route handles the batch.
const OWNER_IMPORT_MARKER='SBC_V6674_OWNER_IMPORT_ENTRY';
function patchOwnerImportEntry(src,rel){
 if(src.includes(OWNER_IMPORT_MARKER))throw Error(OWNER_IMPORT_MARKER+': duplicate '+rel);
 src=once(src,"<button class=\"btn orange\" onclick=\"newCustomer()\">+ New Lead</button><button class=\"btn ghost\" onclick=\"newQuote()\">Create Quote</button>","<button class=\"btn orange\" onclick=\"newCustomer()\">+ New Lead</button>${state.me?.role==='owner'?'<a class=\"btn ghost\" href=\"/owner/lead-import\" data-sbc-owner-lead-import=\"true\">Import 31 Leads</a>':''}<button class=\"btn ghost\" onclick=\"newQuote()\">Create Quote</button>",'owner dashboard import link '+rel);
 src='// '+OWNER_IMPORT_MARKER+'\n'+src;
 new vm.Script(src,{filename:rel});
 return src;
}
// SBC V66.75: post-bundle 90-day revenue contrast repair, mirrored across entrypoints.
const RC90_CONTRAST_MARKER='SBC_V6675_RC90_CONTRAST';
const RC90_CONTRAST_CSS="/* SBC_V6675_RC90_CONTRAST: 90-day command is legible in both themes.\n   Override legacy global strong/b/h3 dark text rules only inside rc90. */\nbody[data-theme=\"dark\"] .rc90-wrap {\n --rc90-surface:#101d2d;--rc90-inset:#17283c;--rc90-ink:#f2f7ff;\n --rc90-muted:#b9c9da;--rc90-border:#37506a;\n color:var(--rc90-ink)!important;\n}\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-stat,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-panel,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-hero-badge {\n background:var(--rc90-surface)!important;border-color:var(--rc90-border)!important;\n color:var(--rc90-ink)!important;\n}\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-ai-list>div,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-math>div,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-offer,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-funnel>div {\n background:var(--rc90-inset)!important;color:var(--rc90-ink)!important;\n}\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-stat .rc90-value,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-funnel b,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-math b,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-offer b,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-offer strong,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-ai-list b,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-ai-list span,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-panel h3,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-hero-badge strong,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-action>div {\n color:var(--rc90-ink)!important;\n}\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-label,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-sub,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-panel-head span:not(.rc90-chip),\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-funnel span,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-offer span,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-math span,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-hero-badge span,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-note,\nbody[data-theme=\"dark\"] .rc90-wrap .rc90-footer {\n color:var(--rc90-muted)!important;\n}\nbody[data-theme=\"light\"] .rc90-wrap {\n --rc90-surface:#ffffff;--rc90-inset:#f0f5fb;--rc90-ink:#17283a;\n --rc90-muted:#475569;--rc90-border:#c7d5e5;\n color:var(--rc90-ink)!important;\n}\nbody[data-theme=\"light\"] .rc90-wrap .rc90-stat,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-panel,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-hero-badge {\n background:var(--rc90-surface)!important;border-color:var(--rc90-border)!important;\n color:var(--rc90-ink)!important;\n}\nbody[data-theme=\"light\"] .rc90-wrap .rc90-ai-list>div,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-math>div,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-offer,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-funnel>div {\n background:var(--rc90-inset)!important;color:var(--rc90-ink)!important;\n}\nbody[data-theme=\"light\"] .rc90-wrap .rc90-stat .rc90-value,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-funnel b,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-math b,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-offer b,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-offer strong,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-ai-list b,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-ai-list span,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-panel h3,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-hero-badge strong,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-action>div {\n color:var(--rc90-ink)!important;\n}\nbody[data-theme=\"light\"] .rc90-wrap .rc90-label,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-sub,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-panel-head span:not(.rc90-chip),\nbody[data-theme=\"light\"] .rc90-wrap .rc90-funnel span,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-offer span,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-math span,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-hero-badge span,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-note,\nbody[data-theme=\"light\"] .rc90-wrap .rc90-footer {\n color:var(--rc90-muted)!important;\n}\n.rc90-wrap .rc90-chip{background:#dcecff!important;color:#174ea6!important}\n.rc90-wrap .rc90-chip.good{background:#d8f5e6!important;color:#0b653c!important}\n.rc90-wrap .rc90-action>span{background:#dcecff!important;color:#174ea6!important}\n.rc90-wrap .rc90-buttons .btn:focus-visible{outline:3px solid #f28c28;outline-offset:3px}\n";
function patchRc90Contrast(root){
 const crypto=require('node:crypto');
 const changed=[];
 for(const dir of ['public','browser_public']){
  const htmlPath=path.join(root,dir,'index.html');
  const html=fs.readFileSync(htmlPath,'utf8');
  const m=html.match(/<link\b[^>]*id="sbc-v6636-canonical-styles"[^>]*href="\/(sbc-v6636-styles\.[a-f0-9]{16}\.css)"/);
  if(!m)throw Error(RC90_CONTRAST_MARKER+': missing canonical CSS bundle in '+dir);
  const oldBundle=m[1],oldFile=path.join(root,dir,oldBundle);
  const original=fs.readFileSync(oldFile,'utf8');
  if(original.includes(RC90_CONTRAST_MARKER))throw Error(RC90_CONTRAST_MARKER+': duplicate '+oldFile);
  const updated=original+'\n'+RC90_CONTRAST_CSS+'\n';
  const digest=crypto.createHash('sha256').update(updated).digest('hex');
  const newBundle='sbc-v6636-styles.'+digest.slice(0,16)+'.css';
  if(newBundle===oldBundle)throw Error(RC90_CONTRAST_MARKER+': unchanged bundle hash');
  fs.writeFileSync(path.join(root,dir,newBundle),updated);
  fs.unlinkSync(oldFile);
  const previousHash=html.match(/data-sbc-v6636="([a-f0-9]{64})"/);
  if(!previousHash)throw Error(RC90_CONTRAST_MARKER+': missing CSS bundle receipt');
  const updatedHtml=html.replace('/'+oldBundle,'/'+newBundle).replace('data-sbc-v6636="'+previousHash[1]+'"','data-sbc-v6636="'+digest+'"');
  fs.writeFileSync(htmlPath,updatedHtml);
  changed.push(dir+'/'+newBundle,dir+'/index.html');
  const standalone=path.join(root,dir,'v56140-90day-revenue-command.css');
  const standaloneCss=fs.readFileSync(standalone,'utf8');
  if(standaloneCss.includes(RC90_CONTRAST_MARKER))throw Error(RC90_CONTRAST_MARKER+': duplicate '+standalone);
  fs.writeFileSync(standalone,standaloneCss+'\n'+RC90_CONTRAST_CSS+'\n');
  changed.push(dir+'/v56140-90day-revenue-command.css');
 }
 return changed;
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
  const rel=dir+'/app.js',app=path.join(root,rel);
  if(!fs.existsSync(app))throw Error(MARKER+': missing '+rel);
  fs.writeFileSync(app,patchOwnerImportEntry(patchCatalogBootstrap(fs.readFileSync(app,'utf8'),rel),rel));changed.push(rel);
 }
 changed.push(...patchRc90Contrast(root));
 const authRepair=require('./apply-v6676-role-login-demo.js').apply(root);
 changed.push(...authRepair.changed);
 return {marker:MARKER,changed,interactionOnly:false,roleAuthorizationHardened:true,providerCalls:false,databaseChanges:false,financialChanges:false,writerRecoveryControlsPreserved:true};
}
module.exports={apply,MARKER,patchRevenue,patchGuardian,patchCatalogBootstrap,CATALOG_MARKER,patchOwnerImportEntry,OWNER_IMPORT_MARKER,patchRc90Contrast,RC90_CONTRAST_MARKER};
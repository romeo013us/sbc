'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6639_PUBLISHED_READ_POLL_GUARD';
function exactly(source,from,to,identity){
 const count=source.split(from).length-1;
 if(count!==1)throw Error(MARKER+': '+identity+' expected exactly one anchor; found '+count);
 return source.replace(from,to);
}
function apply(root){
 const pub=path.join(root,'public'),mirror=path.join(root,'browser_public');
 const targets=[
  {name:'v9.js',transform(s){
   s=exactly(s,'let kimAttentionTimer=null,kimDismissed={};',
    'let kimAttentionTimer=null,kimDismissed={},kimAttentionInFlight=false;', 'Kim single flight');
   s=exactly(s,"async function pollKimAttention(){try{const r=await api('/api/ai/attention');",
    "async function pollKimAttention(){if(document.visibilityState==='hidden'||!window.state?.me||kimAttentionInFlight)return;kimAttentionInFlight=true;try{const r=await api('/api/ai/attention',{timeoutMs:8000});",
    'Kim authenticated timed request');
   s=exactly(s,'catch(e){}}\nfunction kimDismissUrgent',
    'catch(e){}finally{kimAttentionInFlight=false}}\nfunction kimDismissUrgent',
    'Kim finally release');
   return s;
  }},
  {name:'v568-cinematic.js',transform(s){
   s=exactly(s,'let observer=null, poll=null, lastEventId=null;',
    'let observer=null, poll=null, lastEventId=null, automationPollInFlight=false;', 'automation single flight');
   s=exactly(s,
    "  async function pollAutomation(){\n    try{const r=await authFetch('/api/v567/observability/automation'); if(!r.ok)return; const d=await r.json(); updateBeacon(d.events||[]);}catch(_){/* quiet UI */}\n  }",
    "  async function pollAutomation(){\n"+
    "    if(automationPollInFlight||document.visibilityState==='hidden'||!window.state?.me)return;\n"+
    "    automationPollInFlight=true;const c=new AbortController();const timer=setTimeout(()=>c.abort(),8000);\n"+
    "    try{const r=await authFetch('/api/v567/observability/automation',{signal:c.signal}); if(!r.ok)return; const d=await r.json(); updateBeacon(d.events||[]);}\n"+
    "    catch(e){if(e.name!=='AbortError')console.warn('[SBC POLL] automation status unavailable');}\n"+
    "    finally{clearTimeout(timer);automationPollInFlight=false;}\n"+
    "  }",
    'automation finite poll');
   s=exactly(s,'    window.SBC_CINEMATIC={version:VERSION,refresh:pollAutomation};',
    "    window.addEventListener('sbc:authenticated',pollAutomation,{once:true});\n"+
    "    window.SBC_CINEMATIC={version:VERSION,refresh:pollAutomation};", 'authentication trigger');
   return s;
  }},
  {name:'sbc-agent-os-v56-25-3.js',transform(s){
   s=exactly(s,"async function api(path,opts){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts});",
    "async function api(path,opts={}){const c=new AbortController();const timer=setTimeout(()=>c.abort(),8000);try{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts,signal:opts.signal||c.signal});",
    'agent OS finite API start');
   s=exactly(s,'throw e}return j}\n  function render(data)',
    'throw e}return j}finally{clearTimeout(timer)}}\n  function render(data)',
    'agent OS finite API finally');
   s=exactly(s,"  async function load(){try{const d=await api('/api/agent-os/status');",
    "  let sbcAgentOSInFlight=false;\n  async function load(){if(sbcAgentOSInFlight)return false;sbcAgentOSInFlight=true;try{const d=await api('/api/agent-os/status');",
    'agent OS single flight');
   s=exactly(s,"    return false;\n  }}\n  window.sbcAgentOSRefresh",
    "    return false;\n  }finally{sbcAgentOSInFlight=false}}\n  window.sbcAgentOSRefresh",
    'agent OS finally release');
   s=exactly(s,"setInterval(()=>{if(document.visibilityState==='visible')load()},60000)",
    "setInterval(()=>{if(document.visibilityState==='visible'&&window.state?.me)load()},60000)",
    'agent OS authenticated visible polling');
   return s;
  }}
 ];
 const changed=[];
 for(const t of targets){
  const f=path.join(pub,t.name);
  if(!fs.existsSync(f))throw Error(MARKER+': missing primary file '+t.name);
  const before=fs.readFileSync(f,'utf8');
  if(before.includes(MARKER))throw Error(MARKER+': duplicate invocation '+t.name);
  let after=t.transform(before);
  if(after===before)throw Error(MARKER+': unchanged '+t.name);
  after+='\n// '+MARKER+'\n';
  new vm.Script(after,{filename:t.name});
  const other=path.join(mirror,t.name);
  if(!fs.existsSync(other))throw Error(MARKER+': missing mirror file '+t.name);
  fs.writeFileSync(f,after);fs.writeFileSync(other,after);
  changed.push('public/'+t.name,'browser_public/'+t.name);
 }
 return {marker:MARKER,changed,readOnly:true,authRequired:true,hiddenTabPollingPaused:true,
  singleFlightPollers:['Kim attention','automation beacon','agent control plane'],
  networkTimeoutMs:8000,writerGuardChanged:false,crmWrites:false,paymentWrites:false};
}
module.exports={apply,MARKER,exactly};

'use strict';
// Offline regression: no provider credentials, HTTP network, live CRM, or payment calls.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {apply,exactly,MARKER}=require('../hotfix-assets/apply-v6639-published-read-poll-guard.js');
assert.throws(()=>exactly('needle needle','needle','replacement','test'),/exactly one/);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6639-read-poll-'));
const fixtures={
 'v9.js':[
  'let kimAttentionTimer=null,kimDismissed={};',
  "async function pollKimAttention(){try{const r=await api('/api/ai/attention');if(!r)return;}catch(e){}}",
  'function kimDismissUrgent(id){}'
 ].join('\n'),
 'v568-cinematic.js':[
  "(function(){'use strict';",
  'let observer=null, poll=null, lastEventId=null;',
  'function authFetch(url,opts){return fetch(url,opts)}',
  'function updateBeacon(events){}',
  "  async function pollAutomation(){",
  "    try{const r=await authFetch('/api/v567/observability/automation'); if(!r.ok)return; const d=await r.json(); updateBeacon(d.events||[]);}catch(_){/* quiet UI */}",
  '  }',
  '  function boot(){',
  '    window.SBC_CINEMATIC={version:VERSION,refresh:pollAutomation};',
  '  }',
  "  const VERSION='56.8';",
  '  boot();',
  '})();'
 ].join('\n'),
 'sbc-agent-os-v56-25-3.js':[
  "(function(){'use strict';",
  "  async function api(path,opts){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts});",
  "  const text=await r.text();let j;try{j=JSON.parse(text)}catch{j={ok:false,error:'HTTP'}}",
  "  if(!r.ok){const e=new Error(j.error||'HTTP');e.status=r.status;e.agentOs=true;throw e}return j}",
  '  function render(data){}',
  "  async function load(){try{const d=await api('/api/agent-os/status');render(d);return true}catch(e){",
  "    return false;",
  '  }}',
  '  window.sbcAgentOSRefresh=load;',
  "  setInterval(()=>{if(document.visibilityState==='visible')load()},60000)",
  '})();'
 ].join('\n')
};
for(const dir of ['public','browser_public']){
 fs.mkdirSync(path.join(root,dir),{recursive:true});
 for(const [name,src]of Object.entries(fixtures))fs.writeFileSync(path.join(root,dir,name),src);
}
(async()=>{
 try{
  const result=apply(root);
  assert.equal(result.networkTimeoutMs,8000);
  assert.equal(result.changed.length,6);
  for(const name of Object.keys(fixtures)){
   const a=fs.readFileSync(path.join(root,'public',name),'utf8');
   const b=fs.readFileSync(path.join(root,'browser_public',name),'utf8');
   assert.equal(a,b,'entrypoint mirror mismatch: '+name);
   assert.ok(a.includes(MARKER));
   new vm.Script(a,{filename:name});
  }
  assert.throws(()=>apply(root),/duplicate invocation/);
  const agent=fs.readFileSync(path.join(root,'public/sbc-agent-os-v56-25-3.js'),'utf8');
  let pending=[],requests=0;
  const ctx={
   window:{state:{me:{role:'owner'}}},
   document:{visibilityState:'visible'},
   setInterval:()=>0,
   setTimeout,clearTimeout,AbortController,console,
   fetch:()=>{requests++;return new Promise(done=>pending.push(done))}
  };
  vm.runInNewContext(agent,ctx,{timeout:2000});
  const first=ctx.window.sbcAgentOSRefresh();
  const second=ctx.window.sbcAgentOSRefresh();
  assert.equal(requests,1,'simultaneous agent status calls must coalesce');
  assert.equal(await second,false,'duplicate poll held until pending request completes');
  pending.shift()({ok:true,status:200,text:async()=>JSON.stringify({ok:true,brains:[]})});
  assert.equal(await first,true);
  const third=ctx.window.sbcAgentOSRefresh();
  assert.equal(requests,2,'subsequent polling resumes after first settled');
  pending.shift()({ok:true,status:200,text:async()=>JSON.stringify({ok:true,brains:[]})});
  assert.equal(await third,true);
  const cin=fs.readFileSync(path.join(root,'public/v568-cinematic.js'),'utf8');
  let cRequests=0,cPending=[];
  const browser={
   window:{state:{me:{role:'owner'}},addEventListener:()=>{}},
   document:{visibilityState:'visible'},
   AbortController,setTimeout,clearTimeout,console,
   fetch:()=>{cRequests++;return new Promise(done=>cPending.push(done))}
  };
  vm.runInNewContext(cin,browser,{timeout:2000});
  const call1=browser.window.SBC_CINEMATIC.refresh(),call2=browser.window.SBC_CINEMATIC.refresh();
  assert.equal(cRequests,1,'beacon status must be single-flight');
  cPending.shift()({ok:true,json:async()=>({events:[]})});
  await Promise.all([call1,call2]);
  await browser.window.SBC_CINEMATIC.refresh();
  assert.equal(cRequests,2);
  console.log('[SBC V6639] PASS source guards, six mirrored assets, two real async single-flight regressions');
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error('[SBC V6639] FAIL',e);process.exitCode=1});

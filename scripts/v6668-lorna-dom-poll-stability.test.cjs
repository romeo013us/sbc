'use strict';
// Offline browser stability regression for the Lead Researcher navigation guard.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const patch=fs.readFileSync(path.join(__dirname,'../hotfix-assets/apply-v6549-lorna-least-privilege.js'),'utf8');
const found=patch.match(/<script id="sbc-lorna-least-privilege-ui">([\s\S]*?)<\/script>/);
assert.ok(found,'source must contain the role-aware navigation guard');
const code=found[1]; new vm.Script(code);
function fixture(reply){
 const attrs=new Map();let hidden=false,writes=0,requests=0,notify;
 const nav={
  get hidden(){return hidden},
  set hidden(value){hidden=Boolean(value);writes++},
  hasAttribute:name=>attrs.has(name),
  getAttribute:name=>attrs.get(name)||null,
  setAttribute(name,value){attrs.set(name,String(value));writes++},
  removeAttribute(name){attrs.delete(name);writes++}
 };
 nav.setAttribute('data-view','dashboard');writes=0;
 const document={
  readyState:'complete',body:{},
  querySelectorAll:selector=>selector==='[data-view]'?[nav]:[],
  querySelector:selector=>selector==='#app'?{classList:{contains:()=>true}}:null,
  addEventListener(){}
 };
 const window={fetch:async()=>{requests++;return reply()}};
 class MutationObserver{constructor(cb){notify=cb}observe(){}}
 vm.runInNewContext(code,{window,document,MutationObserver,Date,Set,console},{timeout:2000});
 return {nav,mutate:()=>notify(),requests:()=>requests,writes:()=>writes};
}
async function flush(){for(let i=0;i<12;i++)await Promise.resolve()}
(async()=>{
 const researcher=fixture(()=>({ok:true,json:async()=>({user:{role:'lead_researcher'}})}));
 await flush();assert.equal(researcher.nav.hidden,true);
 const first=researcher.writes();
 for(let i=0;i<100;i++)researcher.mutate();
 await flush();
 assert.equal(researcher.writes(),first,'unchanged visibility must not retrigger mutation observers');
 assert.equal(researcher.requests(),1);
 const unavailable=fixture(()=>({ok:false,json:async()=>null}));
 await flush();
 for(let i=0;i<100;i++)unavailable.mutate();
 await flush();
 assert.equal(unavailable.requests(),1,'failed session fetch must be bounded even during rapid DOM changes');
 assert.equal(unavailable.nav.hidden,false,'unknown role must not conceal the UI');
 console.log('[SBC V6668] PASS idempotent role navigation and bounded /api/me retry');
})().catch(e=>{console.error(e);process.exitCode=1});

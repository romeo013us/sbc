'use strict';
// V66.23 login access: isolated browser mocks, no real passwords, API, customer
// records, session store or GoDaddy connections.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const code=read('public/sbc-login-controller-v6623.js');
const html=read('public/index.html');
assert.equal(code,read('browser_public/sbc-login-controller-v6623.js'),'mirror controller');
assert.equal(html,read('browser_public/index.html'),'mirror HTML');
const ref='<script src="/sbc-login-controller-v6623.js?v=66.0.23-login-access"></script>';
assert.ok(html.indexOf(ref)>html.indexOf('id="loginForm"'),'controller appears after form');
assert.ok(html.indexOf(ref)<html.indexOf('/app.js?v='),'controller loads before heavy dashboard');
assert.ok(html.includes('#login:not(.hidden){position:fixed!important'),'login must win over visual overlays');
assert.ok(html.includes("new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true})"),
 'expensive layout scrubber must be coalesced');
assert.match(html,/if\(!app\|\|app\.classList\.contains\('hidden'\)\)return/,'do not scrub during login');
assert.doesNotMatch(code,/localStorage|sessionStorage|document\.cookie|eval\s*\(|location\.reload\s*\(/,
 'do not persist credentials, bypass auth, evaluate scripts or create automatic reload loops');
new vm.Script(code);
function create(reply,{withBoot=true}={}){
 const events={},requests=[],replacements=[],calls=[],button={disabled:false,textContent:'Sign in'};
 const form={querySelector:()=>button,addEventListener:(name,fn,capture)=>{assert.equal(name,'submit');assert.equal(capture,true);events.submit=fn;}};
 const error={textContent:'',setAttribute(k,v){this[k]=v}};
 const app={classList:{hidden:true,contains:k=>k==='hidden'&&this.hidden}}; // custom contains below
 app.classList.contains=k=>k==='hidden'&&app.classList.hidden;
 const content={prepend:x=>calls.push(x.textContent)};
 const document={getElementById:id=>({
  loginForm:form,loginError:error,loginUsername:{value:'owner'},
  loginPassword:{value:'synthetic-only-password'},app,content
 })[id]||null,
 createElement:()=>({setAttribute(){},set textContent(v){this.value=v},get textContent(){return this.value}})};
 const window={location:{replace:x=>replacements.push(x)}};
 if(withBoot)window.boot=async()=>{calls.push('boot');app.classList.hidden=false;};
 let count=0;
 const fetch=async(url,opt)=>{count++;requests.push({url,opt});return typeof reply==='function'?reply():reply;};
 vm.runInNewContext(code,{window,document,fetch,AbortController,setTimeout,clearTimeout,console,
   JSON,String,Error},{timeout:1500});
 const event=()=>({preventDefault(){calls.push('prevented')},stopImmediatePropagation(){calls.push('stopped')}});
 return {events,error,app,button,window,requests,replacements,calls,event,get count(){return count}};
}
const result=(status,body)=>({ok:status===200,status,json:async()=>body});
(async()=>{
 const success=create(result(200,{ok:true,user:{role:'owner'}}));
 await success.events.submit(success.event());
 assert.equal(success.requests.length,1,'one POST per user submit');
 assert.equal(success.requests[0].url,'/api/login');
 assert.equal(success.requests[0].opt.method,'POST');
 assert.equal(success.requests[0].opt.credentials,'same-origin','only original same-origin auth endpoint');
 assert.equal(success.requests[0].opt.cache,'no-store');
 assert.deepEqual(JSON.parse(success.requests[0].opt.body),{username:'owner',password:'synthetic-only-password'});
 assert.equal(success.calls.filter(x=>x==='boot').length,1,'authenticated user starts existing workspace once');
 assert.equal(success.button.disabled,false,'sign-in reenabled');
 assert.equal(success.replacements.length,0,'no extra reload when dashboard is healthy');
 assert.ok(success.calls.includes('stopped'),'legacy form handler is suppressed to avoid duplicate auth');
 const bad=create(result(401,{error:'Incorrect username or password.'}));
 await bad.events.submit(bad.event());
 assert.equal(bad.requests.length,1,'bad password makes no automatic retry');
 assert.match(bad.error.textContent,/Incorrect username/);
 assert.equal(bad.button.disabled,false);
 assert.equal(bad.calls.filter(x=>x==='boot').length,0);
 const offline=create(result(503,{code:'SESSION_PERSISTENCE_UNAVAILABLE',error:'Durable session store unavailable.'}));
 await offline.events.submit(offline.event());
 assert.equal(offline.requests.length,1);
 assert.match(offline.error.textContent,/Durable session store unavailable/);
 const network=create(()=>Promise.reject(Error('network unavailable')));
 await network.events.submit(network.event());
 assert.match(network.error.textContent,/network unavailable/);
 assert.equal(network.button.disabled,false);
 const fallback=create(result(200,{ok:true}),{withBoot:false});
 await fallback.events.submit(fallback.event());
 assert.deepEqual(fallback.replacements,['/?sbcAuthenticated=1'],'only a confirmed successful login can refresh if app.js is missing');
 let unblock;
 const slow=create(()=>new Promise(res=>{unblock=res}));
 const first=slow.events.submit(slow.event());
 const second=slow.events.submit(slow.event());
 assert.equal(slow.requests.length,1,'double-submit is suppressed while first is in flight');
 unblock(result(401,{error:'Synthetic denied'}));
 await Promise.all([first,second]);
 assert.equal(slow.button.disabled,false);
 console.log('[SBC V6623 LOGIN ACCESS] PASS: early sign-in, single POST, error feedback, session-store failure, duplicate suppression, exact auth, fallback and mirror');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});

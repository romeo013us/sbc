'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const source=read('public/sbc-v6566-state-preserving-circuit-breaker.js');
assert.equal(source,read('browser_public/sbc-v6566-state-preserving-circuit-breaker.js'));
function fixture(){
 let now=100000,answer=503,fail=false;const calls=[],nodes=new Map(),events=new Map();
 function element(){return {style:{},children:[],setAttribute(){},append(...items){this.children.push(...items)}};}
 const body={appendChild(n){nodes.set(n.id,n);n.parentNode=this;},removeChild(n){nodes.delete(n.id);}};
 const document={body,createElement:element,getElementById:id=>nodes.get(id)||null};
 const window={location:{href:'https://command.example/'},fetch:async(input,init)=>{calls.push({input,init});if(fail)throw Error('offline');return new Response(null,{status:answer});},addEventListener:(name,fn)=>events.set(name,fn)};
 const forbidden=()=>{assert.fail('must not clear browser state or reload');};
 window.location.reload=forbidden;const storage={clear:forbidden,removeItem:forbidden,setItem:forbidden};
 vm.runInNewContext(source,{window,document,URL,Response,Date:{now:()=>now},localStorage:storage,sessionStorage:storage,indexedDB:{deleteDatabase:forbidden}});
 return {window,calls,nodes,advance:ms=>{now+=ms;},answer:n=>{answer=n;},fail:v=>{fail=v;},online:()=>events.get('online')()};
}
test('two core failures open guard, preserve unrelated requests and resume after a successful probe',async()=>{
 const f=fixture();await f.window.fetch('/api/me');assert.equal(f.nodes.size,0);await f.window.fetch('/api/agent-os/status');assert(f.nodes.has('sbc-v6566-standby'));
 const paused=await f.window.fetch('/api/me');assert.equal(paused.status,503);assert.equal((await paused.json()).code,'SBC_STANDBY_GUARDED');assert.equal(f.calls.length,2);
 f.answer(200);const request={method:'GET'};assert.equal((await f.window.fetch('/api/customers',request)).status,200);assert.equal(f.calls.at(-1).init,request);assert.equal(f.nodes.size,1);
 f.advance(29999);await f.window.fetch('/api/me');assert.equal(f.calls.length,3);f.advance(1);assert.equal((await f.window.fetch('/api/me')).status,200);assert.equal(f.nodes.size,0);assert.equal(f.calls.length,4);
});
test('network failures open guard without changing browser state; online permits recovery probe',async()=>{
 const f=fixture();f.fail(true);await assert.rejects(f.window.fetch('/api/me'),/offline/);await assert.rejects(f.window.fetch('/api/me'),/offline/);assert.equal(f.nodes.size,1);f.advance(30000);f.fail(false);f.answer(200);f.online();await f.window.fetch('/api/me');assert.equal(f.nodes.size,0);
});

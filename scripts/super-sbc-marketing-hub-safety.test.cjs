'use strict';
// Super SBC Marketing Hub: verifies real browser source in isolated Node VM.
// No network access, external accounts, customer data, payments or publishing.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'public/sbc-v6567-marketing-hub.js'),'utf8');
const css=fs.readFileSync(path.join(root,'public/sbc-v6567-marketing-hub.css'),'utf8');
function load(fetch){
  const source=js.replace(/\}\)\(\);\s*$/,'window.__SUPER_SBC_TEST__={serverAction};})();');
  assert.notEqual(source,js,'browser functions must be instrumentable for safety tests');
  const window={};
  const sandbox={
    window,
    document:{readyState:'loading',addEventListener(){},querySelector(){return null}},
    localStorage:{getItem(){return null},setItem(){}},
    fetch,
    confirm(){return true},
    prompt(){return null},
    setInterval(){return 0},
    FormData:class FormData{}
  };
  vm.runInNewContext(source,sandbox,{timeout:4000,filename:'sbc-marketing-hub.js'});
  return window.__SUPER_SBC_TEST__;
}
function reply(body,status=200){return {ok:status>=200&&status<300,status,json:async()=>body};}
test('marketing publisher rejects HTTP success without an explicit ok:true',async()=>{
  const hub=load(async()=>reply({}));
  const x={id:'post-1',durable:true,status:'approved'};
  assert.equal(await hub.serverAction(x,'publish'),false);
  assert.equal(x.providerPostId,undefined);
  assert.equal(x.status,'approved');
});
test('marketing publisher does not invent a receipt for unconfirmed public posts',async()=>{
  for(const body of [{ok:true},{ok:true,published:true,status:'PUBLISHED'},{ok:true,published:true,status:'PUBLISHED',providerPostId:''},{ok:true,published:false,status:'PUBLISHED',providerPostId:'123'}, {ok:true,published:true,status:'QUEUED',providerPostId:'123'}]){
    const hub=load(async()=>reply(body));
    const x={id:'post-2',durable:true,status:'approved'};
    assert.equal(await hub.serverAction(x,'publish'),false);
    assert.equal(x.status,'approved');
    assert.equal(x.providerPostId,undefined);
  }
});
test('marketing publisher accepts only a verified provider post receipt',async()=>{
  const hub=load(async()=>reply({ok:true,published:true,status:'PUBLISHED',providerPostId:'  real-post-id  '}));
  const x={id:'post-3',durable:true,status:'approved'};
  assert.equal(await hub.serverAction(x,'publish'),true);
  assert.equal(x.providerPostId,'real-post-id');
});
test('marketing publish refuses a second action on the same post while pending',async()=>{
  let calls=0,finish;
  const hub=load(()=>{calls++;return new Promise(resolve=>{finish=()=>resolve(reply({ok:true,published:true,status:'PUBLISHED',providerPostId:'id-4'}))})});
  const x={id:'post-4',durable:true};
  const first=hub.serverAction(x,'publish');
  const second=hub.serverAction(x,'publish');
  assert.equal(calls,1);
  assert.equal(await second,false);
  finish();
  assert.equal(await first,true);
  assert.equal(x.providerPostId,'id-4');
});
test('local-only drafts cannot mutate the server or publish',async()=>{
  let calls=0;const hub=load(async()=>{calls++;return reply({ok:true})});
  assert.equal(await hub.serverAction({id:'local',durable:false},'publish'),null);
  assert.equal(calls,0);
});
test('all owner mutation actions require explicit success rather than empty responses',async()=>{
  const hub=load(async()=>reply({}));
  assert.equal(await hub.serverAction({id:'draft',durable:true},'approve'),false);
  const hubOk=load(async()=>reply({ok:true}));
  assert.equal(await hubOk.serverAction({id:'draft2',durable:true},'approve'),true);
});
test('accessibility and mirrored asset parity are preserved',()=>{
  assert.equal(fs.readFileSync(path.join(root,'browser_public/sbc-v6567-marketing-hub.js'),'utf8'),js);
  assert.equal(fs.readFileSync(path.join(root,'browser_public/sbc-v6567-marketing-hub.css'),'utf8'),css);
  assert.match(js,/setAttribute\('role','dialog'\)/);
  assert.match(js,/setAttribute\('aria-modal','true'\)/);
  assert.match(js,/e\.key==='Escape'/);
  assert.match(js,/e\.key==='Tab'/);
  assert.match(js,/previousFocus/);
  assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css,/:focus-visible/);
  cp.execFileSync(process.execPath,['--check',path.join(root,'public/sbc-v6567-marketing-hub.js')]);
  cp.execFileSync(process.execPath,['--check',path.join(root,'browser_public/sbc-v6567-marketing-hub.js')]);
});

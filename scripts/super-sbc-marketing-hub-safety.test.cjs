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
function load(fetch,FormDataType=class FormData{}){
  const source=js.replace(/\}\)\(\);\s*$/,'window.__SUPER_SBC_TEST__={serverAction,render,handleSubmit,state,setRoot(value){root=value}};})();');
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
    FormData:FormDataType
  };
  vm.runInNewContext(source,sandbox,{timeout:4000,filename:'sbc-marketing-hub.js'});
  return {...window.__SUPER_SBC_TEST__,window};
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
test('draft creation and edit preserve CTA destination and artwork URL',()=>{
  class TestFormData{
    constructor(form){this.values=form.values}
    get(name){return this.values[name]||null}
  }
  // Pending response cannot publish or change local state during this inspection.
  const hub=load(()=>new Promise(()=>{}),TestFormData);
  const form={
    id:'mh-draft-form',
    values:{
      title:'SBC services',platform:'facebook',offer:'SBC Business Packages',
      cta:'Learn more',body:'Helpful local business tip',
      ctaUrl:'https://sbcmia.com/?utm_source=facebook',
      mediaUrl:'https://sbcmia.com/assets/sbc-original-logo.png'
    }
  };
  hub.handleSubmit({target:form,preventDefault(){}});
  assert.equal(hub.state.items[0].ctaUrl,form.values.ctaUrl);
  assert.equal(hub.state.items[0].mediaUrl,form.values.mediaUrl);
  const draft=hub.state.items[0];
  hub.state.draft={...draft};
  form.values.ctaUrl='https://sbcwebsites.com/?utm_source=facebook';
  form.values.mediaUrl='https://sbcmia.com/assets/sbc-original-logo.png?updated=1';
  hub.handleSubmit({target:form,preventDefault(){}});
  assert.equal(hub.state.items.length,1,'editing must not create a duplicate content record');
  assert.equal(hub.state.items[0].ctaUrl,form.values.ctaUrl);
  assert.equal(hub.state.items[0].mediaUrl,form.values.mediaUrl);
});

test('verified, configured and missing integrations show the truthful badges',()=>{
  const hub=load(async()=>reply({}));
  hub.window.__SBC_V6567_INTEGRATIONS__={
    facebook:{status:'connected'},
    google:{status:'configured'},
    instagram:{status:'not_configured'}
  };
  const content={innerHTML:'',querySelectorAll(){return []}};
  const tabs={innerHTML:''},notice={textContent:''};
  hub.setRoot({hidden:false,querySelector(selector){
    return {'.mh-content':content,'.mh-tabs':tabs,'.mh-notice':notice}[selector];
  }});
  hub.state.activeTab='integrations';
  hub.render();
  assert.match(content.innerHTML,/<span class="mh-badge good">Verified<\/span>/);
  assert.match(content.innerHTML,/<span class="mh-badge warn">Unverified<\/span>/);
  assert.match(content.innerHTML,/<span class="mh-badge warn">Not connected<\/span>/);
});

test('accessibility and mirrored asset parity are preserved',()=>{
  assert.equal(fs.readFileSync(path.join(root,'browser_public/sbc-v6567-marketing-hub.js'),'utf8'),js);
  assert.equal(fs.readFileSync(path.join(root,'browser_public/sbc-v6567-marketing-hub.css'),'utf8'),css);
  assert.match(js,/setAttribute\('role','dialog'\)/);
  assert.match(js,/setAttribute\('aria-modal','true'\)/);
  assert.match(js,/e\.key==='Escape'/);
  assert.match(js,/e\.key!=='Tab'/);
  assert.match(js,/previousFocus/);
  assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css,/:focus-visible/);
  cp.execFileSync(process.execPath,['--check',path.join(root,'public/sbc-v6567-marketing-hub.js')]);
  cp.execFileSync(process.execPath,['--check',path.join(root,'browser_public/sbc-v6567-marketing-hub.js')]);
});

test('creative inventory is owner-only and missing storage never appears as approved artwork',()=>{
 const hub=load(async()=>reply({}));
 const content={innerHTML:'',querySelectorAll(){return []}},tabs={innerHTML:''},notice={textContent:''};
 hub.setRoot({hidden:false,querySelector(s){return {'.mh-content':content,'.mh-tabs':tabs,'.mh-notice':notice}[s]}});
 hub.window.state={me:{role:'account_manager'}};
 hub.state.activeTab='creatives';hub.render();
 assert.doesNotMatch(tabs.innerHTML,/data-tab="creatives"/);
 hub.window.state.me.role='owner';hub.state.activeTab='creatives';hub.render();
 assert.match(tabs.innerHTML,/data-tab="creatives"/);
 assert.match(content.innerHTML,/Creative inventory/);
 assert.match(content.innerHTML,/not loaded|unavailable/i);
 assert.doesNotMatch(content.innerHTML,/14 approved/i);
});

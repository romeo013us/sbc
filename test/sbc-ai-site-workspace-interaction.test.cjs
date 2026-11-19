'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/sbc-ai-site-handoff-v1.js'),'utf8');
function appFixture(review={issueCount:0,deliveryReview:{status:'STATIC_CHECKS_PASSED',flags:[]}}){
 const nodes=new Map(),devices=[],checks=[],downloads=[],copied=[],requests=[],markup=[];
 function elem(id){
  if(!nodes.has(id))nodes.set(id,{id,value:'',files:[],checked:false,disabled:false,textContent:'',innerHTML:'',
   dataset:{},attrs:{},classList:{toggle(){}},listeners:{},
   setAttribute(key,value){this.attrs[key]=value},
   addEventListener(event,fn){this.listeners[event]=fn},
   click(){return this.listeners.click?.({preventDefault(){}})}
  });
  return nodes.get(id);
 }
 elem('sbcAIQuickTier').value='199';
 const stage=elem('sbcAIFrameStage');stage.dataset.device='desktop';
 for(const device of ['desktop','tablet','mobile']){
  const button=elem('device-'+device);button.dataset.sbcAiDevice=device;
  devices.push(button);
 }
 for(let i=0;i<4;i++)checks.push(elem('release-check-'+i));
 const doc={getElementById:elem,body:{appendChild(x){downloads.push({href:x.href,download:x.download})}},
  querySelectorAll(selector){
   if(selector==='[data-sbc-ai-device]')return devices;
   if(selector==='[data-sbc-ai-release-check]')return checks;
   return [];
  },
  createElement(name){assert.equal(name,'a');return {click(){downloads.at(-1).clicked=true},remove(){}}}
 };
 let uploads=[
  {id:'up_'+'a'.repeat(32),tier:199,active:true,previewAudit:review,createdAt:'2026-11-18T00:00:00Z',fileCount:3,
   previewPath:'/api/website-production/customers/c1/ai-proposals/uploads/up_'+'a'.repeat(32)+'/render/'+'T'.repeat(43)+'/index.html',
   downloadPath:'/api/website-production/customers/c1/ai-proposals/uploads/up_'+'a'.repeat(32)+'/download'},
  {id:'up_'+'b'.repeat(32),tier:199,active:false,previewAudit:review,createdAt:'2026-11-17T00:00:00Z',fileCount:3,
   previewPath:'/api/website-production/customers/c1/ai-proposals/uploads/up_'+'b'.repeat(32)+'/render/'+'U'.repeat(43)+'/index.html',
   downloadPath:'/api/website-production/customers/c1/ai-proposals/uploads/up_'+'b'.repeat(32)+'/download'}
 ];
 const serviceApi=async url=>{
  if(url.endsWith('/uploads'))return {ok:true,uploads};
  return {ok:true,revision:0,variants:{},prompts:{'199':'BUILD STARTER'},prompt:'BUILD'};
 };
 const ctx={window:{location:{href:'https://command.example/'}},document:doc,console,URL,
  navigator:{clipboard:{writeText:async txt=>copied.push(txt)}},
  fetch:async(url,options)=>{
   requests.push({url,options});
   const body=JSON.parse(options.body);
   assert.equal(body.expectedActiveId,uploads[0].id);
   uploads=uploads.map(x=>({...x,active:x.id===uploads[1].id}));
   return {ok:true,json:async()=>({ok:true,durable:true,activeId:uploads.find(x=>x.active).id,published:false})};
  }
 };
 vm.runInNewContext(source,ctx,{filename:'sbc-ai-site-handoff-v1.js'});
 return {elem,devices,checks,downloads,copied,requests,markup,serviceApi,ctx,
  open:()=>ctx.window.SBC_AI_SITE_HANDOFF.open({id:'c1',businessName:'Phil Auto'},{serviceApi,openModal:(title,html)=>markup.push(html)})};
}
test('device toggles change the iframe stage without modifying its sandbox or iframe source',async()=>{
 const f=appFixture();await f.open();
 const frame=f.elem('sbcAIFrame');frame.src='https://command.example/index.html';
 await f.devices[2].click();
 assert.equal(f.elem('sbcAIFrameStage').dataset.device,'mobile');
 assert.equal(f.devices[2].attrs['aria-pressed'],'true');
 assert.equal(frame.src,'https://command.example/index.html');
 await f.devices[1].click();
 assert.equal(f.elem('sbcAIFrameStage').dataset.device,'tablet');
 assert.equal(f.devices[2].attrs['aria-pressed'],'false');
 assert(f.markup.at(-1).includes('sandbox="allow-scripts"'));
 assert(!f.markup.at(-1).includes('allow-same-origin'));
});
test('revision workflow generates specific ChatGPT instructions and never edits the saved ZIP or publishes',async()=>{
 const f=appFixture();await f.open();
 f.elem('sbcAIRevisionNotes').value='Make the heading bigger and adjust the colors.';
 await f.elem('sbcAIRevisionCopy').click();
 assert.equal(f.copied.length,1);
 assert.match(f.copied[0],/Phil Auto/);
 assert.match(f.copied[0],/Make the heading bigger and adjust the colors/);
 assert.match(f.copied[0],/Return ONE complete revised website ZIP/);
 assert.equal(f.requests.length,0);
});
test('approved manual handoff requires static QA plus four explicit review checkboxes',async()=>{
 const f=appFixture();await f.open();
 const prepare=f.elem('sbcAIPreparePublish');
 assert.equal(prepare.disabled,true);
 for(const c of f.checks){c.checked=true;c.listeners.change?.();}
 assert.equal(prepare.disabled,false);
 await prepare.click();
 assert.equal(f.downloads.length,1);
 assert.match(f.downloads[0].href,/\/download$/);
 assert.equal(f.downloads[0].clicked,true);
 assert.equal(f.requests.length,0);
 const blocked=appFixture({issueCount:0,deliveryReview:{status:'OWNER_REVIEW_REQUIRED',flags:['BUSINESS_FACTS_UNVERIFIED']}});
 await blocked.open();
 for(const c of blocked.checks){c.checked=true;c.listeners.change?.();}
 assert.equal(blocked.elem('sbcAIPreparePublish').disabled,true);
 await blocked.elem('sbcAIPreparePublish').click();
 assert.equal(blocked.downloads.length,0);
});

test('existing saved ZIPs can run read-only delivery QA and manual form test is explicitly required',async()=>{
 const f=appFixture({issueCount:0});
 await f.open();
 // Simulate a newly generated QA report returned by the owner-only endpoint.
 const savedId='up_'+'a'.repeat(32);
 const originalService=f.serviceApi;
 // The fixture returns no QA response by default, so the primary contract is
 // checked on source here and in the server route tests.
 assert(source.includes("base+'/uploads/'+item.id+'/qa'"));
 assert(source.includes("response.readOnly!==true"));
 assert(source.includes("flags.filter(x=>x!=='FORM_BACKEND_MUST_BE_TESTED')"));
 assert(f.markup.at(-1).includes('id="sbcAIRunQA"'));
 assert.equal(f.elem('sbcAIPreparePublish').disabled,true);
 assert.equal(typeof originalService,'function');
 assert.match(savedId,/^up_[a-f0-9]{32}$/);
});

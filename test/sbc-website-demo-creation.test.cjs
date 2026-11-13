'use strict';
// Website Production regression: execute the real server function against isolated fakes.
// Nothing here opens checkout, sends a message, or writes to a production database.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
const start=source.indexOf('async function createWebsiteDemo(');
const end=source.indexOf('\nasync function deployDemoSftp(',start);
assert.ok(start>=0&&end>start,'Website Production function must remain discoverable');
const createSource=source.slice(start,end);

function harness(existing){
  const customer={id:'c-119',tenantId:1,businessName:'119th Barber Shop',industry:'Barber Shop',city:'Miami'};
  const store={websiteDemos:existing?[existing]:[],automationEvents:[],leadIntelligence:[]};
  const actions={save:0,bridge:0,direct:0,compile:0};
  const context={
    db:{customers:[customer]},
    SBC_PREVIEW_SALES:{
      canOperate:(record,actor,tenant)=>record.tenantId===tenant,
      sameTenant:(record,tenant)=>record.tenantId===tenant,
      newSlug:base=>base+'-0123456789abcdef0123456789abcdef'
    },
    megaData:()=>store,megaSave:async()=>{actions.save++},
    demoSlug:name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''),
    id:prefix=>prefix+'-new',now:()=> '2026-11-13T10:00:00Z',
    LEAD_INTELLIGENCE:{buildBrief:()=>({})},
    directDemoWithKim:async()=>{actions.direct++;return {plan:{},aiUsed:false}},
    buildDemoHtml:()=>'<html><body>Preview</body></html>',
    compileDemoSandbox:html=>{actions.compile++;return html},
    OFFICE_BOX_BRIDGE:{dispatch:async()=>{actions.bridge++}},
    mysqlPool:null, process:{env:{}},
    console
  };
  const create=vm.runInNewContext(createSource+'\ncreateWebsiteDemo;',context,{
    filename:'server.js:Website Production'
  });
  return {create,store,actions,customer};
}

for(const [tier,pages] of [['starter',1],['essentials',4]]){
  test('website creation for '+tier+' generates a draft with a usable slug ('+pages+' page package)',async()=>{
    const {create,store,actions}=harness();
    const site=await create('c-119',{tenantId:1,offerTier:tier,fast:true});
    assert.equal(site.offerTier,tier);
    assert.equal(site.slug,'119th-barber-shop-0123456789abcdef0123456789abcdef');
    assert.equal(site.status,'Draft');
    assert.equal(site.customer.businessName,'119th Barber Shop');
    assert.equal(site.html,'<html><body>Preview</body></html>');
    assert.equal(store.websiteDemos.length,1);
    assert.equal(actions.save,1);
    assert.equal(actions.compile,1);
    assert.equal(actions.bridge,1); // internal, owner-reviewed Office Box event, not outreach
  });
}
test('approved customer website is never rebuilt, downgraded, or released for new approval',async()=>{
  const approved={id:'site-approved',customerId:'c-119',tenantId:1,status:'Approved',offerTier:'essentials',slug:'previous-approved-slug'};
  const {create,store,actions}=harness(approved);
  const returned=await create('c-119',{tenantId:1,offerTier:'starter',fast:true});
  assert.equal(returned,approved);
  assert.equal(store.websiteDemos[0],approved);
  assert.equal(approved.status,'Approved');
  assert.deepEqual(actions,{save:0,bridge:0,direct:0,compile:0});
});
test('existing draft reuses its opaque slug and can change website package',async()=>{
  const draft={id:'site-draft',customerId:'c-119',tenantId:1,status:'Draft',offerTier:'starter',slug:'old-draft-0123456789abcdef0123456789abcdef'};
  const {create,store}=harness(draft);
  const site=await create('c-119',{tenantId:1,offerTier:'essentials',fast:true});
  assert.equal(site.id,'site-draft');
  assert.equal(site.slug,draft.slug);
  assert.equal(site.offerTier,'essentials');
  assert.equal(store.websiteDemos.length,1);
});
test('tenant mismatch cannot build a website for another business',async()=>{
  const {create,store,actions}=harness();
  await assert.rejects(create('c-119',{tenantId:2,offerTier:'starter',fast:true}),/DEMO_CUSTOMER_NOT_AUTHORIZED/);
  assert.equal(store.websiteDemos.length,0);
  assert.equal(actions.save,0);
});

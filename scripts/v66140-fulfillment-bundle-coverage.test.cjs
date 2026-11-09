'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const COVER=require('../enterprise/v66140-fulfillment-bundle-coverage.cjs'),V400=require('../enterprise/kim-fulfillment-control-v400.js');
const STAGE=require('./v66140-stage-bundle-coverage.cjs');
const cleanItem=name=>({id:'line-1',name,qty:1});
for(const name of ['Office Box','Office Box Subscription','Microsoft 365 Setup','Domain Registration','Business Email Mailbox','SSL Certificate','Web Hosting']){
 assert.equal(COVER.noArtworkService({items:[cleanItem(name)]}),true,name+' must not require fake print artwork');
}
for(const name of ['100 Business Cards','Website Design','Business Starter Package','Business Essentials','Managed WordPress','Office Box + Business Cards']){
 assert.equal(COVER.noArtworkService({items:[cleanItem(name)]}),false,name+' requires service-specific review');
}
assert.equal(COVER.noArtworkService({items:[cleanItem('Office Box'),cleanItem('Business Cards')]}),false,'bundles always use per-line QA');
const parts=[{id:'site',name:'Website Setup'},{id:'cards',name:'100 Business Cards'}];
const site={item_id:'site',vendor:'internal',status:'completed',vendor_status:'completed'};
const print={item_id:'cards',vendor:'fourOverFour',status:'delivered',vendor_status:'delivered',vendor_order_number:'PO-2026-72188',tracking_number:'9400111899223857773333'};
let v=COVER.summary({components:parts,jobs:[site]});
assert.equal(v.ready,false);assert.equal(v.complete,1);assert.equal(v.missing[0].reason,'MISSING_DURABLE_JOB');
v=COVER.summary({components:parts,jobs:[site,{...print,tracking_number:''}]});
assert.equal(v.ready,false);assert.equal(v.missing[0].reason,'TRACKING_PROOF_REQUIRED');
v=COVER.summary({components:parts,jobs:[site,{...print,vendor_order_number:'TEST12345'}]});
assert.equal(v.ready,false);assert.equal(v.missing[0].reason,'VENDOR_RECEIPT_REQUIRED');
v=COVER.summary({components:parts,jobs:[site,print]});
assert.equal(v.ready,true);assert.equal(v.complete,2);
v=COVER.summary({components:parts,jobs:[site,print,print]});
assert.equal(v.ready,false,'duplicate jobs must never certify a single line');
v=COVER.summary({components:[{id:'x',name:'A'},{id:'x',name:'B'}],jobs:[site,print]});
assert.equal(v.ready,false);assert.equal(v.status,'MAPPING_REQUIRED');
const synthetic='sbc_v66140_internal_digital_qa',original=V400.capture(synthetic);
try{
 const x={id:synthetic,orderNumber:'Synthetic Office Box',stage:'PAID',items:[cleanItem('Office Box Subscription')],
  customerId:'synthetic',vendor:{provider:'internal',status:'NOT_STAGED'},shipping:{status:'NOT_SHIPPED'},
  checklist:{payment:true,customer:true,items:true,assets:false,preflight:false,proof:false,approval:false,vendor:false,shipping:false,delivery:false},
  assets:[],proofs:[],history:[],financial:{revenue:49,cost:0,margin:0}};
 V400.state.orders[synthetic]=x;
 V400.advance(synthetic,'INTAKE',{name:'Owner'});
 V400.advance(synthetic,'PREFLIGHT',{name:'Owner'});
 assert.equal(x.checklist.assets,true,'Office Box does not require a fake asset');
 assert.equal(x.checklist.preflight,true,'eligible no-artwork services can complete preflight');
 V400.advance(synthetic,'PRODUCTION_READY',{name:'Owner'});
 assert.equal(x.stage,'PRODUCTION_READY');
 assert.equal(x.blockedReason,'','Office Box must not be blocked for missing print assets');
}finally{V400.restore(original)}
const raw=read('server.js'),compiled=STAGE.patchServer(raw);
new vm.Script(compiled,{filename:'server-with-bundle-gate.js'});
assert.equal(STAGE.patchServer(compiled),compiled,'staging must be idempotent');
assert(compiled.includes('SBC_V66140_BUNDLE_CLOSE_GATE'));
assert(compiled.includes("if(stage==='FULFILLED')"));
assert(compiled.includes("BUNDLE_CHILD_JOBS_NOT_DELIVERED"));
assert(compiled.includes("app.get('/api/kim400/orders/:id/coverage'"));
assert(compiled.includes("FROM sbc_fulfillment_jobs WHERE tenant_id=? AND order_id=?"));
const ui=read('public/v40-fulfillment.js');
assert.equal(ui,read('browser_public/v40-fulfillment.js'));
new vm.Script(ui,{filename:'v40-fulfillment.js'});
assert(ui.includes('Check All Services')&&ui.includes('v400Coverage=coverage'));
assert.equal(read('public/index.html'),read('browser_public/index.html'));
assert(read('public/index.html').includes('/v40-fulfillment.js?v=66.140-service-coverage'));
if(process.argv.includes('--staged'))assert.equal(compiled,raw);
console.log('PASS V66.140: Office Box no fake artwork, bundles require all durable child deliveries, tenant-safe read-only progress, browser mirror');

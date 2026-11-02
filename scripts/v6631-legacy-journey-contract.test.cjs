'use strict';
// V66.31: isolated end-to-end contract for legacy intake and fulfillment.
// All orders/customers are synthetic. No network, GoDaddy, Square or production DB.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const FINISHER=read('routes/v56131-revenue-finisher.js'),LOOP=read('routes/v56131-revenue-loop.js');
const {patchServer}=require('./v6630-customer-journey-hardening.cjs');
const candidate=patchServer(read('server.js')).source;
assert.match(FINISHER,/replace\(\/\\D\/g,''\)/,'phone normalization must remove non-digits');
assert.match(FINISHER,/\/\\\.csv\$\/i\.test\(filename\)/,'only genuine .csv extension accepted');
assert.doesNotMatch(FINISHER,/linktrglobal|googleglobal|global\.__SBC_REQUIRE_TENANT\(req\)\.csv/);
assert.match(FINISHER,/LEAD_IMPORT_WRITER_UNAVAILABLE/,'preview and lost writer cannot import');
assert.match(FINISHER,/LEAD_IMPORT_MYSQL_REQUIRED/);
assert.match(FINISHER,/const tenantId=Number\(global\.__SBC_REQUIRE_TENANT\(req\)\)/);
assert.match(FINISHER,/id:id\('cust'\),tenantId,businessName/);
assert.match(FINISHER,/INSERT INTO sbc_customers[\s\S]*?\(id,tenant_id,business_name/);
assert.match(FINISHER,/Number\(c.tenantId\)===tenantId&&\(/,'do not dedupe against a foreign tenant');
assert.match(candidate,/writerReady:!SBC_RUNTIME_READ_ONLY&&!sbcShutdownStarted/);
assert.match(LOOP,/PAYMENT_EVIDENCE\.providerCapturedSquare\(o\)/);
assert.match(LOOP,/String\(o\.product\|\|''\)!=='SBC Launch QA - \$1 Test Service'/);
assert.match(LOOP,/Number\(j\.tenantId\)===tenantId/);
assert.match(LOOP,/Number\(x\.tenantId\)===Number\(global\.__SBC_REQUIRE_TENANT\(req\)\)/);

const register=require('../routes/v56131-revenue-loop');
const handlers={},app={get:(url,auth,owner,fn)=>{handlers['GET '+url]=fn;},
 post:(url,auth,owner,fn)=>{handlers['POST '+url]=fn;}};
const paid={
 squareOrderId:'so-1',squarePaymentId:'pay-1',squarePaymentStatus:'COMPLETED',
 squarePaymentCompletedAt:'2026-11-01T16:00:00Z'
};
const orders=[
 {id:'status-only',tenantId:1,customerId:'c1',price:349,status:'Paid',product:'Website',notes:''},
 {id:'verified',tenantId:1,customerId:'c1',price:349,status:'Paid',product:'Website',notes:JSON.stringify(paid)},
 {id:'foreign',tenantId:2,customerId:'c2',price:349,status:'Paid',product:'Website',notes:JSON.stringify(paid)},
 {id:'qa',tenantId:1,customerId:'c1',price:1,status:'Paid',product:'SBC Launch QA - $1 Test Service',
   fulfillmentStatus:'QA VERIFIED - NO FULFILLMENT',notes:JSON.stringify({...paid,sbcLaunchQa:{kind:'OWNER_ONLY_ONE_DOLLAR_CHECKOUT'}})}
];
const jobs=[
 {id:'job-status',orderId:'status-only',tenantId:1,vendor:'4over4',value:349},
 {id:'job-valid',orderId:'verified',tenantId:1,vendor:'4over4',value:349},
 {id:'job-foreign',orderId:'foreign',tenantId:2,vendor:'4over4',value:349},
 {id:'job-qa',orderId:'qa',tenantId:1,vendor:'4over4',value:1},
 {id:'job-cross',orderId:'verified',tenantId:2,vendor:'4over4',value:349}
];
const db={orders,customers:[{id:'c1',tenantId:1,website:'x'},{id:'c2',tenantId:2,website:'x'}],
 megaOpsStore:{fulfillmentJobs:jobs}};
global.__SBC_REQUIRE_TENANT=req=>req.tenantId;
register(app,{auth:'AUTH',ownerOnly:'OWNER',getContext:()=>({db,mysqlPool:null})});
(async()=>{
 const r={code:200,status(n){this.code=n;return this},json(v){this.payload=v;return this}};
 const handler=handlers['POST /api/v56131/revenue-loop/wholesale-spool/run'];
 assert.equal(typeof handler,'function');
 await handler({tenantId:1,body:{limit:20},user:{role:'owner'}},r);
 assert.equal(r.code,202);
 assert.equal(r.payload.processed,1,'only one real tenant-bound, Square-proven, non-QA order is queued');
 assert.equal(r.payload.staged[0].orderId,'verified');
 assert.equal(r.payload.staged[0].jobId,'job-valid');
 assert.equal(orders.length,4,'no orders created or modified');
 const status=handlers['GET /api/v56131/revenue-loop/status'];
 const res={code:200,status(n){this.code=n;return this},json(v){this.payload=v;return this}};
 await status({tenantId:1,user:{role:'owner'}},res);
 assert.equal(res.payload.enrichment.pending,1,'tenant two leads cannot inflate tenant one status');
 console.log('[SBC V6631 JOURNEY] PASS: secure CSV/writer/tenant import, Square-proven wholesale queue, QA exclusion and tenant-only counts');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
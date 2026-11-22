'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const STAGE=require('./v66164-stage-owner-csv-1000.cjs');
function extractRoute(source){
 const start=source.indexOf("app.post('/api/crm/leads/import',auth,ownerOnly,");
 const end=source.indexOf("app.get('/api/owner/lead-import/packaged-batch',",start);
 assert(start>=0&&end>start,'existing canonical owner import route is required');
 return source.slice(start,end);
}
function harness(route,{existing,failAt}={}){
 let handler,transactions=0,commits=0,rollbacks=0,inserts=0,reads=0;
 const pool={async getConnection(){return {
  async query(sql,args){
   if(sql.startsWith('SHOW COLUMNS'))return [[{Field:'tenant_id'}]];
   if(sql.startsWith('SELECT id,business_name')){
    reads++;
    if(existing&&args.includes('business 3'))return [[{id:'existing',business_name:'Business 3'}]];
    return [[]];
   }
   if(sql.startsWith('INSERT INTO sbc_customers')){
    inserts++;
    if(failAt&&inserts===failAt)throw Error('Simulated MySQL failure');
    return [{affectedRows:1}];
   }
   throw Error('unexpected query '+sql.slice(0,100));
  },
  async beginTransaction(){transactions++},async commit(){commits++},async rollback(){rollbacks++},release(){}
 }}};
 const data={customers:[]};
 const context={
  app:{post(_route,_auth,_owner,fn){handler=fn}},auth:()=>{},ownerOnly:()=>{},
  require(mod){if(mod==='./enterprise/crm-text-integrity-v66140.cjs')return {inspectBatch:()=>({ok:true})};throw Error(mod)},
  SBC_RUNTIME_READ_ONLY:false,MYSQL_RECOVERY_EVALUATED:true,MYSQL_RECOVERY_REQUIRED:false,sbcWriterLeaseReady:true,
  requireRequestTenant:()=>1,mysqlPool:pool,now:()=>new Date('2026-11-22T12:00:00Z').toISOString(),
  id:x=>x+'-'+(inserts+1),sqlDateTime:x=>x,db:data,console:{error(){}},
 };
 vm.runInNewContext(route,context,{timeout:5000});
 async function call(rows,dryRun){let status=200,payload;
  const res={setHeader(){},status(n){status=n;return this},json(o){payload=o;return this}};
  await handler({body:{rows,dryRun},user:{id:'owner',name:'Owner'}},res);
  return {status,payload};
 }
 return {call,data,get counts(){return {inserts,reads,transactions,commits,rollbacks}}};
}
const rows=n=>Array.from({length:n},(_,i)=>({businessName:'Business '+(i+1),phone:String(3050000000+i),source:'SBC CRM CSV'}));

test('owner CSV accepts 1000 rows as a single atomic writer transaction',async()=>{
 const h=harness(extractRoute(STAGE.patchServer(read('server.js'))));
 const r=await h.call(rows(1000),false);
 assert.equal(r.status,200,JSON.stringify(r.payload));
 assert.equal(r.payload.ok,true);
 assert.equal(r.payload.total,1000);
 assert.equal(r.payload.imported,1000);
 assert.equal(r.payload.duplicates,0);
 assert.deepEqual(h.counts,{inserts:1000,reads:1000,transactions:1,commits:1,rollbacks:0});
 assert.equal(h.data.customers.length,1000);
});
test('1001 is rejected before a database connection or any writes',async()=>{
 const h=harness(extractRoute(STAGE.patchServer(read('server.js'))));
 const r=await h.call(rows(1001),false);
 assert.equal(r.status,400);
 assert.match(r.payload.error,/1 and 1000/);
 assert.equal(h.counts.inserts,0);
});
test('1000-row preview is read-only and server reports existing and in-file duplicates',async()=>{
 const list=rows(1000);list[5].businessName=list[0].businessName;
 const h=harness(extractRoute(STAGE.patchServer(read('server.js'))),{existing:true});
 const r=await h.call(list,true);
 assert.equal(r.status,200,JSON.stringify(r.payload));
 assert.equal(r.payload.dryRun,true);
 assert.equal(r.payload.total,1000);
 assert.equal(r.payload.imported,0);
 assert.equal(r.payload.duplicates,2);
 assert.equal(h.counts.inserts,0);
 assert.equal(h.counts.commits,0);
});
test('failure at row 700 rolls back the entire 1000-row import',async()=>{
 const h=harness(extractRoute(STAGE.patchServer(read('server.js'))),{failAt:700});
 const r=await h.call(rows(1000),false);
 assert.equal(r.status,500);
 assert.equal(h.counts.commits,0);
 assert.equal(h.counts.rollbacks,1);
 assert.equal(h.data.customers.length,0);
});
test('both owner CSV UIs allow exactly 1000, show same cap, and keep duplicate checks',()=>{
 for(const prefix of ['public/','browser_public/']){
  const app=read(prefix+'app.js');
  assert.match(app,/rows\.length>1000/);
  assert.match(app,/Maximum 1000 rows per batch/);
  assert.match(app,/api\/crm\/leads\/import/);
  const overlay=read(prefix+'sbc-lead-import-v6541.js');
  assert.match(overlay,/rows\.length>1000/);
  assert.match(overlay,/1000 rows per import/);
  assert.match(overlay,/duplicates/);
 }
 assert.equal(read('public/app.js'),read('browser_public/app.js'));
 assert.equal(read('public/sbc-lead-import-v6541.js'),read('browser_public/sbc-lead-import-v6541.js'));
});
test('staging is idempotent and cannot rewrite unrelated or already-unsafe server',()=>{
 const baseline=read('server.js'),patched=STAGE.patchServer(baseline);
 assert.match(patched,/SBC_V66164_OWNER_CSV_1000/);
 assert(patched.includes('/sbc-lead-import-v6541.js?v=66.164-owner-csv-1000'));
 assert.equal(STAGE.patchServer(patched),patched);
 assert.throws(()=>STAGE.patchServer('unrelated code'),/OWNER_CSV_IMPORT_ROUTE_NOT_FOUND/);
});

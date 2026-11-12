'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const register=require('../routes/v56131-revenue-finisher.js');
function harness({failInsert=0,failCommit=false,failAssist=false,failSave=false}={}){
 let handler,queries=0,commits=0,rollbacks=0,releases=0,assists=0,activity=0;
 const durable=[],pending=[],db={customers:[]};
 const query=async(_sql,args)=>{queries++;if(queries===failInsert)throw Error('SYNTHETIC_INSERT_FAILURE');pending.push(args)};
 const connection={beginTransaction:async()=>{},query,commit:async()=>{commits++;if(failCommit)throw Error('SYNTHETIC_ACK_LOST');durable.push(...pending)},rollback:async()=>{rollbacks++;pending.length=0},release:()=>{releases++}};
 const ctx={writerReady:true,db,mysqlPool:{getConnection:async()=>connection,query:async(...args)=>{await query(...args);durable.push(pending.pop())}},saveData:async()=>{if(failSave)throw Error('SYNTHETIC_SAVE_FAILURE')},enqueueLeadAssist:async()=>{assists++;assert.equal(durable.length,2,'assist must follow batch commit');if(failAssist)throw Error('SYNTHETIC_QUEUE_FAILURE')},addActivity:()=>{activity++}};
 register({post:(p,...h)=>{if(p.endsWith('/bulk-ingest'))handler=h.at(-1)},get:()=>{}},{auth(){},ownerOnly(){},getContext:()=>ctx});
 return {db,durable,counts:()=>({queries,commits,rollbacks,releases,assists,activity}),async submit(){
  const old=global.__SBC_REQUIRE_TENANT;global.__SBC_REQUIRE_TENANT=()=>1;
  try{let status=200,body;const res={status(n){status=n;return this},json(x){body=x;return this}};
   await handler({tenantId:1,user:{role:'lead_researcher'},body:{filename:'synthetic.csv',contentBase64:Buffer.from('Business Name,Phone\nFirst Company,3055550101\nSecond Company,3055550102\n').toString('base64')}},res);
   return {status,body};
  }finally{global.__SBC_REQUIRE_TENANT=old}
 }};
}
test('second insert failure rolls back the entire batch with no memory or queue changes',async()=>{
 const h=harness({failInsert:2});const r=await h.submit();
 assert.equal(r.status,503);assert.equal(r.body.noLeadsWritten,true);
 assert.equal(h.durable.length,0);assert.equal(h.db.customers.length,0);
 assert.deepEqual(h.counts(),{queries:2,commits:0,rollbacks:1,releases:1,assists:0,activity:0});
});
test('successful batch commits once before memory and downstream work',async()=>{
 const h=harness();const r=await h.submit();assert.equal(r.status,201);assert.equal(r.body.added,2);
 assert.equal(h.durable.length,2);assert.equal(h.db.customers.length,2);
 assert.deepEqual(h.counts(),{queries:2,commits:1,rollbacks:0,releases:1,assists:2,activity:1});
});
test('uncertain COMMIT result requires reconciliation and never recommends retry',async()=>{
 const h=harness({failCommit:true});const r=await h.submit();
 assert.equal(r.status,503);assert.equal(r.body.code,'LEAD_IMPORT_COMMIT_UNCONFIRMED');
 assert.equal(r.body.retryable,false);assert.equal(r.body.reconciliationRequired,true);
 assert.notEqual(r.body.noLeadsWritten,true);assert.equal(h.db.customers.length,0);
 assert.equal(h.counts().assists,0);assert.equal(h.counts().releases,1);
});
test('downstream failure after commit reports saved leads and warns against reimport',async()=>{
 for(const option of [{failAssist:true},{failSave:true}]){
  const h=harness(option);const r=await h.submit();
  assert.equal(r.status,201);assert.equal(r.body.ok,true);assert.equal(r.body.added,2);
  assert.equal(r.body.followUpRequired,true);assert.equal(r.body.retryable,false);
  assert.equal(h.durable.length,2);assert.equal(h.db.customers.length,2);
 }
});

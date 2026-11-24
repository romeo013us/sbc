'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {captureCallRouting,restoreCallRouting}=require('../enterprise/integration/sbc-snapshot-tenants.cjs');
const routing=require('../enterprise/sbc-call-routing-v1.cjs');
const now='2026-11-24T14:00:00Z';
const c=(id,tenantId,fields={})=>({id,tenantId,phone:'+13055550101',status:'Lead',...fields});
const u=(id,tenantId,fields={})=>({id,tenantId,role:'account_manager',active:true,...fields});
test('restart preserves Pending, Spanish and suppression decisions without inventing calls',()=>{
 const pending=c('pending',1),spanish=c('spanish',1),blocked=c('blocked',1,{doNotCall:true});
 for(const [account,outcome] of [[pending,'Pending'],[spanish,'Spanish callback needed']])routing.routingUpdate(account,{id:'attempt-'+account.id,customerId:account.id,tenantId:1,status:'ended',outcome,endedAt:now},now);
 const source={customers:[pending,spanish,blocked],users:[u('rep',1,{spanishCallingApprovedByOwner:true})]};
 const restarted={customers:[c('pending',1),c('spanish',1),c('blocked',1)],users:[u('rep',1)]};
 restoreCallRouting(restarted,JSON.parse(JSON.stringify(captureCallRouting(source))));
 assert.equal(restarted.customers[0].salesQueueState,'contacted_review');
 assert.equal(restarted.customers[1].preferredContactLanguage,'es');
 assert.equal(restarted.customers[1].phone,source.customers[1].phone);
 assert.deepEqual(routing.spanishCallbacks(restarted.customers,1).map(x=>x.id),['spanish']);
 for(const customer of restarted.customers)assert.equal(routing.eligibleForEnglish(customer,[],1,new Date(now)),false);
 assert.equal(routing.isSpanishApproved(restarted.users[0]),true);
 assert.equal(restarted.customers[0].status,'Lead');
});
test('foreign tenant, inactive staff, revoked approval and changed role cannot inherit approval',()=>{
 const source={customers:[c('shared',1,{salesQueueState:'spanish_callback',doNotCall:true,phone:'not copied'})],users:[u('rep',1,{spanishCallingApprovedByOwner:true}),u('revoked',1,{spanishCallingApprovedByOwner:false})]};
 const restarted={customers:[c('shared',2),c('shared',1)],users:[u('rep',2),u('rep',1,{active:false}),u('revoked',1),u('rep',1,{role:'caller'})]};
 restoreCallRouting(restarted,captureCallRouting(source));
 assert.equal(restarted.customers[0].salesQueueState,undefined);
 assert.equal(restarted.customers[1].doNotCall,true);
 assert.equal(restarted.customers[1].phone,'+13055550101');
 assert(restarted.users.every(x=>!routing.isSpanishApproved(x)));
});
test('recover exact legacy saved staff approval without inventing old customer routing',()=>{
 const target={customers:[c('old',1)],users:[u('rep',1),u('rep',2),u('other',1)]};
 restoreCallRouting(target,undefined,[u('rep',1,{spanishCallingApprovedByOwner:true})]);
 assert.equal(target.customers[0].salesQueueState,undefined);
 assert.equal(target.users[0].spanishCallingApprovedByOwner,true);
 assert.equal(target.users[1].spanishCallingApprovedByOwner,false);
 assert.equal(target.users[2].spanishCallingApprovedByOwner,false);
});
test('whitelist and conflicting snapshot identity guard',()=>{
 const payload=captureCallRouting({customers:[c('bad',1,{tenant_id:2,doNotCall:true}),c('safe',1,{salesQueueState:'retired',password:'not copied'})],users:[]});
 assert.equal(payload.customers.length,1);assert.deepEqual(payload.customers[0].fields,{salesQueueState:'retired'});
 const destination={customers:[c('safe',1)],users:[]};
 assert.throws(()=>restoreCallRouting(destination,{...payload,customers:[...payload.customers,...payload.customers]}),/CALL_ROUTING_SNAPSHOT_DUPLICATE/);
 assert.equal(destination.customers[0].salesQueueState,undefined);
});
test('canonical writer and loader use the existing atomic workspace snapshot',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');new vm.Script(source);
 const reader=source.slice(source.indexOf('async function readRelational(){'),source.indexOf('async function writeRelational('));
 const writer=source.slice(source.indexOf('async function writeRelational('),source.indexOf('async function mysqlKeepalive('));
 assert.match(reader,/db=normalize\([\s\S]*SNAPSHOT_TENANTS\.restoreCallRouting\(db,extra\.callRoutingStateV1,extra\.users\)/);
 assert.match(writer,/await conn\.beginTransaction\(\);[\s\S]*callRoutingStateV1:SNAPSHOT_TENANTS\.captureCallRouting\(db\)[\s\S]*INSERT INTO sbc_workspace[\s\S]*await conn\.commit\(\)/);
 assert.match(writer,/callLogs:\(db\.callLogs\|\|\[\]\)\.slice\(0,1000\)/);
});

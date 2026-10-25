'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {apply,MARKER}=require('../hotfix-assets/apply-v6628-kim-canonical-db-rebind.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6628-'));
const put=(rel,src)=>{const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,src)};
try{
 put('server.js',[
  'MYSQL_RECOVERY_REQUIRED SBC_RUNTIME_WRITER_LEASE_REQUIRED',
  'const SBC_KIM_MISSION=KIM_MISSION_ENGINE.createController({db,saveData,audit,other:true});'
 ].join('\n'));
 put('routes/v56135-kim-mission.js',"router.post('/mission',(req)=>global.__SBC_REQUIRE_TENANT(req));");
 put('enterprise/v56135-kim-mission-controller.js',[
  "'use strict';",
  "const VERSION='TEST';",
  "const MAX_BATCH=20;",
  "function sbcAdvisoryScreen(db,tenantId){return {tenantId,total:db.customers.length}}",
  "function createController({db,saveData,audit,other}={}){",
  "  const state={version:VERSION,lastCycleAt:'',running:false};",
  "  function findCustomer(id){return (db?.customers||[]).find(c=>String(c.id)===String(id));}",
  "  async function runMission(customer,interactionData={},options={}){",
  "    if(!customer)throw new Error('Customer is required.');",
  "    if(!Number.isSafeInteger(Number(customer.tenantId))||Number(customer.tenantId)<1)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED'});",
  "    return {id:customer.id,tag:customer.tag};",
  "  }",
  "  async function reconcilePaidOrders(limit=MAX_BATCH,tenantId=null){return {orders:db.orders.length};}",
  "  async function cycle({advisoryOnly=false,tenantId=null,limit=5}={}){",
  "    if(state.running)return {ok:true,skipped:true,reason:'cycle_already_running'};",
  "    if(advisoryOnly)return sbcAdvisoryScreen(db,tenantId,limit,eligible,recentMission);",
  "  }",
  "  function overview(){return {version:VERSION,customers:db.customers.length};}",
  "  return {findCustomer,runMission,reconcilePaidOrders,cycle,overview};",
  "}",
  "module.exports={createController};"
 ].join('\n'));
 const r=apply(root);
 assert.equal(r.changed,true);
 const kim=fs.readFileSync(path.join(root,'enterprise/v56135-kim-mission-controller.js'),'utf8');
 assert.match(kim,/function refreshCanonicalDb/);
 assert.match(kim,/CRM_CANONICAL_DATA_UNAVAILABLE/);
 assert.match(kim,/CRM_CUSTOMER_CONTEXT_STALE/);
 assert.match(kim,/if\(advisoryOnly\)return sbcAdvisoryScreen\(db/);
 assert.match(fs.readFileSync(path.join(root,'server.js'),'utf8'),/getCanonicalDb:\(\)=>db/);
 assert.throws(()=>apply(root),/duplicate patch/);
 const ctx={module:{exports:{}},Number,Array,Object,String,Error};vm.createContext(ctx);
 vm.runInContext(kim,ctx);
 const original={customers:[{id:1,tenantId:1,tag:'old'}],orders:[]};
 let canonical={customers:[{id:1,tenantId:1,tag:'new'},{id:2,tenantId:1}],orders:[{id:20}]};
 const ctl=ctx.module.exports.createController({db:original,getCanonicalDb:()=>canonical});
 assert.equal(ctl.overview().customers,2);
 ctl.cycle({advisoryOnly:true,tenantId:1}).then(async out=>{
  assert.equal(out.total,2);
  assert.equal((await ctl.runMission(original.customers[0])).tag,'new','mission must use canonical row');
  assert.equal((await ctl.reconcilePaidOrders()).orders,1);
  canonical={customers:[{id:9,tenantId:1}],orders:[]};
  assert.equal((await ctl.cycle({advisoryOnly:true,tenantId:1})).total,1);
  await assert.rejects(ctl.runMission(original.customers[0]),/CRM_CUSTOMER_CONTEXT_STALE/);
  console.log('SBC V6628 Kim live DB rebind and stale-customer guard PASS');
 }).catch(e=>{console.error(e);process.exitCode=1;});
}finally{fs.rmSync(root,{recursive:true,force:true})}
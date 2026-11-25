'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createController}=require('../enterprise/v56135-kim-mission-controller.js');

function customer(id,tenantId,leadTemperature,verificationStatus,extras={}){
 return {id,tenantId,leadTemperature,verificationStatus,status:'Lead',...extras};
}
test('advisory explains warm/hot qualification gaps without auto-promoting anyone or leaking records',async()=>{
 const db={orders:[],customers:[
  customer('unverified-sensitive-name',1,'Warm','Needs Verification'),
  customer('sales-ready',1,'Hot','Sales Ready'),
  customer('dnc',1,'Warm','Sales Ready',{doNotContact:true}),
  customer('already-customer',1,'Hot','Sales Ready',{status:'active'}),
  customer('cold',1,'Cold','Needs Verification'),
  customer('another-tenant',2,'Hot','Sales Ready'),
  customer('unresolved',null,'Warm','Sales Ready')
 ]};
 const info=[];const logger={info:(...args)=>info.push(args),warn:()=>{},error:()=>{}};
 const service=createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},logger});
 const out=await service.cycle({tenantId:1,limit:20,advisoryOnly:true});
 assert.equal(out.tenantCustomers,5);
 assert.equal(out.tenantWarmHot,4);
 assert.equal(out.qualifiedWarmHot,1);
 assert.equal(out.prospects,1);
 assert.equal(out.unresolvedTenantRecords,1);
 assert.deepEqual(out.qualificationReasons,{
   warmHotTotal:4,warmHotQualified:1,warmHotNeedsVerification:1,
   warmHotSuppressed:1,warmHotExistingCustomer:1,warmHotOther:0
 });
 assert.equal(out.externalActions,0);
 assert.equal(out.writeAttempts,0);
 const diagnostic=info.find(row=>String(row[0]).includes('eligibility reasons'));
 assert(diagnostic,'safe aggregate eligibility explanation should be logged for the operator');
 const dump=JSON.stringify(diagnostic);
 assert(!dump.includes('unverified-sensitive-name'));
 assert(!dump.includes('another-tenant'));
 assert(!dump.includes('sales-ready'));
});

test('no verified warm/hot customers emits counts but never claims all leads are qualified',async()=>{
 const db={orders:[],customers:[customer('lead1',1,'Hot','Owner Review'),customer('lead2',1,'Warm','Needs Verification')]};
 const out=await createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},logger:{info(){}}}).cycle({tenantId:1,advisoryOnly:true});
 assert.equal(out.qualifiedWarmHot,0);
 assert.equal(out.qualificationReasons.warmHotNeedsVerification,2);
 assert.equal(out.qualificationReasons.warmHotQualified,0);
});

test('Kim produces one evidence-based departmental operating plan without executing actions',async()=>{
 const captured=(id,price,extra={})=>({id,tenantId:1,customerId:'lead1',price,status:'New',paymentStatus:'Paid',squareOrderId:'order_'+id,squarePaymentId:'receipt_'+id,squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:new Date().toISOString(),...extra});
 const db={customers:[customer('lead1',1,'Hot','Sales Ready'),customer('verify1',1,'Warm','Needs Verification'),customer('blocked',1,'Hot','Sales Ready',{doNotContact:true}),customer('foreign',2,'Hot','Sales Ready')],orders:[
 captured('ready',199),captured('held',10000),captured('duplicate_a',499),captured('duplicate_b',499,{squarePaymentId:'receipt_duplicate_a'}),captured('fulfilled',799,{status:'Delivered'}),captured('foreign',900,{tenantId:2}),captured('qaorder_123',1),captured('synthetic',999,{testMode:true})
 ],fulfillmentJobs:[]};
 const original=JSON.stringify(db);
 const service=createController({db,getCanonicalDb:()=>db,tenBrain:{BRAINS:[]},saveData(){throw Error('unexpected write')},logger:{info(){}}});
 const out=await service.cycle({tenantId:1,advisoryOnly:true});
 const plan=out.operatingPlan;
 assert.equal(plan.scope,'TENANT_CANONICAL_SNAPSHOT');assert.equal(plan.execution,'ADVISORY_ONLY');
 assert.equal(plan.commercial.recognizedRevenueCents,1099800);
 assert.equal(plan.commercial.paymentIdentityConflicts,1);
 assert.equal(plan.departments.find(d=>d.id==='sales').decisions.find(d=>d.code==='HUMAN_SALES_REVIEW').count,1);
 assert.equal(plan.departments.find(d=>d.id==='research').decisions.find(d=>d.code==='VERIFY_WARM_HOT').count,1);
 assert.equal(plan.departments.find(d=>d.id==='fulfillment').decisions.find(d=>d.code==='PAID_WITHOUT_JOB').count,1);
 assert.equal(plan.departments.find(d=>d.id==='owner').decisions.find(d=>d.code==='OWNER_CLEARANCE').count,1);
 assert.equal(plan.departments.find(d=>d.id==='finance').decisions.find(d=>d.code==='PAYMENT_RECONCILIATION').count,2);
 assert.equal(JSON.stringify(db),original);assert(!JSON.stringify(plan).includes('receipt_'));assert(!JSON.stringify(plan).includes('lead1'));
});
test('Kim treats unavailable or unscoped fulfillment job evidence as unknown, not zero backlog',async()=>{
 const db={customers:[],orders:[{id:'o',tenantId:1,price:199,status:'New',squareOrderId:'order_o',squarePaymentId:'receipt_o',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:new Date().toISOString()}]};
 const service=createController({db,tenBrain:{BRAINS:[]},logger:{info(){}}});
 const a=await service.cycle({tenantId:1,advisoryOnly:true});
 assert.equal(a.operatingPlan.coverage.fulfillment,'UNAVAILABLE');
 assert.equal(a.operatingPlan.departments.find(d=>d.id==='fulfillment').decisions[0].count,null);
 db.fulfillmentJobs=[{id:'job1',orderId:'o'}];
 const b=await service.cycle({tenantId:1,advisoryOnly:true});
 assert.equal(b.operatingPlan.coverage.fulfillment,'UNSCOPED_RECORDS');
 assert.equal(b.operatingPlan.departments.find(d=>d.id==='fulfillment').decisions[0].count,null);
});

test('owner-only GET plan uses authenticated tenant, never an execution cycle',async()=>{
 const register=require('../routes/v56135-kim-mission');
 const handlers=new Map(),auth=()=>{},ownerOnly=()=>{};
 const prior=global.__SBC_REQUIRE_TENANT;
 global.__SBC_REQUIRE_TENANT=req=>req.tenant;
 let observed;
 const controller={cycle:async opts=>{observed=opts;return {ok:true,advisoryOnly:true,operatingPlan:{schema:1,execution:'ADVISORY_ONLY',scope:'TENANT_CANONICAL_SNAPSHOT',departments:[]}}}};
 register({get:(p,...h)=>handlers.set(p,h),post(){}},{auth,ownerOnly,getController:()=>controller});
 const route=handlers.get('/api/v56135/kim-mission/operating-plan');
 assert.equal(route[0],auth);assert.equal(route[1],ownerOnly);
 const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(x){this.body=x;return this}});
 try{
  let res=response();await route[2]({tenant:7,user:{role:'owner'},query:{tenantId:99,advisoryOnly:false}},res);
  assert.equal(res.code,200);assert.equal(observed.tenantId,7);assert.equal(observed.advisoryOnly,true);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body.operatingPlan.execution,'ADVISORY_ONLY');
  controller.cycle=async()=>({ok:true,skipped:true});
  res=response();await route[2]({tenant:7,user:{role:'owner'}},res);assert.equal(res.code,503);assert.equal(res.body.ok,false);
 }finally{global.__SBC_REQUIRE_TENANT=prior;}
});
test('Kim owner interface presents departmental evidence and isolates legacy controls',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const js=fs.readFileSync(path.join(__dirname,'../public/kim-operations-os.js'),'utf8');
 const win={},calls=[];let unavailable=false;
 const plan={schema:1,scope:'TENANT_CANONICAL_SNAPSHOT',execution:'ADVISORY_ONLY',coverage:{fulfillment:'UNAVAILABLE'},commercial:{recognizedRevenueCents:19901,recognizedPaidOrders:1,proof:'Recorded capture only'},departments:[{id:'finance',decisions:[{code:'PAYMENT_RECONCILIATION',count:2,priority:0,status:'REVIEW_REQUIRED',action:'Review <unsafe> receipts'}]},{id:'fulfillment',decisions:[{code:'PAID_WITHOUT_JOB',count:null,priority:1,status:'EVIDENCE_REQUIRED',action:'Review job evidence'}]}]};
 const ctx={window:win,document:{querySelector:()=>null},addEventListener(){},fetch:async(url,opts)=>{calls.push({url,opts});return {ok:!unavailable||url!=='/api/v56135/kim-mission/operating-plan',json:async()=>url==='/api/v56135/kim-mission/operating-plan'?{ok:true,operatingPlan:plan}:{ok:true,production:{counts:{Staged:3},checklists:[],exceptions:[]}}}}};
 vm.runInNewContext(js,ctx);
 const html=await win.sbcKimOperationsView();
 assert.match(html,/Department operating plan/i);assert.match(html,/199\.01/);assert.match(html,/Payment reconciliation/i);assert.match(html,/Evidence required/i);assert.match(html,/Review &lt;unsafe&gt; receipts/);assert(!html.includes('<unsafe>'));
 assert.match(html,/<details[^>]*>.*Existing production controls/s);
 assert(calls.every(c=>!c.opts.method||c.opts.method==='GET'));
 unavailable=true;const failed=await win.sbcKimOperationsView();assert.match(failed,/Operating plan unavailable/i);assert(!failed.includes('199.01'));
});

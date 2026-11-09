'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {stagePaidCheckoutPlan,completeStep,buildPlan}=require('../enterprise/fulfillment-v2-durable-plan.cjs');
const input=()=>({tenantId:1,checkoutLedgerId:25,orderId:'ord_1234567',sku:'sbc_starter_199',catalogMetadata:{fulfillmentServices:[{code:'starter_website'},{code:'business_cards',quantity:100}]}});
class FakeConnection {
 constructor(){this.rows=[];this.writes=0;}
 async query(sql,args){
   const q=sql.replace(/\s+/g,' ').trim();
   if(q.startsWith('SELECT plan_hash'))return [this.rows.filter(x=>x.tenant_id===args[0]&&x.checkout_ledger_id===args[1]).map(x=>({plan_hash:x.plan_hash}))];
   if(q.startsWith('INSERT INTO sbc_fulfillment_plan_steps')){
     const [tenant_id,checkout_ledger_id,order_id,sku,step_key,plan_hash,service_code,line_number,quantity,lane,description,depends_on_json,status]=args;
     if(!this.rows.some(x=>x.tenant_id===tenant_id&&x.checkout_ledger_id===checkout_ledger_id&&x.step_key===step_key))this.rows.push({tenant_id,checkout_ledger_id,order_id,sku,step_key,plan_hash,service_code,line_number,quantity,lane,description,depends_on_json,status});
     this.writes++;return [{affectedRows:1}];
   }
   if(q.startsWith('SELECT step_key,status'))return [this.rows.filter(x=>x.tenant_id===args[0]&&x.checkout_ledger_id===args[1])];
   if(q.startsWith('UPDATE sbc_fulfillment_plan_steps')){
     const [status,a,b,c,d,e,f]=args;
     const isComplete=q.includes('evidence_json=?');
     const row=this.rows.find(x=>x.tenant_id===(isComplete?c:a)&&x.checkout_ledger_id===(isComplete?d:b)&&x.step_key===(isComplete?e:c));
     if(!row)throw Error('MOCK_UPDATE_MISSING');
     row.status=status;
     if(isComplete){row.evidence_json=a;row.completed_by=b;}
     return [{affectedRows:1}];
   }
   throw Error('UNEXPECTED_SQL:'+q.slice(0,70));
 }
}
test('durably stages all services and shared intake with zero AI',async()=>{
 const db=new FakeConnection(),res=await stagePaidCheckoutPlan(db,input());
 assert.equal(res.status,'STAGED');assert.equal(res.stepsPlanned,db.rows.length);
 assert.equal(res.aiCalls,0);assert.equal(db.rows.filter(x=>x.step_key==='shared_customer_intake').length,1);
 assert(db.rows.some(x=>x.step_key.endsWith('business_cards_vendor_purchase_approval')));
});
test('repeat checkout event is idempotent',async()=>{
 const db=new FakeConnection();await stagePaidCheckoutPlan(db,input());const n=db.rows.length;
 await stagePaidCheckoutPlan(db,input());assert.equal(db.rows.length,n);
});
test('unmapped SKU does not stage guessed work',async()=>{
 const db=new FakeConnection(),i=input();i.catalogMetadata={};const result=await stagePaidCheckoutPlan(db,i);
 assert.equal(result.status,'NEEDS_CATALOG_MAPPING');assert.equal(db.rows.length,0);
});
test('changed recipe cannot silently mutate existing order',async()=>{
 const db=new FakeConnection(),i=input();await stagePaidCheckoutPlan(db,i);
 const j=input();j.catalogMetadata={fulfillmentServices:[{code:'office_box'}]};
 await assert.rejects(stagePaidCheckoutPlan(db,j),{code:'FULFILLMENT_PLAN_DRIFT_RECONCILIATION_REQUIRED'});
});
test('shared intake completion unlocks each service intake',async()=>{
 const db=new FakeConnection();await stagePaidCheckoutPlan(db,input());
 const result=await completeStep(db,{tenantId:1,checkoutLedgerId:25,stepKey:'shared_customer_intake',actorId:'employee_123',evidence:{reference:'crm:customer-123'}});
 assert.equal(result.status,'COMPLETED');assert.equal(result.unblocked.length,2);
 assert(result.unblocked.every(x=>x.status==='WAITING_CUSTOMER'));
});
test('completing a dependent step before its prerequisite fails',async()=>{
 const db=new FakeConnection();await stagePaidCheckoutPlan(db,input());
 await assert.rejects(completeStep(db,{tenantId:1,checkoutLedgerId:25,stepKey:'line1_starter_website_build',actorId:'employee_123',evidence:{reference:'site:1'}}),{code:'FULFILLMENT_STEP_NOT_READY'});
});
test('duplicate step completion is safe',async()=>{
 const db=new FakeConnection();await stagePaidCheckoutPlan(db,input());const req={tenantId:1,checkoutLedgerId:25,stepKey:'shared_customer_intake',actorId:'employee_123',evidence:{reference:'crm:customer-123'}};
 await completeStep(db,req);assert.equal((await completeStep(db,req)).status,'ALREADY_COMPLETED');
});
test('evidence and tenant context required for completion',async()=>{
 const db=new FakeConnection();await stagePaidCheckoutPlan(db,input());
 const p={tenantId:1,checkoutLedgerId:25,stepKey:'shared_customer_intake',actorId:'employee_123'};
 await assert.rejects(completeStep(db,p),{code:'FULFILLMENT_EVIDENCE_REQUIRED'});
 await assert.rejects(completeStep(db,{...p,tenantId:2,evidence:{reference:'abc'}}),{code:'FULFILLMENT_STEP_NOT_FOUND'});
});
test('nothing in blueprint is an OpenAI API call',()=>{
 assert.equal(buildPlan(input()).executionAllowed,false);
});

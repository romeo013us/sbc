'use strict';
// SBC Fulfillment 2.0: transactional, idempotent paid-checkout work planning.
// Does not execute steps, make purchases, send emails, or call AI.
const crypto = require('node:crypto');
const {isDeepStrictEqual} = require('node:util');
const {compile} = require('./fulfillment-v2-blueprints.cjs');
const LANES = Object.freeze({customer:'WAITING_CUSTOMER', owner:'WAITING_OWNER', specialist:'READY_SPECIALIST', adapter_or_specialist:'READY_SPECIALIST', automation:'READY_AUTOMATION'});
const DONE='COMPLETED';
function fail(code){throw Object.assign(new Error(code),{code});}
function servicesFromCatalog(metadata){
  if (!metadata || typeof metadata!=='object' || !Array.isArray(metadata.fulfillmentServices)) return [];
  // Only allow explicit service codes from server-owned product catalog metadata.
  return metadata.fulfillmentServices.map(x=> typeof x==='string'?{code:x,quantity:1}:x);
}
function buildPlan(input){
  const services=servicesFromCatalog(input.catalogMetadata);
  return compile({tenantId:input.tenantId,orderId:input.orderId,sku:input.sku,services});
}
function fingerprint(plan){
  return crypto.createHash('sha256').update(JSON.stringify({version:plan.version,tenantId:plan.tenantId,sku:plan.sku,steps:plan.steps})).digest('hex');
}
function statusFor(step){return step.dependsOn.length?'WAITING_DEPENDENCIES':LANES[step.lane];}
async function stagePaidCheckoutPlan(connection,input){
  if (!connection || typeof connection.query!=='function') fail('FULFILLMENT_DB_REQUIRED');
  if(!Number.isSafeInteger(Number(input.checkoutLedgerId)) || Number(input.checkoutLedgerId)<1) fail('FULFILLMENT_CHECKOUT_LEDGER_REQUIRED');
  const plan=buildPlan(input);
  if(plan.status!=='PLANNED')return {status:'NEEDS_CATALOG_MAPPING',stepsPlanned:0,reason:plan.unmappedCodes||[]};
  const hash=fingerprint(plan);
  // Called only inside existing checkout worker transaction with checkout ledger FOR UPDATE.
  const [existing]=await connection.query(
    'SELECT plan_hash,order_id,sku,step_key,service_code,line_number,quantity,lane,description,depends_on_json FROM sbc_fulfillment_plan_steps WHERE tenant_id=? AND checkout_ledger_id=? FOR UPDATE',
    [plan.tenantId,Number(input.checkoutLedgerId)]);
  // Existing work must match the entire immutable recipe. A partial plan is
  // evidence of drift, not permission to recreate steps with possible side effects.
  if(existing.length){
    const expected=new Map(plan.steps.map(step=>[step.id,step]));
    const seen=new Set();
    const matches=existing.length===plan.steps.length&&existing.every(row=>{
      const step=expected.get(row.step_key);
      if(!step||seen.has(row.step_key))return false;
      seen.add(row.step_key);
      let prerequisites;
      try{prerequisites=dependencies(row.depends_on_json);}catch{return false;}
      return row.plan_hash===hash&&String(row.order_id)===plan.orderId&&String(row.sku)===plan.sku&&
        row.service_code===step.serviceCode&&Number(row.line_number)===step.line&&Number(row.quantity)===step.quantity&&
        row.lane===step.lane&&row.description===step.description&&isDeepStrictEqual(prerequisites,step.dependsOn);
    });
    if(!matches)fail('FULFILLMENT_PLAN_DRIFT_RECONCILIATION_REQUIRED');
    return {status:'STAGED',stepsPlanned:plan.steps.length,planHash:hash,autoExecutableCount:plan.steps.filter(x=>x.lane==='automation').length,aiCalls:0};
  }
  for(const step of plan.steps){
    await connection.query('INSERT INTO sbc_fulfillment_plan_steps (tenant_id,checkout_ledger_id,order_id,sku,step_key,plan_hash,service_code,line_number,quantity,lane,description,depends_on_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE step_key=step_key',
      [plan.tenantId,Number(input.checkoutLedgerId),plan.orderId,plan.sku,step.id,hash,step.serviceCode,step.line,step.quantity,step.lane,step.description,JSON.stringify(step.dependsOn),statusFor(step)]);
  }
  return {status:'STAGED',stepsPlanned:plan.steps.length,planHash:hash,autoExecutableCount:plan.steps.filter(x=>x.lane==='automation').length,aiCalls:0};
}
function dependencies(value){
  let v=value;
  if(typeof v==='string'){try{v=JSON.parse(v)}catch{fail('FULFILLMENT_DEPENDENCY_JSON_INVALID')}}
  if(!Array.isArray(v)||v.some(x=>typeof x!=='string'))fail('FULFILLMENT_DEPENDENCY_JSON_INVALID');
  return v;
}
function actionable(rows){
  const statuses=new Map(rows.map(x=>[String(x.step_key),x.status]));
  return rows.filter(x=>Object.hasOwn(LANES,x.lane)&&x.status===LANES[x.lane]&&dependencies(x.depends_on_json).every(key=>statuses.get(key)===DONE));
}
// Must be invoked inside a transaction by a server-side authenticated operation.
// It updates only SBC-owned work records, never external suppliers.
async function completeStep(connection,{tenantId,checkoutLedgerId,stepKey,evidence,actorId}={}){
  const t=Number(tenantId),ledger=Number(checkoutLedgerId);
  if(!Number.isSafeInteger(t)||t<1||!Number.isSafeInteger(ledger)||ledger<1)fail('FULFILLMENT_IDENTITY_REQUIRED');
  if(!/^[A-Za-z0-9._:-]{1,191}$/.test(String(stepKey||'')))fail('FULFILLMENT_STEP_KEY_INVALID');
  if(!/^[A-Za-z0-9._:-]{1,120}$/.test(String(actorId||'')))fail('FULFILLMENT_ACTOR_REQUIRED');
  // Evidence must be provided by trusted caller and verified for external side effects.
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence)||!String(evidence.reference||'').trim()||JSON.stringify(evidence).length>4096)fail('FULFILLMENT_EVIDENCE_REQUIRED');
  const [rows]=await connection.query('SELECT step_key,status,lane,depends_on_json,evidence_json,completed_by FROM sbc_fulfillment_plan_steps WHERE tenant_id=? AND checkout_ledger_id=? FOR UPDATE',[t,ledger]);
  const step=rows.find(x=>x.step_key===stepKey);
  if(!step)fail('FULFILLMENT_STEP_NOT_FOUND');
  if(step.status===DONE){
    let savedEvidence,requestedEvidence;
    try{
      savedEvidence=typeof step.evidence_json==='string'?JSON.parse(step.evidence_json):step.evidence_json;
      requestedEvidence=JSON.parse(JSON.stringify(evidence));
    }catch{fail('FULFILLMENT_COMPLETION_REPLAY_CONFLICT');}
    if(!savedEvidence||String(step.completed_by||'')!==String(actorId)||!isDeepStrictEqual(savedEvidence,requestedEvidence))fail('FULFILLMENT_COMPLETION_REPLAY_CONFLICT');
    return {status:'ALREADY_COMPLETED',unblocked:[]};
  }
  if(!Object.hasOwn(LANES,step.lane))fail('FULFILLMENT_STEP_LANE_INVALID');
  const allowed=LANES[step.lane];
  if(step.status!==allowed)fail('FULFILLMENT_STEP_NOT_READY');
  const map=new Map(rows.map(x=>[String(x.step_key),x.status]));
  if(!dependencies(step.depends_on_json).every(k=>map.get(k)===DONE))fail('FULFILLMENT_DEPENDENCY_INCOMPLETE');
  const [completed]=await connection.query('UPDATE sbc_fulfillment_plan_steps SET status=?,evidence_json=?,completed_by=?,completed_at=NOW(),updated_at=NOW() WHERE tenant_id=? AND checkout_ledger_id=? AND step_key=? AND status=?', [DONE,JSON.stringify(evidence),actorId,t,ledger,stepKey,allowed]);
  if(completed?.affectedRows!==1)fail('FULFILLMENT_COMPLETION_WRITE_CONFLICT');
  map.set(stepKey,DONE);
  const ready=[];
  for(const item of rows){
    if(item.status!=='WAITING_DEPENDENCIES')continue;
    if(dependencies(item.depends_on_json).every(k=>map.get(k)===DONE)){
      if(!Object.hasOwn(LANES,item.lane))fail('FULFILLMENT_STEP_LANE_INVALID');
      const target=LANES[item.lane];
      const [updated]=await connection.query('UPDATE sbc_fulfillment_plan_steps SET status=?,updated_at=NOW() WHERE tenant_id=? AND checkout_ledger_id=? AND step_key=? AND status=?',[target,t,ledger,item.step_key,'WAITING_DEPENDENCIES']);
      if(updated?.affectedRows!==1)fail('FULFILLMENT_DEPENDENCY_WRITE_CONFLICT');
      ready.push({stepKey:item.step_key,status:target});
    }
  }
  return {status:'COMPLETED',unblocked:ready};
}
module.exports={LANES,servicesFromCatalog,buildPlan,stagePaidCheckoutPlan,completeStep,actionable,fingerprint};

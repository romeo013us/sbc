'use strict';
/* SBC Sales Command V1 — owner-attested commission ledger.
 * NO automatic bank, contractor, Square, vendor, payroll, or fulfillment actions.
 * Never trust checkout flags or a browser-submitted amount as payment proof.
 */
const crypto=require('node:crypto');
const CALC=require('../enterprise/sbc-sales-compensation-v1.cjs');
const HIRING=require('../enterprise/sbc-sales-hiring-scorecard-v1.cjs');
const WORKFORCE=require('../enterprise/sbc-workforce-performance-v2.cjs');
const MONEY=require('../enterprise/v6640-payment-evidence.cjs');
const TRUTH=require('../enterprise/sbc-revenue-reporting-truth-v66142.cjs');
const NEGATIVE=new Set(['REFUNDED','CHARGEBACK','CHARGED_BACK','VOID','VOIDED']);
const fail=(res,status,code)=>res.status(status).json({ok:false,code});
const val=(v,max=180)=>String(v??'').trim().slice(0,max);
const money=v=>CALC.amount(v);
const owner=req=>req?.user?.role==='owner'&&req.user.active!==false;
const manager=req=>req?.user?.role==='account_manager'&&req.user.active!==false;
const dateSql=t=>new Date(t).toISOString().slice(0,23).replace('T',' ');
const HASH=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const audit=async(conn,t,m,month,action,actor,detail={})=>
 conn.query('INSERT INTO sbc_commission_audit_v1 (id,tenant_id,manager_id,month_key,action,actor_id,detail_json) VALUES (?,?,?,?,?,?,?)',
 [crypto.randomUUID(),t,m,month,action,actor,JSON.stringify(detail)]);
function staff(ctx,t,id){
 const u=(ctx.db?.users||[]).find(x=>String(x.id)===id&&Number(x.tenantId??x.tenant_id)===t&&x.role==='account_manager'&&x.active!==false);
 if(!u)throw Object.assign(Error('ACTIVE_ACCOUNT_MANAGER_REQUIRED'),{status:422});
 return u;
}
function creditRow(row){
 return {tenantId:Number(row.tenant_id),managerId:String(row.manager_id),orderId:String(row.order_id),
 grossCents:Number(row.gross_cents),directCostCents:Number(row.direct_cost_cents),
 laborCents:Number(row.labor_cents),processingCents:Number(row.processing_cents),
 refundCents:Number(row.refund_cents),capturedAt:row.captured_at instanceof Date?row.captured_at.toISOString():String(row.captured_at).replace(' ','T')+'Z',
 source:String(row.source),proofVerified:true,ownerAttested:true};
}
function createReport(t,m,month,credits,terms,statementRow){
 const term=terms||null;
 const computed=CALC.statement({tenantId:t,managerId:m,month,
  tier:term?.tier||'standard',credits:credits.map(creditRow)});
 return {...computed,commissionCents:term?computed.commissionCents:0,
  eligible:term?computed.eligible:false,
  commissionStatus:!term?'SIGNED_TERMS_REQUIRED':computed.commissionStatus,
  termsConfigured:Boolean(term),termsTier:term?.tier||null,
  lockedStatement:statementRow?{
   status:String(statementRow.status),
   revenueCents:Number(statementRow.revenue_cents),profitCents:Number(statementRow.profit_cents),
   commissionCents:Number(statementRow.commission_cents),closedAt:statementRow.closed_at,
   approvedAt:statementRow.approved_at||null,paidAt:statementRow.paid_at||null,
   hasExternalPaymentReference:Boolean(statementRow.external_payment_reference)
  }:null};
}
function register(app,{auth,getContext,tenantForRead,writer}={}){
 if(!app||typeof app.get!=='function'||typeof app.post!=='function'||
    typeof auth!=='function'||typeof getContext!=='function'||
    typeof tenantForRead!=='function'||typeof writer!=='function')
  throw Error('SALES_COMMAND_DEPENDENCIES_REQUIRED');
 function gate(req,role='owner',write=false){
  if(!(role==='owner'?owner(req):manager(req)))throw Object.assign(Error('SALES_COMMAND_ROLE_DENIED'),{status:403});
  const t=CALC.tenant(tenantForRead(req));
  if(req?.user?.tenantId!=null&&Number(req.user.tenantId)!==t)
   throw Object.assign(Error('SALES_COMMAND_TENANT_MISMATCH'),{status:403});
  const ctx=getContext();
  if(!ctx?.mysqlPool||typeof ctx.mysqlPool.getConnection!=='function')
   throw Object.assign(Error('SALES_COMMAND_MYSQL_REQUIRED'),{status:503});
  if(write){
   if(typeof ctx.recoveryRequired!=='function'||ctx.recoveryRequired()!==false)
    throw Object.assign(Error('SALES_COMMAND_RECOVERY_HOLD'),{status:423});
   writer();
  }
  return {ctx,t,actor:CALC.id(req.user.id)};
 }
 const error=(res,e)=>fail(res,Number(e?.status)||(/TENANT|ROLE_DENIED/.test(e?.message||'')?403:
  /INVALID|REQUIRED|CLOSED|EXISTS|UNVERIFIED|MISMATCH|AGREEMENT|TERMS|NO_COMMISSION|MONTH_NOT_ENDED/.test(e?.message||'')?422:503),
  val(e?.code||e?.message||'SALES_COMMAND_UNAVAILABLE',120));
 const monthReq=req=>CALC.monthKey(req.query?.month||req.body?.month||CALC.miamiMonth(new Date()));
 const findOrder=(ctx,t,orderId)=>{
  const o=(Array.isArray(ctx.db?.orders)?ctx.db.orders:[]).find(x=>
   String(x?.id)===orderId&&Number(x.tenantId??x.tenant_id)===t);
  if(!o||TRUTH.isQaOrder(o))throw Error('REAL_ORDER_REQUIRED');
  if(!MONEY.providerCapturedSquare(o))throw Error('SQUARE_CAPTURE_UNVERIFIED');
  const proof=MONEY.proofFields(o);
  if(NEGATIVE.has(val(o.paymentStatus).toUpperCase())||NEGATIVE.has(proof.state))
   throw Error('REFUNDED_ORDER_INELIGIBLE');
  const amount=Number(o.price??o.total);
  if(!Number.isFinite(amount)||amount<=0||amount>1000000||
    Math.abs(Math.round(amount*100)-amount*100)>0.001)throw Error('ORDER_AMOUNT_INVALID');
  return {order:o,proof,grossCents:Math.round(amount*100)};
 };
 async function inTx(ctx,fn){
  const conn=await ctx.mysqlPool.getConnection();let open=false;
  try{await conn.beginTransaction();open=true;const out=await fn(conn);
   await conn.commit();open=false;return out;}
  catch(e){if(open)try{await conn.rollback()}catch{}throw e}
  finally{try{conn.release()}catch{}}
 }
 async function read(ctx,t,m,month){
  const [credits]=await ctx.mysqlPool.query('SELECT * FROM sbc_sales_credit_v1 WHERE tenant_id=? AND manager_id=? ORDER BY captured_at DESC LIMIT 10001',[t,m]);
  if(credits.length>10000)throw Error('SALES_LEDGER_QUERY_TRUNCATED');
  const [terms]=await ctx.mysqlPool.query('SELECT tier FROM sbc_commission_terms_v1 WHERE tenant_id=? AND manager_id=? AND month_key=? LIMIT 1',[t,m,month]);
  const [locked]=await ctx.mysqlPool.query('SELECT * FROM sbc_commission_statement_v1 WHERE tenant_id=? AND manager_id=? AND month_key=? LIMIT 1',[t,m,month]);
  return createReport(t,m,month,credits,terms[0],locked[0]);
 }
 // Stateless advisory endpoints: no applicant storage, no worker mutation or provider calls.
 app.post('/api/owner/sales-command/hiring/evaluate',auth,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{gate(req);return res.json({ok:true,readOnly:true,result:req.body?.tier===undefined?HIRING.evaluate(req.body?.scores,req.body?.evidence):HIRING.evaluateTier(req.body.tier,req.body.scores,req.body.evidence)});}
  catch(e){return error(res,e)}
 });
 app.post('/api/owner/sales-command/hiring/forecast',auth,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{gate(req);return res.json({ok:true,readOnly:true,result:HIRING.forecast(req.body||{})});}
  catch(e){return error(res,e)}
 });
 // V2 workforce policy and owner-only revenue checkpoint; no signed terms or payroll mutations.
 app.get('/api/owner/sales-command/workforce/policy',auth,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{gate(req);return res.json({ok:true,readOnly:true,policy:WORKFORCE.POLICY,activeCompensationTermsUnchanged:true});}
  catch(e){return error(res,e)}
 });
 app.get('/api/owner/sales-command/workforce/review',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {ctx,t}=gate(req),m=CALC.id(req.query?.managerId);
   staff(ctx,t,m);
   const tier=val(req.query?.tier),startDate=val(req.query?.startDate),throughDate=val(req.query?.throughDate);
   if(throughDate>=WORKFORCE.miamiDay(new Date()))throw Error('INVALID_REVIEW_REQUIRES_COMPLETED_DATE');
   WORKFORCE.review({tier,startDate,throughDate,credits:[]});
   const [rows]=await ctx.mysqlPool.query('SELECT * FROM sbc_sales_credit_v1 WHERE tenant_id=? AND manager_id=? ORDER BY captured_at DESC LIMIT 10001',[t,m]);
   if(rows.length>10000)throw Error('SALES_LEDGER_QUERY_TRUNCATED');
   const credits=rows.map(row=>{
    const c=creditRow(row);
    CALC.credit(c,{tenantId:t,managerId:m});
    return {...c,customerId:CALC.id(row.customer_id)};
   });
   return res.json({ok:true,readOnly:true,managerId:m,review:WORKFORCE.review({tier,startDate,throughDate,credits}),
    dataScope:'OWNER_RECONCILED_PAID_ORDERS_ONLY',reviewInputs:'OWNER_SELECTED_TIER_AND_TRIAL_DATES_NOT_SIGNED_TERMS',
    ledgerCompletenessVerified:false,automaticTransfers:false,automaticPersonnelAction:false});
  }catch(e){return error(res,e)}
 });
 app.post('/api/owner/sales-command/workforce/trial-plan',auth,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{gate(req);return res.json({ok:true,readOnly:true,plan:WORKFORCE.trialPlan(req.body||{})});}catch(e){return error(res,e)}
 });
 app.post('/api/owner/sales-command/workforce/pay-schedule',auth,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{gate(req);return res.json({ok:true,readOnly:true,schedule:WORKFORCE.paySchedule(req.body||{})});}
  catch(e){return error(res,e)}
 });
 // Enrollment records a previously signed paid trial, never hires or moves money.
 app.post('/api/owner/sales-command/workforce/enroll',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {ctx,t,actor}=gate(req,'owner',true);
   const {plan,members}=WORKFORCE.enrollmentPlan(req.body||{});
   if(plan.startDate<WORKFORCE.miamiDay(new Date()))throw Error('INVALID_TRIAL_START_IN_PAST');
   for(const m of members)staff(ctx,t,m.managerId);
   const cohortId=crypto.randomUUID();
   await inTx(ctx,async conn=>{
    for(const m of [...members].sort((a,b)=>a.managerId.localeCompare(b.managerId))){
     const [profile]=await conn.query('SELECT tier, revision FROM sbc_am_workstation_profile_v2 WHERE tenant_id=? AND manager_id=? FOR UPDATE',[t,m.managerId]);
     if(profile.length!==1||profile[0].tier!==m.tier)throw Error('WORKSTATION_PROFILE_MISMATCH');
    }
    await conn.query('INSERT INTO sbc_am_trial_cohort_v2 (tenant_id,cohort_id,start_day,end_day,reserve_cents,planned_base_cents,created_by) VALUES (?,?,?,?,?,?,?)',[t,cohortId,plan.startDate,plan.endDate,plan.reserveCents,plan.plannedBaseCents,actor]);
    for(const m of members){
     await conn.query('INSERT INTO sbc_am_trial_member_v2 (tenant_id,manager_id,cohort_id,tier,agreement_hash) VALUES (?,?,?,?,?)',[t,m.managerId,cohortId,m.tier,HASH(m.agreementReference)]);
     await audit(conn,t,m.managerId,plan.startDate.slice(0,7),'PAID_TRIAL_ENROLLED',actor,{cohortId,tier:m.tier,startDate:plan.startDate,endDate:plan.endDate,signedTermsConfirmed:true,payScheduleReviewed:true,fairOpportunityConfirmed:true});
    }
   });
   return res.status(201).json({ok:true,cohortId,startDate:plan.startDate,endDate:plan.endDate,memberCount:members.length,automaticPersonnelAction:false,payrollInitiated:false});
  }catch(e){if(e?.code==='ER_DUP_ENTRY')return fail(res,409,'TRIAL_ALREADY_ENROLLED');return error(res,e)}
 });
 async function enrolledTrial(ctx,t,m){
  const [rows]=await ctx.mysqlPool.query('SELECT m.tier,c.start_day,c.end_day FROM sbc_am_trial_member_v2 m JOIN sbc_am_trial_cohort_v2 c ON c.tenant_id=m.tenant_id AND c.cohort_id=m.cohort_id WHERE m.tenant_id=? AND m.manager_id=? LIMIT 1',[t,m]);
  if(!rows.length)return null;
  const row=rows[0],plan=WORKFORCE.trialPlan({startDate:row.start_day,tiers:[row.tier]});
  if(plan.endDate!==row.end_day)throw Error('INVALID_TRIAL_RECORD');
  const today=WORKFORCE.miamiDay(new Date());
  const yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  let review=null;
  if(yesterday>=plan.startDate){
   const throughDate=yesterday<plan.endDate?yesterday:plan.endDate;
   const [credits]=await ctx.mysqlPool.query('SELECT * FROM sbc_sales_credit_v1 WHERE tenant_id=? AND manager_id=? ORDER BY captured_at DESC LIMIT 10001',[t,m]);
   if(credits.length>10000)throw Error('SALES_LEDGER_QUERY_TRUNCATED');
   const validated=credits.map(row=>{const c=creditRow(row);CALC.credit(c,{tenantId:t,managerId:m});return {...c,customerId:CALC.id(row.customer_id)};});
   const r=WORKFORCE.review({tier:row.tier,startDate:plan.startDate,throughDate,credits:validated});
   review={...r,grade:null,gradeWithheldReason:'LEDGER_COMPLETENESS_NOT_VERIFIED'};
  }
  return {tier:row.tier,startDate:plan.startDate,endDate:plan.endDate,checkpoints:plan.checkpoints,review,stage:today<plan.startDate?'UPCOMING':today>plan.endDate?'OWNER_REVIEW_DUE':'IN_PROGRESS'};
 }
 app.get('/api/sbc/sales/workforce/trial/me',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{const {ctx,t,actor}=gate(req,'account_manager');staff(ctx,t,actor);return res.json({ok:true,trial:await enrolledTrial(ctx,t,actor),ledgerCompletenessVerified:false,automaticPersonnelAction:false});}
  catch(e){return error(res,e)}
 });
 app.get('/api/owner/sales-command/workforce/enrollment',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{const {ctx,t}=gate(req),m=CALC.id(req.query?.managerId);staff(ctx,t,m);return res.json({ok:true,trial:await enrolledTrial(ctx,t,m),ledgerCompletenessVerified:false,automaticPersonnelAction:false});}
  catch(e){return error(res,e)}
 });
 // Workstation presentation tier is independently provisioned; no financial or language permission changes.
 async function workstationProfile(pool,t,m){
  const [rows]=await pool.query('SELECT tier, revision FROM sbc_am_workstation_profile_v2 WHERE tenant_id=? AND manager_id=? LIMIT 1',[t,m]);
  const row=rows[0];
  if(!row)return {tier:null,revision:0,weeklyQuotaCents:null,spanishRequirement:null,spanishAccessGranted:false,compensationChanged:false};
  if(!['standard','senior'].includes(row.tier)||!Number.isSafeInteger(Number(row.revision))||Number(row.revision)<1)throw Error('INVALID_WORKSTATION_PROFILE');
  const policy=WORKFORCE.POLICY[row.tier];
  return {tier:row.tier,revision:Number(row.revision),weeklyQuotaCents:policy.weeklyQuotaCents,
   spanishRequirement:policy.spanish,spanishAccessGranted:false,compensationChanged:false};
 }
 app.get('/api/sbc/sales/workstation/me',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{const {ctx,t,actor}=gate(req,'account_manager');staff(ctx,t,actor);
   return res.json({ok:true,profile:await workstationProfile(ctx.mysqlPool,t,actor)});
  }catch(e){return error(res,e)}
 });
 app.get('/api/owner/sales-command/workstation/profile',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{const {ctx,t}=gate(req),m=CALC.id(req.query?.managerId);staff(ctx,t,m);
   return res.json({ok:true,profile:await workstationProfile(ctx.mysqlPool,t,m)});
  }catch(e){return error(res,e)}
 });
 app.post('/api/owner/sales-command/workstation/profile',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {ctx,t,actor}=gate(req,'owner',true),b=req.body||{},m=CALC.id(b.managerId);staff(ctx,t,m);
   if(!['standard','senior'].includes(b.tier)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||b.expectedRevision>=2147483647||
    b.confirm!=='OWNER_CONFIRMED_WORKSTATION_TIER'||(b.tier==='senior'&&b.bilingualEvidenceConfirmed!==true))throw Error('INVALID_WORKSTATION_PROFILE_CONFIRMATION');
   const result=await inTx(ctx,async conn=>{
    const [rows]=await conn.query('SELECT tier, revision FROM sbc_am_workstation_profile_v2 WHERE tenant_id=? AND manager_id=? FOR UPDATE',[t,m]);
    const revision=rows.length?Number(rows[0].revision):0;
    if(revision!==b.expectedRevision)throw Object.assign(Error('WORKSTATION_PROFILE_REVISION_MISMATCH'),{status:409});
    if(rows.length){
     const [changed]=await conn.query('UPDATE sbc_am_workstation_profile_v2 SET tier=?,revision=?,updated_by=?,updated_at=CURRENT_TIMESTAMP(3) WHERE tenant_id=? AND manager_id=? AND revision=?',[b.tier,revision+1,actor,t,m,revision]);
     if(changed.affectedRows!==1)throw Object.assign(Error('WORKSTATION_PROFILE_REVISION_MISMATCH'),{status:409});
    }else await conn.query('INSERT INTO sbc_am_workstation_profile_v2 (tenant_id,manager_id,tier,revision,updated_by) VALUES (?,?,?,?,?)',[t,m,b.tier,1,actor]);
    await audit(conn,t,m,CALC.miamiMonth(new Date()),'WORKSTATION_PROFILE_CONFIGURED',actor,{priorTier:rows[0]?.tier||null,tier:b.tier,revision:revision+1,seniorEvidenceAttested:b.tier==='senior',compensationChanged:false});
    return {tier:b.tier,revision:revision+1,compensationChanged:false,spanishAccessGranted:false};
   });
   return res.json({ok:true,profile:result});
  }catch(e){return error(res,e)}
 });
 // Read-only preflight: table visibility and MySQL recovery, never auto-migrate.
 app.get('/api/owner/sales-command/readiness',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {ctx,t}=gate(req);
   const tables=['sbc_sales_credit_v1','sbc_commission_terms_v1',
     'sbc_commission_statement_v1','sbc_commission_audit_v1'];
   const missingTables=[];
   for(const table of tables){
    try{await ctx.mysqlPool.query('SELECT 1 FROM '+table+' WHERE tenant_id=? LIMIT 0',[t]);}
    catch(e){
     if(e?.code==='ER_NO_SUCH_TABLE')missingTables.push(table);
     else return fail(res,503,'SALES_SCHEMA_READ_UNAVAILABLE');
    }
   }
   const schemaReady=missingTables.length===0;
   const writeReady=typeof ctx.recoveryRequired==='function'&&ctx.recoveryRequired()===false;
   return res.json({ok:true,ready:schemaReady&&writeReady,schemaReady,writeReady,
    missingTables,migrationExecuted:false,providerCalls:0,readOnly:true,
    nextAction:!schemaReady?'REVIEW_AND_APPLY_STAGING_MIGRATION':
      !writeReady?'RESOLVE_MYSQL_RECOVERY_HOLD':'RUN_STAGING_SANDBOX_ACCEPTANCE'});
  }catch(e){return error(res,e)}
 });
 // Owner sees the team dashboard; sales are credited from the approved ledger, never client input.
 app.get('/api/owner/sales-command/overview',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {ctx,t}=gate(req),month=monthReq(req);
   const managers=(ctx.db?.users||[]).filter(u=>u.role==='account_manager'&&
      Number(u.tenantId??u.tenant_id)===t).slice(0,100);
   const rows=[];
   for(const u of managers){
    const r=await read(ctx,t,String(u.id),month);
    rows.push({managerId:String(u.id),name:val(u.name||u.username||u.id,130),
      active:u.active!==false,...r});
   }
   const total=rows.reduce((a,r)=>a+r.revenueCents,0);
   const profit=rows.reduce((a,r)=>a+r.profitCents,0);
   const liability=rows.reduce((a,r)=>a+(r.lockedStatement?.commissionCents??r.commissionCents),0);
   return res.json({ok:true,readOnly:true,month,teamDailyTargetCents:CALC.TEAM_DAILY_TARGET_CENTS,
     teamMonthlyTargetCents:CALC.TEAM_MONTHLY_TARGET_CENTS,teamRevenueCents:total,
     teamGrossProfitCents:profit,commissionLiabilityCents:liability,managers:rows,
     dataScope:'OWNER_RECONCILED_PAID_ORDERS_ONLY',ownerSalesExcluded:true,
     providerVerification:'SBC_STORED_SQUARE_PROOF_NOT_INDEPENDENT_BANK_CONFIRMATION',
     automaticTransfers:false,orderApprovalRequired:true});
  }catch(e){return error(res,e)}
 });
 // Manager can read ONLY own credited revenue and quota. No cost/vendor rows exposed.
 app.get('/api/sbc/sales/compensation/me',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {ctx,t,actor}=gate(req,'account_manager'),month=monthReq(req);
   staff(ctx,t,actor);
   const r=await read(ctx,t,actor,month);
   const {profitCents,lockedStatement,...safe}=r; // company gross profit remains owner-private
   const visibleLocked=lockedStatement?((({profitCents,...fields})=>fields)(lockedStatement)):null;
   return res.json({ok:true,readOnly:true,...safe,lockedStatement:visibleLocked,managerId:actor,
     statusNote:'Estimated until month close and owner approval. No automatic payouts.'});
  }catch(e){return error(res,e)}
 });
 // Terms are entered only AFTER an actual written compensation agreement is confirmed.
 app.post('/api/owner/sales-command/terms',auth,async(req,res)=>{
  try{
   const {ctx,t,actor}=gate(req,'owner',true),b=req.body||{};
   const m=CALC.id(b.managerId),month=CALC.monthKey(b.month),tier=val(b.tier);
   const ref=val(b.agreementReference,180);
   staff(ctx,t,m);
   if(!Object.hasOwn(CALC.TIERS,tier)||b.confirm!=='SIGNED_AGREEMENT_CONFIRMED'||ref.length<12)
    throw Error('SIGNED_COMPENSATION_AGREEMENT_REQUIRED');
   if(tier.endsWith('_v2')&&(b.confirmMonthlyQuotaCents!==CALC.TIERS[tier].quotaCents||b.confirmCommissionBps!==CALC.TIERS[tier].commissionBps))throw Error('SIGNED_V2_RATE_AND_QUOTA_CONFIRMATION_REQUIRED');
   const result=await inTx(ctx,async conn=>{
    const [existing]=await conn.query('SELECT tier,agreement_reference FROM sbc_commission_terms_v1 WHERE tenant_id=? AND manager_id=? AND month_key=? FOR UPDATE',[t,m,month]);
    if(existing.length){
     if(existing[0].tier!==tier||existing[0].agreement_reference!==ref)throw Error('MONTHLY_TERMS_ALREADY_LOCKED');
     return {existing:true};
    }
    await conn.query('INSERT INTO sbc_commission_terms_v1 (tenant_id,manager_id,month_key,tier,agreement_reference,confirmed_by) VALUES (?,?,?,?,?,?)',[t,m,month,tier,ref,actor]);
    await audit(conn,t,m,month,'TERMS_CONFIRMED',actor,{tier,quotaCents:CALC.TIERS[tier].quotaCents,commissionBps:CALC.TIERS[tier].commissionBps,agreementReferenceHash:HASH(ref)});
    return {existing:false};
   });
   return res.status(result.existing?200:201).json({ok:true,...result,month,managerId:m,tier});
  }catch(e){return error(res,e)}
 });
 // Owner reconciles a real, provider-captured order with documented direct costs.
 // This never creates, approves, fulfills or charges an order.
 app.post('/api/owner/sales-command/credits',auth,async(req,res)=>{
  try{
   const {ctx,t,actor}=gate(req,'owner',true),b=req.body||{};
   const m=CALC.id(b.managerId),orderId=CALC.id(b.orderId);
   staff(ctx,t,m);
   if(b.confirm!=='OWNER_VERIFIED_CAPTURE_AND_COSTS'||val(b.costEvidence,500).length<12)
    throw Error('COST_EVIDENCE_AND_OWNER_CONFIRMATION_REQUIRED');
   const direct=money(b.directCostCents),labor=money(b.laborCents??0),
    processing=money(b.processingCents??0),refund=money(b.refundCents??0);
   if(refund!==0)throw Error('REFUND_RECONCILIATION_REQUIRED');
   const source=val(b.source);
   if(!['NEW_CUSTOMER','ACTIVE_UPSELL','MANUALLY_SOLD_RENEWAL'].includes(source))
    throw Error('SALE_SOURCE_INVALID');
   const {order,proof,grossCents}=findOrder(ctx,t,orderId);
   const customerId=CALC.id(order.customerId);
   const month=CALC.miamiMonth(proof.completedAt);
   const result=await inTx(ctx,async conn=>{
    const [customers]=await conn.query('SELECT id,assigned_to FROM sbc_customers WHERE tenant_id=? AND id=? LIMIT 1 FOR UPDATE',[t,customerId]);
    if(customers.length!==1||String(customers[0].assigned_to||'')!==m)
     throw Error('AUTHORITATIVE_ACCOUNT_ASSIGNMENT_MISMATCH');
    const [persisted]=await conn.query('SELECT id,customer_id FROM sbc_orders WHERE tenant_id=? AND id=? LIMIT 1',[t,orderId]);
    if(persisted.length!==1||String(persisted[0].customer_id)!==customerId)
     throw Error('PERSISTED_ORDER_CUSTOMER_MISMATCH');
    const [locked]=await conn.query('SELECT status FROM sbc_commission_statement_v1 WHERE tenant_id=? AND manager_id=? AND month_key=? LIMIT 1 FOR UPDATE',[t,m,month]);
    if(locked.length)throw Error('MONTH_ALREADY_CLOSED');
    const [existing]=await conn.query('SELECT order_id FROM sbc_sales_credit_v1 WHERE tenant_id=? AND order_id=? LIMIT 1 FOR UPDATE',[t,orderId]);
    if(existing.length)return {existing:true,orderId};
    await conn.query('INSERT INTO sbc_sales_credit_v1 (tenant_id,order_id,customer_id,manager_id,source,gross_cents,direct_cost_cents,labor_cents,processing_cents,refund_cents,captured_at,square_payment_hash,owner_actor,owner_evidence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
     [t,orderId,customerId,m,source,grossCents,direct,labor,processing,refund,dateSql(proof.completedAt),HASH(proof.id),actor,val(b.costEvidence,500)]);
    await audit(conn,t,m,month,'PAID_ORDER_RECONCILED',actor,{orderId,customerId,grossCents,directCostCents:direct,laborCents:labor,processingCents:processing,providerProofHash:HASH(proof.id)});
    return {existing:false,orderId};
   });
   return res.status(result.existing?200:201).json({ok:true,...result,managerId:m,month,
    grossCents,profitCents:grossCents-direct-labor-processing,source,
    paymentInitiated:false,fulfillmentApproved:false});
  }catch(e){return error(res,e)}
 });
 // Preview potential paid orders needing manual cost verification (not booked revenue).
 app.get('/api/owner/sales-command/eligible-orders',auth,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
   const {ctx,t}=gate(req),[ledger]=await ctx.mysqlPool.query('SELECT order_id FROM sbc_sales_credit_v1 WHERE tenant_id=? LIMIT 10001',[t]);
   if(ledger.length>10000)throw Error('SALES_LEDGER_QUERY_TRUNCATED');
   const credited=new Set(ledger.map(x=>String(x.order_id)));
   const candidates=(Array.isArray(ctx.db?.orders)?ctx.db.orders:[]).filter(o=>{
     if(Number(o?.tenantId??o?.tenant_id)!==t||!MONEY.providerCapturedSquare(o)||
        TRUTH.isQaOrder(o)||credited.has(String(o.id)))return false;
     const amount=Number(o.price??o.total);
     return Number.isFinite(amount)&&amount>0&&amount<=1000000&&
       Math.abs(Math.round(amount*100)-amount*100)<=0.001;
    }).slice(0,80).map(o=>({
      orderId:String(o.id),customerId:String(o.customerId||''),grossCents:Math.round(Number(o.price??o.total)*100),
      capturedAt:MONEY.proofFields(o).completedAt,requiresOwnerCostVerification:true
     })).filter(x=>Number.isSafeInteger(x.grossCents)&&x.grossCents>0);
   return res.json({ok:true,readOnly:true,candidates,noAutomaticCredit:true,
     proof:'SBC_STORED_CAPTURE_METADATA_NEEDS_OWNER_RECONCILIATION'});
  }catch(e){return error(res,e)}
 });
 app.post('/api/owner/sales-command/statements/close',auth,async(req,res)=>{
  try{
   const {ctx,t,actor}=gate(req,'owner',true),b=req.body||{},
    m=CALC.id(b.managerId),month=CALC.monthKey(b.month);
   if(b.confirm!=='CLOSE_MONTH_FOR_OWNER_REVIEW')throw Error('MONTH_CLOSE_CONFIRMATION_REQUIRED');
   if(month>=CALC.miamiMonth(new Date()))throw Error('SALES_MONTH_NOT_ENDED');
   staff(ctx,t,m);
   const result=await inTx(ctx,async conn=>{
    const [terms]=await conn.query('SELECT tier FROM sbc_commission_terms_v1 WHERE tenant_id=? AND manager_id=? AND month_key=? LIMIT 1 FOR UPDATE',[t,m,month]);
    if(terms.length!==1)throw Error('SIGNED_MONTHLY_TERMS_REQUIRED');
    const [existing]=await conn.query('SELECT status FROM sbc_commission_statement_v1 WHERE tenant_id=? AND manager_id=? AND month_key=? LIMIT 1 FOR UPDATE',[t,m,month]);
    if(existing.length)return {existing:true,status:existing[0].status};
    const [rows]=await conn.query('SELECT * FROM sbc_sales_credit_v1 WHERE tenant_id=? AND manager_id=? ORDER BY captured_at ASC LIMIT 10001 FOR UPDATE',[t,m]);
    if(rows.length>10000)throw Error('SALES_CREDIT_SNAPSHOT_TOO_LARGE');
    const used=rows.filter(c=>CALC.miamiMonth(creditRow(c).capturedAt)===month);
    for(const c of used){
     const {order,proof,grossCents}=findOrder(ctx,t,String(c.order_id));
     if(grossCents!==Number(c.gross_cents)||HASH(proof.id)!==c.square_payment_hash||String(order.customerId)!==String(c.customer_id))
      throw Error('CAPTURE_OR_ORDER_CHANGED_RECONCILIATION_REQUIRED');
    }
    const outcome=createReport(t,m,month,rows,terms[0],null);
    await conn.query('INSERT INTO sbc_commission_statement_v1 (tenant_id,manager_id,month_key,tier,quota_cents,revenue_cents,profit_cents,commission_cents,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
     [t,m,month,outcome.tier,outcome.quotaCents,outcome.revenueCents,outcome.profitCents,outcome.commissionCents,'DRAFT',actor]);
    await audit(conn,t,m,month,'MONTH_CLOSED_DRAFT',actor,{revenueCents:outcome.revenueCents,profitCents:outcome.profitCents,commissionCents:outcome.commissionCents});
    return {existing:false,status:'DRAFT',statement:outcome};
   });
   return res.json({ok:true,month,managerId:m,...result,providerTransfers:0});
  }catch(e){return error(res,e)}
 });
 // Revalidate every frozen sale before approving or recording a payout. A Square
 // refund/chargeback can arrive AFTER closing; a stale snapshot must fail closed.
 // Owner must reconcile these differences manually under the signed agreement.
 async function validateClosedStatement(conn,ctx,t,m,month,locked){
  const [credits]=await conn.query('SELECT * FROM sbc_sales_credit_v1 WHERE tenant_id=? AND manager_id=? ORDER BY captured_at ASC LIMIT 10001 FOR UPDATE',[t,m]);
  if(credits.length>10000)throw Object.assign(Error('CREDIT_RECONCILIATION_LIMIT_REACHED'),{status:409});
  for(const row of credits){
   if(CALC.miamiMonth(creditRow(row).capturedAt)!==month)continue;
   let payment;
   try{payment=findOrder(ctx,t,String(row.order_id));}
   catch(_){throw Object.assign(Error('CAPTURE_OR_ORDER_CHANGED_RECONCILIATION_REQUIRED'),{status:409});}
   const {order,proof,grossCents}=payment;
   if(grossCents!==Number(row.gross_cents)||HASH(proof.id)!==String(row.square_payment_hash)||
      String(order.customerId)!==String(row.customer_id)||CALC.miamiMonth(proof.completedAt)!==month)
    throw Object.assign(Error('CAPTURE_OR_ORDER_CHANGED_RECONCILIATION_REQUIRED'),{status:409});
  }
  const computed=createReport(t,m,month,credits,{tier:String(locked.tier)},null);
  for(const [field,snapshot] of [
   ['quotaCents',locked.quota_cents],['revenueCents',locked.revenue_cents],
   ['profitCents',locked.profit_cents],['commissionCents',locked.commission_cents]]){
   if(computed[field]!==Number(snapshot))
    throw Object.assign(Error('CLOSED_STATEMENT_RECONCILIATION_REQUIRED'),{status:409});
  }
 }
 async function transition(req,res,nextStatus){
  try{
   const {ctx,t,actor}=gate(req,'owner',true),m=CALC.id(req.params.managerId),
    month=CALC.monthKey(req.params.month),b=req.body||{};
   const approval=nextStatus==='APPROVED';
   if(b.confirm!==(approval?'APPROVE_COMMISSION_STATEMENT':'RECORD_ALREADY_SENT_PAYMENT'))
    throw Error('OWNER_EXPLICIT_APPROVAL_REQUIRED');
   const paymentRef=val(b.paymentReference,180);
   if(!approval&&paymentRef.length<8)throw Error('EXTERNAL_PAYMENT_PROOF_REQUIRED');
   const result=await inTx(ctx,async conn=>{
    const [rows]=await conn.query('SELECT * FROM sbc_commission_statement_v1 WHERE tenant_id=? AND manager_id=? AND month_key=? LIMIT 1 FOR UPDATE',[t,m,month]);
    if(rows.length!==1)throw Error('CLOSED_STATEMENT_REQUIRED');
    const old=rows[0],expected=approval?'DRAFT':'APPROVED';
    if(old.status!==expected)throw Error('INVALID_COMMISSION_TRANSITION');
    if(Number(old.commission_cents)<=0)throw Error('NO_COMMISSION_DUE');
    await validateClosedStatement(conn,ctx,t,m,month,old);
    if(approval){
     await conn.query("UPDATE sbc_commission_statement_v1 SET status='APPROVED',approved_by=?,approved_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND manager_id=? AND month_key=? AND status='DRAFT'",
      [actor,t,m,month]);
     await audit(conn,t,m,month,'COMMISSION_APPROVED',actor,{commissionCents:Number(old.commission_cents)});
    }else{
     await conn.query("UPDATE sbc_commission_statement_v1 SET status='PAID',paid_by=?,paid_at=UTC_TIMESTAMP(3),external_payment_reference=? WHERE tenant_id=? AND manager_id=? AND month_key=? AND status='APPROVED'",
      [actor,paymentRef,t,m,month]);
     await audit(conn,t,m,month,'EXTERNAL_PAYMENT_RECORDED',actor,{paymentReferenceHash:HASH(paymentRef),commissionCents:Number(old.commission_cents),providerPaidStatusVerified:false});
    }
    return {status:nextStatus,commissionCents:Number(old.commission_cents)};
   });
   return res.json({ok:true,month,managerId:m,...result,paymentInitiated:false,
     paymentVerification:'OWNER_RECORDED_EXTERNAL_REFERENCE_ONLY'});
  }catch(e){return error(res,e)}
 }
 app.post('/api/owner/sales-command/statements/:managerId/:month/approve',auth,(req,res)=>transition(req,res,'APPROVED'));
 app.post('/api/owner/sales-command/statements/:managerId/:month/paid',auth,(req,res)=>transition(req,res,'PAID'));
 return {registered:true,providerActions:false,ownerApprovals:true};
}
module.exports={register,createReport,creditRow};

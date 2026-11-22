'use strict';
/* SBC Sales Command V1 — owner-attested commission ledger.
 * NO automatic bank, contractor, Square, vendor, payroll, or fulfillment actions.
 * Never trust checkout flags or a browser-submitted amount as payment proof.
 */
const crypto=require('node:crypto');
const CALC=require('../enterprise/sbc-sales-compensation-v1.cjs');
const HIRING=require('../enterprise/sbc-sales-hiring-scorecard-v1.cjs');
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
  try{gate(req);return res.json({ok:true,readOnly:true,result:HIRING.evaluate(req.body?.scores,req.body?.evidence)});}
  catch(e){return error(res,e)}
 });
 app.post('/api/owner/sales-command/hiring/forecast',auth,(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{gate(req);return res.json({ok:true,readOnly:true,result:HIRING.forecast(req.body||{})});}
  catch(e){return error(res,e)}
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
   const result=await inTx(ctx,async conn=>{
    const [existing]=await conn.query('SELECT tier,agreement_reference FROM sbc_commission_terms_v1 WHERE tenant_id=? AND manager_id=? AND month_key=? FOR UPDATE',[t,m,month]);
    if(existing.length){
     if(existing[0].tier!==tier||existing[0].agreement_reference!==ref)throw Error('MONTHLY_TERMS_ALREADY_LOCKED');
     return {existing:true};
    }
    await conn.query('INSERT INTO sbc_commission_terms_v1 (tenant_id,manager_id,month_key,tier,agreement_reference,confirmed_by) VALUES (?,?,?,?,?,?)',[t,m,month,tier,ref,actor]);
    await audit(conn,t,m,month,'TERMS_CONFIRMED',actor,{tier,agreementReferenceHash:HASH(ref)});
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

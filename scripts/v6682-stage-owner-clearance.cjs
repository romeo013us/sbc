'use strict';
/* Stage V66.82 exclusively in disposable CI checkout; pinned master server.js
 * is never edited in place. Scope: owner delivery approval route only.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V6682_DURABLE_OWNER_CLEARANCE_BINDING';
const ORDER_MARK='SBC_V6682_ORDER_AMOUNT_INTEGRITY';
const submitBefore="  SBC_V6651_REQUIRE_PAID(sourceOrder,job?.tenantId);\n  const amount=Number(job?.value||0);";
const submitAfter="  SBC_V6651_REQUIRE_PAID(sourceOrder,job?.tenantId);\n  // SBC_V6682_ORDER_AMOUNT_INTEGRITY: a paid $25k order cannot run as a $9k job.\n  const amount=V569_PRODUCTION_EXPANSION.financialAmountCents(job?.value)/100;\n  const orderAmount=V569_PRODUCTION_EXPANSION.financialAmountCents(sourceOrder?.price)/100;\n  if(amount!==orderAmount)throw new Error('FULFILLMENT_ORDER_AMOUNT_MISMATCH');";
const before=`app.post('/api/v566/delivery/approve/:jobId',auth,ownerOnly,async(req,res)=>{
  try{
    const m=megaData();
    const job=(m.fulfillmentJobs||[]).find(x=>String(x.id)===String(req.params.jobId));
    if(!job)return res.status(404).json({ok:false,error:'Fulfillment job not found.'});
    if(Number(job.value||0)<10000)return res.json({ok:true,version:BUILD_VERSION,job,status:'NO_CLEARANCE_REQUIRED'});
    job.ownerClearanceAt=now(); job.ownerClearanceBy=req.user?.id||'owner'; job.status='ready'; job.vendorStatus='approved_for_execution'; job.lastError=''; job.updatedAt=now();
    await megaSave(m);
    const jobAmount=Number(job.value||0);
    audit(req.user,'fulfillment_owner_clearance',\`Owner cleared fulfillment job \${job.id}\`,{jobId:job.id,orderId:job.orderId,amount:jobAmount});
    res.status(202).json({ok:true,version:BUILD_VERSION,job,status:'CLEARED'});
  }catch(e){res.status(400).json({ok:false,error:e.message});}
});`;
const after=`app.post('/api/v566/delivery/approve/:jobId',auth,ownerOnly,async(req,res)=>{
  try{
    // SBC_V6682_DURABLE_OWNER_CLEARANCE_BINDING: no UI clearance before vault authorization.
    const tenant=__sbcRequireTenantId(req.tenantId);
    const m=megaData();
    const job=(m.fulfillmentJobs||[]).find(x=>String(x.id)===String(req.params.jobId)&&Number(x.tenantId)===tenant);
    if(!job)return res.status(404).json({ok:false,error:'Fulfillment job not found.'});
    const jobAmount=V569_PRODUCTION_EXPANSION.financialAmountCents(job.value)/100;
    if(jobAmount<10000)return res.json({ok:true,version:BUILD_VERSION,job,status:'NO_CLEARANCE_REQUIRED'});
    if(!['ready','owner_clearance_required'].includes(String(job.status)))throw new Error('FULFILLMENT_JOB_NOT_APPROVABLE');
    if(!mysqlPool)throw new Error('FINANCIAL_VAULT_STORAGE_UNAVAILABLE');
    if(!job.financialLockId)throw new Error('FINANCIAL_LOCK_ID_REQUIRED');
    const approvedBy=String(req.user?.id||req.user?.email||'').trim();
    if(!approvedBy)throw new Error('OWNER_APPROVAL_REQUIRED');
    const scope={tenantId:tenant,resourceId:job.id,action:'vendor_fulfillment',amount:jobAmount};
    const persisted=await V569_PRODUCTION_EXPANSION.getPersistentFinancialLock(mysqlPool,job.financialLockId,tenant);
    V569_PRODUCTION_EXPANSION.assertPersistentFinancialLockBinding(persisted,scope);
    const approval=await V569_PRODUCTION_EXPANSION.authorizePersistentFinancialExecution(mysqlPool,job.financialLockId,approvedBy,{tenantId:tenant});
    if(String(approval.status)!=='OWNER_AUTHORIZED'||!approval.owner_authorized_by||!approval.owner_authorized_at)
      throw new Error('FINANCIAL_VAULT_APPROVAL_NOT_DURABLE');
    // Retry/worker overlap must not reopen a processing or completed job.
    if(!['ready','owner_clearance_required'].includes(String(job.status)))throw new Error('FULFILLMENT_JOB_NOT_APPROVABLE');
    V569_PRODUCTION_EXPANSION.assertPersistentFinancialLockBinding(persisted,{tenantId:tenant,resourceId:job.id,action:'vendor_fulfillment',amount:job.value});
    // The worker still checks exact vault binding and holds an atomic ready->processing job claim.
    job.ownerClearanceAt=now();job.ownerClearanceBy=approvedBy;job.status='ready';job.vendorStatus='approved_for_execution';job.lastError='';job.updatedAt=now();
    await megaSave(m);
    audit(req.user,'fulfillment_owner_clearance',\`Owner cleared fulfillment job \${job.id}\`,{jobId:job.id,orderId:job.orderId,amount:jobAmount,lockId:job.financialLockId});
    res.status(202).json({ok:true,version:BUILD_VERSION,job,status:'CLEARED',clearancePersisted:true});
  }catch(e){res.status(400).json({ok:false,error:e.message});}
});`;
function patchSource(input){
  if(input.includes(MARK)){
    if(!input.includes("clearancePersisted:true")||!input.includes('assertPersistentFinancialLockBinding(persisted,scope)')||!input.includes(ORDER_MARK))throw Error('V6682_PARTIAL_OWNER_CLEARANCE_PATCH');
    return input;
  }
  if(input.split(before).length!==2)throw Error('V6682_OWNER_CLEARANCE_ROUTE_ANCHOR_MISMATCH');
  const updated=input.replace(before,after);
  if(updated.split(submitBefore).length!==2)throw Error('V6682_FULFILLMENT_AMOUNT_ANCHOR_MISMATCH');
  return updated.replace(submitBefore,submitAfter);
}
function apply(root){
  const file=path.join(root,'server.js'),source=fs.readFileSync(file,'utf8');
  const patched=patchSource(source);
  if(patched!==source)fs.writeFileSync(file,patched);
  return {applied:source!==patched,mark:MARK};
}
if(require.main===module){
  if(process.argv[2]!=='--apply'||process.env.SBC_V6682_ISOLATED_STAGE!=='YES')throw Error('V6682_STAGE_ONLY_IN_DISPOSABLE_CI');
  console.log(JSON.stringify(apply(path.resolve(__dirname,'..'))));
}
module.exports={MARK,before,after,patchSource,apply};

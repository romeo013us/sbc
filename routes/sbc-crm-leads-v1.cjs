'use strict';
// Transaction boundary: caller retains authenticated owner, recovery, writer and text guards.
function createCrmLeadHandlers(getContext){
 return {async importRows(req,res,{dryRun,normalized,normPhone,normEmail,normName}){
 const {requireRequestTenant,mysqlPool,getDb,id,now,sqlDateTime}=getContext();
 let conn;
 try{
  const tenantId=Number(requireRequestTenant(req));
  if(!Number.isSafeInteger(tenantId)||tenantId<=0)return res.status(403).json({ok:false,error:'A valid authenticated tenant context is required.'});
  if(!mysqlPool)return res.status(503).json({ok:false,error:'MySQL is unavailable; no records were changed.'});
  conn=await mysqlPool.getConnection();
  const [tenantCols]=await conn.query("SHOW COLUMNS FROM sbc_customers LIKE 'tenant_id'");
  if(!tenantCols.length)return res.status(503).json({ok:false,code:'TENANT_SCHEMA_NOT_READY',error:'The customer table is missing tenant_id. Import is disabled to protect tenant isolation; no records were changed.'});
  if(!dryRun)await conn.beginTransaction();
  const seen=new Set(),results=[],created=[];
  for(const r of normalized){
   const p=normPhone(r.phone),e=normEmail(r.email),b=normName(r.businessName),keys=[p?'p:'+p:'',e?'e:'+e:'',b?'b:'+b:''].filter(Boolean);
   const localKey=keys.find(k=>seen.has(k));let duplicate=null;
   if(localKey)duplicate={business_name:r.businessName,match:'duplicate within uploaded file'};
   else{
    const [matches]=await conn.query("SELECT id,business_name,phone,email FROM sbc_customers WHERE tenant_id=? AND ((? <> '' AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')',''),'+','')=?) OR (? <> '' AND LOWER(email)=LOWER(?)) OR (? <> '' AND LOWER(business_name)=LOWER(?))) LIMIT 1",[tenantId,p,p,e,e,b,b]);
    if(matches.length)duplicate={id:matches[0].id,business_name:matches[0].business_name,match:'existing CRM record'};
   }
   if(duplicate){results.push({row:r.row,businessName:r.businessName,status:'duplicate',match:duplicate.match,existingBusinessName:duplicate.business_name});continue;}
   keys.forEach(k=>seen.add(k));results.push({row:r.row,businessName:r.businessName,status:dryRun?'ready':'imported'});if(dryRun)continue;
   const createdAt=now(),c={id:id('cust'),tenantId,businessName:r.businessName,contactName:r.contactName,phone:r.phone,email:r.email,status:'Lead',source:r.source,followUp:'',notes:r.notes,website:r.website,websiteStatus:r.websiteStatus||(!r.website?'No Website':''),industry:r.industry,dealValue:0,assignedTo:'',researcherId:req.user.id,researcherName:req.user.name||req.user.username||'Lead Import',createdAt,updatedAt:createdAt};
   await conn.query("INSERT INTO sbc_customers (id,tenant_id,business_name,contact_name,phone,email,status,source,follow_up,notes,website,industry,website_status,assigned_to,account_notes_json,lead_intelligence_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",[c.id,c.tenantId,c.businessName,c.contactName,c.phone,c.email,c.status,c.source,null,c.notes,c.website,c.industry,c.websiteStatus,c.assignedTo,'[]','{}',sqlDateTime(c.createdAt),sqlDateTime(c.updatedAt)]);
   created.push(c);
  }
  if(!dryRun){await conn.commit();const db=getDb();if(db&&Array.isArray(db.customers))created.forEach(c=>db.customers.push(c));}
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Cache-Control','no-store');const importedCount=dryRun?0:created.length;const duplicateCount=results.filter(r=>r.status==='duplicate').length;res.json({ok:true,dryRun,tenantId,total:normalized.length,imported:importedCount,ready:results.filter(r=>r.status==='ready').length,duplicates:duplicateCount,results,message:dryRun?'Preview complete. No records were written.':(importedCount===0?'No new records were written; '+duplicateCount+' duplicate(s) were skipped.':'Import complete: '+importedCount+' added; '+duplicateCount+' duplicates skipped.')});
 }catch(e){if(conn&&!dryRun){try{await conn.rollback();}catch{}}console.error('[SBC_V6541_LEAD_IMPORT] import failed:',e&&e.message?e.message:e);res.status(e&&e.code==='TENANT_CONTEXT_REQUIRED'?403:500).json({ok:false,error:'Lead import failed safely. No partial import was committed.',detail:String(e&&e.message||'Unexpected import error').slice(0,300)});}
 finally{if(conn)conn.release();}
 }};
}
module.exports={createCrmLeadHandlers};

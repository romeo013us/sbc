'use strict';
// Legacy manual renewal routes: retain the existing save rail, scope every lookup.
function createLegacyRenewalHandlers(getContext){
 const matches=(row,tenantId)=>Number(row?.tenantId)===tenantId;
 const fields=['customerId','customerName','service','dueDate','amount','status','notes'];
 function validCustomer(db,tenantId,value){
  return !String(value??'').trim()||(db.customers||[]).some(c=>matches(c,tenantId)&&String(c.id)===String(value));
 }
 async function create(req,res){
  const {db,requireRequestTenant,id,now,addActivity,saveData}=getContext();
  const tenantId=requireRequestTenant(req),b=req.body||{};
  if(!b.customerName||!b.service||!b.dueDate)return res.status(400).json({error:'Customer, service and due date are required.'});
  if(!validCustomer(db,tenantId,b.customerId))return res.status(404).json({error:'Customer not found.'});
  const r={id:id('ren'),tenantId,customerId:String(b.customerId||''),customerName:String(b.customerName),service:String(b.service),dueDate:b.dueDate,amount:Number(b.amount||0),status:b.status||'Upcoming',notes:String(b.notes||''),createdAt:now(),updatedAt:now()};
  db.renewals.unshift(r);addActivity('renewal','Added '+r.service+' renewal for '+r.customerName,{renewalId:r.id});await saveData();res.status(201).json(r);
 }
 async function update(req,res){
  const {db,requireRequestTenant,now,saveData}=getContext();
  const tenantId=requireRequestTenant(req),r=db.renewals.find(x=>matches(x,tenantId)&&x.id===req.params.id);
  if(!r)return res.status(404).json({error:'Renewal not found.'});
  const b=req.body||{};
  if(Object.hasOwn(b,'customerId')&&!validCustomer(db,tenantId,b.customerId))return res.status(404).json({error:'Customer not found.'});
  for(const field of fields)if(Object.hasOwn(b,field))r[field]=b[field];
  r.updatedAt=now();await saveData();res.json(r);
 }
 async function remove(req,res){
  const {db,requireRequestTenant,now,saveData}=getContext();
  const tenantId=requireRequestTenant(req),i=db.renewals.findIndex(x=>matches(x,tenantId)&&x.id===req.params.id);
  if(i<0)return res.status(404).json({error:'Renewal not found.'});
  db.renewals[i].status='Deleted';db.renewals[i].updatedAt=now();await saveData();db.renewals.splice(i,1);res.json({ok:true});
 }
 return {create,update,remove};
}
module.exports={createLegacyRenewalHandlers};

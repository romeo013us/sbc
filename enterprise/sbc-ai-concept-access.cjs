'use strict';
// Private concept creation is allowed for owner or the account manager
// explicitly assigned to the CRM account. Release, payment and publishing
// stay owner-only. This is enforced on the server, not just in the browser.
function canCreate(actor,customer,tenantId){
 const tenant=Number(tenantId);
 if(!actor||!customer||!Number.isSafeInteger(tenant)||tenant<1||
  Number(actor.tenantId)!==tenant||Number(customer.tenantId)!==tenant)return false;
 if(String(actor.role)==='owner')return true;
 const assigned=String(customer.assignedTo||customer.assigned_to||'');
 return String(actor.role)==='account_manager'&&assigned.length>0&&assigned===String(actor.id);
}
function canRelease(actor){return String(actor?.role||'')==='owner';}
function middleware({db,requireTenant}){
 return function conceptOnly(req,res,next){
  const tenant=Number(requireTenant(req)),id=String(req.params?.id||'');
  const customer=(Array.isArray(db?.customers)?db.customers:[]).find(c=>String(c.id)===id&&Number(c.tenantId)===tenant);
  if(!canCreate(req.user,customer,tenant))return res.status(403).json({ok:false,code:'WEBSITE_CONCEPT_NOT_ASSIGNED'});
  next();
 };
}
module.exports={canCreate,canRelease,middleware};

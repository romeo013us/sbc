'use strict';
// Legacy CRM compatibility guard; direct-MySQL v6606 endpoint remains preferred.
const EDIT_FIELDS=Object.freeze({
 businessName:255,contactName:255,phone:80,email:255,website:500,industry:160,
 status:48,source:160,followUp:48,notes:12000,city:160,address:500,
 assignedTo:120,websiteStatus:120,leadTemperature:80,dealValue:32
});
const STATES=new Set(['Lead','Prospect','Contacted','Qualified','Proposal','Customer','Lost','Follow Up','Interested','Not Interested','Appointment Set','Not Qualified','Do Not Call','Duplicate']);
function owns(record,tenantId){
 const actual=Number(record?.tenantId??record?.tenant_id),required=Number(tenantId);
 return Number.isSafeInteger(required)&&required>0&&Number.isSafeInteger(actual)&&actual===required;
}
function validatePatch(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.getPrototypeOf(body)!==Object.prototype)return 'INVALID_CRM_PATCH_BODY';
 const keys=Object.keys(body);
 if(!keys.length)return 'EMPTY_CRM_PATCH';
 for(const key of keys){
  if(!Object.hasOwn(EDIT_FIELDS,key))return 'UNAPPROVED_CRM_EDIT_FIELD';
  const value=body[key];
  if(key==='dealValue'){
   if(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>999999999)return 'INVALID_DEAL_VALUE';
  }else if(typeof value!=='string'||value.length>EDIT_FIELDS[key])return 'INVALID_CRM_EDIT_VALUE';
  if(key==='status'&&!STATES.has(value))return 'INVALID_CRM_STATUS';
  if(key==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return 'INVALID_CRM_EMAIL';
 }
 return '';
}
module.exports={EDIT_FIELDS,STATES,owns,validatePatch};

'use strict';
/* SBC independent account-manager session policy. This is a DENY-BY-DEFAULT
 * perimeter, not an owner/caller alias. Managers may only reach their own
 * tenant-scoped Account/Social endpoints after the service checks ownership.
 * The global employee gate must call allowAccountManager on every request.
 */
const STATIC={
 GET:new Set(['/api/me','/api/v9/time/status','/api/training','/api/account-social/v1/portfolio','/api/account-social/v1/research/queue','/api/v6606/crm/account-portfolios/mine','/api/website-production/call-desk','/api/appointments','/api/sbc/sales/actions/today','/api/sbc/sales/reminders/preview','/api/sbc/journey/queue','/api/sbc/journey/reminders','/api/sbc/sales/compensation/me','/api/sbc/sales/workstation/me','/api/sbc/sales/workforce/trial/me','/api/sbc/sales/workforce/awards/me','/api/sales/spanish-callbacks']),
 POST:new Set(['/api/logout','/api/v9/time/clock','/api/training/progress','/api/account-social/v1/posts','/api/sbc/design-briefs','/api/appointments']),
 PUT:new Set([])
};
const VALID_ID='[A-Za-z0-9][A-Za-z0-9_-]{0,119}';
const CONCEPT_BASE='^/api/website-production/customers/'+VALID_ID+'/ai-proposals';
const CONCEPT_UPLOAD='up_[a-f0-9]{32}';
const CONCEPT={
 GET:[new RegExp(CONCEPT_BASE+'$'),new RegExp(CONCEPT_BASE+'/uploads$'),
  new RegExp(CONCEPT_BASE+'/uploads/'+CONCEPT_UPLOAD+'/(?:text-fields|images|qa|download)$'),
  new RegExp(CONCEPT_BASE+'/uploads/'+CONCEPT_UPLOAD+'/preview/[A-Za-z0-9_./-]+$')],
 POST:[new RegExp(CONCEPT_BASE+'/uploads/(?:199|499|799|999)$'),
  new RegExp(CONCEPT_BASE+'/uploads/'+CONCEPT_UPLOAD+'/(?:text-edit|image-replace)$')],
 PATCH:[new RegExp(CONCEPT_BASE+'$')]
};
const RE={
 GET:[
  new RegExp('^/api/sbc/journey/accounts/'+VALID_ID+'$'),
  new RegExp('^/api/training/courses/'+VALID_ID+'$'),
  /^\/api\/sbc\/academy-am\/v1\/window$/,
  /^\/api\/sbc\/academy-am\/v1\/(?:quiz|lab)\/am-[0-9]{2}$/,
  new RegExp('^/api/prospect-intelligence/v4/accounts/'+VALID_ID+'/research$'),
  new RegExp('^/api/prospect-intelligence/v5/accounts/'+VALID_ID+'/plan$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/history$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/call-preflight$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/(?:call-readiness|call-history)$'),
  new RegExp('^/api/account-social/v1/accounts/'+VALID_ID+'/(?:channels|posts)$'),
  new RegExp('^/api/account-social/v1/posts/'+VALID_ID+'$'),
  new RegExp('^/api/sbc/design-briefs/customer/'+VALID_ID+'$')
 ],
 POST:[
  /^\/api\/sbc\/academy-am\/v1\/window\/start$/,
  /^\/api\/sbc\/academy-am\/v1\/(?:quiz|roleplay|lab)\/am-[0-9]{2}$/,
  new RegExp('^/api/sbc/journey/accounts/'+VALID_ID+'/(?:review|consent|invite)$'),
  new RegExp('^/api/sbc/journey/orders/'+VALID_ID+'/progress$'),
  new RegExp('^/api/account-social/v1/accounts/'+VALID_ID+'/interactions$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/(?:note|follow-up)$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/interaction$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/call-start$'),
  new RegExp('^/api/account-social/v1/posts/'+VALID_ID+'/submit$'),
  new RegExp('^/api/account-social/v1/research/handoffs/'+VALID_ID+'/return$'),
  new RegExp('^/api/sbc/design-briefs/'+VALID_ID+'/(?:revoke|review)$'),
  new RegExp('^/api/sales/spanish-callbacks/'+VALID_ID+'/(?:claim|resolve)$')
 ],
 PUT:[new RegExp('^/api/appointments/'+VALID_ID+'$')]
};
function allowed(method,url){
 const verb=String(method||'').toUpperCase();
 if(!Object.hasOwn(STATIC,verb)&&!Object.hasOwn(CONCEPT,verb))return false;
 const path=String(url||'').split('?')[0];
 if(path.includes('%')||path.includes('\\')||path.includes('//')||path.includes('..'))return false;
 return (STATIC[verb]?.has(path)||false)||(RE[verb]?.some(rule=>rule.test(path))||false)||(CONCEPT[verb]?.some(rule=>rule.test(path))||false);
}
function allowAccountManager(user,method,url,now=new Date()){
 if(user?.role!=='account_manager'||user.active===false)return false;
 if(user.expiresAt){
  const expiry=Date.parse(user.expiresAt);
  if(!Number.isFinite(expiry)||expiry<=new Date(now).getTime())return false;
 }
 return allowed(method,url);
}
module.exports=Object.freeze({allowed,allowAccountManager});

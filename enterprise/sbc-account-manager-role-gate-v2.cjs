'use strict';
/* SBC independent account-manager session policy. This is a DENY-BY-DEFAULT
 * perimeter, not an owner/caller alias. Managers may only reach their own
 * tenant-scoped Account/Social endpoints after the service checks ownership.
 * The global employee gate must call allowAccountManager on every request.
 */
const STATIC={
 GET:new Set(['/api/me','/api/v9/time/status','/api/training','/api/account-social/v1/portfolio','/api/account-social/v1/research/queue','/api/v6606/crm/account-portfolios/mine']),
 POST:new Set(['/api/logout','/api/v9/time/clock','/api/training/progress','/api/account-social/v1/posts','/api/sbc/design-briefs'])
};
const VALID_ID='[A-Za-z0-9][A-Za-z0-9_-]{0,119}';
const RE={
 GET:[
  new RegExp('^/api/training/courses/'+VALID_ID+'$'),
  new RegExp('^/api/prospect-intelligence/v4/accounts/'+VALID_ID+'/research$'),
  new RegExp('^/api/prospect-intelligence/v5/accounts/'+VALID_ID+'/plan$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/history$'),
  new RegExp('^/api/account-social/v1/accounts/'+VALID_ID+'/(?:channels|posts)$'),
  new RegExp('^/api/account-social/v1/posts/'+VALID_ID+'$'),
  new RegExp('^/api/sbc/design-briefs/customer/'+VALID_ID+'$')
 ],
 POST:[
  new RegExp('^/api/account-social/v1/accounts/'+VALID_ID+'/interactions$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/(?:note|follow-up)$'),
  new RegExp('^/api/v6606/crm/account-portfolios/'+VALID_ID+'/interaction$'),
  new RegExp('^/api/account-social/v1/posts/'+VALID_ID+'/submit$'),
  new RegExp('^/api/account-social/v1/research/handoffs/'+VALID_ID+'/return$'),
  new RegExp('^/api/sbc/design-briefs/'+VALID_ID+'/(?:revoke|review)$')
 ]
};
function allowed(method,url){
 const verb=String(method||'').toUpperCase();
 if(!Object.hasOwn(STATIC,verb))return false;
 const path=String(url||'').split('?')[0];
 if(path.includes('%')||path.includes('\\')||path.includes('//')||path.includes('..'))return false;
 return STATIC[verb].has(path)||RE[verb].some(rule=>rule.test(path));
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

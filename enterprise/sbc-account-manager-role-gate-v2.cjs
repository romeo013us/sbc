'use strict';
/* SBC independent account-manager session policy. This is a DENY-BY-DEFAULT
 * perimeter, not an owner/caller alias. Managers may only reach their own
 * tenant-scoped Account/Social endpoints after the service checks ownership.
 * The global employee gate must call allowAccountManager on every request.
 */
const STATIC={
 GET:new Set(['/api/me','/api/v9/time/status','/api/training','/api/account-social/v1/portfolio','/api/account-social/v1/research/queue']),
 POST:new Set(['/api/logout','/api/v9/time/clock','/api/training/progress','/api/account-social/v1/posts'])
};
const VALID_ID='[A-Za-z0-9][A-Za-z0-9_-]{0,119}';
const RE={
 GET:[
  new RegExp('^/api/training/courses/'+VALID_ID+'$'),
  new RegExp('^/api/account-social/v1/accounts/'+VALID_ID+'/(?:channels|posts)$'),
  new RegExp('^/api/account-social/v1/posts/'+VALID_ID+'$')
 ],
 POST:[
  new RegExp('^/api/account-social/v1/accounts/'+VALID_ID+'/interactions$'),
  new RegExp('^/api/account-social/v1/posts/'+VALID_ID+'/submit$'),
  new RegExp('^/api/account-social/v1/research/handoffs/'+VALID_ID+'/return$')
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

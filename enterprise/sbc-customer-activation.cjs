'use strict';
const {randomBytes}=require('node:crypto');
const {getState,editState,hash}=require('./sbc-connected-journey.cjs');
const {sameTenant}=require('./sbc-sales-p0p1.cjs');
function createAccess(service,{hashPassword}={}){
 const fail=(code,status=400)=>{throw Object.assign(Error(code),{status})};
 function invite(cid,actor,tid,b){return service.transaction(()=>{
  const c=service.account(cid,actor,tid);if(b.contactVerified!==true)fail('VERIFY_CUSTOMER_CONTACT_FIRST');
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(c.email||'')))fail('CUSTOMER_EMAIL_REQUIRED');
  const account=(service.db.customerAccounts||[]).find(a=>a.customerId===c.id&&a.active!==false);
  if(account?.passwordHash)return {ok:true,alreadyActive:true,activationUrl:service.publicOrigin+'/account.php'};
  const token=randomBytes(32).toString('base64url');editState(c).portalInvitation={tokenHash:hash(token),expiresAt:new Date(Date.parse(service.now())+72*3600000).toISOString(),createdBy:actor.id,destinationHash:hash(String(c.email).trim().toLowerCase())};
  service.event(c,'portal_invitation_prepared',{actor:actor.id});return {ok:true,durable:true,activationUrl:service.publicOrigin+'/activate.php#token='+token};
 },['customers'])}
 function activate(tid,b){return service.transaction(()=>{
  const token=String(b.token||''),password=String(b.password||'');if(!/^[A-Za-z0-9_-]{43}$/.test(token)||password.length<12||password.length>200)fail('INVALID_ACTIVATION_OR_PASSWORD');
  const c=(service.db.customers||[]).find(c=>{const i=getState(c).portalInvitation;return sameTenant(c,tid)&&i&&i.tokenHash===hash(token)&&!i.usedAt&&Date.parse(i.expiresAt)>Date.parse(service.now())&&i.destinationHash===hash(String(c.email||'').trim().toLowerCase())});
  if(!c)fail('ACTIVATION_LINK_INVALID_OR_EXPIRED');
  service.db.customerAccounts=service.db.customerAccounts||[];
  let a=service.db.customerAccounts.find(a=>a.customerId===c.id&&a.active!==false);if(a?.passwordHash)fail('ACCOUNT_ALREADY_ACTIVE',409);
  // An existing account email on another customer cannot be silently reassigned.
  if(service.db.customerAccounts.some(a=>a.active!==false&&a.email===String(c.email).trim().toLowerCase()&&a.customerId!==c.id))fail('ACCOUNT_REVIEW_REQUIRED',409);
  if(!a){a={id:service.id('acct'),tenantId:Number(tid),customerId:c.id,email:String(c.email).trim().toLowerCase(),createdAt:service.now(),active:true};service.db.customerAccounts.push(a)}
  a.passwordHash=hashPassword(password);a.portalSessionVersion=(Number(a.portalSessionVersion)||0)+1;a.lastLoginAt=service.now();editState(c).portalInvitation.usedAt=service.now();
  service.event(c,'portal_activated');return {ok:true,durable:true};
 },['customers','customerAccounts'])}
 return {invite,activate};
}
module.exports={createAccess};

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

test('account manager role policy denies all privileged or unrecognized endpoints',()=>{
 const {allowed}=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 for(const [method,route] of [
  ['GET','/api/me'],['GET','/api/v9/time/status'],['GET','/api/training'],['GET','/api/training/courses/role-account_manager-v1'],
  ['POST','/api/v9/time/clock'],['POST','/api/training/progress'],['GET','/api/account-social/v1/portfolio'],
  ['GET','/api/account-social/v1/research/queue'],
  ['GET','/api/account-social/v1/accounts/abc-123/channels'],
  ['GET','/api/account-social/v1/accounts/abc-123/posts'],
  ['GET','/api/account-social/v1/posts/post-123'],
  ['POST','/api/account-social/v1/accounts/abc-123/interactions'],
  ['POST','/api/account-social/v1/posts'],
  ['POST','/api/account-social/v1/posts/post-123/submit'],
  ['POST','/api/account-social/v1/research/handoffs/abc-123/return'],
  ['POST','/api/logout']
 ])assert(allowed(method,route),'needed manager endpoint denied: '+method+' '+route);
 for(const [method,route] of [
  ['GET','/api/users'],['POST','/api/users'],['GET','/api/customers'],
  ['GET','/api/v566/crm/customer-360/abc-123'],
  ['POST','/api/account-social/v1/research/handoffs'],
  ['POST','/api/account-social/v1/research/handoffs/abc-123/assign'],
  ['GET','/api/account-social/v1/research/feedback'],
  ['POST','/api/account-social/v1/accounts/abc-123/channels'],
  ['POST','/api/account-social/v1/channels/ch-123/verify'],
  ['POST','/api/account-social/v1/posts/post-123/approve'],
  ['POST','/api/account-social/v1/posts/post-123/schedule'],
  ['PUT','/api/account-social/v1/accounts/abc-123/manager'],
  ['GET','/api/orders'],['POST','/api/payments/square'],['GET','/api/marketing/content'],
  ['GET','/api/voice/token'],['GET','/api/account-social/v1/accounts/abc-123/posts/../owner'],
  ['GET','/api/account-social/v1/portfolio/extra'],['DELETE','/api/account-social/v1/posts'],
  ['GET','/api/account-social/v1/accounts/abc-123/channels/secret'],
  ['GET','/api/account-social/v1/accounts/%2e%2e/channels']
 ])assert(!allowed(method,route),'privileged/invalid endpoint allowed: '+method+' '+route);
});

test('role gate rejects inactive or expired workers and rejects non-manager role',()=>{
 const {allowAccountManager}=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 assert(allowAccountManager({role:'account_manager',active:true},'GET','/api/account-social/v1/portfolio'));
 assert(!allowAccountManager({role:'account_manager',active:false},'GET','/api/account-social/v1/portfolio'));
 assert(!allowAccountManager({role:'account_manager',expiresAt:'2020-01-01T00:00:00Z'},'GET','/api/account-social/v1/portfolio',new Date('2026-11-14T00:00:00Z')));
 assert(!allowAccountManager({role:'caller'},'GET','/api/account-social/v1/portfolio'));
 assert(!allowAccountManager({role:'account_manager'},'POST','/api/account-social/v1/posts/p-1/approve'));
});

test('surgical opt-in staging patch adds employee provisioning, auth deny-by-default, and login shell',()=>{
 const {patch,MARK}=require('./stage-account-manager-role-v2.cjs');
 const before=read('server.js');
 assert(!before.includes(MARK),'source should not already contain staged patch marker');
 const result=patch(before);
 assert(result.changed);
 assert.equal(patch(result.source).changed,false,'idempotence');
 assert(result.source.includes("'account_manager','lead_researcher'"),'owner must be able to create and edit manager role');
 assert(result.source.includes('SBC_ACCOUNT_MANAGER_ROLE_GATE.allowAccountManager(u,req.method,req.path)'),'authenticated API should be allowlisted');
 assert(result.source.includes("u?.role==='account_manager'"),'account manager gets dedicated shell');
 assert(result.source.includes("return res.redirect(302,'/sbc-account-manager-v1.html')"),'login route redirects to manager UI');
 assert(result.source.includes("function isWorkforceRole(role){return ['caller','account_manager','lead_researcher','fulfillment'].includes(role)}"));
 assert(result.source.includes('SBC_ACCOUNT_MANAGER_ROLE_GATE'),'role gate module loaded');
 assert(result.source.includes('SBC_V66101_CALLER_POLICY'),'existing caller policy unaffected');
 assert(result.source.includes("if(u?.role==='lead_researcher')return res.redirect(302,'/lead-research.html');"),'Lorna redirect unaffected');
 assert(result.source.includes('app.post(\'/api/login\''),'login unchanged');
 assert(result.source.length-before.length<1700,'patch must stay surgical');
});

test('staging patch refuses unexpected server source instead of installing permissive fallback',()=>{
 const {patch}=require('./stage-account-manager-role-v2.cjs');
 assert.throws(()=>patch('test'),/ACCOUNT_MANAGER_ROLE_PATCH_ANCHOR/);
});

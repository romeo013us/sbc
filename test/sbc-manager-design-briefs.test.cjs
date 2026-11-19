'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {allowed}=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
test('assigned manager can create, read, review and revoke design requests without opening general CRM routes',()=>{
 for(const [method,url] of [
  ['POST','/api/sbc/design-briefs'],
  ['GET','/api/sbc/design-briefs/customer/cust_abc1'],
  ['POST','/api/sbc/design-briefs/brief_a1/review'],
  ['POST','/api/sbc/design-briefs/brief_a1/revoke']])assert(allowed(method,url),method+' '+url);
 for(const [method,url] of [
  ['GET','/api/customers'],
  ['POST','/api/communications/email'],
  ['POST','/api/sbc/design-briefs/brief_a1/delete'],
  ['GET','/api/sbc/design-briefs/customer/%2e%2e']])assert.equal(allowed(method,url),false);
});
test('account-manager opens a customer-specific request panel; browser assets exactly mirror public',()=>{
 for(const f of ['sbc-manager-design-briefs-v1.js','sbc-account-manager-v1.js','sbc-account-manager-v1.html']){
  assert.equal(read('public/'+f),read('browser_public/'+f),f);
 }
 const html=read('public/sbc-account-manager-v1.html'),src=read('public/sbc-account-manager-v1.js');
 assert.match(html,/id="sbcManagerDesignRequests"/);
 assert.match(html,/sbc-manager-design-briefs-v1\.js/);
 assert.match(src,/SBC_MANAGER_DESIGN_BRIEFS\?\.open/);
 const code=read('public/sbc-manager-design-briefs-v1.js');new vm.Script(code);
 assert.match(code,/\/api\/sbc\/design-briefs/);
 assert.match(code,/Assigned|assigned|customer/);
 assert.doesNotMatch(code,/\/api\/communications\/(?:sms|email)/);
});

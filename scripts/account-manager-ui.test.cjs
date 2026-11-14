'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('manager workstation is standalone, session-driven, bilingual, and contains no embedded client data',()=>{
 const html=read('public/sbc-account-manager-v1.html'),js=read('public/sbc-account-manager-v1.js');
 new vm.Script(js,{filename:'sbc-account-manager-v1.js'});
 for(const id of ['accountGrid','handoffList','socialCustomer','socialChannel','socialForm','socialList','noteForm','lang-en','lang-es','alert'])assert(html.includes(`id="${id}"`),'UI missing '+id);
 assert(html.includes('name="robots" content="noindex,nofollow"'));
 assert(js.includes("credentials:'same-origin'"));assert(js.includes('escapeHtml'));assert(!/localStorage|sessionStorage/.test(js),'no CRM data stored in browser');
 assert(js.includes('Mis cuentas'),'bilingual workspace labels');
 assert(js.includes('/api/account-social/v1/portfolio'));assert(js.includes('/api/account-social/v1/research/queue'));
 assert(js.includes('/api/account-social/v1/posts'));assert(!js.includes('example.com/customer'));
});
test('Lorna extension is optional and never replaces her original workspace',()=>{
 const addon=read('public/sbc-lorna-handoff-v1.js');new vm.Script(addon,{filename:'sbc-lorna-handoff-v1.js'});
 assert(addon.includes('nav[aria-label="Research navigation"]'));
 assert(addon.includes('/api/account-social/v1/research'));
 assert(!addon.includes('localStorage')&&!addon.includes('sessionStorage'));
 for(const asset of ['sbc-account-manager-v1.html','sbc-account-manager-v1.css','sbc-account-manager-v1.js','sbc-lorna-handoff-v1.js','sbc-lorna-handoff-v1.css'])
  assert.equal(read('public/'+asset),read('browser_public/'+asset),'asset trees must be mirrored: '+asset);
});

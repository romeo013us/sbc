'use strict';
/* SBC V6616: static owner-QA link must survive dynamic dashboard replacements.
 * Pure browser mocks: no HTTP, provider calls, database or production writes.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
assert.equal(html,fs.readFileSync(path.join(root,'browser_public/index.html'),'utf8'));
assert.match(html,/id="sbc-owner-qa-nav-link"/);
assert.match(html,/id="sbc-quick-checkout-nav-link"/);
assert.match(html,/#sbc-owner-qa-nav-link\[hidden\]\{display:none!important\}/);
assert.match(html,/id="sbc-owner-qa-nav-link"[^>]*hidden/);
assert.match(html,/id="sbc-quick-checkout-nav-link"[^>]*hidden/);
const start=html.indexOf('<script id="sbc-owner-import-nav-verified">');
const end=html.indexOf('</script>',start);
assert(start>=0&&end>start,'owner navigation script must exist');
const script=html.slice(start+html.slice(start).indexOf('>')+1,end);
new vm.Script(script);
async function probe(role){
 const calls=[],listeners={},elements={};
 for(const id of ['app','sbc-owner-import-link','sbc-owner-qa-nav-link','sbc-quick-checkout-nav-link','logoutBtn']){
  elements[id]={hidden:true,classList:{contains:()=>false},addEventListener:(name,fn)=>listeners[id+':'+name]=fn};
 }
 const document={getElementById:id=>elements[id]||null};
 const window={sbcOpenOwnerDollarQA:()=>calls.push('owner-test'),sbcOpenQuickCheckout:()=>calls.push('quick-sale')};
 const fetch=async(url,opt)=>{assert.equal(url,'/api/me');assert.equal(opt.credentials,'same-origin');return{ok:true,json:async()=>({authenticated:true,user:{role}})}};
 vm.runInNewContext(script,{document,window,fetch,console},{timeout:2000});
 await new Promise(resolve=>setImmediate(resolve));
 const owner=role==='owner',sales=['owner','admin','manager','sales','sales_manager','sales_account_manager'].includes(role);
 assert.equal(elements['sbc-owner-qa-nav-link'].hidden,!owner,'QA is owner-only in navigation');
 assert.equal(elements['sbc-owner-import-link'].hidden,!owner,'old importer role still enforced');
 assert.equal(elements['sbc-quick-checkout-nav-link'].hidden,!sales,'fast checkout visible to permitted sales roles');
 listeners['sbc-owner-qa-nav-link:click']();
 listeners['sbc-quick-checkout-nav-link:click']();
 assert.equal(calls.includes('owner-test'),owner,'owner action only for owner');
 assert.equal(calls.includes('quick-sale'),sales,'sales shortcut only for permitted roles');
 listeners['logoutBtn:click']();
 assert.equal(elements['sbc-owner-qa-nav-link'].hidden,true,'logout immediately hides owner QA');
 assert.equal(elements['sbc-quick-checkout-nav-link'].hidden,true,'logout immediately hides checkout');
}
(async()=>{
 await probe('owner');
 await probe('sales');
 await probe('lead_researcher');
 await probe('demo');
 console.log('[SBC V6616 QA NAV] PASS: owner/sales/Lorna/demo, static shortcut, logout hiding, no dashboard or payment mutations');
})().catch(e=>{console.error(e);process.exitCode=1});

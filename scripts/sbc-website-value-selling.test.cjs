'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const read=name=>fs.readFileSync(__dirname+'/../'+name,'utf8');
test('owner website pitch explains discovery, confidence and next action without guaranteed rankings',()=>{
 const pitch=require('../public/sbc-website-sales-script-v1.js').build({businessName:'Example Services'});
 for(const phrase of ['GET FOUND','BUILD TRUST','GENERATE INQUIRIES','Facebook','optional','79/month'])assert(pitch.includes(phrase),phrase);
 assert(!/we guarantee (google rankings|sales)/i.test(pitch));
});
test('staff caller gets three bilingual website-value objections in playbook',()=>{
 const lib=require('../public/sbc-sales-playbook-v66106.js'),en=lib.getSections('en'),es=lib.getSections('es');
 assert.equal(lib.check().bilingual,true);
 const g=en.find(x=>x.id==='websiteValue'),s=es.find(x=>x.id==='websiteValue');assert(g&&s);
 for(const id of ['value-find','value-trust','value-inquiry','value-social','value-care'])assert(g.items.some(x=>x.id===id)&&s.items.some(x=>x.id===id),id);
 assert(!/guaranteed rankings|guaranteed sales/i.test(g.items.map(i=>i.say).join(' ')));
});
test('account manager has dedicated website value quick-reference and translated sales prompts',()=>{
 const html=read('public/sbc-account-manager-v1.html');const js=read('public/sbc-account-manager-v1.js');
 assert(html.includes('data-view="website-value"'));assert(html.includes('id="view-website-value"'));
 for(const phrase of ['Get Found','Build Trust','Make Contact Easy','Facebook'])assert(html.includes(phrase),phrase);
 assert(js.includes('siteValue')&&js.includes('siteNeed')&&js.includes('careText'));
});
for(const f of ['sbc-sales-playbook-v66106.js','sbc-account-manager-v1.html','sbc-account-manager-v1.js','sbc-website-sales-script-v1.js'])
 test('static mirrored '+f,()=>assert.equal(read('public/'+f),read('browser_public/'+f)));

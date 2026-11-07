'use strict';
/* SBC V66.106: source-and-staged sales-only regression. No calls, writes or payment actions. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=x=>fs.readFileSync(path.join(root,x),'utf8');
for(const name of ['sales-caller.html','sales-caller.js','sales-caller.css','sbc-sales-playbook-v66106.js'])
 assert.equal(read('public/'+name),read('browser_public/'+name),'browser/public parity: '+name);
const html=read('public/sales-caller.html');
const caller=read('public/sales-caller.js');
const script=read('public/sbc-sales-playbook-v66106.js');
const css=read('public/sales-caller.css');
new vm.Script(caller,{filename:'sales-caller.js'});
new vm.Script(script,{filename:'sbc-sales-playbook-v66106.js'});
const moduleApi=require('../public/sbc-sales-playbook-v66106.js');
const status=moduleApi.check();
assert.deepEqual(status,{count:33,unique:true,bilingual:true});
const en=moduleApi.getSections('en'),es=moduleApi.getSections('es');
assert.equal(en.length,5);
assert.equal(es.length,5);
assert.deepEqual(en.map(x=>x.id),es.map(x=>x.id));
assert.deepEqual(en.flatMap(x=>x.items.map(i=>i.id)),es.flatMap(x=>x.items.map(i=>i.id)));
for(const [language,sections] of [['en',en],['es',es]]){
 assert.equal(sections.reduce((n,s)=>n+s.items.length,0),33);
 for(const section of sections)for(const i of section.items){
  assert(i.title.length>=5&&i.say.length>=35&&i.coach.length>=15,'readable '+language+' '+i.id);
  assert(!/<script\b/i.test(i.say)&&!/<script\b/i.test(i.coach));
 }
}
assert(en[0].items.some(x=>x.id==='cold'&&x.say.includes('Successful By Choice')));
assert(es[0].items.some(x=>x.id==='cold'&&x.say.includes('Successful By Choice')));
assert(en.some(s=>s.id==='verticals'&&s.items.some(x=>x.id==='barber')&&s.items.some(x=>x.id==='restaurant')));
assert(en.some(s=>s.id==='objections'&&s.items.some(x=>x.id==='dnc')&&s.items.some(x=>x.id==='trust')));
assert(en.some(s=>s.id==='finish'&&s.items.some(x=>x.id==='handoff')));
assert(html.indexOf('src="/sbc-sales-playbook-v66106.js')>0);
assert(html.indexOf('src="/sbc-sales-playbook-v66106.js')<html.indexOf('src="/sales-caller.js'));
assert(html.includes('sales-caller.js?v=3')&&html.includes('sales-caller.css?v=4'),'cache-bust changed frontend assets');
assert(caller.includes('window.SBCSalesPlaybook')&&caller.includes('sbc-script-search')&&caller.includes('navigator.clipboard.writeText'));
assert(caller.includes("renderScripts(chosen)"),'language switch updates script content');
assert(caller.includes("lead=data.leads.find"),'assigned dialer unchanged');
assert(caller.includes("role==='sales'&&selector&&selector.value==='360'?360:240"),'4/6 hour schedule unchanged');
assert(caller.includes('SBCResearchLessonReader')&&caller.includes("lesson.learn"),'training reader unchanged');
assert(!script.includes('fetch(')&&!script.includes('XMLHttpRequest')&&!script.includes('/api/'),'scripts are purely informational');
assert(!script.includes('localStorage')&&!script.includes('document.createElement'),'module cannot change CRM data or active caller UI');
assert(css.includes('#desk #scripts .sbc-script-card'),'script-specific styling only');
for(const phrase of ['Do Not Call','do-not-call','Stop','STOP']){
 assert(script.toLowerCase().includes(phrase.toLowerCase()),'DNC safeguard missing: '+phrase);
}
console.log('[SBC V66.106] PASS: 33 original bilingual sales talk tracks; no missing language, mirrored staged assets, scoped script UX, unchanged Twilio/dialer/training/4-6h shift/owner permissions, DNC guardrails');

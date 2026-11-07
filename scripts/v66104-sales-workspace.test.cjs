'use strict';
/* SBC V66.104: no provider calls, no contact, no customer writes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
for(const file of ['sales-caller.html','sales-caller.css','sales-caller.js','sbc-sales-workspace-locale-v66104.js']){
 assert.equal(read('public/'+file),read('browser_public/'+file),file+' must be mirrored in both served asset trees');
}
const html=read('public/sales-caller.html'),source=read('public/sales-caller.js'),localeSource=read('public/sbc-sales-workspace-locale-v66104.js');
new vm.Script(source,{filename:'sales-caller.js'});
new vm.Script(localeSource,{filename:'sbc-sales-workspace-locale-v66104.js'});
const scriptOrder=['sbc-research-lesson-reader.js','sbc-sales-workspace-locale-v66104.js','sales-caller.js'];
let start=-1;
for(const entry of scriptOrder){const at=html.indexOf('src="/'+entry);assert(at>start,'script must load before dependent caller code: '+entry);start=at;}
assert.equal((html.match(/id="lang-es"/g)||[]).length,1);
assert.equal((html.match(/id="lang-en"/g)||[]).length,1);
assert.match(html,/role="group" aria-label="Whole-workspace language"/);
assert.match(html,/https:\/\/sbcmia\.com"/);assert.match(html,/https:\/\/sbcwebsites\.com"/);
assert.equal((html.match(/rel="noopener noreferrer"/g)||[]).length,2,'external links must be safe new tabs');
assert.match(html,/id="training-detail"/);assert.match(html,/academy-sales-hero/);
assert(!source.includes("Mark lesson studied"),'legacy one-click lesson completion removed');
assert(!source.includes("prompt('Briefly describe what you learned"),'no legacy popup completion');
for(const term of [
 'SBCResearchLessonReader','reader.normalize(module)','lesson.learn',
 'lesson.practicePrompt','lesson.knowledgePrompt','lesson.questions',
 'lesson-complete-form','reflection.value.trim().length<12',
 'check.checked','status:\u0027completed\u0027','Back to courses',
 'training-lesson-content','aria-expanded','readable course material'
])assert(source.includes(term),'structured course-reader support missing: '+term);
assert(!source.includes('window.location.replace(')&&source.includes("'/api/training/progress'"),
 'course progress must use authorized employee training API with no impersonation');
assert(source.includes("selected=localStorage.getItem('sbc-sales-language-v1:'+me.id)"),'employee-scoped language saved locally');
assert(source.includes("switchLanguage('es')")&&source.includes("switchLanguage('en')"));
assert(source.includes('renderScripts(chosen)'),'language and scripts must stay in sync');
const locale=require('../public/sbc-sales-workspace-locale-v66104.js');
assert.equal(locale.convert('My Assigned Leads','es'),'Mis prospectos asignados');
assert.equal(locale.convert('4-hour shift','es'),'Turno de 4 horas');
assert.equal(locale.convert('6-hour shift','es'),'Turno de 6 horas');
assert.equal(locale.convert('Clock In','es'),'Registrar entrada');
assert.equal(locale.convert('Open lesson','es'),'Abrir lección');
assert.equal(locale.convert('Research links','es'),'Enlaces de consulta');
assert.equal(locale.convert('My Assigned Leads','en'),'My Assigned Leads','English restored without leaking Spanish into stored data');
assert.equal(locale.convert('Real client business','es'),'Real client business','customer-provided names must be unchanged');
assert.match(locale.convert('4 of 8 checked · 240 planned minutes','es'),/4 de 8/);
assert.match(locale.convert('Schedule anchored to verified clock-in: 10:00 · 6-hour plan.','es'),/6 horas/);
const reader=require('../public/sbc-research-lesson-reader.js');
const sample=reader.normalize({id:'sales-01',title:'Sales Practice',minutes:15,lesson:{
 objective:'Make an accurate and consented sales call.',
 learn:['Identify the business need','Record real outcomes'],
 practice:{prompt:'Practice an opening',evidence:'Describe the conversation'},
 knowledgeCheck:{prompt:'When should you stop calling?',passingRule:'Stop when someone opts out'}
}});
assert.equal(sample.hasReadableContent,true);
assert.deepEqual(sample.learn,['Identify the business need','Record real outcomes']);
assert.match(sample.knowledgePrompt,/stop calling/);
const shift=require('../public/sbc-role-shift-plan.js');
assert.equal(shift.totalMinutes('sales',{minutes:240}),240);
assert.equal(shift.totalMinutes('sales',{minutes:360}),360);
assert.match(source,/const selected=role==='sales'&&selector&&selector.value==='360'\?360:240/,'four/six-hour planner must be preserved');
assert.match(source,/lead=data\.leads\.find/,'assigned lead dialer must remain untouched');
const callerPolicy=require('../enterprise/v66101-caller-access.cjs');
assert(callerPolicy.allowed('GET','/api/training/courses/role-caller-v1'));
assert(callerPolicy.allowed('POST','/api/training/progress'));
assert(!callerPolicy.allowed('GET','/api/orders'));
assert(!callerPolicy.allowed('GET','/api/customers'));
assert(!callerPolicy.allowed('POST','/api/payments'));
console.log('PASS V66.104 — structured Academy reader, gated completion, full-desk ES/EN, mirrored assets, secure sites, untouched shift/dialer, role access');

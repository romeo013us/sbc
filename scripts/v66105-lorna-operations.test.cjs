'use strict';
/* SBC V66.105 Lorna operational test: read-only queue filtering,
   researcher least-privilege notice action, and full 4-hour plan. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const schedule=require('../public/sbc-role-shift-plan.js');
const filter=require('../public/sbc-lorna-queue-filter-v66105.js');
const stage=require('./v66105-stage-lorna-notice-role.cjs');
const tasks=schedule.template('lead_researcher');
assert.equal(schedule.totalMinutes('lead_researcher'),240);
assert.equal(tasks[0].minutes,2,'clock-in task exactly two minutes');
assert.equal(tasks[0].tab,'clock');
assert.equal(tasks.at(-1).minutes,2,'clock-out task exactly two minutes');
assert.equal(tasks.at(-1).tab,'clock');
assert.equal(tasks.filter(x=>/^research/.test(x.id)).reduce((n,x)=>n+x.minutes,0),215,'215 minutes direct lead research');
assert(!tasks.some(x=>/cool.?down|rest period|mandatory break/i.test(x.title)));
assert.equal(schedule.totalMinutes('sales',{minutes:240}),240,'4h calling schedule preserved');
assert.equal(schedule.totalMinutes('sales',{minutes:360}),360,'6h calling schedule preserved');
const normal={id:'good',businessName:'Café Pérez',contactName:'María Gómez',phone:'3055550101'};
const binary={id:'binary',businessName:'PK\u0003\u0004\u0001\u0002 not readable'};
const binaryXml={id:'xml',businessName:'xl/workbook.xml'};
const damaged={id:'damaged',businessName:'broken \ufffd name'};
assert.deepEqual(filter.clean([normal,binary,binaryXml,damaged]).map(x=>x.id),['good']);
assert.equal(filter.displayable(normal),true);
assert.equal(filter.corrupt(binary),true);
assert.equal(filter.corrupt(binaryXml),true);
assert.equal(filter.corrupt(damaged),true);
assert.equal(filter.displayable({businessName:'El Niño',contactName:'Ana'}),true);
const ui=read('public/lead-research.js'),html=read('public/lead-research.html');
new vm.Script(ui,{filename:'lead-research.js'});
new vm.Script(read('public/sbc-lorna-queue-filter-v66105.js'),{filename:'sbc-lorna-queue-filter-v66105.js'});
assert(ui.includes('researchDisplayable(c)&&isException(c)'),'attention queue must skip binary CRM remnants');
assert(ui.includes('submittedIds.has(String(c.id))&&researchDisplayable(c)'),'only researcher submissions and human readable leads');
assert(ui.includes('function researchDisplayable(c)'),'filter must fail without removing the lead from CRM');
assert(html.includes('sbc-lorna-queue-filter-v66105.js?v=1'),'filter must load before research UI');
assert(html.indexOf('sbc-lorna-queue-filter-v66105.js?v=1')<html.indexOf('lead-research.js?v=9'),'filter load order');
assert(html.includes('sbc-role-shift-plan.js?v=2'),'updated schedule cache bust');
assert(!/DELETE|fetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(read('public/sbc-lorna-queue-filter-v66105.js')),'filter cannot mutate data');
const raw=read('server.js'),patched=stage.patchServer(raw);
assert.equal(stage.patchServer(patched),patched,'staged role allowance must be idempotent');
assert(patched.includes(stage.MARK));
const start=patched.indexOf('function sbcLornaAllowedRequest(req,user){');
const end=patched.indexOf('app.use(async function sbcLornaLeastPrivilegeGate',start);
assert(start>=0&&end>start,'fail closed if role gate is not present');
const allow=(new Function(patched.slice(start,end)+';return sbcLornaAllowedRequest;'))();
const req=(method,path)=>({method,path});
const me={id:'lorna1',role:'lead_researcher'};
assert(allow(req('POST','/api/v9/lead-verification/lead-1/resolve-notice'),me),'existing safe notice route must work');
assert(allow(req('GET','/api/v9/lead-verification'),me),'research queue stays available');
assert(allow(req('POST','/api/v9/lead-verification/lead-1'),me),'research correction stays available');
for(const [method,p] of [
 ['GET','/api/v9/lead-verification/lead-1/resolve-notice'],['DELETE','/api/v9/lead-verification/lead-1/resolve-notice'],
 ['POST','/api/v9/lead-verification/lead-1/resolve-notice/other'],['GET','/api/orders'],
 ['POST','/api/payments'],['POST','/api/users']
])assert.equal(allow(req(method,p),me),false,'must not expand researcher access to '+method+' '+p);
assert(patched.includes("app.post('/api/v9/lead-verification/:id/resolve-notice',auth,"),'real existing handler still required');
assert(patched.includes("if(!owns||['customer'"),'server still checks ownership');
if(process.argv.includes('--staged'))assert.equal(raw,patched,'staged ZIP must contain allowed route after transform');
console.log('PASS V66.105 — Lorna 215/240 research focus, 2-minute clocks, corrupted-row quarantine without deletion, scoped notice route and forbidden API denials');

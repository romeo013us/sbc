'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const priority=require('../public/sbc-followup-priority-v66103.js');
assert.equal(read('public/sbc-followup-priority-v66103.js'),read('browser_public/sbc-followup-priority-v66103.js'),'new helper must be mirrored');
assert.equal(read('public/sales-caller.js'),read('browser_public/sales-caller.js'),'sales UI must be mirrored');
assert.equal(read('public/sales-caller.html'),read('browser_public/sales-caller.html'),'sales HTML must be mirrored');
const html=read('public/sales-caller.html');
assert(html.indexOf('/sbc-followup-priority-v66103.js?v=1')<html.indexOf('/sales-caller.js?v=1'),'load helper before caller');
const ui=read('public/sales-caller.js');
assert(ui.includes('SBCFollowupPriority?.buildQueue'),'caller UI must use callback prioritization');
assert(ui.includes('Follow-up prioritization is unavailable.'),'missing helper must show a visible error');
const now=Date.parse('2026-11-07T12:00:00Z');
const leads=[
{id:'a',canCall:true,businessName:'Overdue Company'},
{id:'b',canCall:true,businessName:'Due Soon Company'},
{id:'c',canCall:true,businessName:'Future Company'},
{id:'d',canCall:true,businessName:'Unscheduled Company'},
{id:'e',canCall:false,doNotContact:true,businessName:'Suppressed'},
{id:'f',canCall:true,businessName:'Refused'},
{id:'g',canCall:true,businessName:'Lead Scheduled','followUpAt':'2026-11-08T18:00:00Z'},
{id:'h',canCall:true,businessName:'Handled By Later Report'},
{id:'i',canCall:true,businessName:'Date Only Follow Up','followUpAt':'2026-11-08'},
{id:'j',canCall:true,businessName:'No Report'}
];
const report=(customerId,outcome,callbackAt='',createdAt='2026-11-07T11:00:00Z')=>({customerId,outcome,callbackAt,createdAt});
const reports=[
report('a','Follow-up Requested','2026-11-07T10:00:00Z'),
report('b','Appointment Requested','2026-11-07T12:30:00Z'),
report('c','Follow-up Requested','2026-11-08T19:00:00Z'),
report('d','Follow-up Requested'),
report('e','Follow-up Requested','2026-11-07T10:00:00Z'),
report('f','Follow-up Requested','2026-11-07T10:00:00Z','2026-11-06T10:00:00Z'),
report('f','Do Not Call','','2026-11-07T11:00:00Z'),
report('h','Follow-up Requested','2026-11-07T10:00:00Z','2026-11-06T10:00:00Z'),
report('h','No Answer','','2026-11-07T11:00:00Z'),
report('not-assigned','Follow-up Requested','2026-11-07T10:00:00Z')
];
const before=JSON.stringify({leads,reports});
const rows=priority.buildQueue(leads,reports,now);
assert.deepEqual(rows.map(x=>x.customerId),['a','d','i','b','c','g'],'overdue first, then unscheduled, soon, later');
assert.equal(rows[0].status,'overdue');
assert.equal(rows[1].status,'needs_time');
assert.equal(rows[2].status,'needs_time');
assert.equal(rows[3].status,'due_soon');
assert.equal(rows[4].status,'scheduled');
assert.equal(rows[5].status,'scheduled');
assert(!rows.some(x=>['e','f','h','not-assigned','j'].includes(x.customerId)),'never propose restricted, closed, unrelated or unscheduled-no-intent contacts');
assert.equal(JSON.stringify({leads,reports}),before,'ranking must not mutate CRM or reports');
assert.equal(priority.time('2026-11-07'),null,'date-only is not an exact scheduled call');
assert.equal(priority.time('2026-11-07T12:00:00'),null,'timezone-less date is not exact');
assert.equal(priority.time('bogus'),null);
assert.equal(priority.buildQueue([],reports,now).length,0);
assert.equal(priority.buildQueue(leads,[],now).length,2,'only explicit lead follow-up evidence survives without reports');
console.log('PASS V66.103: overdue-first assigned follow-ups, DNC/closure guard, latest report, no guessed times, mirrored assets and non-mutating queue');

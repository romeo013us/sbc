'use strict';
// Super SBC owner real-world regression: 500 unassigned records are a QUEUE,
// not 500 urgent tasks. Broken source names are flagged, never silently fixed.
const assert=require('node:assert/strict');
const {planActions}=require('../enterprise/sbc-free-action-focus.cjs');
const actor={id:'owner_001',role:'owner',active:true};
const tenantId=7,today='2026-11-21';
function row(n,patch={}){return {tenant_id:7,id:'lead_'+String(n).padStart(5,'0'),business_name:'Shop '+n,
 phone:'3055551234',status:'Lead',assigned_to:'',follow_up:null,...patch};}
const backlogged=Array.from({length:500},(_,i)=>row(i));
const grouped=planActions({tenantId,actor,rows:backlogged,today,limit:12});
assert.equal(grouped.total,1,'500 unassigned leads are one owner work queue, not 500 emergency tasks');
assert.equal(grouped.actions.length,1);
assert.equal(grouped.actions[0].code,'UNASSIGNED_QUEUE_REVIEW');
assert.equal(grouped.actions[0].batchCount,500);
assert.equal(grouped.actions[0].accountId,null,'batch action cannot pretend to open arbitrary account');
assert.equal(grouped.queueCounts.UNASSIGNED_QUEUE_REVIEW,500);
assert.equal(grouped.dataQualityCount,0);
assert.equal(grouped.requiresAi,false);
assert.equal(grouped.messagesSent,0);
assert(!JSON.stringify(grouped).includes('305555'),'contact numbers never leave the action endpoint');
// A single urgent record is placed before the batch review, not buried in the wall.
const urgent=planActions({tenantId,actor,rows:[...backlogged,row(900,{assigned_to:'manager_001',follow_up:'2026-11-20'})],today});
assert.equal(urgent.actions[0].code,'FOLLOW_UP_DUE');
assert.equal(urgent.queueCounts.UNASSIGNED_QUEUE_REVIEW,500);
// The source might contain C0/C1 controls, decode replacement characters,
// mixed binary, or invalid UTF8 from an import. Never render corrupt bytes
// as a business name, nor overwrite the existing database value.
const corrupt=[row(1001,{business_name:'}\uFFFD \uFFFD /0Q\uFFFD*H'}),row(1002,{business_name:'Auto\u0003\u0000\u009f Shop'}),row(1003,{business_name:Buffer.from([0xff,0xfe,0xfd])}),row(1004,{business_name:''})];
const dataIssue=planActions({tenantId,actor,rows:corrupt,today,limit:12});
assert.equal(dataIssue.dataQualityCount,4);
assert.equal(dataIssue.actions.filter(a=>a.code==='VERIFY_BUSINESS_NAME').length,4);
assert(dataIssue.actions.filter(a=>a.code==='VERIFY_BUSINESS_NAME').every(a=>a.businessName==='Business name needs verification'));
assert(!JSON.stringify(dataIssue).includes('\uFFFD'));
assert(!JSON.stringify(dataIssue).includes('Auto\u0003'));
assert(dataIssue.actions.every(a=>a.detail.includes('source')||a.code==='UNASSIGNED_QUEUE_REVIEW'));
// Legitimate multilingual text is displayed without arbitrary English-only filtering.
const unicode=planActions({tenantId,actor,rows:[row(1005,{business_name:'Café São José'}),row(1006,{business_name:'美美理髪店'})],today});
assert.equal(unicode.dataQualityCount,0);
assert.equal(unicode.actions[0].code,'UNASSIGNED_QUEUE_REVIEW');
// General low-priority qualification work is also grouped, while real dated
// commitments and safety restrictions remain independently visible.
const assigned=Array.from({length:300},(_,i)=>row(i,{assigned_to:'manager_001'}));
const am=planActions({tenantId,actor:{id:'manager_001',role:'account_manager',active:true},rows:assigned,today});
assert.equal(am.total,1,'hundreds of unqualified leads should be a queue, not hundreds of urgent cards');
assert.equal(am.actions[0].code,'QUALIFICATION_QUEUE_REVIEW');
assert.equal(am.actions[0].batchCount,300);
const suppressed=planActions({tenantId,actor,rows:[row(1500,{status:'Do Not Contact',follow_up:'2026-11-17'})],today});
assert.equal(suppressed.actions[0].code,'CONTACT_RESTRICTION_REVIEW');
console.log('SUPER SBC TRIAGE PASS: 500 backlog -> one queue; corrupt source names flagged; urgent items and tenant safety preserved');

const desk=planActions({tenantId,actor,today,limit:2,rows:[
 ...Array.from({length:20},(_,i)=>row(i,{assigned_to:'manager_001',follow_up:'2026-11-20'})),
 row(100,{assigned_to:'manager_001',follow_up:'2026-11-24'}),
 row(101,{status:'Do Not Call'}),row(102,{business_name:''}),
 ...Array.from({length:25},(_,i)=>row(200+i))
]});
assert.equal(desk.actions.length,2,'legacy prioritized list preserved');
assert.deepEqual(desk.lanes.map(x=>x.id),['commitments','review','upcoming','pipeline']);
assert.equal(desk.lanes[0].decisionCount,20);
assert.equal(desk.lanes[0].actions.length,2);
assert.equal(desk.lanes[1].decisionCount,2);
assert.equal(desk.lanes[2].actions[0].code,'FOLLOW_UP_UPCOMING');
assert.equal(desk.lanes[3].recordCount,25);
assert.equal(desk.lanes[3].decisionCount,1);
assert.equal(desk.lanes.reduce((n,x)=>n+x.decisionCount,0),desk.total);
assert.equal(desk.lanes.reduce((n,x)=>n+x.recordCount,0),48);
assert(!JSON.stringify(desk.lanes).includes('305555'));

// Closed and duplicate records must not crowd either active daily workspace.
for(const role of ['owner','account_manager']){
 const active=planActions({tenantId,actor:{id:'manager_001',role,active:true},today,rows:[row(9100,{assigned_to:'manager_001',follow_up:'2026-11-20'}),row(9101,{assigned_to:'manager_001',status:' Duplicate ',follow_up:'2026-11-19'}),row(9102,{assigned_to:'manager_001',status:'Archived',follow_up:'2026-11-19'})]});
 assert.equal(active.total,1);assert.equal(active.actions[0].accountId,'lead_09100');
}

'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {recordCallDisposition}=require('../lib/smart-dialing-crm-integration');
const now=new Date('2026-11-10T15:30:00Z');
function makeWriter(){
 const state={lead:{id:'L1',callAttempts:0},events:[],patches:0};
 const writer={
  transaction:async fn=>fn({
   findCallEvent:async id=>state.events.find(e=>e.eventId===id),
   getLeadForUpdate:async id=>id==='L1'?state.lead:null,
   applyLeadPatch:async(id,patch)=>{state.lead={...state.lead,...patch};state.patches++},
   appendCallEvent:async event=>{state.events.push(event)}
  })
 };
 return {state,writer};
}
const authorize=async()=>true;
test('updates lead and records audit event',async()=>{
 const {state,writer}=makeWriter();
 const result=await recordCallDisposition({writer,leadId:'L1',input:{eventId:'event-0001',actorId:'agent1',outcome:'no_answer'},now,authorize});
 assert.equal(result.duplicate,false);assert.equal(state.patches,1);assert.equal(state.events.length,1);
});
test('repeated event does not double count',async()=>{
 const {state,writer}=makeWriter();
 const args={writer,leadId:'L1',input:{eventId:'event-0001',actorId:'agent1',outcome:'no_answer'},now,authorize};
 await recordCallDisposition(args);const second=await recordCallDisposition(args);
 assert.equal(second.duplicate,true);assert.equal(state.lead.callAttempts,1);
});
test('unauthorized caller cannot change CRM',async()=>{
 const {state,writer}=makeWriter();
 await assert.rejects(recordCallDisposition({writer,leadId:'L1',input:{eventId:'event-0001',actorId:'agent1',outcome:'no_answer'},now,authorize:async()=>false}),/Not authorized/);
 assert.equal(state.patches,0);
});
test('invalid event id rejected',async()=>{
 const {writer}=makeWriter();
 await assert.rejects(recordCallDisposition({writer,leadId:'L1',input:{eventId:'bad',actorId:'agent1',outcome:'no_answer'},now,authorize}),/Stable eventId/);
});

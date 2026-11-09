'use strict';
const assert=require('node:assert/strict');
const {SBCUnattendedNotifications}=require('../enterprise/sbc-unattended-notifications-v6504.cjs');
(async()=>{
 const now=new Date('2026-11-09T13:00:00.000Z');
 const owner=new SBCUnattendedNotifications({
  env:{SBC_RUNTIME_ROLE:'test'},getPool:()=>null,
  getDb:()=>({appointments:[
   {id:'a1',customerName:'SBC Example Repair',title:'Website demonstration',startAt:'2026-11-09T15:00:00.000Z',status:'Scheduled'},
   {id:'a2',customerName:'Cancelled Business',startAt:'2026-11-09T12:00:00.000Z',status:'Cancelled'}
  ],tasks:[
   {id:'t1',customerName:'SBC Example Restaurant',title:'Review email reply',type:'SBC Inbound Reply Review',dueAt:'2026-11-09T14:00:00.000Z',status:'Open'},
   {id:'t2',customerName:'Old task',title:'Closed follow-up',type:'Follow Up',dueAt:'2026-11-09T13:00:00.000Z',status:'Completed'}
  ]}),
  getRecoveryRequired:()=>false,clock:()=>now,rootDir:'/nonexistent/sbc-test-state',logger:{warn(){}}
 });
 const report=await owner._metrics();
 assert.equal(report.salesPriorities.dueOrUpcoming,2,'live appointment and email reply task prioritized');
 assert.equal(report.salesPriorities.preview[0].business,'SBC Example Restaurant');
 assert.equal(report.salesPriorities.preview[1].business,'SBC Example Repair');
 const brief=owner._briefText(report);
 assert.match(brief,/SALES PRIORITIES NEXT 48 HOURS/);
 assert.match(brief,/SBC Example Repair/);
 assert.match(brief,/SBC Example Restaurant/);
 assert.doesNotMatch(brief,/Cancelled Business/);
 assert.doesNotMatch(brief,/Old task/);
 assert.match(brief,/LOCAL READ MODEL/);
 console.log('PASS SBC owner daily briefing: due-first appointment and reply tasks, cancelled/closed excluded, local-read caveat');
})().catch(e=>{console.error(e);process.exitCode=1});

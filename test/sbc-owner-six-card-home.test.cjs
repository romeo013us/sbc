'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const root=path.resolve(__dirname,'..'), read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('public/app.js'), ops=read('public/v32-2-upgrade.js'), html=read('public/index.html');
function load(){
 const source=app.match(/\/\* SBC_OWNER_DAILY_HOME_BEGIN \*\/([\s\S]*?)\/\* SBC_OWNER_DAILY_HOME_END \*\//)?.[1];
 assert.ok(source,'owner daily model and renderer must exist');
 const window={}, document={readyState:'loading',addEventListener(){}};
 const context={window,document,console,Intl,Date};
 vm.runInNewContext(ops,context);
 vm.runInNewContext(source+';window.dailyModel=sbcOwnerDailyModel;window.dailyMarkup=sbcOwnerDailyMarkup;',context);
 return window;
}
const now=new Date('2026-11-26T05:30:00Z');
const paid={id:'order-a',price:199,squareOrderId:'so1',squarePaymentId:'sp1',squarePaymentStatus:'COMPLETED',squarePaymentCompletedAt:'2026-11-26T05:10:00Z'};
const fixture={recovery:{required:false},orders:[paid,{...paid,id:'duplicate'},{...paid,squarePaymentId:'yesterday',squarePaymentCompletedAt:'2026-11-26T04:59:00Z'},{...paid,squarePaymentId:'refund',paymentStatus:'REFUNDED'},{...paid,squarePaymentId:'test',sbcTest:true},{price:999,paymentStatus:'PAID'}],quotes:[{status:'Won',total:999},{status:'Sent',total:499}],customers:[{status:'Qualified',followUp:'2026-11-25'},{status:'Do Not Call',followUp:'2026-11-25'},{status:'Qualified',_recoveryProjection:true}],tasks:[{status:'Open',dueAt:'2026-11-26T06:00:00Z'},{status:'Completed',dueAt:'2026-11-26T06:00:00Z'}],appointments:[{status:'Scheduled',startAt:'2026-11-26T15:00:00Z'},{status:'Cancelled',startAt:'2026-11-26T16:00:00Z'}],callReports:[{status:'Pending'}],users:[{role:'owner'},{role:'account_manager',active:true},{role:'caller',active:false}],renewals:[],ecosystem:{orderPipelines:{digital:{orders:2}}}};
test('daily revenue counts only unique recorded Square captures for the Eastern business day',()=>{
 const w=load(), m=w.dailyModel(fixture,now,w.sbcRecordedSquareCapture);
 assert.equal(m.revenueCents,19900);assert.equal(m.targetCents,60000);assert.equal(m.pipelineValue,499);
 assert.equal(m.qualified,1);assert.equal(m.overdue,1);assert.equal(m.tasksToday,1);assert.equal(m.appointmentsToday,1);assert.equal(m.pendingCalls,1);assert.equal(m.team,1);assert.equal(m.digitalOrders,2);
 const conflicting={...fixture,orders:[paid,{...paid,id:'different',price:499}]};
 assert.equal(w.dailyModel(conflicting,now,w.sbcRecordedSquareCapture).revenueCents,null);
});
test('reversal evidence excludes a duplicate captured payment, regardless of row order',()=>{
 const w=load(), reversal={...paid,id:'refund-row',paymentStatus:'REFUNDED'};
 for(const orders of [[paid,reversal],[reversal,paid]])assert.equal(w.dailyModel({...fixture,orders},now,w.sbcRecordedSquareCapture).revenueCents,0);
});
test('missing source data is unavailable rather than fabricated zero revenue',()=>{
 const w=load();
 assert.equal(w.dailyModel({},now,w.sbcRecordedSquareCapture).revenueCents,null);
 assert.equal(w.dailyModel(fixture,now,null).revenueCents,null);
 assert.equal(w.dailyModel({},now,null).team,null);
});
test('six owner cards, existing action routes, recovery and employee role boundaries',()=>{
 const w=load(), render=(role,data)=>w.dailyMarkup({me:{role},view:'dashboard',data},now,w.sbcRecordedSquareCapture);
 const markup=render('owner',fixture);
 for(const label of ['Revenue Today','Sales Opportunities',"Today's Tasks",'Website Production','Employee Performance','Needs My Attention'])assert.ok(markup.includes(label),label);
 assert.equal((markup.match(/data-sbc-owner-daily-card=/g)||[]).length,6);
 assert.match(markup,/recorded Square captures/i);assert.match(markup,/not settlement/i);
 assert.equal(render('account_manager',fixture),'');assert.equal(render('owner',{recovery:{required:true}}),'');assert.equal(render('owner',{}),'');
 assert.match(app,/sbcOwnerDailyMarkup\(state\)/);assert.match(html,/data-sbc-owner-routine="true"[\s\S]*sbc-owner-daily-home/);
 for(const p of ['app.js','v32-2-upgrade.js','index.html'])assert.equal(read('public/'+p),read('browser_public/'+p),p);
});

test('healthy bootstrap explicitly establishes recovery clearance; unknown, recovery, Preview and no writer remain fail-closed',()=>{
 const s=read('server.js'),a=s.indexOf('/* SBC_OWNER_ROUTINE_RECOVERY_EVIDENCE_BEGIN */'),b=s.indexOf('/* SBC_OWNER_ROUTINE_RECOVERY_EVIDENCE_END */');assert(a>=0&&b>a);
 const evidence=vm.runInNewContext(s.slice(a,b)+'\nsbcOwnerRoutineRecoveryEvidence');
 const input={readOnly:false,recoveryEvaluated:true,recoveryRequired:false,writerLeaseReady:true,mysqlConnected:true,storage:'mysql-relational'};
 assert.equal(evidence(input).required,false);
 for(const k of ['recoveryEvaluated','writerLeaseReady','mysqlConnected'])assert.equal(evidence({...input,[k]:false}),null,k);
 for(const k of ['readOnly','recoveryRequired'])assert.equal(evidence({...input,[k]:true}),null,k);
 assert.equal(evidence({...input,storage:'file'}),null);assert.equal(evidence({}),null);
 const route=s.slice(s.indexOf("app.get('/api/bootstrap'"),s.indexOf('const projectedCustomers=db.customers;'));
 assert.match(route,/if\(recovery===null&&req\.user\.role==='owner'\)recovery=sbcOwnerRoutineRecoveryEvidence/);
 const w=load();assert.equal(w.dailyMarkup({me:{role:'owner'},view:'dashboard',data:{...fixture,readOnly:true}},now,w.sbcRecordedSquareCapture),'');
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createWorkforcePayrollHandlers}=require('../routes/sbc-workforce-payroll-v1.cjs');
function fixture(){
 const events=[],data={compensation:{},payrollRuns:[]};
 const p={period:'Weekly',periodStart:'2026-11-23',hours:3,trainingHours:1,callingHours:2,qualifiedAppointments:1,sales:0,basePay:15,bonuses:0,estimatedGrossPay:15,currency:'USD'};
 const ctx={db:{users:[{id:'a',name:'Caller',role:'caller'},{id:'b',role:'customer'}]},isWorkforceRole:r=>r==='caller',v9User:u=>({id:u.id}),compFor:()=>({payRate:5,currency:'USD',payPeriod:'Weekly',commissionRates:{},monthlyBonuses:{}}),payrollFor:()=>p,v9data:()=>data,id:()=> 'pay-fixture',now:()=> '2026-11-25T00:00:00.000Z',v9save:async()=>events.push('save'),audit:()=>events.push('audit')};
 const h=createWorkforcePayrollHandlers(()=>ctx);
 const res=()=>({code:200,status(n){this.code=n;return this;},json(v){this.body=v;return this;}});
 return {ctx,h,res,data,events};
}
test('list excludes non-workforce and resolves latest request-time state',()=>{const f=fixture(),r=f.res();f.h.listPayroll({},r);assert.equal(r.body.length,1);assert.equal(r.body[0].user.id,'a');f.ctx.db={users:[]};f.h.listCompensation({},r);assert.deepEqual(r.body,[]);});
test('draft creation retains amounts, persists before audit, and initiates no payment',async()=>{const f=fixture(),r=f.res();await f.h.createPayrollDraft({user:{id:'owner'},body:{userId:'a'}},r);assert.equal(r.code,201);assert.equal(r.body.status,'Draft');assert.equal(r.body.total,15);assert.equal(r.body.paymentReference,'');assert.equal(r.body.paidAt,null);assert.equal(f.data.payrollRuns[0],r.body);assert.deepEqual(f.events,['save','audit']);});
test('unknown member or run cannot mutate state',async()=>{const f=fixture(),r=f.res();await f.h.createPayrollDraft({body:{userId:'b'}},r);assert.equal(r.code,404);await f.h.updatePayrollStatus({params:{id:'missing'},body:{status:'Paid'}},r);assert.equal(r.code,404);assert.deepEqual(f.events,[]);});
test('compensation maintains existing rate clamps and persistence sequence',async()=>{const f=fixture(),r=f.res();await f.h.updateCompensation({user:{id:'owner'},params:{userId:'a'},body:{payRate:-1,commissionRates:{sale:2}}},r);assert.equal(r.body.compensation.payRate,0);assert.equal(r.body.compensation.commissionRates.sale,.25);assert.deepEqual(f.events,['save','audit']);});
test('all five original routes retain owner auth middleware and order',()=>{const s=require('node:fs').readFileSync(require('node:path').resolve(__dirname,'../server.js'),'utf8');for(const [verb,route,method] of [['get','/api/v9/compensation','listCompensation'],['put','/api/v9/compensation/:userId','updateCompensation'],['get','/api/v9/payroll','listPayroll'],['post','/api/v9/payroll/run','createPayrollDraft'],['post','/api/v9/payroll/run/:id/status','updatePayrollStatus']])assert(s.includes("app."+verb+"('"+route+"',auth,ownerOnly,SBC_WORKFORCE_PAYROLL."+method+")"));});

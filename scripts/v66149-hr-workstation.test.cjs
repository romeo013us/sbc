'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MODEL=require('../enterprise/v66149-hr-owner-workstation.cjs');
const STAGE=require('./v66149-stage-hr-workstation.cjs');
const users=[
 {id:'lorna',tenantId:1,role:'lead_researcher',name:'Lorna Example',username:'lorna',active:true},
 {id:'caller',tenantId:1,role:'caller',name:'Sales Staff',username:'sales',active:true},
 {id:'owner',tenantId:1,role:'owner',name:'Owner',username:'owner',active:true},
 {id:'foreign',tenantId:2,role:'caller',name:'Foreign Staff',username:'foreign',active:true},
 {id:'inactive',tenantId:1,role:'fulfillment',name:'Former Staff',username:'former',active:false}
];
const v9={
 compensation:{lorna:{payRate:4,currency:'USD',payPeriod:'Monthly'},caller:{payRate:3.5},foreign:{payRate:500}},
 onboarding:{lorna:{country:'Philippines',status:'Pending',contractorAgreementAccepted:true,ownerVerified:false},
  foreign:{country:'Foreign Address',status:'Approved'}},
 timeEntries:[
  {userId:'lorna',clockIn:'2026-11-09T10:00:00Z',clockOut:'2026-11-09T14:00:00Z',
   breaks:[{start:'2026-11-09T11:00:00Z',end:'2026-11-09T11:30:00Z'}]},
  {userId:'caller',clockIn:'2026-11-09T10:00:00Z'},
  {userId:'foreign',clockIn:'2026-11-09T10:00:00Z',clockOut:'2026-11-09T11:00:00Z'}
 ],
 payrollRuns:[
  {id:'pay1',userId:'lorna',total:80,currency:'USD',status:'Draft',createdAt:'2026-11-10',paymentReference:'secret-reference'},
  {id:'pay2',userId:'foreign',total:500,status:'Paid',paymentReference:'foreign-private'}]
};
const d=MODEL.visible({tenantId:1,users,v9});
assert.equal(d.ok,true);assert.equal(d.readOnly,true);assert.equal(d.roleActivation,'HR_MANAGER_NOT_ENABLED');
assert.equal(d.totalPeople,3);
assert.equal(d.totals.active,2);assert.equal(d.totals.inactive,1);assert.equal(d.totals.draftPayroll,1);
assert.equal(d.totals.openTimeEntries,1);
assert.equal(d.payrollRuns.length,1);assert.equal(d.payrollRuns[0].recordedAmount,80);
assert.equal(d.payrollRuns[0].hasPaymentReference,true);
assert.equal(d.people[0].closedHours,3.5);
assert.equal(d.people[0].classification,'NOT_DETERMINED_BY_THIS_SYSTEM');
assert(!JSON.stringify(d).includes('secret-reference'));assert(!JSON.stringify(d).includes('Foreign Address'));
assert(!JSON.stringify(d).includes('foreign-private'));assert(!JSON.stringify(d).includes('500'));
assert.throws(()=>MODEL.visible({tenantId:0,users,v9}),/HR_TENANT_REQUIRED/);
assert(d.capabilities.forbiddenForHr.includes('send_money'));
assert(d.capabilities.forbiddenForHr.includes('approve_payroll'));

const file=path.resolve(__dirname,'../server.js'),source=fs.readFileSync(file,'utf8');
const patched=STAGE.patchServer(source);
assert.equal(STAGE.patchServer(patched),patched);
assert(patched.includes(STAGE.MARK));new vm.Script(patched,{filename:'hr-staged-server.js'});
if(process.argv.includes('--staged'))assert.equal(patched,source,'compiled release must contain HR route');
const start=patched.indexOf("app.get('/api/hr/workspace'");
const end=patched.indexOf("app.get('/api/v9/payroll'",start);
assert(start>0&&end>start);
let handler,ownerGate,authGate;const ctx={
 app:{get(route,auth,owner,fn){assert.equal(route,'/api/hr/workspace');authGate=auth;ownerGate=owner;handler=fn}},
 auth:'AUTHENTICATION_REQUIRED',ownerOnly:'OWNER_ROLE_REQUIRED',
 requireRequestTenant:()=>1,db:{users},
 v9data:()=>v9,
 require:p=>{assert.equal(p,'./enterprise/v66149-hr-owner-workstation.cjs');return MODEL}
};
vm.runInNewContext(patched.slice(start,end),ctx);
assert.equal(authGate,'AUTHENTICATION_REQUIRED');assert.equal(ownerGate,'OWNER_ROLE_REQUIRED');
assert.equal(typeof handler,'function');
let payload,code=200,cache='';
const res={setHeader(k,v){assert.equal(k,'Cache-Control');cache=v},status(n){code=n;return this},json(v){payload=v;return this}};
handler({user:{role:'owner'}},res);
assert.equal(code,200);assert.equal(cache,'no-store');assert.equal(payload.totalPeople,3);
const html=fs.readFileSync(path.resolve(__dirname,'../public/hr-department.html'),'utf8');
const mirrorHtml=fs.readFileSync(path.resolve(__dirname,'../browser_public/hr-department.html'),'utf8');
assert.equal(html,mirrorHtml);assert(html.includes('HR Department Login'));
assert(html.includes('Future HR Manager account: NOT YET ENABLED'));
const js=fs.readFileSync(path.resolve(__dirname,'../public/hr-department.js'),'utf8');
const mirrorJs=fs.readFileSync(path.resolve(__dirname,'../browser_public/hr-department.js'),'utf8');
assert.equal(js,mirrorJs);new vm.Script(js,{filename:'hr-department.js'});
assert(js.includes("user.role!=='owner'"));
assert(!js.includes('innerHTML'),'no dynamic HR data injection into HTML');
assert(!js.includes('send_money'));
console.log('PASS V66.149: owner-only isolated HR workstation, tenant separation, payroll privacy, 0 paid status inference, no HR-account escalation, mirrored no-XSS browser');

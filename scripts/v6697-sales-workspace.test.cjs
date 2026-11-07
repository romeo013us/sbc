'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const core=require('../enterprise/sales-caller-workspace-v6697.cjs');
const patch=require('./v6697-stage-sales-workspace.cjs');
const owner={id:'u-owner',role:'owner',tenantId:7};
const staff={id:'u-sales',username:'spanish.sales',name:'Caller A',active:true,tenantId:7,role:'caller'};
const lorna={id:'u-research',username:'lorna',name:'Researcher',active:true,tenantId:7,role:'lead_researcher'};
const other={id:'u-other',role:'caller',tenantId:8,active:true};
const customers=[
 {id:'l1',tenantId:7,assignedTo:'u-sales',businessName:'Miami Barber',phone:'305 555 0112',status:'Lead'},
 {id:'l2',tenantId:7,assignedTo:'u-sales',businessName:'Blocked Prospect',phone:'305 555 0113',doNotContact:true,status:'Lead'},
 {id:'l3',tenantId:7,assignedTo:'u-research',businessName:'Research Project',phone:'305 555 0114',status:'Lead',leadAssistStatus:'REWORK_REQUIRED'},
 {id:'l4',tenantId:7,assignedTo:'u-other',businessName:'Different Caller',phone:'305 555 0115',status:'Lead'},
 {id:'l5',tenantId:8,assignedTo:'u-sales',businessName:'Cross Tenant Secret',phone:'305 555 0116',status:'Lead'},
 {id:'l6',tenantId:7,assignedTo:'',businessName:'Unassigned',phone:'305 555 0117',status:'Lead'}
];
const base={users:[owner,staff,lorna,other],tenantId:7,customers,reports:[{id:'rep1',callerId:'u-sales',customerId:'l1',notes:'Follow-up',outcome:'Follow-up Requested'}],timeEntries:[],certifications:{'u-sales':{status:'Certified'}},onboarding:{},canLiveCall:u=>u.id==='u-sales'};
const before=JSON.stringify(base);
const direct=core.workspace({...base,actor:staff});
assert.equal(direct.preview,false);
assert.equal(direct.leads.length,2,'only assigned caller records should show');
assert.equal(direct.metrics.callable,1,'DNC must not be callable');
assert(!direct.leads.some(x=>x.businessName==='Cross Tenant Secret'||x.businessName==='Unassigned'));
assert(!Object.keys(direct.user).includes('passwordHash'),'never project secrets');
const ownerView=core.workspace({...base,actor:owner,previewUserId:'u-sales'});
assert.equal(ownerView.preview,true);
assert.equal(ownerView.readOnly,true);
assert.deepEqual(ownerView.leads,direct.leads);
const researcher=core.workspace({...base,actor:owner,previewUserId:'u-research'});
assert.equal(researcher.role,'lead_researcher');assert.equal(researcher.leads.length,1);
assert.equal(researcher.metrics.needsAttention,1);
assert.throws(()=>core.workspace({...base,actor:owner,previewUserId:'u-other'}),/WORKER_NOT_FOUND/);
assert.throws(()=>core.workspace({...base,actor:staff,previewUserId:'u-research'}),/ROLE_ACCESS_DENIED|WORKER_NOT_FOUND/);
assert.equal(JSON.stringify(base),before,'projections must not mutate CRM');
assert.equal(core.cleanPhone('(305) 555-0112'),'+13055550112');
const html=read('public/sales-caller.html'),js=read('public/sales-caller.js');
assert(html.includes('Español')&&html.includes('Spanish Sales Caller Workspace'));
assert(html.includes('read-only')||html.includes('READ ONLY'));
assert(js.includes('previewUserId')&&js.includes('canWrite()'));
assert(js.includes('SBCWorkforceTheme.attach'));
assert(read('public/index.html').includes('/sbc-owner-employee-switch-v6697.js?v=1'));
assert(read('public/index.html').includes('/sbc-owner-employee-switch-v6697.css?v=1'));
assert.equal(read('public/sbc-owner-employee-switch-v6697.js'),read('browser_public/sbc-owner-employee-switch-v6697.js'));
const ownerUi=read('public/sbc-owner-employee-switch-v6697.js');
assert(ownerUi.includes('getRandomValues'),'temporary credentials must come from secure browser generator');
assert(!ownerUi.includes('password123'));
assert(ownerUi.includes("role:'caller'"));
assert(ownerUi.includes("expiresAt"));
const patched=patch.patchServer(read('server.js'));
assert(patched.includes(patch.MARK),'server owner preview endpoint absent');
assert(patched.includes('CALLER_ONBOARDING_AND_CERTIFICATION_REQUIRED'),'caller role token gate missing');
assert(patched.includes('CALLER_LEAD_NOT_ASSIGNED'),'call report assignment gate missing');
assert(patched.includes('EMPLOYEE_ACCOUNT_EXPIRED'),'temporary account expiration enforcement missing');
assert(patched.includes("String(c.assignedTo||'')===String(req.user.id)"),'caller must not see unassigned leads');
assert(patched.includes("const quotes=isOwnerRole||manager?db.quotes:[];"),'caller must not receive all company quotes');
assert.equal(patch.patchServer(patched),patched,'server patch must be idempotent');
if(process.argv.includes('--staged'))assert.equal(patched,read('server.js'),'staged server must contain the worker hardening patch');
console.log('PASS: SBC Spanish caller tenant isolation, assigned leads, DNC, owner read-only preview, credentials, expiring accounts and server gates');

'use strict';
// V66.76: executable role-policy contract on the exact reconstructed runtime.
// Synthetic identity + CRM data; no stored credentials or production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const server=read('server.js'),app=read('public/app.js'),mirror=read('browser_public/app.js'),html=read('public/index.html'),htmlMirror=read('browser_public/index.html');
assert.equal(app,mirror,'all clients use the same role-aware renderer');
assert.equal(html,htmlMirror,'both HTML entrypoints have the same role tour');
assert(server.includes('SBC_V6676_ROLE_LOGIN_AND_DEMO'));
assert(app.includes('SBC_V6676_ROLE_LOGIN_AND_DEMO'));
assert(html.includes('sbc-v6676-demo-viewer'));
// Evaluate actual production Lorna allowlist rather than a duplicated test policy.
const lstart=server.indexOf('function sbcLornaAllowedRequest(req,user){');
const lend=server.indexOf('\napp.use(async function sbcLornaLeastPrivilegeGate',lstart);
assert(lstart>0&&lend>lstart);
const roleFns=vm.runInNewContext(server.slice(lstart,lend)+'\n({sbcLornaAllowedRequest})',{},{timeout:1500});
const L=(p,m='GET',uid='lorna-1')=>roleFns.sbcLornaAllowedRequest({path:p,method:m},{id:uid,username:'lorna',role:'lead_researcher'});
assert(L('/api/me')&&L('/api/bootstrap')&&L('/api/catalog'),'real employee login must load initial workspace and catalog');
assert(L('/api/v9/bootstrap')&&L('/api/v9/lead-verification')&&L('/api/workforce/leads'),'researcher training/verification and lead submission must be reachable');
assert(L('/api/workforce/leads','POST')&&L('/api/v10/leads/submit','POST'),'legitimate research submission must be allowed');
assert(!L('/api/owner/recovery/census')&&!L('/api/communications/status')&&!L('/api/crm/leads/import','POST'),'Lorna cannot see owner/financial routes or use owner CSV importer');
assert(!L('/api/bootstrap','POST'),'bootstrap is read-only');
// Exercise production response branch, including another tenant's records.
const bootstrapStart=server.indexOf('  if(sbcLornaRole(req.user)){',server.indexOf('const projectedCustomers=db.customers;'));
const bootstrapEnd=server.indexOf('\n  const base=',bootstrapStart);
assert(bootstrapStart>0&&bootstrapEnd>bootstrapStart);
const bootstrap=new vm.Script('function run(req,res){\n'+server.slice(bootstrapStart,bootstrapEnd)+'\n}\nrun(req,res)',{filename:'lorna-live-bootstrap.js'});
const sample=[
 {id:'allowed',tenantId:1,businessName:'Sample research prospect',status:'Lead',phone:'3051230000',verificationStatus:'Needs Verification',assignedTo:'',accountNotes:'OWNER PRIVATE'},
 {id:'mine',tenantId:1,businessName:'My research prospect',status:'Lead',assignedTo:'lorna-1'},
 {id:'other',tenantId:1,businessName:'Another employee prospect',status:'Lead',assignedTo:'owner-1'},
 {id:'tenant',tenantId:2,businessName:'Other tenant prospect',status:'Lead',assignedTo:''},
 {id:'customer',tenantId:1,businessName:'Paid customer',status:'Customer',assignedTo:''},
 {id:'sales',tenantId:1,businessName:'Sales handoff',status:'Lead',verificationStatus:'Sales Ready',assignedTo:''}
];
let result=null;
bootstrap.runInNewContext({
 req:{user:{id:'lorna-1',username:'lorna',name:'Lead Research',role:'lead_researcher'}},
 res:{setHeader(){},json:x=>{result=x;return x}},
 sbcLornaRole:u=>u.role==='lead_researcher',requireRequestTenant:()=>1,
 db:{customers:sample,activities:[],settings:{businessName:'SBC',tagline:'Business Services',slogan:'Because Why Not?',financialSecret:'PRIVATE'}},
 CATALOG:{packages:[],services:[]},BUILD_VERSION:'66.0.0',storageMode:'mysql',MYSQL_RECOVERY_REQUIRED:false
},{timeout:1500});
assert(result&&result.customers.length===2,'Lorna must see only active, current-tenant unassigned or own research leads');
assert(result.customers.some(c=>c.id==='allowed')&&result.customers.some(c=>c.id==='mine'));
assert(!result.customers.some(c=>['other','tenant','customer','sales'].includes(c.id)));
assert(!('accountNotes' in result.customers[0])&&!('financialSecret' in result.settings));
assert(Array.isArray(result.orders)&&result.orders.length===0);
assert(Array.isArray(result.quotes)&&result.quotes.length===0);
assert(result.user.role==='lead_researcher');
// Evaluate demo request allowlist AND middleware with synthetic sessions.
const dstart=server.indexOf('function sbcDemoViewerAllowed(method,route){');
const dend=server.indexOf("\napp.get('/api/gateways/readiness',auth,",dstart);
assert(dstart>0&&dend>dstart);
let guard;
const dctx={app:{use:fn=>{guard=fn}},sessionUser:async req=>req.user};
vm.runInNewContext(server.slice(dstart,dend),dctx,{timeout:1500});
const allow=dctx.sbcDemoViewerAllowed;
assert(allow('GET','/api/bootstrap')&&allow('GET','/api/catalog')&&allow('GET','/api/me'));
assert(allow('POST','/api/logout'));
for(const [method,url] of [['POST','/api/quotes'],['POST','/api/workforce/leads'],['POST','/api/communications/sms'],['GET','/api/owner/recovery/census'],['GET','/api/v9/bootstrap'],['GET','/api/workforce/leads'],['GET','/api/portal/admin-summary']])assert(!allow(method,url),'demo must never reach '+url);
async function invoke(user,url,method){
 let status=200,response=null,next=false;
 const res={setHeader(){},status:n=>{status=n;return res},json:j=>{response=j;return res}};
 await guard({user,method,path:url},res,()=>{next=true});
 return {status,response,next};
}
(async()=>{
 for(let pass=1;pass<=3;pass++){
  assert((await invoke({role:'demo'},'/api/bootstrap','GET')).next);
  assert((await invoke({role:'demo'},'/api/logout','POST')).next);
  const denied=await invoke({role:'demo'},'/api/quotes','POST');
  assert.equal(denied.status,403);assert.equal(denied.response.code,'SBC_DEMO_READ_ONLY');
  assert(!(await invoke({role:'demo'},'/api/workforce/leads','GET')).next);
  assert((await invoke({role:'owner'},'/api/quotes','POST')).next,'owner behavior unchanged');
  assert((await invoke({role:'lead_researcher'},'/api/workforce/leads','POST')).next);
  console.log('[SBC V6676] PASS '+pass+'/3 real role allowlist and deny-by-default demo API');
 }
 assert(html.includes('leadresearch')&&html.includes('leadverification'),'Lorna navigation shows research tools');
 assert(html.includes('sbc-demo-mode')&&html.includes('SAMPLE DATA ONLY'),'demo screen must be clearly labeled');
 assert(app.includes("state.me?.role!=='demo')setTimeout(loadProductionControlDashboard"),'demo must not fetch live owner production controls');
 assert(app.includes('style="display:none!important"'),'demo must not offer dashboard write buttons');
 assert(server.includes("if(req.user.role==='demo'){const d=demoBootstrapData()"),'buyer sample data must remain synthetic');
 new vm.Script(app,{filename:'app.js'});
 console.log('[SBC V6676] PASS isolated Lorna workspace, demo buyer surface and browser syntax');
})().catch(e=>{console.error(e);process.exitCode=1});

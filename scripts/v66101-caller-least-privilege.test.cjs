'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'server.js'),'utf8');
const policy=require('../enterprise/v66101-caller-access.cjs'),patch=require('./v66101-stage-caller-workstation.cjs');
const permitted=[['GET','/api/me'],['GET','/api/sales-caller/workspace'],['GET','/api/v9/time/status'],['GET','/api/training'],['GET','/api/training/courses/sales-1'],['GET','/api/voice/status'],['GET','/api/voice/token'],['POST','/api/v9/time/clock'],['POST','/api/training/progress'],['POST','/api/voice/log'],['POST','/api/v9/call-report'],['POST','/api/logout']];
const forbidden=[['GET','/api/bootstrap'],['GET','/api/v9/bootstrap'],['GET','/api/customers'],['GET','/api/quotes'],['GET','/api/orders'],['GET','/api/users'],['POST','/api/users'],['GET','/api/payments'],['GET','/api/owner/launch'],['POST','/api/supernova/events'],['POST','/api/mega/projects'],['GET','/api/kim/v453/launch-dashboard'],['GET','/api/voice/logs'],['POST','/api/training/admin'],['GET','/api/settings'],['GET','/api/v9/assign-batch'],['DELETE','/api/customers/c1'],['POST','/api/voice/logs']];
for(const [method,url] of permitted)assert(policy.allowed(method,url),'Needed: '+method+' '+url);
for(const [method,url] of forbidden)assert(!policy.allowed(method,url),'Forbidden: '+method+' '+url);
for(const url of ['/','/index.html','/cc-v26','/command-center-v2612','/sbc-v2612'])assert(policy.ownerShellPath(url));
const staged=patch.patchServer(source);
assert.equal(patch.patchServer(staged),staged);
assert(staged.includes(patch.MARK)&&staged.includes('CALLER_WORKSPACE_ONLY')&&staged.includes('CALLER_ASSIGNED_LEAD_REQUIRED'));
assert(staged.includes("if(u?.role==='caller')return res.redirect(302,'/sales-caller.html')"));
const a=staged.indexOf('const SBC_V66101_CALLER_POLICY=require('),b=staged.indexOf('function ownerOnly(req,res,next)',a);assert(a>0&&b>a);
const context={require:()=>policy,sessionUser:async req=>req.cookieUser||null,ADMIN_PASSWORD:'configured',tenantIdForUser:u=>u.tenantId,strictTenantGuard:(_req,_res,next)=>next(),runWithTenantContext:(_ctx,fn)=>fn(),isWorkforceRole:r=>['caller','lead_researcher','fulfillment'].includes(r),console};vm.createContext(context);vm.runInContext(staged.slice(a,b)+'\nthis.checkAuth=auth;',context);
async function request(user,method,url){let status=200,accepted=false;const req={cookieUser:user,method,path:url},res={setHeader(){return this},status(n){status=n;return this},json(){return this}};await context.checkAuth(req,res,()=>{accepted=true});return {status,accepted};}
(async()=>{
 const test1={id:'test1',role:'caller',tenantId:1,active:true};
 for(const [method,url] of forbidden){const r=await request(test1,method,url);assert.equal(r.status,403,'test1 '+method+' '+url);assert(!r.accepted);}
 for(const [method,url] of permitted){const r=await request(test1,method,url);assert(r.accepted,'test1 should use '+method+' '+url);}
 assert.equal((await request({...test1,active:false},'GET','/api/me')).status,403);
 assert((await request({id:'owner',role:'owner',tenantId:1,active:true},'GET','/api/bootstrap')).accepted);
 const html=fs.readFileSync(path.join(root,'public/sales-caller.html'),'utf8');
 assert(html.includes('class="nav sidebar"')&&html.includes('lead-research.css?v=7'));
 assert(!html.includes('class="home-link"'));assert(html.includes('/assets/sbc-logo.jpg'));
 assert.equal(html,fs.readFileSync(path.join(root,'browser_public/sales-caller.html'),'utf8'));
 for(const name of ['public/app.js','browser_public/app.js'])assert(fs.readFileSync(path.join(root,name),'utf8').includes("window.location.replace('/sales-caller.html')"));
 if(process.argv.includes('--staged'))assert.equal(staged,source,'Staged runtime must already include caller gate');
 console.log('PASS V66.101: test1 denied '+forbidden.length+' privileged routes, retained '+permitted.length+' minimum APIs; Lorna shell mirrored');
})().catch(e=>{console.error(e);process.exitCode=1});

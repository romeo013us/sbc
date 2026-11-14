'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService,createMemoryRepository}=require('../enterprise/sbc-account-social-core.cjs');
const owner={tenantId:1,id:'boss',role:'owner'},manager={tenantId:1,id:'m1',role:'account_manager'};
const repo=createMemoryRepository({customers:[{id:'c1',tenantId:1,businessName:'SBC Client'},{id:'c1',tenantId:2,businessName:'Different Client'}],users:[{id:'m1',tenantId:1,role:'account_manager',active:true}]});
const service=createService({repository:repo,provider:{verify:async x=>({verified:true,providerAccountId:x.providerAccountId}),publish:async()=>({id:'none'})}});
function harness(){const app={routes:[],get(path,...handlers){this.routes.push({method:'GET',path,handlers})},post(path,...handlers){this.routes.push({method:'POST',path,handlers})},put(path,...handlers){this.routes.push({method:'PUT',path,handlers})}};return app;}
async function dispatch(app,method,path,actor,body={}){
 const entry=app.routes.find(r=>r.method===method&&r.path===path);assert(entry,`route missing ${method} ${path}`);
 const req={user:actor,body,params:body.params||{},query:body.query||{},headers:body.headers||{},tenantId:body.tenantId};
 const res={statusCode:200,status(s){this.statusCode=s;return this},json(value){this.body=value;return this},setHeader(){}};
 for(const handler of entry.handlers){let nextCalled=false;await handler(req,res,()=>{nextCalled=true});if(!nextCalled)break;}
 return {status:res.statusCode,body:res.body};
}
test('API is dark by default with zero route registrations',()=>{
 const {registerAccountSocialRoutes}=require('../routes/sbc-account-social-v1.cjs');
 const app=harness();assert.equal(registerAccountSocialRoutes(app,{service,auth:(req,res,next)=>next(),resolveActor:r=>r.user}),false);
 assert.equal(app.routes.length,0);
});
test('enabled API reads server-side identity, ignores body tenant and denies unauthenticated access',async()=>{
 const {registerAccountSocialRoutes}=require('../routes/sbc-account-social-v1.cjs');
 const app=harness();registerAccountSocialRoutes(app,{enabled:true,service,auth:(req,res,next)=>next(),resolveActor:r=>r.user,writeReady:()=>true});
 const result=await dispatch(app,'PUT','/api/account-social/v1/accounts/:customerId/manager',owner,{params:{customerId:'c1'},managerId:'m1',tenantId:2});
 assert.equal(result.status,200);assert.equal(result.body.data.tenantId,1);
 const cross=await dispatch(app,'GET','/api/account-social/v1/portfolio',{tenantId:2,id:'intruder',role:'account_manager'});
 assert.deepEqual(cross.body.data.accounts,[]);
 const anon=await dispatch(app,'GET','/api/account-social/v1/portfolio',null);
 assert.equal(anon.status,403);
 const assigned=await dispatch(app,'GET','/api/account-social/v1/portfolio',manager);
 assert.equal(assigned.body.data.accounts.length,1);
});
test('manager cannot self-assign, approve or publish',async()=>{
 const {registerAccountSocialRoutes}=require('../routes/sbc-account-social-v1.cjs');
 const app=harness();registerAccountSocialRoutes(app,{enabled:true,service,auth:(req,res,next)=>next(),resolveActor:r=>r.user,writeReady:()=>true});
 const assign=await dispatch(app,'PUT','/api/account-social/v1/accounts/:customerId/manager',manager,{params:{customerId:'c1'},managerId:'m1'});
 assert.equal(assign.status,403);assert.equal(assign.body.error,'OWNER_REQUIRED');
 const unknown=await dispatch(app,'POST','/api/account-social/v1/posts/:postId/approve',manager,{params:{postId:'forged'}});
 assert.equal(unknown.status,403);
 assert.equal(app.routes.some(r=>r.path.includes('/publish')||r.path.includes('/jobs')),false,'publishing must have no user-triggered HTTP endpoint');
});
test('production route activation requires auth and resolver callbacks',()=>{
 const {registerAccountSocialRoutes}=require('../routes/sbc-account-social-v1.cjs');
 assert.throws(()=>registerAccountSocialRoutes(harness(),{enabled:true,service}),/AUTH_MIDDLEWARE_REQUIRED/);
 assert.throws(()=>registerAccountSocialRoutes(harness(),{enabled:true,service,auth:(q,s,n)=>n()}),/AUTHENTICATED_ACTOR_RESOLVER_REQUIRED/);
});

test('write endpoints fail closed when published writer is not proven',async()=>{
 const {registerAccountSocialRoutes}=require('../routes/sbc-account-social-v1.cjs');
 const app=harness();registerAccountSocialRoutes(app,{enabled:true,service,auth:(req,res,next)=>next(),resolveActor:r=>r.user});
 const before=await dispatch(app,'GET','/api/account-social/v1/portfolio',owner);assert.equal(before.status,200);
 const blocked=await dispatch(app,'PUT','/api/account-social/v1/accounts/:customerId/manager',owner,{params:{customerId:'c1'},managerId:'m1'});
 assert.equal(blocked.status,423);assert.equal(blocked.body.error,'WRITER_NOT_READY');
});

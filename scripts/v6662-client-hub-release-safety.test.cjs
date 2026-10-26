'use strict';
// Compiled V66.62 live-handler simulation, entirely synthetic. No database, payment or network mutations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const s=fs.readFileSync(path.join(root,'server.js'),'utf8'),H=require(path.join(root,'enterprise/v6662-client-hub-security.cjs'));
assert.match(s,/SBC_V6662_PUBLIC_CLIENT_HUB_BOUNDARIES/);
new vm.Script(s,{filename:'server.js'});
const marker=s.indexOf('SBC_V6662_PUBLIC_CLIENT_HUB_BOUNDARIES');
const start=s.lastIndexOf('\n//',marker);
const end=s.indexOf("\n\napp.use('/assets'",marker);
assert.ok(start>=0&&end>start,'extract exact compiled public client hub routes');
assert.equal(H.validToken('a'.repeat(48)),true);
for(const bad of ['', 'X'.repeat(48), 'a'.repeat(47),'<script>alert(1)</script>', 'a'.repeat(49)])
 assert.equal(H.validToken(bad),false,'malformed or script-bearing client token is blocked');
const token='12'.repeat(24),page=H.render(token);
assert.match(page.csp,/script-src 'nonce-/);
assert.ok(!page.csp.includes('unsafe-inline'),'CSP must not allow arbitrary inline scripts');
assert.ok(page.html.includes('textContent=String(value)'),'client-owned names inserted only via textContent');
assert.ok(!page.html.includes('innerHTML'),'customer data must never enter innerHTML');
assert.match(page.html,/referrerPolicy:'no-referrer'/); // fetch must never leak bearer URL
assert.ok(!page.html.includes('undefined'));
assert.throws(()=>H.render('<img src=x onerror=alert(1)>'),/INVALID_CLIENT_HUB_TOKEN/);
const routes={};
const one={id:'one',tenantId:1,contactName:'<svg onload=alert(1)>',businessName:'One Tenant',email:'one@example.test',phone:'3055550101',portalToken:'',updatedAt:''};
const two={id:'two',tenantId:2,contactName:'Private Tenant',businessName:'Two Tenant',email:'two@example.test',phone:'3055550202',portalToken:'',updatedAt:''};
const db={customers:[one,two],quotes:[],settings:{businessName:'SBC',phone:'3055550000',email:'support@example.test'}};
let persisted=0,operations=0;
const ctx={
 app:{post:(p,...rest)=>routes['POST '+p]=rest.at(-1),get:(p,...rest)=>routes['GET '+p]=rest.at(-1)},
 require:x=>{assert.equal(x,'./enterprise/v6662-client-hub-security.cjs');return H},
 auth:()=>{},crypto,Number,String,Buffer,encodeURIComponent,Date,
 db,id:()=>crypto.randomUUID(),now:()=>new Date().toISOString(),saveData:async()=>{persisted++},
 isMgr:req=>['owner','manager'].includes(req.user?.role),
 requireRequestTenant:req=>{if(!Number.isInteger(req.tenantId)||req.tenantId<=0)throw Error('TENANT_CONTEXT_REQUIRED');return req.tenantId},
 audit:()=>{operations++},
 megaData:()=>({projects:[],tickets:[]}),portalOrdersFor:()=>[],portalQuotesFor:()=>[],
};
vm.runInNewContext(s.slice(start,end),ctx,{timeout:3000});
function res(){
 return {code:200,headers:{},status(n){this.code=n;return this},json(v){this.body=v;return this},type(v){this.contentType=v;return this},send(v){this.body=v;return this},
 setHeader(k,v){this.headers[k.toLowerCase()]=v}};
}
(async()=>{
 const grant=routes['POST /api/mega/client-portal/:customerId/token'];
 const publicApi=routes['GET /api/public/client/:token'];
 const html=routes['GET /client/:token'];
 assert.equal(typeof grant,'function');assert.equal(typeof publicApi,'function');assert.equal(typeof html,'function');
 const foreign=res();
 await grant({user:{role:'manager'},tenantId:1,params:{customerId:'two'}},foreign);
 assert.equal(foreign.code,404);assert.equal(two.portalToken,'');assert.equal(persisted,0);
 const missingScope=res();
 await grant({user:{role:'owner'},params:{customerId:'one'}},missingScope);
 assert.equal(missingScope.code,403);assert.equal(one.portalToken,'');assert.equal(persisted,0);
 const nonManager=res();
 await grant({user:{role:'caller'},tenantId:1,params:{customerId:'one'}},nonManager);
 assert.equal(nonManager.code,403);assert.equal(persisted,0);
 const issued=res();
 await grant({user:{role:'manager'},tenantId:1,params:{customerId:'one'}},issued);
 assert.equal(issued.code,200);
 assert.equal(issued.body.url,'/client/'+issued.body.token);
 assert.equal(H.validToken(issued.body.token),true);
 assert.equal(one.portalToken,issued.body.token);
 assert.equal(persisted,1);
 const missing=res();
 await publicApi({params:{token:'<script>alert(1)</script>'}},missing);
 assert.equal(missing.code,404);
 assert.equal(missing.body.error,'Portal not found.');
 const found=res();
 await publicApi({params:{token:issued.body.token}},found);
 assert.equal(found.code,200);assert.equal(found.body.customer.businessName,'One Tenant');
 for(const k of ['cache-control','referrer-policy','x-robots-tag'])assert.ok(found.headers[k],'private response header '+k);
 const invalidHtml=res();
 await html({params:{token:'<script>alert(1)</script>'}},invalidHtml);
 assert.equal(invalidHtml.code,404);
 assert.ok(!String(invalidHtml.body).includes('<script>'));
 const validHtml=res();
 await html({params:{token:issued.body.token}},validHtml);
 assert.equal(validHtml.code,200);
 assert.equal(validHtml.contentType,'html');
 assert.match(validHtml.headers['content-security-policy'],/script-src 'nonce-/);
 assert.equal(validHtml.headers['referrer-policy'],'no-referrer');
 assert.ok(!validHtml.body.includes(one.contactName),'user data must not be interpolated into HTML');
 assert.equal(persisted,1,'GET requests never write business records');
 const begin=s.indexOf('function portalOrdersFor(cid)');
 const quoteStart=s.indexOf('function portalQuotesFor(cid)',begin);
 assert.ok(begin>=0&&quoteStart>begin);
 const portalCtx={db:{orders:[{customerId:'one',notes:'PRIVATE_INTERNAL_SQUARE_METADATA',price:100}]},orderParsed:()=>({squarePaymentStatus:'PAID',customerVisibleNotes:'Public delivery note'}),Number,String};
 vm.runInNewContext(s.slice(begin,quoteStart)+'\nthis.orders=portalOrdersFor;',portalCtx);
 const [customerOrder]=portalCtx.orders('one');
 assert.equal(customerOrder.notes,'Public delivery note');
 assert.equal(JSON.stringify(customerOrder).includes('PRIVATE_INTERNAL_SQUARE_METADATA'),false);
 assert.match(s,/app.post\('\/api\/kim\/control-plane\/run',auth,ownerOnly,/,'only owner can trigger autonomous Kim cycle');
 assert.match(s,/app.get\('\/api\/kim\/control-plane',auth,ownerOnly,/,'only owner can see the private operational control-plane');
 console.log('[SBC V6662] PASS '+String(process.env.SBC_AUDIT_PASS||'1')+
  ': tenant isolation, strict bearer, text-only rendering, CSP, cache/referrer, no internal financial notes, owner-only production controls');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});

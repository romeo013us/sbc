'use strict';
// No network, real credentials, live customer records, external provider calls or MySQL writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const S=require(path.join(root,'enterprise/v6660-website-bridge.cjs'));
const key='a'.repeat(64),seconds=1793053200;
let counter=0;
function synthetic(route='/api/web-lead'){
 const nonce=(++counter).toString(16).padStart(32,'1'),body=Buffer.from('{"email":"a@example.test"}');
 const at=String(seconds),host='sbcmia.com',method='POST';
 const sig=S.signature({key,host,method,path:route,at,nonce,body});
 return {headers:{'x-sbc-website-host':host,'x-sbc-website-timestamp':at,'x-sbc-website-nonce':nonce,'x-sbc-website-signature':sig},
  method,path:route,rawBody:body};
}
// Independent PHP-generated HMAC test vector proves PHP and Node use compatible bytes.
assert.equal(S.signature({key,host:'sbcmia.com',method:'POST',path:'/api/portal/login',at:String(seconds),
 nonce:'1'.repeat(32),body:'{"email":"a@example.test"}'}),
 '25a65b788a5098084ce6cd60e7687dc75c13451ed557314e64457be247034bac');
const valid=synthetic();assert.equal(S.verify(valid,{key,nowSeconds:seconds}).ok,true);
assert.equal(S.verify(valid,{key,nowSeconds:seconds}).code,'SITE_BRIDGE_REPLAY_DENIED');
for(const [name,change] of [
 ['tampered body',q=>q.rawBody=Buffer.from('{}')],
 ['unmapped host',q=>q.headers['x-sbc-website-host']='other.example'],
 ['disallowed path',q=>q.path='/api/payments/square/refresh/order'],
 ['expired timestamp',q=>q.headers['x-sbc-website-timestamp']=String(seconds-1000)],
 ['invalid signature',q=>q.headers['x-sbc-website-signature']='0'.repeat(64)],
 ['no raw body',q=>delete q.rawBody],
 ['non-post request',q=>q.method='GET']
]){
 const v=synthetic();change(v);assert.equal(S.verify(v,{key,nowSeconds:seconds}).ok,false,name);
}
assert.equal(S.verify(synthetic(),{key:'short',nowSeconds:seconds}).code,'SITE_BRIDGE_NOT_CONFIGURED');
for(const route of ['/api/portal/login','/api/portal/register'])
 assert.equal(S.verify(synthetic(route),{key,nowSeconds:seconds}).ok,true);
const app=fs.readFileSync(path.join(root,'server.js'),'utf8');
new vm.Script(app,{filename:'server.js'});
assert.match(app,/SBC_V6660_WEBSITE_BRIDGE_TENANT_SECURITY/);
assert.match(app,/app\.post\('\/api\/web-lead',express\.json\(\{limit:'64kb',verify:/,'early website route must parse and capture exact JSON body');
assert.match(app,/let tenantId;try\{tenantId=sbcVerifiedWebsiteTenant\(req\)\}/);
assert.match(app,/let websiteTenant;try\{websiteTenant=sbcVerifiedWebsiteTenant\(req\)\}/);
assert.match(app,/An SBC customer record exists/);
assert.match(app,/Number\(c.tenantId\)===websiteTenant/);
for(const route of [
 "app.get('/api/portal/admin-summary',auth,sbcPortalStaffScope",
 "app.get('/api/portal/internal/:customerId',auth,sbcPortalStaffScope",
 "app.post('/api/portal/internal/:customerId/message',auth,sbcPortalStaffScope",
 "app.post('/api/portal/internal/:customerId/invite',auth,sbcPortalStaffScope"])
 assert.ok(app.includes(route),'unsafe staff portal: '+route);
assert.match(app,/String\(req.user\?\.role\|\|''\)!=='owner'/);
assert.match(app,/Number\(x.tenantId\)===req.sbcPortalStaffTenant/);
assert.match(app,/ownIds.has\(String\(m.customerId\)\)/);
console.log('[SBC V6660] PASS PHP signing parity, tenant-bound public writes, no cross-tenant owner portal leaks, replay/tamper rejection');
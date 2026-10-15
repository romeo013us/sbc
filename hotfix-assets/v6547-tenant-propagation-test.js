'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),patch=fs.readFileSync(path.join(root,'hotfix-assets/apply-v6547-tenant-propagation.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
assert.equal(pkg.version,'65.1.46');assert.equal(lock.version,'65.1.46');assert.equal(lock.packages[''].version,'65.1.46');
for(const p of [/requireMappedRequestTenant\(req\)/,/tenantId:rec\.tenantId/,/tenantId:requireRequestTenant\(req\)/,/Customer not found in the authenticated tenant/,/public host is not mapped to a tenant/,/SBC_V6547_TENANT_PROPAGATION/])assert.match(patch,p);
assert.doesNotMatch(patch,/tenantId\s*\|\|\s*1/);assert.doesNotMatch(patch,/SBC_RUNTIME_READ_ONLY\s*=\s*false/);assert.doesNotMatch(patch,/MYSQL_RECOVERY_REQUIRED\s*=\s*false/);
const b=fs.readFileSync(path.join(root,'bootstrap.js'),'utf8');assert.match(b,/apply-v6547-tenant-propagation\.js/);assert.match(b,/tenant-propagation-v6547/);
console.log('[SBC V65.1.46] tenant propagation contract PASS');

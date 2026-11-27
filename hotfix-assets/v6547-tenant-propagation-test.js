'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const server=read('server.js'),host=require('../enterprise/v569-production-expansion.js'),hardening=require('../enterprise/production-hardening-v56-25-3.js');
const extract=name=>{const line=server.split('\n').find(x=>x.startsWith('function '+name+'('));assert(line,'missing current tenant resolver: '+name);return line;};
test('authenticated and public tenant resolvers use current runtime, reject missing or unmapped identity',()=>{
 const ctx={PRODUCTION_HARDENING:hardening,V569_PRODUCTION_EXPANSION:host};vm.runInNewContext(extract('requireRequestTenant')+'\n'+extract('requireMappedRequestTenant'),ctx,{timeout:1000});
 assert.equal(ctx.requireRequestTenant({tenantId:7}),7);assert.throws(()=>ctx.requireRequestTenant({}),/TENANT_CONTEXT_REQUIRED/);assert.throws(()=>ctx.requireRequestTenant({tenantId:0}),/TENANT_CONTEXT_REQUIRED/);
 assert.equal(ctx.requireMappedRequestTenant({headers:{host:'sbcmia.com'}}),1);assert.throws(()=>ctx.requireMappedRequestTenant({headers:{host:'unmapped.example.invalid'}}),/TENANT_CONTEXT_REQUIRED/);
 for(const [name,mapping] of Object.entries(host.loadHostMap()))assert.equal(ctx.requireMappedRequestTenant({headers:{host:name}}),Number(mapping.tenantId));
});
test('current release identity and compatibility launcher agree without replaying patches or starting a second writer',()=>{
 const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json')),identity=require('../config/release-identity.js');
 assert.equal(pkg.version,lock.version);assert.equal(lock.packages[''].version,pkg.version);assert.equal(identity.RELEASE_VERSION,pkg.version);
 assert.equal(pkg.main,'sbc-godaddy-flat-entrypoint.cjs');assert.equal(pkg.scripts.start,'node sbc-godaddy-flat-entrypoint.cjs');
 const calls=[];vm.runInNewContext(read('bootstrap.js'),{console:{log(){}},require:id=>{calls.push(id);return {};}},{timeout:1000});assert.deepEqual(calls,['./sbc-godaddy-flat-entrypoint.cjs']);
});

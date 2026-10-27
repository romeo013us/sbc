#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const app=read('public/app.js');
const browserApp=read('browser_public/app.js');
const ops=read('public/v32-2-upgrade.js');
const browserOps=read('browser_public/v32-2-upgrade.js');
const server=read('server.js');
const identity=read('config/release-identity.js');
const pkg=JSON.parse(read('package.json'));
const training=read('enterprise/training-system-v2.js');
const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+name)}
check('release identity, package version, and cache-busted shell agree',()=>{
  assert.equal(pkg.version, require('../package.json').version);
  assert.match(identity,new RegExp("RELEASE_VERSION = '" + pkg.version.replaceAll('.', '\\.') + "'"));
  assert.match(read('VERSION'),/V65\.1\.26/);
  assert.match(read('public/index.html'),/V65\.1\.26 · DEMO STUDIO/);
  assert.match(read('public/index.html'),/app\.js\?v=65\.1\.26-demo-studio/);
});
check('training library falls back to the authenticated admin catalog when assignment projections are empty',()=>{
  assert.match(app,/if\(map\.size===0&&Array\.isArray\(t\.library\?\.courses\)\)/);
  assert.match(app,/sbcCanonicalOpenCourse\('\$\{esc\(c0\.id\|\|''\)\}'\)/);
  assert.match(browserApp,/t\.library\?\.courses/);
  assert.match(training,/function repairCourseCatalog\(db\)/);
});
check('Customer 360 performs read-only relational enrichment and merges legacy field names',()=>{
  assert.match(ops,/async function openV322Customer360\(id\)/);
  assert.match(ops,/customer-360-relational\//);
  assert.match(ops,/contact_name/);
  assert.match(ops,/primary_phone/);
  assert.match(ops,/remoteOrders/);
  assert.match(ops,/This path never writes or restores records/);
  assert.match(browserOps,/customer-360-relational\//);
});
check('recovery write guard is registered before routes and stays fail-closed',()=>{
  const guard=server.indexOf('app.use(createRecoveryWriteGuard(');
  const trainingWrite=server.indexOf("app.post('/api/training/progress'");
  assert(guard>=0&&trainingWrite>guard,'recovery write guard must run before training mutations');
  assert.match(server,/isRecoveryRequired:\(\)=>!MYSQL_RECOVERY_EVALUATED \|\| MYSQL_RECOVERY_REQUIRED/);
  assert.match(server,/app\.get\('\/api\/training'/);
});
check('recovery lock is not disabled or weakened by the release',()=>{
  assert.match(server,/recoveryRequired:recoveryReadOnly,readOnly:recoveryReadOnly/);
  assert.match(read('RELEASE-NOTES-V65.1.5-BUYER-DEMO-STABILITY.md'),/does not unlock recovery/);
});
console.log(`\nSBC V65.1.26 buyer-demo stability regression: ${checks.length}/5 passed`);

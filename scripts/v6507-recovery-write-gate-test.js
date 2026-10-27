'use strict';
const assert = require('node:assert/strict');
const {createRecoveryWriteGuard, isExpectedRecoveryRejection} = require('../enterprise/recovery/recovery-write-guard.cjs');
const fs = require('node:fs');
const path = require('node:path');
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
let locked = true;
let evaluated = true;
const guard = createRecoveryWriteGuard({isRecoveryRequired:()=>!evaluated || locked});
function run(method,path){
  let statusCode=200, body=null, nextCalled=false;
  const req={method,path};
  const res={status(n){statusCode=n;return this;},json(value){body=value;return this;}};
  guard(req,res,()=>{nextCalled=true;});
  return {statusCode,body,nextCalled};
}
const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
check('fails closed before startup recovery census completes',()=>{evaluated=false;const r=run('POST','/api/customers');assert.equal(r.statusCode,423);assert.equal(r.nextCalled,false);evaluated=true;});
check('recognizes expected recovery rejection without treating it as a fatal runtime fault',()=>{assert.equal(isExpectedRecoveryRejection(new Error('MYSQL_RECOVERY_REQUIRED')),true);assert.equal(isExpectedRecoveryRejection(new Error('ECONNRESET')),false);});
check('startup gate is wired fail-closed until recovery evaluation completes',()=>{assert(serverSource.includes('isRecoveryRequired:()=>!MYSQL_RECOVERY_EVALUATED || MYSQL_RECOVERY_REQUIRED'));});
check('expected recovery rejection is handled before fatal shutdown',()=>{assert(serverSource.includes('if (isExpectedRecoveryRejection(reason))'));});
check('blocks POST before handler while recovery locked',()=>{const r=run('POST','/api/customers');assert.equal(r.statusCode,423);assert.equal(r.body.error,'MYSQL_RECOVERY_REQUIRED');assert.equal(r.nextCalled,false);});
check('blocks PUT while recovery locked',()=>{const r=run('PUT','/api/orders/1');assert.equal(r.statusCode,423);assert.equal(r.nextCalled,false);});
check('blocks DELETE while recovery locked',()=>{const r=run('DELETE','/api/customers/1');assert.equal(r.statusCode,423);assert.equal(r.nextCalled,false);});
check('allows owner login while recovery locked',()=>{const r=run('POST','/api/login');assert.equal(r.statusCode,200);assert.equal(r.nextCalled,true);});
check('allows logout while recovery locked',()=>{const r=run('POST','/api/logout');assert.equal(r.statusCode,200);assert.equal(r.nextCalled,true);});
check('allows GET status/read endpoints while recovery locked',()=>{const r=run('GET','/api/system/health');assert.equal(r.statusCode,200);assert.equal(r.nextCalled,true);});
check('allows writes after recovery clears',()=>{locked=false;const r=run('POST','/api/customers');assert.equal(r.statusCode,200);assert.equal(r.nextCalled,true);});
check('global guard is registered before first mutating route',()=>{assert(serverSource.indexOf('app.use(createRecoveryWriteGuard') < serverSource.indexOf("app.post('/api/revenue-os/score'"));});
console.log(`V65.1.26 recovery write-gate test: ${checks.length}/${checks.length} PASS`);

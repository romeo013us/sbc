'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('./v66149-stage-hr-ui.cjs');
const root=path.resolve(__dirname,'..');
for(const [a,b,patch] of [
 ['public/app.js','browser_public/app.js',S.patchApp],
 ['public/v10.js','browser_public/v10.js',S.patchV10]
]){
 const x=fs.readFileSync(path.join(root,a),'utf8'),y=fs.readFileSync(path.join(root,b),'utf8');
 assert.equal(x,y,'browser mirrors must match');
 const z=patch(x);
 assert.equal(z,patch(z),'UI patch idempotent');
 new vm.Script(z,{filename:a});
 if(process.argv.includes('--staged'))assert.equal(x,z,'HR owner nav missing from compiled release');
 if(a.endsWith('app.js')){
  assert(z.includes('HR Department</button>'));
  assert(z.includes("state.me?.role!=='owner'"),'HR owner button must be role-checked');
 }else{
  assert(z.includes('HR Department Manager</option>'));
  assert(z.includes('value="hr_manager"'));
  assert(z.includes('Open HR Department'));
 }
}
const a=fs.readFileSync(path.join(root,'public/hr-workstation.html'),'utf8'),
 b=fs.readFileSync(path.join(root,'browser_public/hr-workstation.html'),'utf8');
assert.equal(a,b,'HTML mirrors must match');
for(const anchor of ['HR Department Sign In','id="username"','id="password"','/api/hr/overview',
 '/api/hr/drafts','/api/hr/payout-preferences','Remitly','Owner Approval Queue','OWNER-GOVERNED',
 'No transfer or bank account collection','data-draft'])assert(a.includes(anchor),anchor);
assert(!/https?:\/\/(?:cdn|unpkg|jsdelivr)/.test(a),'standalone HR must not rely on external scripts');
assert(!a.includes('localStorage')&&!a.includes('sessionStorage'),'no client-side storage of PII or passwords');
assert(!a.includes('/api/v9/payroll/run'),'HR cannot use privileged payroll execution rail');
assert(!a.includes('id="bankAccount"'),'do not collect bank details');
const scripts=[...a.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert.equal(scripts.length,1);
new vm.Script(scripts[0],{filename:'hr-workstation.html inline JS'});
console.log('PASS V66.149: HR independent login, role option, owner nav, no bank/secret collection, HTML/JS parity');

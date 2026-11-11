'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('./v66150-stage-hr-ui.cjs');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'public/v10.js'),'utf8'),
 mirror=fs.readFileSync(path.join(root,'browser_public/v10.js'),'utf8');
assert.equal(src,mirror,'Workforce users UI mirrors identical');
const out=S.patchV10(src);
assert.equal(S.patchV10(out),out);
assert(out.includes(S.MARK));
assert(out.includes('HR Department Manager</option>'));
assert(out.includes('value="hr_manager"'));
assert(out.includes('/hr-workstation.html'));
new vm.Script(out,{filename:'owner-workforce-hr-role.js'});
if(process.argv.includes('--staged'))assert.equal(out,src,'HR manager user role missing in compiled UI');
const app=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
assert(app.includes('SBC_V66149_HR_DEPARTMENT_SHORTCUT'),'canonical owner HR department remains accessible');
const html=fs.readFileSync(path.join(root,'public/hr-workstation.html'),'utf8'),
 htmlMirror=fs.readFileSync(path.join(root,'browser_public/hr-workstation.html'),'utf8');
assert.equal(html,htmlMirror,'independent HR manager browser mirror required');
for(const text of ['HR Department Sign In','/api/hr/overview','/api/hr/drafts',
 '/api/hr/payout-preferences','providerChoice','Owner Approval Queue',
 'No transfer or bank account collection','data-draft'])assert(html.includes(text),text);
assert(!html.includes('/api/v9/payroll/run'),'HR cannot run privileged payroll');
assert(!html.includes('localStorage')&&!html.includes('sessionStorage'),'never store employee data clientside');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert.equal(scripts.length,1);new vm.Script(scripts[0],{filename:'hr-manager-workstation.js'});
console.log('PASS V66.150: existing owner HR intact, HR manager creation + independent login, owner-only approval UI and no secrets');

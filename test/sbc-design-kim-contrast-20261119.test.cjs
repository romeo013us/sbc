'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
for(const dir of ['public','browser_public']){
 const css=fs.readFileSync(path.join(root,dir,'sbc-global-contrast-rescue-20261106.css'),'utf8');
 assert.ok(css.includes('body #sbcDesignRequestCall.sbc-design-call'));
 assert.match(css,/body #sbcV56240GrowthHardening/);
 assert.ok(css.includes('body #sbcV56240GrowthHardening .kpi'));
 assert.doesNotMatch(css,/body #sbcCallAppointments/);
}
const {verify}=require('../scripts/v66-owner-ui-css-bundle.cjs');
assert.equal(verify(root).ok,true);
console.log('Focused Design Request + Kim contrast and compiled bundle: PASS');

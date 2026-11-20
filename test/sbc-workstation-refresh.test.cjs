'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(dir,name)=>fs.readFileSync(path.join(root,dir,name),'utf8');

test('staff workstation UI edits are mirrored and owner dashboard remains outside the patch',()=>{
 for(const file of ['lead-research.html','lead-research.css','sales-caller.html','sales-caller.css','hr-department.html','hr-workstation.html','sbc-customer-design-requests-v1.js'])
  assert.equal(read('public',file),read('browser_public',file),file);
});
test('Lorna submitted leads are scrollable and compact without hiding mobile records',()=>{
 assert.match(read('public','lead-research.html'),/id="mine-list"[^>]*tabindex="0"[^>]*role="region"/);
 const css=read('public','lead-research.css');
 assert.match(css,/\.pane\[data-pane="mine"\] #mine-list\.sbc-compact-submission-list/);
 assert.match(css,/max-height:none;overflow:visible/);
});
test('legacy caller transition and both HR workstations retain navigation and protections',()=>{
 assert.match(read('public','sales-caller.html'),/Legacy Calling Desk/);
 assert.match(read('public','hr-department.html'),/href="\/hr-workstation\.html"/);
 assert.match(read('public','hr-workstation.html'),/focus-visible/);
 assert.match(read('public','hr-workstation.html'),/Owner Approval Queue/);
});
test('Customer Design Requests report schema readiness and do not auto-create DB tables',()=>{
 const route=fs.readFileSync(path.join(root,'routes/sbc-customer-design-briefs.cjs'),'utf8');
 const ui=read('public','sbc-customer-design-requests-v1.js');
 assert.match(route,/DESIGN_REQUEST_SCHEMA_NOT_READY/);
 assert.doesNotMatch(route,/CREATE TABLE|ALTER TABLE/);
 assert.match(ui,/Design Requests need database activation/);
 assert.match(ui,/setAccountCreateState\(id,false\)/);
});
test('demo role offers three clearly synthetic examples with no outreach destinations',()=>{
 const {demoBootstrapData}=require('../enterprise/sbc-demo-bootstrap.cjs');
 const examples=demoBootstrapData().customers;
 assert.equal(examples.length,3);
 for(const x of examples){assert.equal(x.demoOnly,true);assert.equal(x.tenantId,0);assert.equal(x.phone,'');assert.equal(x.email,'');assert.match(x.businessName,/DEMO/)}
});

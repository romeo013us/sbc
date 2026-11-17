'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Lorna owner assignment stays compact, on dashboard only, with dismiss/restore',()=>{
 const h=read('public/lead-research.html'),j=read('public/lead-research.js');
 assert(h.indexOf('data-pane="home"')<h.indexOf('id="sbc-full-research-urgent"'));
 for(const id of ['sbc-assignment-details','sbc-dismiss-assignment','sbc-restore-assignment','sbc-urgent-lead-details'])assert(h.includes('id="'+id+'"'));
 assert.match(j,/function setupAssignmentDismiss/);
 assert.doesNotMatch(j,/localStorage\\./); // Do not store research-workspace state in local browser storage.
 assert.equal(h,read('browser_public/lead-research.html'));
});
test('HR tabs preserve role-guarded payment drafts and owner approvals',()=>{
 const h=read('public/hr-workstation.html');
 for(const key of ['team','time','approvals','providers','holidays'])assert(h.includes('data-hr-panel="'+key+'"'));
 assert.match(h,/aria-label="HR workspace sections"/);
 assert.match(h,/November 20, 2026/);assert.match(h,/Unpaid closure/);assert.match(h,/Biweekly payroll/);
 assert.match(h,/\/api\/hr\/drafts/);assert.equal(h,read('browser_public/hr-workstation.html'));
 assert.equal((h.match(/<script>/g)||[]).length,1);
});
test('ChatGPT website flow is primary with $499 Business Basic and private backup',()=>{
 const s=read('public/sbc-website-production-v1.js');
 assert.match(s,/Build & revise with ChatGPT/);
 assert.match(s,/Business Basic · \$499/);
 assert.doesNotMatch(s,/Business Basic · \$349/);
 assert.match(s,/Legacy Website Studio · backup/);
 assert.equal(s,read('browser_public/sbc-website-production-v1.js'));
});

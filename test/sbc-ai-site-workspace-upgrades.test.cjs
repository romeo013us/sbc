'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
test('SBC studio has desktop/tablet/mobile iframe preview, isolated origin, owner revision flow and gated publish handoff',()=>{
 const code=fs.readFileSync(path.join(root,'public/sbc-ai-site-handoff-v1.js'),'utf8');
 const mirror=fs.readFileSync(path.join(root,'browser_public/sbc-ai-site-handoff-v1.js'),'utf8');
 assert.equal(code,mirror);
 for(const device of ['desktop','tablet','mobile'])assert(code.includes('data-sbc-ai-device="'+device+'"'));
 assert(code.includes('id="sbcAIFrameStage"'));
 assert(code.includes('sandbox="allow-scripts"'));
 assert(!code.includes('allow-same-origin'));
 assert(code.includes('sbcAIRevisionCopy'));
 assert(code.includes('return ONE complete revised website ZIP')===false); // actual prompt capitalization differs
 assert(code.includes("Return ONE complete revised website ZIP"));
 assert(code.includes('data-sbc-ai-restore'));
 assert(code.includes("'/select'"));
 assert(code.includes('expectedActiveId'));
 assert(code.includes('sbcAIPreparePublish'));
 assert(code.includes("qa?.issueCount===0"));
 assert(code.includes("FORM_BACKEND_MUST_BE_TESTED"));
 assert(code.includes('sbcAIRunQA'));
 assert(code.includes("+'/qa'"));
 assert(code.includes("published")||code.includes("does NOT publish"));
});
test('device simulator and quality-review controls have constrained widths and readable labels',()=>{
 const css=fs.readFileSync(path.join(root,'public/sbc-command-center-focus-v1.css'),'utf8');
 const mirror=fs.readFileSync(path.join(root,'browser_public/sbc-command-center-focus-v1.css'),'utf8');
 assert.equal(css,mirror);
 assert.match(css,/data-device="tablet".*768px/);
 assert.match(css,/data-device="mobile".*390px/);
 assert.match(css,/sbc-ai-release-review/);
 assert.match(css,/sbcAIQAStatus/);
});

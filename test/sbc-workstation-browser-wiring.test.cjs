'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const file=(dir,name)=>fs.readFileSync(path.join(root,dir,name),'utf8');

test('Lorna production HTML explicitly loads the working handoff panel before the researcher script',()=>{
 for(const dir of ['public','browser_public']){
  const html=file(dir,'lead-research.html');
  const helper=html.indexOf('/sbc-lorna-handoff-v1.js');
  const researcher=html.indexOf('/lead-research.js');
  assert(helper>=0,dir+' must load the real handoff asset (button is otherwise hidden)');
  assert(researcher>helper,dir+' must load handoff before lead-research.js runs');
  assert(html.includes('/sbc-lorna-handoff-v1.css'),dir+' must style the working handoff panel');
  assert(html.includes('defer src="/sbc-lorna-handoff-v1.js'),dir+' must use deferred script ordering');
  const source=file(dir,'sbc-lorna-handoff-v1.js');
  assert.match(source,/SBCLornaHandoff=Object\.freeze\(\{openForLead\}\)/);
 }
 assert.equal(file('public','lead-research.html'),file('browser_public','lead-research.html'));
});

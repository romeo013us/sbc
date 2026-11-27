'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('flagship call desk keeps one focused prepare-call-wrap-next workflow',()=>{
 const html=read('public/sales-caller.html');
 assert.match(html,/SBC CALL CENTER · FOCUS MODE/);
 assert.match(html,/One account\. One conversation\. One next step\./);
 assert.match(html,/data-outcome="Interested"/);
 assert.match(html,/data-outcome="Do Not Call"/);
 assert.match(html,/Save & Open Next Account/);
 assert.match(html,/CRM save must succeed before the queue advances/);
 assert.match(html,/sales-caller\.css\?v=5/);
 assert.match(html,/sales-caller\.js\?v=4/);
});

test('wrap-up enforces scheduled outcomes and advances only after durable save',()=>{
 const js=read('public/sales-caller.js');
 assert.match(js,/needsTime&&!\$\('callback'\)\.value/);
 assert.match(js,/if\(!saved\.id\)throw Error/);
 assert.match(js,/await load\(\)/);
 assert.match(js,/callDeskShortcut/);
 assert.match(js,/requestSubmit\(\)/);
});

test('public and browser release assets remain byte-identical',()=>{
 for(const name of ['sales-caller.html','sales-caller.js','sales-caller.css','sbc-call-command-live-v3.js','sbc-call-command-live-v3.css']){
  assert.equal(read('public/'+name),read('browser_public/'+name),name+' mirror drift');
 }
});

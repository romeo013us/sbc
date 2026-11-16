'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const ui=read('public/sbc-chatgpt-os-v1.js');
const mirror=read('browser_public/sbc-chatgpt-os-v1.js');
const {canResumeModal}=require('../public/sbc-chatgpt-os-v1.js');
test('Ask ChatGPT can reopen without clearing draft, reply or unsaved Business Memory text',()=>{
 assert.match(ui,/function open\(\)[\s\S]*?if\s*\(!draftStarted\)/);
 assert.match(ui,/function startNewBrief\(/);
 assert.match(ui,/sbc-chatgpt-os-new-brief/);
 assert.match(ui,/Draft restored/);
 assert.match(ui,/dialog\.addEventListener\('close'/);
 assert.doesNotMatch(ui,/dialog\.addEventListener\('click',\s*e\s*=>\s*\{\s*if\s*\(e\.target===dialog\)dialog\.close\(\)/);
});
test('safe common modal recovery is registered without modifying the transactional modal mechanism',()=>{
 assert.match(ui,/function installModalRecovery\(/);
 assert.match(ui,/id='sbc-last-panel-resume'/);
 assert.match(ui,/modal\.classList\.remove\('hidden'\)/);
 assert.match(ui,/MutationObserver\(sync\)/);
 assert.match(ui,/ownerKey/);
});
test('resume control remains hidden until safe to restore, including in dark mode',()=>{
 const css=read('public/sbc-chatgpt-os-v1.css');
 assert.match(css,/#sbc-last-panel-resume\[hidden\]\{display:none!important\}/);
 assert.equal(css,read('browser_public/sbc-chatgpt-os-v1.css'));
});
test('restore policy denies cross-session, payment and credential modals',()=>{
 assert.equal(canResumeModal({sameSession:true,authorized:true,hasContent:true,title:'View contact details'}),true);
 for(const changes of [
  {sameSession:false},{authorized:false},{hasContent:false},
  {title:'Complete Square checkout'},{title:'Refund a payment'},
  {title:'Password and API key settings'},{hasCredentials:true}
 ])assert.equal(canResumeModal({...{sameSession:true,authorized:true,hasContent:true,title:'View account'},...changes}),false,JSON.stringify(changes));
});
test('main and standalone workspaces cache-bust resume code and styles',()=>{
 const focus=read('public/sbc-command-center-focus-v1.js');
 const home=read('public/index.html');
 assert.match(focus,/sbc-chatgpt-os-v1\\.js\\?v=66\\.0\\.132-resume/);
 assert.match(focus,/sbc-chatgpt-os-v1\\.css\\?v=66\\.0\\.132-resume/);
 assert.match(home,/sbc-command-center-focus-v1\\.js\\?v=20261116-panel-resume/);
 for(const file of ['lead-research.html','sales-caller.html','hr-workstation.html','hr-department.html','renewals-center.html','sbc-account-manager-v1.html','kevin-cockpit.html']){
  const html=read('public/'+file);
  assert.match(html,/sbc-chatgpt-os-v1\\.js\\?v=66\\.0\\.132-resume/,file);
  assert.match(html,/sbc-chatgpt-os-v1\\.css\\?v=66\\.0\\.132-resume/,file);
  assert.equal(html,read('browser_public/'+file));
 }
});
test('both frontend directories ship matching resumed panel implementation',()=>{
 assert.equal(ui,mirror);
});

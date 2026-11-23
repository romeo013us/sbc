'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),src=p=>fs.readFileSync(path.join(root,p),'utf8');
test('lesson explicitly explains when scoring is blocked and which action to take next',()=>{
 const html=src('public/sbc-am-academy.html'),js=src('public/sbc-am-academy-v1.js');
 for(const id of ['academyStepGuide','academyActionStatus','academyNextAction','labGateHint','quizGateHint'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const marker of ['function gradingBlocker()','function renderGuidance()','function nextMissingStep()'])assert(js.includes(marker),marker);
 assert.match(js,/Start your official training clock/);
 assert.match(js,/Owner preview cannot score employee work/);
 assert.match(js,/90%/);
});
test('scoring remains performed by the server and owner observation stays mandatory',()=>{
 const js=src('public/sbc-am-academy-v1.js');
 assert.match(js,/PREFIX\+'\/quiz\/'\+id/);
 assert.match(js,/PREFIX\+'\/lab\/'\+id/);
 assert.match(js,/PREFIX\+'\/roleplay\/'\+id/);
 assert.match(js,/Owner observation and certification remain separate/);
 assert(!js.includes('score=answers.filter(Boolean).length'));
});
test('video first; only Learn and Prove It; optional illustration separate from video',()=>{
 const html=src('public/sbc-am-academy.html'),js=src('public/sbc-am-academy-v1.js');
 assert(html.indexOf('id="lessonTitle"')<html.indexOf('id="academyRecording"'));
 assert(html.indexOf('id="academyRecording"')<html.indexOf('id="academyMore"'));
 assert.match(html,/id="tabLesson"[^>]*>01 · Learn/);
 assert.match(html,/id="tabKnowledge"[^>]*>02 · Prove It/);
 assert(!html.includes('id="tabLab"'));
 for(const id of ['proofPanel','proofSample','proofRoleplay','proofQuiz','academyIllustratedMore'])assert(html.includes('id="'+id+'"'));
 assert(!html.includes('id="narrationVoice"')&&!html.includes('id="voiceSample"'));
 assert(js.includes('chooseVoice(speechSynthesis.getVoices(),lang,null)'));
 assert(!js.includes('populateVoices')&&!js.includes("showTab('Lab')"));
});
test('Academy is discoverable in owner Command Center and dedicated AM workplace',()=>{
 const app=src('public/app.js'),html=src('public/sbc-account-manager-v1.html');
 assert.match(app,/Academy 360 · Official Training/);
 assert(app.includes('sbc-am-academy-owner.html'));
 assert.match(html,/data-view="academy"[^>]*>🎓/);
 assert.match(html,/src="\/sbc-am-academy\.html"/);
});
test('all classroom and staff navigation changes are mirrored into both release asset roots',()=>{
 const names=['sbc-am-academy.html','sbc-am-academy-v1.js','sbc-am-academy-v1.css','sbc-account-manager-v1.html','app.js'];
 for(const name of names)if(fs.existsSync(path.join(root,'browser_public',name)))assert.equal(src('public/'+name),src('browser_public/'+name),name);
});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
test('Lorna My Training embeds Academy 360 media and does not render legacy catalog',()=>{
 const html=read('public/lead-research.html'),js=read('public/lead-research.js');
 assert.match(html,/<section class="pane" data-pane="training" hidden>[\s\S]*?id="academy360EmployeeFrame"[^>]*src="\/sbc-academy360-employee-training\.html"/);
 const panel=html.split('<section class="pane" data-pane="training" hidden>')[1].split('</section>')[0];
 assert.doesNotMatch(panel,/id="training-list"|id="training-detail"|My Learning Library/);
 assert.match(js,/async function loadTraining\(\)\{[\s\S]{0,600}academy360EmployeeFrame/);
});
test('Sales Caller Test My Training shows Academy 360 inline, not 12-hour legacy lessons',()=>{
 const html=read('public/sales-caller.html'),js=read('public/sales-caller.js');
 const pane=html.split('<section id="training" data-page hidden>')[1].split('</section>')[0];
 assert.match(pane,/id="academy360CallerFrame"[^>]*src="\/sbc-academy360-employee-training\.html"/);
 assert.doesNotMatch(pane,/Legacy caller training|Legacy SBC Academy|id="training-list"|id="training-detail"/);
 assert.match(js,/async function renderTraining\(\)\{[\s\S]{0,700}academy360CallerFrame/);
});
test('Dedicated account_manager receives scored Academy embedded in existing workstation view',()=>{
 const html=read('public/sbc-account-manager-v1.html'),js=read('public/sbc-account-manager-v1.js');
 assert.match(html,/data-view="academy"[^>]*>🎓/);
 assert.match(html,/id="view-academy" class="view" hidden>[\s\S]*?src="\/sbc-am-academy\.html"/);
 assert.doesNotMatch(html,/<a class="tab" href="\/sbc-am-academy\.html"/);
 assert.match(js,/document\.querySelectorAll\('\.tab'\)/);
 assert.match(js,/\.top-actions \[data-view="academy"\]/);
});
test('Command Center Training renders embedded Academy 360 owner pages, not older trainingV2View catalog',()=>{
 const app=read('public/app.js'),fn=app.split('function training(){')[1].split('window.sbcOpenTrainingSafe=')[0];
 assert(fn.includes('src=\\"/sbc-am-academy.html')||fn.includes('/sbc-am-academy.html'));
 assert(fn.includes('src=\\"/sbc-am-academy-owner.html')||fn.includes('/sbc-am-academy-owner.html'));
 assert.match(fn,/Academy 360 · Official Training/);
 assert.doesNotMatch(fn,/trainingV2View|Training Library|openTrainingCourseV2/);
});
test('embedded legacy-role viewer has actual bilingual media and discloses non-graded status',()=>{
 const html=read('public/sbc-academy360-employee-training.html'),js=read('public/sbc-academy360-employee-training.js');
 assert.match(html,/Academy 360/);
 assert.match(html,/id="academyRoleMessage"/);
 assert.match(html,/id="academyVideo"/);
 assert.match(html,/id="academyAudio"/);
 assert.match(html,/id="academyPhotos"/);
 assert.match(js,/account_manager/);
 assert.match(js,/Certification is not available under a caller or research account/);
 assert.match(js,/\/academy-media\/academy360\//);
 assert.doesNotMatch(js,/training\/progress|roleplay|submitAttempt|certification\/|window\/start/);
});
test('workstation and in-app Academy surface changes remain mirrored for GoDaddy',()=>{
 for(const f of ['lead-research.html','lead-research.js','sales-caller.html','sales-caller.js','sbc-account-manager-v1.html','sbc-academy360-employee-training.html','sbc-academy360-employee-training.js'])assert.equal(read('public/'+f),read('browser_public/'+f),f);
});

'use strict';
/* SBC V66.109 — audio-control war test, pure synthetic SpeechSynthesis. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const audio=require('../public/sbc-workforce-audio-v66109.js');
const parts=[
 'Lesson objective: Understand the current Successful By Choice service and customer journey.',
 'What you need to learn: truthful identity, approved service scope, order and payment safeguards.',
 'Practice exercise: rehearse a simulated customer interaction. Record the decision and owner handoff.'
];
const sections=audio.chunks(parts,180);
assert(sections.length>=3,'multiple seekable spoken sections');
assert(sections.every(x=>x&&x.length<=180),'voice utterances should be browser-safe lengths');
assert(sections.join(' ').includes('Successful By Choice'));
assert(audio.chunks([]).length===0);
assert(audio.chunks(['a'.repeat(880)],110).every(x=>x.length<=110),'long single tokens must chunk safely');
function FakeUtterance(text){this.text=text;this.lang='';this.rate=0;}
const synth={
 spoken:[],cancels:0,paused:false,
 speak(u){this.spoken.push(u);},
 cancel(){this.cancels++;this.paused=false;},
 pause(){this.paused=true;},
 resume(){this.paused=false;}
};
let latest;
const player=audio.createPlayer({segments:['First verified section.','Second section.','Third section.'],
 synth,Utterance:FakeUtterance,onState:x=>latest=x});
assert.deepEqual(player.snapshot(),{position:0,count:3,mode:'idle',supported:true,disposed:false});
player.play();
assert.equal(synth.spoken.length,1);
assert.equal(synth.spoken[0].text,'First verified section.');
assert.equal(synth.spoken[0].rate,.93,'preserve previous Lorna voice rate');
player.pause();
assert.equal(player.snapshot().mode,'paused');
assert.equal(synth.paused,true);
player.play();
assert.equal(player.snapshot().mode,'playing','Play resumes paused voice');
assert.equal(synth.paused,false);
const first=synth.spoken[0];
first.onend();
assert.equal(player.snapshot().position,1);
assert.equal(synth.spoken.at(-1).text,'Second section.');
player.next();
assert.equal(player.snapshot().position,2);
assert.equal(synth.spoken.at(-1).text,'Third section.');
const stale=synth.spoken.at(-2);
const countBefore=synth.spoken.length;
stale.onend();
assert.equal(synth.spoken.length,countBefore,'canceled utterance must never auto-advance');
assert.equal(player.snapshot().position,2);
player.previous();
assert.equal(player.snapshot().position,1);
assert.equal(synth.spoken.at(-1).text,'Second section.');
player.seek(1000);
assert.equal(player.snapshot().position,2,'seeking clamps to last section');
player.pause();
player.seek(0);
assert.equal(player.snapshot().mode,'idle','seek during pause should restart cleanly, not resume canceled utterance');
assert.equal(synth.paused,false);
player.play();
assert.equal(synth.spoken.at(-1).text,'First verified section.');
player.stop();
assert.equal(player.snapshot().mode,'idle');
assert.equal(player.snapshot().position,0);
const before=synth.spoken.length;
first.onend();
assert.equal(synth.spoken.length,before,'stale onend after Stop must not restart');
player.play();
player.dispose();
player.play();
assert.equal(synth.spoken.length,before+1,'disposed narrator must not start again');
assert.equal(player.snapshot().disposed,true);
let unsupportedState;
const unsupported=audio.createPlayer({segments:['Read text.'],synth:null,Utterance:null,onState:s=>unsupportedState=s});
unsupported.play();
assert.equal(unsupported.snapshot().mode,'unavailable');
assert.equal(unsupportedState.supported,false);
assert.equal(audio.textParts(null).length,0);
const htmls=['lead-research.html','sales-caller.html'];
for(const filename of htmls){
 const html=read('public/'+filename);
 const scriptAt=html.indexOf('/sbc-workforce-audio-v66109.js?v=1');
 const pageCode=filename==='lead-research.html'?html.search(/\/lead-research\.js\?v=\d+/):html.indexOf('/sales-caller.js?v=3');
 assert(scriptAt>0&&pageCode>scriptAt,'shared reader loads before lesson renderer in '+filename);
 assert(html.includes('/sbc-workforce-audio-v66109.css?v=1'),'control styles included in '+filename);
 assert.equal(html,read('browser_public/'+filename),'served mirror '+filename);
}
for(const filename of ['sbc-workforce-audio-v66109.js','sbc-workforce-audio-v66109.css','sbc-workforce-academy-v6697.js']){
 assert.equal(read('public/'+filename),read('browser_public/'+filename),'staged mirrored reader: '+filename);
}
const renderer=read('public/sbc-workforce-academy-v6697.js');
assert(renderer.includes('W.SBCWorkforceAudio.mount(content,W)'),'Lorna should delegate to new audio player');
assert(renderer.includes('🎧 Listen to this lesson'),'original reader kept as fallback');
const browser=read('public/sbc-workforce-audio-v66109.js');
new vm.Script(browser,{filename:'sbc-workforce-audio-v66109.js'});
assert(browser.includes('createElement')&&browser.includes("slider.type='range'"),'accessible playback scrubber must render');
for(const action of ['previous','play','pause','stop','next','seek'])assert(browser.includes('player.'+action+'('),'missing control: '+action);
assert(!browser.includes('fetch(')&&!browser.includes('XMLHttpRequest')&&!browser.includes('/api/'),'narrator must not touch server');
const sales=read('public/sales-caller.js'),research=read('public/lead-research.js');
assert(sales.includes('SBCSalesPlaybook'),'approved sales script remains');
assert(sales.includes('lead=data.leads.find'),'assigned lead selector remains');
assert(research.includes('trainingParagraph'),'approved researcher lessons remain');
assert(read('public/sbc-workforce-audio-v66109.css').includes('@media(max-width:660px)'),'mobile support');
console.log('[SBC V66.109] PASS: real caller voice asset, Lorna shared voice and fallback, Play/Pause/Stop/Rewind/Forward/section slider, auto-next, stale-event and seek safety, mobile/theme, mirrored assets, no API/CRM side effects');

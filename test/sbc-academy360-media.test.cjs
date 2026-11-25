'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require(process.env.SBC_TEST_JSDOM_MODULE||'jsdom');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('video player verifies actual same-origin media and rejects HTML fallback',async()=>{
 const dom=new JSDOM(read('public/sbc-am-academy.html'),{url:'https://academy.test/sbc-am-academy.html',runScripts:'outside-only'});
 const w=dom.window,d=w.document;w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};
 const calls=[];w.fetch=async(url,opts)=>{calls.push({url,opts});return{ok:url.endsWith('.webm'),headers:{get:()=>url.includes('-es.')?'text/html':'video/webm'}};};
 w.eval(read('public/sbc-am-academy-media-v1.js'));
 await w.SBC_ACADEMY_VIDEO.render('am-01','en');
 assert.equal(d.getElementById('academyRecording').hidden,false);
 assert.match(d.getElementById('academyRecording').src,/am-01-en.webm$/);
 assert.equal(calls[0].opts.method,'HEAD');assert.equal(calls[0].opts.credentials,'same-origin');
 await w.SBC_ACADEMY_VIDEO.render('am-01','es');assert.equal(d.getElementById('academyRecording').hidden,true);
 assert.match(d.getElementById('academyVideoStatus').textContent,/(Todavía no|Aún no)/);
 const count=calls.length;await w.SBC_ACADEMY_VIDEO.render('../../secret','en');assert.equal(calls.length,count);
 assert(!read('public/sbc-am-academy-media-v1.js').includes('/api/training/progress'));
 dom.window.close();
});
test('real recording studio has twelve filmed lessons, guarded local downloads and honest draft captions',()=>{
 const dom=new JSDOM(read('public/sbc-am-academy-recorder.html'),{url:'https://academy.test/sbc-am-academy-recorder.html',runScripts:'outside-only'});
 dom.window.eval(read('public/sbc-am-academy-recorder-v1.js'));
 const d=dom.window.document,a=dom.window.SBC_ACADEMY_RECORDER;
 assert.equal(a.lessons.length,12);assert.equal(d.getElementById('lessonSelect').options.length,12);
 assert.equal(d.getElementById('downloadVideo').disabled,true);assert.equal(d.getElementById('downloadVtt').disabled,true);
 assert.match(a.vtt('Hello.\nOpen the fictional account.',60),/00:00:00.000 --> 00:00:30.000/);
 assert.throws(()=>a.vtt('',60),/Add spoken captions/);assert.throws(()=>a.vtt('Hello',0),/record at least five/);
 assert.match(read('public/sbc-am-academy-recorder-v1.js'),/getDisplayMedia/);assert.match(read('public/sbc-am-academy-recorder.html'),/No media is automatically uploaded/);
 dom.window.close();
});
test('new media is shipped in both public and browser_public with unchanged certification rails',()=>{
 for(const name of ['sbc-am-academy.html','sbc-am-academy-v1.js','sbc-am-academy-v1.css','sbc-am-academy-owner.html','sbc-am-academy-media-v1.js','sbc-am-academy-recorder.html','sbc-am-academy-recorder-v1.js'])assert.equal(read('public/'+name),read('browser_public/'+name));
 assert.match(read('public/sbc-am-academy-v1.js'),/SBC_ACADEMY_VIDEO\?\.render/);
 assert.match(read('public/sbc-am-academy-owner.html'),/sbc-am-academy-recorder.html/);
});

test('media hub presents video, audio, screenshot gallery, seek/speed, captions and full screen controls',async()=>{
 const dom=new JSDOM(read('public/sbc-am-academy.html'),{url:'https://academy.test/sbc-am-academy.html',runScripts:'outside-only'});
 const w=dom.window,d=w.document;w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};w.HTMLMediaElement.prototype.play=()=>Promise.resolve();
 const looked=[];w.fetch=async(url,opts)=>{looked.push(url);let mime='text/html';if(url.endsWith('.webm'))mime=url.includes('-audio.')?'audio/webm':'video/webm';if(url.endsWith('.vtt'))mime='text/vtt';if(url.endsWith('-01.webp'))mime='image/webp';return {ok:mime!=='text/html',headers:{get:()=>mime}};};
 w.eval(read('public/sbc-am-academy-media-v1.js'));
 await w.SBC_ACADEMY_VIDEO.render('am-03','en');
 assert.equal(d.getElementById('academyRecording').hidden,false);
 assert.equal(d.getElementById('academyAudioRecording').hidden,false);
 assert.equal(d.querySelectorAll('#academyPhotoGallery figure').length,1);
 assert.equal(d.getElementById('academyVideoCaptions').hidden,false);
 d.getElementById('academyModePhotos').click();
 assert.equal(d.getElementById('academyPhotosPane').hidden,false);
 assert.equal(d.getElementById('academyVideoPane').hidden,true);
 assert.equal(d.getElementById('academyAvControls').hidden,true);
 d.getElementById('academyModeAudio').click();
 assert.equal(d.getElementById('academyAvControls').hidden,false);
 const audio=d.getElementById('academyAudioRecording');audio.currentTime=20;
 d.getElementById('academyMediaForward').click();assert.equal(audio.currentTime,30);
 d.getElementById('academyMediaRewind').click();assert.equal(audio.currentTime,20);
 d.getElementById('academyMediaSpeed').value='1.5';
 d.getElementById('academyMediaSpeed').dispatchEvent(new w.Event('change'));
 assert.equal(audio.playbackRate,1.5);
 d.getElementById('academyModeVideo').click();d.getElementById('academyVideoCaptions').click();
 assert.equal(d.getElementById('academyVideoCaptions').getAttribute('aria-pressed'),'false');
 assert(looked.some(u=>u.endsWith('am-03-en-01.webp')));
 dom.window.close();
});
test('each lesson provides narration fallback without inventing missing screen recordings or screenshots',async()=>{
 const dom=new JSDOM(read('public/sbc-am-academy.html'),{url:'https://academy.test/sbc-am-academy.html',runScripts:'outside-only'});
 const w=dom.window,d=w.document;w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};
 w.fetch=async()=>({ok:false,headers:{get:()=> 'text/html'}});
 w.eval(read('public/sbc-am-academy-media-v1.js'));
 await w.SBC_ACADEMY_VIDEO.render('am-12','es');
 assert.equal(d.getElementById('academyRecording').hidden,true);
 assert.equal(d.getElementById('academyAudioRecording').hidden,true);
 assert.equal(d.querySelectorAll('#academyPhotoGallery img').length,0);
 assert.match(d.getElementById('academyPhotosStatus').textContent,/aún no hay capturas reales/i);
 assert.match(d.getElementById('academyAudioStatus').textContent,/Narrar/);
 assert.equal(d.getElementById('academyAvControls').hidden,true);
 assert.equal(d.getElementById('playScene').textContent.includes('Narrate'),true);
 dom.window.close();
});

test('recorder exports actual workstation stills and optional microphone-only audio for a lesson',()=>{
 const dom=new JSDOM(read('public/sbc-am-academy-recorder.html'),{url:'https://academy.test/sbc-am-academy-recorder.html',runScripts:'outside-only'});
 dom.window.eval(read('public/sbc-am-academy-recorder-v1.js'));
 const d=dom.window.document,r=dom.window.SBC_ACADEMY_RECORDER;
 assert.equal(d.getElementById('captureStill').disabled,true);
 assert.equal(d.getElementById('downloadAudio').disabled,true);
 assert.equal(r.screenshotName(1),'am-01-en-01.webp');
 assert.equal(r.screenshotName(4),'am-01-en-04.webp');
 d.getElementById('lessonSelect').value='am-07';d.getElementById('languageSelect').value='es';
 assert.equal(r.screenshotName(2),'am-07-es-02.webp');
 assert.match(read('public/sbc-am-academy-recorder-v1.js'),/canvas\.toBlob/);
 assert.match(read('public/sbc-am-academy-recorder-v1.js'),/new MediaRecorder\(microphone/);
 dom.window.close();
});

test('synthetic Academy lesson media never masquerades as authentic employee screen recordings',async()=>{
 const receipt=JSON.parse(read('public/academy-media/academy360/AUTO_GENERATED_MANIFEST.json'));
 assert.equal(receipt.syntheticOnly,true);
 assert.equal(receipt.authenticatedEmployeeRecording,false);
 for(const lang of ['en','es']){
  const dom=new JSDOM(read('public/sbc-am-academy.html'),{url:'https://academy.test/sbc-am-academy.html',runScripts:'outside-only'});
  const w=dom.window,d=w.document;
  w.HTMLMediaElement.prototype.pause=()=>{};
  w.HTMLMediaElement.prototype.load=()=>{};
  w.fetch=async url=>{
   const mime=String(url).endsWith('.mp4')?'video/mp4':String(url).endsWith('.webp')?'image/webp':'text/html';
   return {ok:mime!=='text/html',headers:{get:()=>mime}};
  };
  w.eval(read('public/sbc-am-academy-media-v1.js'));
  await w.SBC_ACADEMY_VIDEO.render('am-01',lang);
  const status=d.getElementById('academyVideoStatus').textContent;
  const gallery=d.getElementById('academyPhotosStatus').textContent;
  const photo=d.querySelector('#academyPhotoGallery figcaption');
  assert(photo,'synthetic still was not rendered');
  assert.match(status,/simulat|simulad/i,'video explicitly labeled as simulated');
  assert.match(gallery,/simulat|simulad/i,'gallery explicitly labeled as simulated');
  assert.match(photo.textContent,/simulat|simulad/i,'individual still explicitly labeled as simulated');
  assert.doesNotMatch(photo.textContent,/\\breal\\b|verified|verificad/i,'synthetic still falsely called authentic');
  assert.match(status,/authentic|auténtic|original/i,'real employee capture remains pending');
  dom.window.close();
 }
 assert.equal(read('public/sbc-am-academy-media-v1.js'),read('browser_public/sbc-am-academy-media-v1.js'));
});

test('Spanish playback errors are localized and inactive media failure does not interrupt photo review',async()=>{
 const dom=new JSDOM(read('public/sbc-am-academy.html'),{url:'https://academy.test/sbc-am-academy.html',runScripts:'outside-only'});
 const w=dom.window,d=w.document;
 try{
  w.HTMLMediaElement.prototype.pause=()=>{};w.HTMLMediaElement.prototype.load=()=>{};
  w.fetch=async url=>{const mime=url.endsWith('.webm')?(url.includes('-audio.')?'audio/webm':'video/webm'):'text/html';return {ok:mime!=='text/html',headers:{get:()=>mime}};};
  w.eval(read('public/sbc-am-academy-media-v1.js'));
  await w.SBC_ACADEMY_VIDEO.render('am-01','es');
  d.getElementById('academyModePhotos').click();
  d.getElementById('academyAudioRecording').dispatchEvent(new w.Event('error'));
  assert.equal(d.getElementById('academyPhotosPane').hidden,false);
  assert.match(d.getElementById('academyAudioStatus').textContent,/audio no disponible/i);
  d.getElementById('academyModeVideo').click();
  d.getElementById('academyRecording').dispatchEvent(new w.Event('error'));
  assert.match(d.getElementById('academyVideoStatus').textContent,/no se pudo reproducir/i);
  assert.equal(d.getElementById('academyPhotosPane').hidden,false);
  assert.equal(d.getElementById('clearNarration').hidden,false);
 }finally{dom.window.close();}
});

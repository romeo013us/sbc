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
 assert.match(d.getElementById('academyVideoStatus').textContent,/Todavía no/);
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

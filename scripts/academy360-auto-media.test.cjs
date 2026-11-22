'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const m=require('./academy360-auto-media.cjs');
test('automated media builds 24 bilingual clips from 12 actual Academy modules',()=>{
 const lessons=m.plan();
 assert.equal(lessons.length,24);
 assert.equal(new Set(lessons.map(x=>x.id)).size,12);
 for(const lesson of lessons){assert.equal(lesson.phrases.length,4);assert.equal(lesson.scenes.length,4);assert(lesson.phrases.every(v=>v.length>=15));}
 assert.deepEqual(new Set(lessons.map(x=>x.lang)),new Set(['en','es']));
});
test('isolated training server has no mutation endpoints',()=>{
 let status,payload;
 m.api({method:'POST'},{writeHead:s=>{status=s},end:s=>{payload=JSON.parse(s)}},'/api/v6606/crm/account-portfolios/TRAINING-001/note');
 assert.equal(status,403);assert.equal(payload.error,'TRAINING_MUTATIONS_FORBIDDEN');
});
test('synthetic examples never include real customers or live numbers',()=>{
 assert(m.fakeAccounts.every(a=>a.id.startsWith('TRAINING-')&&a.phone.includes('NO REAL NUMBER')));
 let result;
 m.api({method:'GET'},{writeHead(){},end:s=>{result=JSON.parse(s)}},'/api/me');
 assert.equal(result.user.role,'account_manager');
 assert.equal(result.user.id,'academy-test');
});
test('English/Spanish narrations have captions and increasing timecodes',()=>{
 const tracks=m.makeVtt(['One actual UI','Two fictional scenarios','Three permission boundaries','Four owner approval rules'],[14,14,14,14]);
 assert.match(tracks,/WEBVTT/);
 assert.match(tracks,/00:00:42.000/);
 assert.match(tracks,/Four owner approval rules/);
 assert.throws(()=>m.makeVtt(['wrong'],[14]),/INVALID_CAPTION_STORY/);
});
test('source capture explicitly refuses an employee-authenticated/live-state recording claim',()=>{
 const fs=require('node:fs'),p=require('node:path');
 const source=fs.readFileSync(p.join(__dirname,'academy360-auto-media.cjs'),'utf8');
 assert.match(source,/authenticatedEmployeeRecording:false/);
 assert.match(source,/AUTOMATED TRAINING SIMULATIONS/);
 assert.match(source,/127\.0\.0\.1/);
 assert(!source.includes('https://tyvrqnjz57'));
});

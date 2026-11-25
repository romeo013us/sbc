'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const E=require('../enterprise/sbc-social-asset-engine.cjs');
const logo=fs.readFileSync(path.join(__dirname,'../public/assets/sbc-logo.jpg'));
test('Eastern slots span both DST changes, two per local day',()=>{
 for(const date of ['2026-03-07','2026-10-31']){
  const slots=E.slots(date);
  assert.equal(slots.length,14);
  assert.equal(new Set(slots.map(s=>s.key)).size,14);
  assert.deepEqual(slots.map(s=>s.hour),Array.from({length:14},(_,i)=>i%2?22:10));
  for(const s of slots)assert.equal(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',hourCycle:'h23'}).format(new Date(s.at)),String(s.hour));
 }
 assert.throws(()=>E.slots('2026-02-31'));
});
test('exact and perceptual duplicate rejection and malformed history fail closed',()=>{
 const row={sha256:'a'.repeat(64),dhash:'0000000000000000'};
 assert.equal(E.duplicate(row,[row]),true);
 assert.equal(E.duplicate({sha256:'b'.repeat(64),dhash:'000000000000003f'},[row]),true);
 assert.equal(E.duplicate({sha256:'b'.repeat(64),dhash:'000000000000007f'},[row]),false);
 assert.throws(()=>E.duplicate(row,[{sha256:'invalid'}]));
 assert.equal(E.dhash(Buffer.from(Array.from({length:72},(_,i)=>255-(i%9)*20))),'ffffffffffffffff');
});
test('rendered PNG inventory is deterministic, contains six pillars and rejects near duplicates',()=>{
 const first=E.generate({startDay:'2026-11-26',logo});
 const second=E.generate({startDay:'2026-11-26',logo});
 assert.equal(first.length,14);
 assert.equal(new Set(first.map(r=>r.service)).size,6);
 assert.deepEqual(first.map(r=>r.sha256),second.map(r=>r.sha256));
 for(let i=0;i<first.length;i++){
  const r=first[i];assert.equal(r.state,'DRAFT');assert.equal(r.png.readUInt32BE(16),r.width);assert.equal(r.png.readUInt32BE(20),r.height);
  assert.equal(E.duplicate(r,first.slice(0,i)),false);
 }
 assert.deepEqual(new Set(first.map(r=>r.width+'x'+r.height)),new Set(['1080x1080','1200x630']));
});
test('local manifest keeps draft separate from approved, survives restart and rejects tampering',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-art-'));
 try{
  const rows=E.generate({startDay:'2026-11-26',logo});
  E.stage(dir,rows);
  assert.equal(E.inventory(dir).approved,0);
  E.approve(dir,rows[0].sha256);
  assert.equal(E.inventory(dir).approved,1);
  assert.equal(E.inventory(dir).low,true);
  fs.appendFileSync(path.join(dir,rows[0].sha256+'.png'),'tampered');
  assert.throws(()=>E.inventory(dir),/ASSET_INTEGRITY/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('only provider-confirmed rejection permits retries; ambiguous sends reconcile',()=>{
 assert.equal(E.retry({attempt:0,outcome:'REJECTED_TRANSIENT',status:429}).delayMs,60000);
 assert.equal(E.retry({attempt:1,outcome:'REJECTED_TRANSIENT',status:503}).delayMs,300000);
 assert.equal(E.retry({attempt:2,outcome:'REJECTED_TRANSIENT',status:503}).delayMs,900000);
 assert.equal(E.retry({attempt:3,outcome:'REJECTED_TRANSIENT',status:503}).action,'OWNER_REVIEW');
 assert.equal(E.retry({attempt:0,outcome:'UNKNOWN',status:503}).action,'RECONCILE');
 assert.equal(E.retry({attempt:0,outcome:'REJECTED_TRANSIENT',status:429,retryAfterMs:120000}).delayMs,120000);
});

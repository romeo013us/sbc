'use strict';
/*
 * SBC V66.115: fix an actual release contract mismatch.
 * In the published no-DDL advisory code, the CSV-only Dropzone watcher was
 * opt-in even though the release script asserted default-on by looking at a
 * different occurrence in server.js.
 *
 * This transformer runs only on the disposable GoDaddy CI staging checkout.
 * Writer lease, recovered database, single-tenant check, no outgoing contact,
 * and disabled automatic demos remain unchanged.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const MARK='SBC_V66110_DDL_FREE_DROPZONE_ONLY_LAUNCH';
const OLD="if(String(process.env.SBC_AUTOPILOT_DROPZONE_ENABLED||'').trim().toLowerCase()==='true'){";
const NEW="if(String(process.env.SBC_AUTOPILOT_DROPZONE_ENABLED||'true').trim().toLowerCase()!=='false'){";
const OLD_LOG="dropzone watcher held until explicit SBC_AUTOPILOT_DROPZONE_ENABLED=true";
const NEW_LOG="dropzone watcher explicitly disabled by SBC_AUTOPILOT_DROPZONE_ENABLED=false";
function boundary(s){
 const begin=s.indexOf('// '+MARK);
 const end=s.indexOf('  await pulse();',begin);
 assert(begin>=0&&end>begin,'no-DDL dropzone startup block absent');
 return {begin,end,block:s.slice(begin,end)};
}
function patch(s){
 const b=boundary(s);
 const occurrences=(b.block.match(/SBC_AUTOPILOT_DROPZONE_ENABLED\|\|/g)||[]).length;
 assert.equal(occurrences,1,'expected one no-DDL Dropzone configuration switch');
 if(b.block.includes(NEW)){
  assert(!b.block.includes(OLD),'conflicting no-DDL Dropzone switch');
  return s;
 }
 assert(b.block.includes(OLD),'unrecognized no-DDL Dropzone switch; refuse blind patch');
 assert(b.block.includes(OLD_LOG),'existing operator message mismatch');
 let next=b.block.replace(OLD,NEW).replace(OLD_LOG,NEW_LOG);
 return s.slice(0,b.begin)+next+s.slice(b.end);
}
function verify(s){
 const {block}=boundary(s);
 assert(block.includes(NEW),'no-DDL Dropzone startup must default to healthy-writer intake');
 assert(!block.includes(OLD),'legacy opt-in switch must not survive');
 assert(block.includes('autoDemo:false,autoOutbound:false'),'do not enable demos or outgoing contact');
 assert(s.includes('!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady'),'database recovery/lease must still be checked');
 assert(s.includes('if(!Array.isArray(rows)||rows.length!==1)'),'single-tenant scope must remain enforced');
 return true;
}
if(require.main===module){
 const filename=path.resolve(__dirname,'..','server.js');
 const source=fs.readFileSync(filename,'utf8');
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66115_ISOLATED_STAGE!=='YES')throw Error('SBC_V66115_REFUSE_NON_DISPOSABLE_STAGE');
  const next=patch(source);verify(next);assert.equal(patch(next),next,'patch not idempotent');
  if(next!==source)fs.writeFileSync(filename,next);
  console.log('[SBC V66.115] STAGED: no-DDL Dropzone default-on on verified, healthy writer');
 }else if(process.argv.includes('--verify-staged')){
  verify(source);console.log('[SBC V66.115] VERIFIED: exact no-DDL Dropzone startup condition');
 }else{
  const candidate=patch(source);verify(candidate);
  console.log('[SBC V66.115] DRY RUN PASS (source unchanged)');
 }
}
module.exports={patch,verify,OLD,NEW};

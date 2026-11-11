'use strict';
/* SBC V66.157 — isolated GoDaddy runtime patch. Source release server.js and
 * its pinned receipts are immutable until the staged compiler verifies them.
 * Preserve HR drafts, payroll preference proposals and owner review history.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66157_HR_LEDGER_RETENTION';
const BASE_V9='function v9save(v){db.settings.v9=v;return saveData()}';
const NEW_V9="function v9save(v){ /* "+MARK+" */ const prior=db.settings.v9||{};db.settings.v9={...prior,...v};try{return Promise.resolve(saveData()).catch(e=>{db.settings.v9=prior;throw e})}catch(e){db.settings.v9=prior;throw e}}";
const BASE_HR='  const committed=await v9save({...v,hrOps:{drafts:ops.drafts.slice(0,200),\n   preferences:ops.preferences,reviewLog:ops.reviewLog.slice(0,300)}});';
const NEW_HR='  const committed=await v9save({...v,hrOps:{drafts:[...ops.drafts],\n   preferences:{...ops.preferences},reviewLog:[...ops.reviewLog]}});';
function once(src,oldText,newText,label){
 const count=src.split(oldText).length-1;
 if(count!==1)throw Error(MARK+': '+label+' anchor expected once, got '+count);
 return src.replace(oldText,newText);
}
function patchServer(source){
 if(typeof source!=='string'||!source)throw Error(MARK+': server source required');
 if(source.includes(MARK)){
  if(!source.includes(NEW_HR)||!source.includes(NEW_V9))throw Error(MARK+': partial applied patch');
  return source;
 }
 let src=once(source,BASE_V9,NEW_V9,'workforce-v9 save');
 src=once(src,BASE_HR,NEW_HR,'HR-ledger save');
 return src;
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),src=fs.readFileSync(file,'utf8'),next=patchServer(src);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66157_ISOLATED_STAGE!=='YES')throw Error('HR_LEDGER_DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(file,next);
 }
 if(process.argv.includes('--verify-staged')&&next!==src)throw Error('HR_LEDGER_GUARDS_NOT_STAGED');
 console.log('[SBC V66.157] HR ledger retention '+(src===next?'PRESENT':'STAGING_READY'));
}
module.exports={patchServer,MARK};

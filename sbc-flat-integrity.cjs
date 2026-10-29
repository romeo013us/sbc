'use strict';
// SBC V66 clean deployment: verify all packaged application code and assets.
// Fail closed on missing, substituted or partially-extracted release files.
// Does not read/modify MySQL, session files, backups or persistent data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function digest(b){return crypto.createHash('sha256').update(b).digest('hex');}
function verifyFlatIntegrity(root,release){
 const file=path.join(root,'SBC-FLAT-FILE-INVENTORY.json');
 const bytes=fs.readFileSync(file);
 if(digest(bytes)!==release.inventorySha256)
  throw Error('[SBC FLAT INTEGRITY] manifest hash mismatch; mixed/incomplete deployment');
 const m=JSON.parse(bytes.toString('utf8'));
 if(m.schema!==1||m.version!==release.version||m.sourceFingerprint!==release.sourceFingerprint||
    !Array.isArray(m.files)||m.files.length<200||m.files.length>5000)
  throw Error('[SBC FLAT INTEGRITY] malformed source-bound inventory');
 let total=0;
 const seen=new Set();
 for(const item of m.files){
  const rel=item.path;
  if(typeof rel!=='string'||!rel||rel.startsWith('/')||rel.includes('\\')||
     rel.split('/').some(s=>!s||s==='.'||s==='..')||seen.has(rel)||
     /^(?:data|backups|sbc-persistent|node_modules|\.git)\//.test(rel)||
     !/^[a-f0-9]{64}$/.test(item.sha256||'')||
     !Number.isSafeInteger(item.size)||item.size<0||item.size>50*1024*1024)
   throw Error('[SBC FLAT INTEGRITY] unsafe inventory entry');
  seen.add(rel);
  const target=path.join(root,rel);
  let actual;
  try{actual=fs.readFileSync(target);}
  catch{throw Error('[SBC FLAT INTEGRITY] required packaged file missing: '+rel);}
  if(actual.length!==item.size)
   throw Error('[SBC FLAT INTEGRITY] wrong packaged file type/size: '+rel);
  if(digest(actual)!==item.sha256)
   throw Error('[SBC FLAT INTEGRITY] packaged file altered: '+rel);
  total+=item.size;
  if(total>256*1024*1024)throw Error('[SBC FLAT INTEGRITY] release size exceeds limit');
 }
 for(const required of ['server.js','package.json','bootstrap.js','sbc-godaddy-flat-entrypoint.cjs',
                         'sbc-flat-integrity.cjs','persistent-state.js',
                         'tenant-rejection-guard.js','runtime-env-beacon.js',
                         'public/index.html','public/app.js','browser_public/index.html']){
  if(!seen.has(required))throw Error('[SBC FLAT INTEGRITY] critical runtime asset not pinned: '+required);
 }
 console.log('[SBC FLAT INTEGRITY] PASS source='+release.sourceCommit.slice(0,12)+' files='+seen.size+' bytes='+total);
 return {ok:true,files:seen.size};
}
module.exports={verifyFlatIntegrity};
if(require.main===module)verifyFlatIntegrity(__dirname,require('./SBC-FLAT-RELEASE-IDENTITY.json'));

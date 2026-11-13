'use strict';
// Fail closed on accidental frontend drift while the V66 master publisher requires
// both public/ and browser_public/. These are intentional exemptions, not a
// declaration that browser_public/ is safe to delete from the current release.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const INTENTIONAL_PUBLIC_ONLY=new Set([
 'lead-research-import-core.js','lead-research.css','lead-research.js',
 'sbc-crm-cleanup-preview.js','sbc-demo-interactive-v1.js',
 'sbc-lorna-queue-filter-v66105.js','sbc-research-lesson-reader.js',
 'sbc-role-shift-plan.js','sbc-workforce-academy-v6697.css'
]);
const INTENTIONAL_BROWSER_ONLY=new Set(['kim-os-v326.css','kim-os-v326.js']);
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function filesUnder(root){
 const found=new Map();
 function scan(folder,prefix=''){
  for(const d of fs.readdirSync(folder,{withFileTypes:true})){
   const relative=prefix?prefix+'/'+d.name:d.name;
   const full=path.join(folder,d.name);
   if(d.isSymbolicLink())throw Error('unexpected symlink in frontend assets: '+relative);
   if(d.isDirectory())scan(full,relative);
   else if(d.isFile())found.set(relative,full);
   else throw Error('unexpected file type in frontend assets: '+relative);
  }
 }
 scan(root);
 return found;
}
function verifyStaticMirrors(base,options={}){
 const required=Number.isInteger(options.minimumShared)?options.minimumShared:220;
 const a=filesUnder(path.join(base,'public'));
 const b=filesUnder(path.join(base,'browser_public'));
 const drift=[],unexpected=[];
 let mirrored=0;
 for(const [name,file] of a){
  if(!b.has(name)){
   if(!INTENTIONAL_PUBLIC_ONLY.has(name))unexpected.push('public only: '+name);
   continue;
  }
  mirrored++;
  if(digest(file)!==digest(b.get(name)))drift.push(name);
 }
 for(const name of b.keys()){
  if(!a.has(name)&&!INTENTIONAL_BROWSER_ONLY.has(name))unexpected.push('browser_public only: '+name);
 }
 if(mirrored<required)throw Error('Frontend mirror incomplete: '+mirrored+' shared, required '+required);
 if(drift.length||unexpected.length){
  throw Error('Frontend static mirror drift/unmirrored exceptions: drift='+JSON.stringify(drift.slice(0,15))+
    ' unmirrored='+JSON.stringify(unexpected.slice(0,15)));
 }
 return {mirrored,drift,unexpected,intentionalPublicOnly:[...a.keys()].filter(n=>!b.has(n)).length,
  intentionalBrowserOnly:[...b.keys()].filter(n=>!a.has(n)).length};
}
if(require.main===module){
 const result=verifyStaticMirrors(path.resolve(__dirname,'..'));
 console.log('[SBC V66 STATIC MIRROR] PASS '+JSON.stringify(result));
}
module.exports={verifyStaticMirrors};

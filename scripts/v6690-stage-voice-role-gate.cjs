'use strict';
// SBC V66.90: insert a caller-role guard into the disposable compiled server,
// never the pinned source server or Published MySQL state.
// The release workflow regenerates source identity, manifest and receipt AFTER
// this transform; do not bypass either integrity check.
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V6690_VOICE_ROLE_GATE';
const ROUTES=Object.freeze([
  "app.get('/api/voice/status',auth,(req,res)=>{",
  "app.get('/api/voice/token',auth,(req,res)=>{",
  "app.get('/api/voice/logs',auth,(req,res)=>{",
  "app.post('/api/voice/log',auth,async(req,res)=>{"
]);
const ROLE_GUARD="/* "+MARK+" */const role=String(req.user?.role||'').trim().toLowerCase();if(!['owner','manager','caller'].includes(role))return res.status(403).json({ok:false,error:'VOICE_CALLER_ROLE_REQUIRED'});";
function patchServer(input){
 let source=String(input||'');
 for(const anchor of ROUTES){
  const occurrences=source.split(anchor).length-1;
  if(occurrences!==1)throw Error('VOICE_ROLE_ANCHOR_NOT_UNIQUE '+anchor+' count='+occurrences);
  const originalIndex=source.indexOf(anchor);
  const after=source.slice(originalIndex+anchor.length,originalIndex+anchor.length+ROLE_GUARD.length);
  if(after===ROLE_GUARD)continue; // legitimate repeat stage invocation
  if(after.includes(MARK))throw Error('VOICE_ROLE_PATCH_CONFLICT '+anchor);
  source=source.replace(anchor,anchor+ROLE_GUARD);
 }
 if(source.split(MARK).length-1!==4)throw Error('VOICE_ROLE_GUARD_COUNT_FAILED');
 return source;
}
function inspectSource(source){
 const result={};
 for(const anchor of ROUTES){const i=String(source).indexOf(anchor);result[anchor]=i>=0 && String(source).slice(i+anchor.length,i+anchor.length+ROLE_GUARD.length)===ROLE_GUARD;}
 return result;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),server=path.join(root,'server.js'),src=fs.readFileSync(server,'utf8');
 const transformed=patchServer(src);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V6690_ISOLATED_STAGE!=='YES')throw Error('VOICE_ROLE_STAGE_ONLY: SBC_V6690_ISOLATED_STAGE=YES required');
  fs.writeFileSync(server,transformed,'utf8');
  console.log('[SBC V66.90] Four voice routes role-gated in disposable staged server; regenerate verified identity/receipt before distribution');
 }else console.log('[SBC V66.90] Read-only patch compatibility verified; no source file changed');
}
module.exports={patchServer,inspectSource,ROUTES,ROLE_GUARD,MARK};

'use strict';
/* SBC V66.105 — permit only the existing researcher-owned notice resolution API.
 * The existing server handler still validates tenant, assigned/researcher owner,
 * current source completeness, role, MySQL write and durable readback. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66105_RESEARCH_NOTICE_ALLOWED';
const ANCHOR=String.raw`if(/^\/api\/v9\/lead-verification\/[^/]+$/.test(p))return m==='POST';`;
const EXTRA=String.raw` if(m==='POST'&&/^\/api\/v9\/lead-verification\/[^/]+\/resolve-notice$/.test(p))return true; // SBC_V66105_RESEARCH_NOTICE_ALLOWED
`;
function patchServer(input){
 const source=String(input||'');
 if(source.includes(MARK))return source;
 if(source.split(ANCHOR).length!==2)throw Error('SBC_V66105_RESEARCH_ROLE_ANCHOR_CHANGED');
 if(!source.includes("app.post('/api/v9/lead-verification/:id/resolve-notice',auth,"))
  throw Error('SBC_V66105_NOTICE_ROUTE_MISSING');
 return source.replace(ANCHOR,ANCHOR+'\n'+EXTRA.trimEnd());
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),before=fs.readFileSync(file,'utf8'),after=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66105_ISOLATED_STAGE!=='YES')throw Error('SBC_V66105_STAGE_ONLY');
  fs.writeFileSync(file,after,'utf8');
  console.log('[SBC V66.105] Scoped researcher notice action allowed in disposable staged release; no other role grants');
 }else console.log('[SBC V66.105] Research notice role patch verified; no writes');
}
module.exports={MARK,patchServer};

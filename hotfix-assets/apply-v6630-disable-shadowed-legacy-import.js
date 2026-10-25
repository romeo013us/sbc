'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6630_DISABLE_SHADOWED_LEGACY_CSV_IMPORT';
function apply(root){
 const p=path.join(root,'server.js');let s=fs.readFileSync(p,'utf8');
 if(s.includes(MARKER))throw Error(MARKER+': already applied');
 const old="app.post('/api/crm/leads/import',auth,async(req,res)=>{";
 const modern="app.post('/api/crm/leads/import',auth,ownerOnly,async(req,res)=>{";
 if(s.split(old).length!==2)throw Error(MARKER+': legacy handler not uniquely present');
 if(s.split(modern).length!==2)throw Error(MARKER+': modern owner-only preview handler not uniquely present');
 const lines=s.split('\n'),line=lines.findIndex(x=>x.startsWith(old));
 if(line<0||!lines[line].includes('res.json({added,skipped});});')||!lines[line].includes('await saveData()'))throw Error(MARKER+': legacy route shape changed, refusal');
 if(s.indexOf(old)>s.indexOf(modern))throw Error(MARKER+': unexpected handler order');
 lines[line]='// '+MARKER+': Removed legacy duplicate POST /api/crm/leads/import that wrote records on preview and returned only {added,skipped}.';
 s=lines.join('\n');
 if(s.includes(old)||s.split(modern).length!==2)throw Error(MARKER+': import routes not exclusive');
 if(!s.includes("code:'SBC_IMPORT_WRITE_LOCKED'")||!s.includes('requireRequestTenant(req)')||!s.includes('sbcWriterLeaseReady'))throw Error(MARKER+': writer/recovery/tenant gates missing');
 fs.writeFileSync(p,s);
 return {marker:MARKER,activeImportRoutes:1,legacyMutatingPreviewRemoved:true,newHandlerOwnerOnly:true,crmWrites:false};
}
module.exports={apply,MARKER};
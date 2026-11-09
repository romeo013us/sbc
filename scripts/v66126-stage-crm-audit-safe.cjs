'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),FILE=path.join(ROOT,'server.js');
const MARK='SBC_V66126_CRM_AUDIT_NO_SILENT_DELETE';
function once(s,needle,replacement) {
 assert.equal(s.split(needle).length-1,1,'SBC V66126 exact server anchor absent or ambiguous');
 return s.replace(needle,replacement);
}
function patchServer(source){
 if(source.includes(MARK)){
  assert(source.includes('SBC_V66126_AUDIT.preview(db.customers')&&
    source.includes('const leadAudit=auditLeadPool({dedupe:false,rate:true});'),
    'partial read-only CRM audit patch');
  return source;
 }
 let s=once(source,
   '// SBC_V6630_DISABLE_SHADOWED_LEGACY_CSV_IMPORT:',
   '/* '+MARK+' */\nconst SBC_V66126_AUDIT=require(\'./enterprise/v66126-crm-audit-preview.cjs\');\n// SBC_V6630_DISABLE_SHADOWED_LEGACY_CSV_IMPORT:');
 const before=[
  "app.post('/api/crm/leads/audit',auth,async(req,res)=>{",
  "  if(!['owner','manager','lead_researcher'].includes(req.user.role))return res.status(403).json({error:'Lead research access required.'});",
  "  const result=auditLeadPool({dedupe:req.body?.dedupe!==false,rate:req.body?.rate!==false});",
  "  await saveData();",
  "  res.json(result);",
  "});"
 ].join('\n');
 const after=[
  "app.post('/api/crm/leads/audit',auth,async(req,res)=>{",
  "  if(!['owner','manager','lead_researcher'].includes(req.user.role))return res.status(403).json({error:'Lead research access required.'});",
  "  // The old API silently deleted/merged starter leads. All legacy callers now",
  "  // receive a scoped, read-only audit regardless of dedupe/rate body flags.",
  "  res.setHeader('Cache-Control','no-store');",
  "  try{",
  "   const result=SBC_V66126_AUDIT.preview(db.customers,requireRequestTenant(req),{includeIds:req.user.role==='owner'});",
  "   return res.json(result);",
  "  }catch(e){return res.status(403).json({ok:false,error:'CRM_AUDIT_TENANT_REQUIRED',readOnly:true});}",
  "});"
 ].join('\n');
 s=once(s,before,after);
 s=once(s,'const leadAudit=auditLeadPool({dedupe:true,rate:true});',
    'const leadAudit=auditLeadPool({dedupe:false,rate:true}); // V66.126: preserve original CRM rows at startup');
 return s;
}
if(require.main===module){
 const original=fs.readFileSync(FILE,'utf8'),out=patchServer(original);
 assert.equal(patchServer(out),out,'CRM audit patch must be idempotent');
 if(process.argv.includes('--verify-staged'))assert.equal(original,out,'compiled release missing V66.126');
 else if(process.argv.includes('--apply')){
  if(process.env.SBC_V66126_ISOLATED_STAGE!=='YES')throw new Error('CRM_AUDIT_DISPOSABLE_STAGE_REQUIRED');
  fs.writeFileSync(FILE,out);
 }
 console.log('[SBC V66.126] PASS read-only tenant CRM audit; no startup dedupe');
}
module.exports={MARK,patchServer};

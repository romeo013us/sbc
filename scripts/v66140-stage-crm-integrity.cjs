'use strict';
/* SBC V66.140 isolated stage-only CRM integrity gate. Never mutate pinned source. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66140_CORRUPT_CRM_TEXT_GATE';
const WORKFORCE_MARK='SBC_WORKFORCE_CRM_TEXT_GATE';
const WORKFORCE_TENANT_MARK='SBC_WORKFORCE_LEAD_TENANT_SCOPE';
const WORKFORCE_ROUTES=[
 "app.post('/api/workforce/leads',auth,async(req,res)=>{",
 "app.post('/api/v9/lead-verification/:id',auth,async(req,res)=>{",
 "app.put('/api/workforce/leads/:id',auth,async(req,res)=>{"
];
function once(s,needle,replacement,label){
 const count=s.split(needle).length-1;
 if(count!==1)throw Error('V66140_ANCHOR_'+label+':'+count);
 return s.replace(needle,replacement);
}
function patchIntake(s){
 s=once(s,"app.post('/api/crm/leads/import',auth,ownerOnly,async(req,res)=>{",
 "app.post('/api/crm/leads/import',auth,ownerOnly,async(req,res)=>{/* "+MARK+" */const SBC_CRM_TEXT=require('./enterprise/crm-text-integrity-v66140.cjs');",
 'import-handler');
 s=once(s,
 " if(normalized.some(r=>!r.businessName))return res.status(400).json({ok:false,error:'Every row must include a business name.',invalidRows:normalized.filter(r=>!r.businessName).map(r=>r.row)});",
 " const textGate=SBC_CRM_TEXT.inspectBatch(normalized);if(!textGate.ok)return res.status(400).json({ok:false,code:'CORRUPT_CRM_TEXT_REJECTED',invalidRows:textGate.invalid,error:'Binary-looking or malformed lead text rejected. No rows imported.'});\n if(normalized.some(r=>!r.businessName))return res.status(400).json({ok:false,error:'Every row must include a business name.',invalidRows:normalized.filter(r=>!r.businessName).map(r=>r.row)});",
 'import-before-write');
 s=once(s,"app.post('/api/crm/inbound/:key',async(req,res)=>{",
 "app.post('/api/crm/inbound/:key',async(req,res)=>{const SBC_CRM_TEXT=require('./enterprise/crm-text-integrity-v66140.cjs');",
 'api-inbound');
 s=once(s,
 "if(!c.businessName&&!c.contactName)return res.status(400).json({error:'businessName or contactName required.'});",
 "const badText=SBC_CRM_TEXT.invalidFields(c);if(badText.length)return res.status(400).json({ok:false,code:'CORRUPT_CRM_TEXT_REJECTED',fields:badText,error:'Invalid lead text; no record saved.'});if(!c.businessName&&!c.contactName)return res.status(400).json({error:'businessName or contactName required.'});",
 'inbound-before-write');
 return s;
}
function patchWorkforceRoute(s,route){
 const start=s.indexOf(route);
 if(start<0||s.indexOf(route,start+route.length)>=0)throw Error('V66140_WORKFORCE_ROUTE_ANCHOR: '+route);
 const end=s.indexOf('\n});',start);
 if(end<0)throw Error('V66140_WORKFORCE_ROUTE_END: '+route);
 const source=s.slice(start,end);
 if(source.includes(WORKFORCE_MARK))return s;
 const declaration='  const b=req.body||{};';
 const guard=[
  declaration,
  '  /* '+WORKFORCE_MARK+' */',
  "  const badFields=require('./enterprise/crm-text-integrity-v66140.cjs').invalidFields(b);",
  "  if(badFields.length)return res.status(400).json({ok:false,code:'CORRUPT_CRM_TEXT_REJECTED',fields:badFields,error:'Unreadable lead text in '+badFields.join(', ')+'. Correct the fields and save again.'});"
 ].join('\n');
 return s.slice(0,start)+once(source,declaration,guard,'workforce-before-write')+s.slice(end);
}
function scopeWorkforceRecord(s,route){
 const start=s.indexOf(route);
 const end=s.indexOf('\n});',start);
 if(start<0||end<0)throw Error('V66140_WORKFORCE_SCOPE_ANCHOR: '+route);
 let source=s.slice(start,end);
 if(source.includes(WORKFORCE_TENANT_MARK))return s;
 const isLegacyEdit=route.startsWith('app.put(');
 const lookup="const c=(db.customers||[]).find(x=>String(x.id)===String(req.params.id));";
 const scoped="/* "+WORKFORCE_TENANT_MARK+" */\n  const tenantId=requireRequestTenant(req);\n"+
   "  const "+(isLegacyEdit?'record':'c')+"=(db.customers||[]).find(x=>String(x.id)===String(req.params.id) && Number(x.tenantId??x.tenant_id)===Number(tenantId));";
 source=once(source,lookup,scoped,'workforce-tenant-lookup');
 if(isLegacyEdit){
  source=once(source,"if(!c)return res.status(404).json({error:'Lead not found.'});",
   "if(!record)return res.status(404).json({error:'Lead not found.'});\n"+
   "  /* SBC_WORKFORCE_LEAD_EDIT_SERIAL */\n"+
   "  const lockKey=String(tenantId)+':'+String(req.params.id);\n"+
   "  const previous=SBC_WORKFORCE_LEAD_EDIT_TAILS.get(lockKey)||Promise.resolve();\n"+
   "  let release;const turn=new Promise(resolve=>{release=resolve;});\n"+
   "  const tail=previous.then(()=>turn);SBC_WORKFORCE_LEAD_EDIT_TAILS.set(lockKey,tail);\n"+
   "  await previous;\n  try{\n  const c={...record};",'workforce-edit-copy');
  source=once(source,'updated_at=? WHERE id=?','updated_at=? WHERE tenant_id=? AND id=?','workforce-tenant-update');
  source=once(source,'sqlDateTime(c.updatedAt),c.id]);','sqlDateTime(c.updatedAt),tenantId,c.id]);','workforce-tenant-update-parameters');
  source=once(source,"WHERE id=? LIMIT 1',[c.id]","WHERE tenant_id=? AND id=? LIMIT 1',[tenantId,c.id]",'workforce-tenant-readback');
  source=once(source,'  if(mysqlPool){',"  if(!mysqlPool)return res.status(503).json({ok:false,error:'CRM database unavailable.'});\n  try{",'workforce-durable-update-required');
  source=once(source,"  }\n  audit(req.user,'lead_updated',",
   "  }catch{ return res.status(503).json({ok:false,error:'Lead update could not be verified.'}); }\n"+
   "  Object.assign(record,c);\n  audit(req.user,'lead_updated',",'workforce-cache-after-readback');
  source+='\n  }finally{release();if(SBC_WORKFORCE_LEAD_EDIT_TAILS.get(lockKey)===tail)SBC_WORKFORCE_LEAD_EDIT_TAILS.delete(lockKey);}';
 }
 return s.slice(0,start)+source+s.slice(end);
}
function patchServer(input){
 let s=String(input||'');
 if(!s.includes(MARK))s=patchIntake(s);
 for(const route of WORKFORCE_ROUTES)s=patchWorkforceRoute(s,route);
 for(const route of [...WORKFORCE_ROUTES.slice(1),"app.get('/api/workforce/leads/:id',auth,async(req,res)=>{"]){
  s=scopeWorkforceRecord(s,route);
 }
 if(!s.includes('const SBC_WORKFORCE_LEAD_EDIT_TAILS=new Map();'))s=once(s,WORKFORCE_ROUTES[2],
  'const SBC_WORKFORCE_LEAD_EDIT_TAILS=new Map();\n'+WORKFORCE_ROUTES[2],'workforce-edit-lock-declaration');
 return s;
}
if(require.main===module){
 const file=path.resolve(__dirname,'../server.js'),before=fs.readFileSync(file,'utf8'),after=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66140_ISOLATED_STAGE!=='YES')throw Error('V66140_ISOLATED_STAGE_ONLY');
  fs.writeFileSync(file,after);console.log('SBC V66.140: staged CRM text gates');
 }else console.log('SBC V66.140 anchors validated; pinned source unchanged');
}
module.exports={MARK,patchServer};

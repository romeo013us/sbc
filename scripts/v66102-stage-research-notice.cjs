'use strict';
/* V66.102: stage read-only-friendly acknowledgement for already fixed research notices.
 * Never deletes, merges or alters the actual customer fields.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66102_RESEARCH_NOTICE_ACK';
function once(s,b,a,label){const n=s.split(b).length-1;if(n!==1)throw Error('V66102_'+label+'_'+n);return s.replace(b,a);}
function patchServer(input){
 let s=String(input||'');if(s.includes(MARK))return s;
 const endpoint="app.get('/api/v9/lead-verification',auth,(req,res)=>{";
 const route=[
 "// SBC_V66102_RESEARCH_NOTICE_ACK — owner/researcher resolution, no deletion.",
 "const SBC_V66102_RESEARCH_NOTICE=require('./enterprise/v66102-research-notice.cjs');",
 "app.post('/api/v9/lead-verification/:id/resolve-notice',auth,async(req,res)=>{",
 " const researcher=sbcLornaRole(req.user);",
 " if(!researcher&&req.user.role!=='owner')return res.status(403).json({ok:false,error:'NOTICE_RESOLUTION_ROLE_DENIED'});",
 " const tenantId=requireRequestTenant(req);",
 " const c=(db.customers||[]).find(x=>String(x.id)===String(req.params.id)&&Number(x.tenantId??x.tenant_id)===Number(tenantId));",
 " if(!c)return res.status(404).json({ok:false,error:'LEAD_NOT_FOUND_IN_TENANT'});",
 " if(researcher){",
 "  const owns=String(c.researcherId||c.leadIntelligence?.researchSubmittedBy||'')===String(req.user.id)",
 "    ||String(c.assignedTo||'')===String(req.user.id);",
 "  if(!owns||['customer','lost','do not call','dnc','closed','duplicate'].includes(String(c.status||'').trim().toLowerCase()))",
 "   return res.status(403).json({ok:false,error:'NOT_YOUR_RESEARCH_RECORD'});",
 " }",
 " const proof=SBC_V66102_RESEARCH_NOTICE.eligible(c);",
 " if(!proof.ok)return res.status(409).json({ok:false,error:proof.reason,message:'Fix the actual lead before clearing its correction notice.'});",
 " if(SBC_V66102_RESEARCH_NOTICE.resolved(c))return res.json({ok:true,resolved:true,alreadyResolved:true,deleted:false});",
 " if(!mysqlPool)return res.status(503).json({ok:false,error:'MYSQL_REQUIRED_FOR_DURABLE_NOTICE_RESOLUTION'});",
 " const at=now(),notice=SBC_V66102_RESEARCH_NOTICE.markResolved(c,req.user.id,at);",
 " const nextIntel={...(c.leadIntelligence||{}),researchNotice:notice};",
 " try{",
 "  const [updated]=await mysqlPool.query('UPDATE sbc_customers SET lead_intelligence_json=?, updated_at=? WHERE id=? AND tenant_id=?',",
 "   [JSON.stringify(nextIntel),sqlDateTime(at),c.id,tenantId]);",
 "  if(Number(updated.affectedRows)!==1)return res.status(409).json({ok:false,error:'NO_DURABLE_LEAD_MATCH'});",
 "  const [rows]=await mysqlPool.query('SELECT lead_intelligence_json FROM sbc_customers WHERE id=? AND tenant_id=? LIMIT 1',[c.id,tenantId]);",
 "  const persisted=rows?.[0]?.lead_intelligence_json;",
 "  const obj=typeof persisted==='string'?JSON.parse(persisted):persisted;",
 "  if(!obj||obj.researchNotice?.fingerprint!==notice.fingerprint)return res.status(503).json({ok:false,error:'NOTICE_PERSISTENCE_NOT_VERIFIED'});",
 "  c.leadIntelligence=nextIntel;c.updatedAt=at;",
 "  audit(req.user,'research_notice_resolved','Resolved stale lead correction notice; customer retained',",
 "   {customerId:c.id,tenantId,resolvedAt:at,noticeFingerprint:notice.fingerprint});",
 "  res.setHeader('Cache-Control','no-store');",
 "  return res.json({ok:true,id:c.id,resolved:true,deleted:false,retainedCustomer:true,resolvedAt:at});",
 " }catch(err){console.error('[RESEARCH NOTICE] durable resolution failed',String(err?.code||err?.message||'unknown'));return res.status(503).json({ok:false,error:'NOTICE_RESOLUTION_UNAVAILABLE'});}",
 "});",
 ""].join('\n');
 s=once(s,endpoint,route+'\n'+endpoint,'route');
 const field="researchStatus:c.leadIntelligence?.researchStatus||'NOT_RECORDED',researchSource:c.leadIntelligence?.researchSource||''";
 const projected=field+",researchNoticeResolved:SBC_V66102_RESEARCH_NOTICE.resolved(c),researchNoticeResolvedAt:c.leadIntelligence?.researchNotice?.resolvedAt||''";
 s=once(s,field,projected,'lead-projection');
 return s;
}
if(require.main===module){
 const f=path.resolve(__dirname,'../server.js'),raw=fs.readFileSync(f,'utf8'),next=patchServer(raw);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V66102_ISOLATED_STAGE!=='YES')throw Error('V66102_STAGE_ONLY');
  fs.writeFileSync(f,next);
  console.log('[SBC V66.102] durable correction notice acknowledgement staged; customer stays.');
 }else console.log('[SBC V66.102] route anchors compatible, no writes');
}
module.exports={MARK,patchServer};

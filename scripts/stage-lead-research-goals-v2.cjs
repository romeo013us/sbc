'use strict';
/* SBC V2 research goal endpoint: only staged to candidate ZIP through signed CI pipeline.
 * Preserve root compiled server/receipt/inventory until release rehashing has completed.
 */
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_RESEARCH_PRODUCTIVITY_V2';
const ROUTE="\n// SBC_RESEARCH_PRODUCTIVITY_V2: per-researcher, tenant-scoped accepted CRM lead counts.\n// Count auditable, durable lead-creation events, not queue membership or client-side attempts.\napp.get('/api/workforce/research-progress',auth,async(req,res)=>{\n  res.setHeader('Cache-Control','no-store');\n  if(!sbcLornaRole(req.user))return res.status(403).json({ok:false,error:'Researcher access required.'});\n  try{\n    const tenantId=requireRequestTenant(req);\n    if(!mysqlPool||MYSQL_RECOVERY_REQUIRED)return res.status(503).json({ok:false,code:'RESEARCH_STATS_UNAVAILABLE',error:'Verified CRM progress is temporarily unavailable.'});\n    const customerMap=new Map((db.customers||[]).filter(c=>Number(c.tenantId)===Number(tenantId)).map(c=>[String(c.id),c]));\n    const [sqlEvents]=await mysqlPool.query(\n      \"SELECT id,meta_json,created_at FROM sbc_audit_log WHERE user_id=? AND event_type='workforce_lead_created' ORDER BY created_at DESC LIMIT 20000\",\n      [String(req.user.id)]\n    );\n    const seenEvents=new Set(),seenCustomers=new Set(),accepted=[];\n    const source=[...(sqlEvents||[]).map(r=>({id:r.id,meta:r.meta_json,createdAt:r.created_at})),\n      ...(db.auditLog||[]).filter(e=>String(e.userId)===String(req.user.id)&&e.eventType==='workforce_lead_created').map(e=>({id:e.id,meta:e.meta,createdAt:e.createdAt}))];\n    const etParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'});\n    const etDate=value=>{\n      const date=new Date(value);\n      if(!Number.isFinite(date.getTime()))return '';\n      const parts=Object.fromEntries(etParts.formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));\n      return parts.year+'-'+parts.month+'-'+parts.day;\n    };\n    for(const event of source){\n      const id=String(event.id||'');\n      if(!id||seenEvents.has(id))continue;\n      seenEvents.add(id);\n      let meta=event.meta;\n      if(typeof meta==='string'){try{meta=JSON.parse(meta)}catch{continue}}\n      const customerId=String(meta?.customerId||'');\n      if(!customerId||seenCustomers.has(customerId))continue;\n      const customer=customerMap.get(customerId);\n      if(!customer||isSbcSyntheticTestRecord(customer))continue;\n      const day=etDate(event.createdAt);\n      if(!day)continue;\n      seenCustomers.add(customerId);\n      accepted.push({id:customerId,day,verified:['Verified','Sales Ready'].includes(String(customer.verificationStatus||''))});\n    }\n    const today=etDate(new Date()),days=[];\n    for(let offset=6;offset>=0;offset--){\n      const date=new Date(Date.parse(today+'T12:00:00Z')-offset*86400000).toISOString().slice(0,10);\n      days.push({date,count:accepted.filter(r=>r.day===date).length});\n    }\n    const current=accepted.filter(r=>r.day===today);\n    res.json({ok:true,date:today,timeZone:'America/New_York',goalMin:16,goalMax:20,\n      todayCount:current.length,verifiedTodayCount:current.filter(r=>r.verified).length,\n      last7Count:days.reduce((sum,d)=>sum+d.count,0),allTimeCount:accepted.length,\n      last7Days:days,submittedLeadIds:accepted.map(r=>r.id).slice(0,1000),source:'durable-crm-audit',limitReached:(sqlEvents||[]).length>=20000});\n  }catch(err){\n    console.error('[SBC RESEARCH PROGRESS] secure read failed:',String(err?.code||err?.message||'unknown'));\n    res.status(503).json({ok:false,code:'RESEARCH_STATS_UNAVAILABLE',error:'Verified CRM progress is temporarily unavailable.'});\n  }\n});\n";
function patchSource(src){
 if(src.includes(MARKER)){
  if(!src.includes("if(p==='/api/workforce/research-progress')return m==='GET'")||!src.includes("app.get('/api/workforce/research-progress',auth,async(req,res)=>"))
   throw Error('[SBC RESEARCH GOALS] partial staged patch found');
  return src;
 }
 if(!src.includes('SBC_LEAD_RESEARCH_ROLE_ISOLATION_V1'))throw Error('[SBC RESEARCH GOALS] secure researcher isolation patch missing');
 const gate=" if(p==='/api/workforce/lorna')return m==='GET';";
 const header="app.get('/api/v9/lead-verification',auth,(req,res)=>{";
 if(src.split(gate).length!==2||src.split(header).length!==2)throw Error('[SBC RESEARCH GOALS] unexpected API route structure');
 let out=src.replace(gate,gate+"\n if(p==='/api/workforce/research-progress')return m==='GET';");
 out=out.replace(header,ROUTE+"\n"+header);
 if(!out.includes(MARKER)||!out.includes("source:'durable-crm-audit'"))throw Error('[SBC RESEARCH GOALS] incomplete patch');
 return out;
}
function apply(root){
 const file=path.join(root,'server.js'),before=fs.readFileSync(file,'utf8'),after=patchSource(before);
 if(before!==after)fs.writeFileSync(file,after);
 return {marker:MARKER,applied:before!==after,bytes:after.length};
}
if(require.main===module){
 if(process.argv[2]!=='--apply')throw Error('Run with --apply only in staged verified release CI.');
 console.log('[SBC RESEARCH GOALS] '+JSON.stringify(apply(path.resolve(__dirname,'..'))));
}
module.exports={MARKER,patchSource,apply};

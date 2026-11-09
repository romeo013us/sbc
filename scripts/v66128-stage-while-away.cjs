'use strict';
/* V66.128 disposable-stage patch: read-only owner "While I Was Away" report.
 * Does not alter operational data, schema, AI agents or job scheduling.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const FILE=path.resolve(__dirname,'../server.js');
const MARK='SBC_V66128_OWNER_WHILE_AWAY';
function patchServer(s){
 if(s.includes(MARK)){
  assert(s.includes("require('./enterprise/v66128-owner-while-away.cjs')"));
  return s;
 }
 const anchor=' // SBC_V66112_OFFICEBOX_COMMITTED_OWNER_RECONCILIATION';
 const route=[
 ' // '+MARK,
 " const SBC_V66128_CATCHUP=require('./enterprise/v66128-owner-while-away.cjs');",
 " app.get('/api/owner/while-away',auth,ownerOnly,async(req,res)=>{",
 "  res.setHeader('Cache-Control','no-store');",
 '  try{',
 '   const tenantId=requireRequestTenant(req),hours=Number(req.query?.hours||24);',
 "   if(![24,48,168].includes(hours))return res.status(400).json({ok:false,error:'OWNER_RECAP_WINDOW_INVALID'});",
 "   if(!mysqlPool)return res.status(503).json({ok:false,error:'OWNER_RECAP_MYSQL_REQUIRED'});",
 "   if(MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED)return res.status(503).json({ok:false,error:'OWNER_RECAP_RECOVERY_NOT_READY'});",
 '   const nowTime=Date.now(),since=new Date(nowTime-hours*3600000),until=new Date(nowTime);',
 '   const staff=SBC_V66128_CATCHUP.eligibleUsers(db.users,tenantId);',
 '   if(!staff.length){return res.json(SBC_V66128_CATCHUP.summarize({tenantId,users:db.users,',
 '      events:[],crmRows:[],shiftEntries:v9data().timeEntries,now:nowTime,hours}));}',
 '   const [auditRows]=await mysqlPool.query(',
 '    "SELECT id,user_id,event_type,meta_json,created_at FROM sbc_audit_log WHERE user_id IN (?) AND created_at>=? AND created_at<=? AND event_type IN (\\'workforce_lead_created\\',\\'call_report\\',\\'lead_updated\\',\\'lead_verification_update\\',\\'website_demo\\') ORDER BY created_at DESC LIMIT 5001",',
 '    [staff.map(x=>String(x.id)),sqlDateTime(since),sqlDateTime(until)]);',
 '   const ids=[...new Set((auditRows||[]).map(x=>{',
 "    let m=x.meta_json;try{if(typeof m==='string')m=JSON.parse(m)}catch{m={}}",
 "    return String(m?.customerId||'');",
 '   }).filter(Boolean))];',
 '   const crmRows=[];',
 '   for(let i=0;i<ids.length;i+=300){',
 '    const [rows]=await mysqlPool.query(',
 "     'SELECT id,tenant_id,business_name FROM sbc_customers WHERE tenant_id=? AND id IN (?)',",
 '     [tenantId,ids.slice(i,i+300)]);',
 '    crmRows.push(...(rows||[]));',
 '   }',
 '   const data=SBC_V66128_CATCHUP.summarize({tenantId,users:db.users,events:(auditRows||[]).slice(0,5000),',
 '      crmRows,shiftEntries:v9data().timeEntries,now:nowTime,hours,truncated:(auditRows||[]).length>5000});',
 '   return res.json(data);',
 '  }catch(e){',
 "    console.warn('[SBC OWNER RECAP] read failed:',String(e?.code||'QUERY_UNAVAILABLE'));",
 "    return res.status(503).json({ok:false,error:'OWNER_RECAP_DATA_UNAVAILABLE',readOnly:true});",
 '  }',
 ' });',
 ''
 ].join('\n');
 assert.equal(s.split(anchor).length-1,1,'V66.128 owner route anchor missing');
 return s.replace(anchor,route+anchor);
}
if(require.main===module){
 const src=fs.readFileSync(FILE,'utf8'),out=patchServer(src);
 assert.equal(patchServer(out),out,'not idempotent');
 if(process.argv.includes('--verify-staged'))assert.equal(src,out,'staged owner recap missing');
 else if(process.argv.includes('--apply')){
  if(process.env.SBC_V66128_ISOLATED_STAGE!=='YES')throw Error('DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(FILE,out);
 }
 console.log('[SBC V66.128] PASS owner-only while-away read-only MySQL summary');
}
module.exports={MARK,patchServer};

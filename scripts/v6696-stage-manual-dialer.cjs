'use strict';
/* SBC V66.96: extend the disposable staged server with tenant-scoped
 * manual-number call logs. Never change live customer records here.
 * Original existing customer call routes remain unchanged.
 */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V6696_MANUAL_DIAL_LOG';
function once(source,oldText,newText,label){
 const count=source.split(oldText).length-1;
 if(count!==1)throw Error('MANUAL_DIAL_PATCH_ANCHOR '+label+' '+count);
 return source.replace(oldText,newText);
}
function patchServer(input){
 let source=String(input||'');
 if(source.includes(MARK))return source;
 const getStart=source.indexOf("app.get('/api/voice/logs',auth,(req,res)=>{");
 const postStart=source.indexOf("app.post('/api/voice/log',auth,async(req,res)=>{",getStart);
 const end=source.indexOf("app.get('/api/ai/attention',",postStart);
 if(getStart<0||postStart<0||end<0)throw Error('MANUAL_DIAL_ROUTES_NOT_FOUND');
 let get=source.slice(getStart,postStart);
 let post=source.slice(postStart,end);
 get=once(get,
  "const customerId=String(req.query.customerId||'').trim().slice(0,120);if(!customerId)return res.status(400).json({ok:false,error:'customerId is required.'});",
  "/* "+MARK+" */const customerId=String(req.query.customerId||'').trim().slice(0,120);const manualMode=String(req.query.manual||'')==='1'&&!customerId;if(!customerId&&!manualMode)return res.status(400).json({ok:false,error:'customerId is required.'});",'history-param');
 get=once(get,
  "const customer=(db.customers||[]).find(c=>String(c.id)===customerId&&Number(c.tenantId??c.tenant_id)===Number(tenantId));if(!customer)return res.status(404).json({ok:false,error:'Customer not found in this workspace.'});",
  "const customer=manualMode?null:(db.customers||[]).find(c=>String(c.id)===customerId&&Number(c.tenantId??c.tenant_id)===Number(tenantId));if(!manualMode&&!customer)return res.status(404).json({ok:false,error:'Customer not found in this workspace.'});",'history-customer');
 get=once(get,"String(x.customerId)===customerId&&Number(x.tenantId||0)===Number(tenantId)",
  "(manualMode?x.manualDial===true:String(x.customerId)===customerId)&&Number(x.tenantId||0)===Number(tenantId)",'history-filter');
 get=once(get,"customerId:x.customerId,status:x.status",
  "customerId:x.customerId,manualDial:x.manualDial===true,status:x.status",'history-projection');
 post=once(post,
  "const customerId=String(b.customerId||'').trim().slice(0,120);if(!customerId)return res.status(400).json({ok:false,error:'customerId is required to log an SBC call.'});const customer=(db.customers||[]).find(c=>String(c.id)===customerId&&Number(c.tenantId??c.tenant_id)===Number(tenantId));if(!customer)return res.status(404).json({ok:false,error:'Customer not found in this workspace.'});",
  "const customerId=String(b.customerId||'').trim().slice(0,120);const manualDial=b.manualDial===true&&!customerId;if(b.manualDial===true&&customerId)return res.status(400).json({ok:false,error:'MANUAL_DIAL_MUST_NOT_LINK_CUSTOMER'});if(!customerId&&!manualDial)return res.status(400).json({ok:false,error:'customerId is required to log an SBC call.'});const customer=manualDial?null:(db.customers||[]).find(c=>String(c.id)===customerId&&Number(c.tenantId??c.tenant_id)===Number(tenantId));if(!manualDial&&!customer)return res.status(404).json({ok:false,error:'Customer not found in this workspace.'});const manualTo=manualDial?normalizeDialNumber(b.to):'';if(manualDial&&!/^\\+[1-9]\\d{7,14}$/.test(manualTo))return res.status(400).json({ok:false,error:'MANUAL_DIAL_INVALID_NUMBER'});if(manualDial&&(db.customers||[]).some(c=>Number(c.tenantId??c.tenant_id)===Number(tenantId)&&normalizeDialNumber(c.phone)===manualTo&&(c.doNotContact===true||c.salesSuppressed===true||c.isSuppressed===true||['do not call','do not contact','dnc','opt out','unsubscribe'].includes(String(c.status||'').trim().toLowerCase()))))return res.status(403).json({ok:false,error:'MANUAL_DIAL_SUPPRESSED_CONTACT'});",
  'log-customer-and-suppression');
 post=once(post,
  "&&String(x.customerId)===customerId):null;",
  "&&String(x.customerId)===customerId&&Boolean(x.manualDial)===manualDial):null;",'log-session-scope');
 post=once(post,
  "const isNew=!log;const priorStatus",
  "if(log&&manualDial&&manualTo!==log.to)return res.status(409).json({ok:false,error:'MANUAL_DIAL_NUMBER_LOCKED'});const isNew=!log;const priorStatus",'log-number-lock');
 post=once(post,
  "userName:req.user.name||req.user.username||'SBC Team',customerId,to:normalizeDialNumber(b.to),direction:'outbound',",
  "userName:req.user.name||req.user.username||'SBC Team',customerId,manualDial,to:normalizeDialNumber(b.to),direction:'outbound',",'log-new-flag');
 post=once(post,
  "if(b.to)log.to=normalizeDialNumber(b.to);",
  "if(b.to&&!manualDial)log.to=normalizeDialNumber(b.to);",'log-no-number-mutation');
 post=once(post,
  "callLogId:log.id,customerId,callSid:log.callSid",
  "callLogId:log.id,customerId,manualDial,callSid:log.callSid",'audit-marker');
 return source.slice(0,getStart)+get+post+source.slice(end);
}
if(require.main===module){
 const root=path.resolve(__dirname,'..'),server=path.join(root,'server.js');
 const before=fs.readFileSync(server,'utf8');const after=patchServer(before);
 if(process.argv.includes('--apply')){
  if(process.env.SBC_V6696_ISOLATED_STAGE!=='YES')throw Error('MANUAL_DIAL_STAGE_ONLY');
  fs.writeFileSync(server,after,'utf8');
  console.log('[SBC V66.96] staged manual-number logging; original source and production data unchanged');
 }else console.log('[SBC V66.96] read-only staged route compatibility PASS');
}
module.exports={patchServer,MARK};

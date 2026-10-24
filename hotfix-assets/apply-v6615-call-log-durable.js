'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6615_CALL_LOG_MYSQL_DURABILITY';
function once(s,oldText,newText,reason){
 const count=s.split(oldText).length-1;
 if(count!==1)throw Error(MARKER+': '+reason+': expected one anchor, found '+count);
 return s.replace(oldText,newText);
}
function apply(root){
 const file=path.join(root,'server.js');
 const before=fs.readFileSync(file,'utf8');
 if(before.includes(MARKER))return {marker:MARKER,changed:false};
 let source=before;
 if(!source.includes('SBC_V6614_VOICE_CALL_LOG_INTEGRITY'))throw Error(MARKER+': requires tenant-scoped call log patch');
 source=once(source,
  "app.post('/api/voice/log',auth,async(req,res)=>{try{const b=req.body||{};",
  "let sbcVoiceLogCommitTailV6615=Promise.resolve();\n"+
  "app.post('/api/voice/log',auth,async(req,res)=>{"+
  "const prior=sbcVoiceLogCommitTailV6615;let release;"+
  "sbcVoiceLogCommitTailV6615=new Promise(resolve=>{release=resolve});"+
  "await prior;"+
  "/* "+MARKER+": serialized writes with best-effort in-memory rollback */"+
  "const previousLogs=(db.callLogs||[]).map(row=>({...row}));"+
  "const previousActivity=(db.activities||[]).map(row=>({...row}));"+
  "const previousAudit=(db.auditLog||[]).map(row=>({...row}));"+
  "try{const b=req.body||{};",
  'call-log serialization and rollback snapshot'
 );
 source=once(source,
  "await saveData();res.status(isNew?201:200).json({ok:true,id:log.id,sessionId:log.sessionId,status:log.status,updatedAt:log.updatedAt})",
  "await saveData();"+
  "if(!mysqlPool)throw Object.assign(new Error('VOICE_LOG_MYSQL_NOT_AVAILABLE'),{code:'VOICE_LOG_NOT_DURABLE'});"+
  "const [durabilityRows]=await mysqlPool.query("+
  "'SELECT JSON_CONTAINS(payload,JSON_OBJECT(\\'id\\',?,\\'tenantId\\',?,\\'status\\',?,\\'notes\\',?,\\'outcome\\',?),\\'$.callLogs\\') AS confirmed FROM sbc_workspace WHERE id=1',"+
  "[log.id,Number(tenantId),log.status,log.notes,log.outcome]);"+
  "if(Number(durabilityRows?.[0]?.confirmed)!==1)throw Object.assign(new Error('VOICE_LOG_MYSQL_NOT_DURABLE'),{code:'VOICE_LOG_NOT_DURABLE'});"+
  "res.status(isNew?201:200).json({ok:true,durable:true,id:log.id,sessionId:log.sessionId,status:log.status,updatedAt:log.updatedAt})",
  'verify call-log committed to authoritative MySQL workspace'
 );
 source=once(source,
  "}catch(e){const code=e?.statusCode===423?423:503;res.status(code).json({ok:false,error:e.message||'Unable to save the SBC call log.'})}});",
  "}catch(e){db.callLogs=previousLogs;db.activities=previousActivity;db.auditLog=previousAudit;"+
  "const code=e?.statusCode===423?423:503;"+
  "res.status(code).json({ok:false,durable:false,error:e.code==='VOICE_LOG_NOT_DURABLE'?'VOICE_LOG_NOT_DURABLE':(e.message||'Unable to save the SBC call log.')})"+
  "}finally{release()}});",
  'rollback and release queue even after writer failure'
 );
 fs.writeFileSync(file,source);
 const testPath=path.join(__dirname,'v6615-call-log-durable-test.cjs');
 if(!fs.existsSync(testPath))throw Error(MARKER+': test fixture missing');
 fs.copyFileSync(testPath,path.join(root,'scripts','v6615-call-log-durable-test.cjs'));
 return {marker:MARKER,changed:true,dbSchemaChanged:false,twilioTokensChanged:false};
}
module.exports={MARKER,apply};

'use strict';
// SQL archive primitives. Only the authoritative caller may supply the
// connection and transaction; no DDL, network calls, or independent commits.
const crypto=require('node:crypto');
const TABLE='sbc_call_attempt_archive_v1',REVISIONS='sbc_call_attempt_revision_v1';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const fail=code=>{throw Object.assign(new Error(code),{code})};
const validTenant=v=>['number','string'].includes(typeof v)&&/^[1-9]\d*$/.test(String(v))&&Number.isSafeInteger(Number(v));
function text(v,max,required=false){
 if(v==null)v='';
 if(typeof v!=='string'&&typeof v!=='number')fail('CALL_ARCHIVE_FIELD_INVALID');
 const s=String(v);if(s.length>max||(required&&!s.trim()))fail('CALL_ARCHIVE_FIELD_INVALID');return s;
}
function ms(v){if(typeof v!=='string'||!v)return null;const n=Date.parse(v);return Number.isSafeInteger(n)&&n>=0?n:null;}
function prepare(row){
 if(!row||!validTenant(row.tenantId??row.tenant_id))fail('CALL_ARCHIVE_TENANT_INVALID');
 if(row.tenantId!=null&&row.tenant_id!=null&&String(row.tenantId)!==String(row.tenant_id))fail('CALL_ARCHIVE_TENANT_INVALID');
 const payload={tenantId:Number(row.tenantId??row.tenant_id),id:text(row.id,120,true),userId:text(row.userId,120,true),
  customerId:text(row.customerId,120),manualDial:row.manualDial===true,sessionId:text(row.sessionId,120),
  userName:text(row.userName,255),to:text(row.to,80),direction:text(row.direction,32),callSid:text(row.callSid,120),
  status:text(row.status,32),outcome:text(row.outcome,80),notes:text(row.notes,12000),nextAction:text(row.nextAction,1000),
  followUpAt:text(row.followUpAt,80),startedAt:text(row.startedAt,80),endedAt:text(row.endedAt,80),
  createdAt:text(row.createdAt,80),updatedAt:text(row.updatedAt,80),previousOutcome:text(row.previousOutcome,80),
  outcomeCorrectionReason:text(row.outcomeCorrectionReason,1200),outcomeCorrectedBy:text(row.outcomeCorrectedBy,120),
  outcomeCorrectedAt:text(row.outcomeCorrectedAt,80),durationSec:Number(row.durationSec??0)};
 if(!Number.isFinite(payload.durationSec)||payload.durationSec<0||payload.durationSec>86400)fail('CALL_ARCHIVE_DURATION_INVALID');
 if(payload.manualDial&&payload.customerId)fail('CALL_ARCHIVE_IDENTITY_CONFLICT');
 const numberDigits=payload.to.replace(/\D/g,'');
 if(numberDigits.length>20)fail('CALL_ARCHIVE_NUMBER_INVALID');
 const json=JSON.stringify(payload),revisionHash=hash(json),sessionKey=payload.sessionId?hash(JSON.stringify([payload.userId,payload.sessionId,payload.customerId,payload.manualDial])):null;
 const occurred=ms(payload.endedAt)??ms(payload.startedAt)??ms(payload.createdAt);
 const updates=[ms(payload.updatedAt),ms(payload.outcomeCorrectedAt)].filter(v=>v!==null);
 const updated=updates.length?Math.max(...updates):occurred;
 return {payload,json,revisionHash,sessionKey,numberDigits,occurred,updated};
}
const columns='tenant_id,log_id,actor_id,customer_id,manual_dial,session_key,number_digits,status,outcome,occurred_ms,source_updated_ms,latest_hash,payload_json';
const values=r=>[r.payload.tenantId,r.payload.id,r.payload.userId,r.payload.customerId,r.payload.manualDial?1:0,r.sessionKey,r.numberDigits,r.payload.status,r.payload.outcome,r.occurred,r.updated,r.revisionHash,r.json];
function sameIdentity(old,r){return String(old.actor_id)===r.payload.userId&&String(old.customer_id)===r.payload.customerId&&Number(old.manual_dial)===(r.payload.manualDial?1:0)&&(old.session_key??null)===r.sessionKey;}
function canAdvance(old,r){const a=old.source_updated_ms==null?null:Number(old.source_updated_ms);return a===null||(r.updated!==null&&r.updated>=a);}
async function appendBatch(conn,rows){
 if(!Array.isArray(rows)||rows.length>20000)fail('CALL_ARCHIVE_BATCH_INVALID');
 const groups=new Map(),seen=new Set(),sessions=new Map();
 for(const row of rows){
  const r=prepare(row),tid=r.payload.tenantId,key=JSON.stringify([tid,r.payload.id]);
  if(seen.has(key))fail('CALL_ARCHIVE_DUPLICATE_INPUT');seen.add(key);
  if(r.sessionKey){const sk=JSON.stringify([tid,r.sessionKey]);if(sessions.has(sk))fail('CALL_ARCHIVE_SESSION_CONFLICT');sessions.set(sk,r.payload.id);}
  if(!groups.has(tid))groups.set(tid,[]);groups.get(tid).push(r);
 }
 let inserted=0,advanced=0,unchanged=0,older=0;
 for(const [tid,group] of [...groups].sort((a,b)=>a[0]-b[0])){
  group.sort((a,b)=>a.payload.id.localeCompare(b.payload.id));
  for(let i=0;i<group.length;i+=100){
   const chunk=group.slice(i,i+100);
   const [existing]=await conn.query('SELECT log_id,actor_id,customer_id,manual_dial,session_key,source_updated_ms,latest_hash FROM '+TABLE+' WHERE tenant_id=? AND log_id IN (?) FOR UPDATE',[tid,chunk.map(r=>r.payload.id)]);
   const byId=new Map(existing.map(r=>[String(r.log_id),r]));
   const fresh=[],revisions=[],updates=[];
   for(const r of chunk){
    const old=byId.get(r.payload.id);
    if(old&&!sameIdentity(old,r))fail('CALL_ARCHIVE_IDENTITY_CONFLICT');
    if(!old){fresh.push(values(r));inserted++;}
    else if(old.latest_hash===r.revisionHash){unchanged++;continue;}
    else if(canAdvance(old,r)){updates.push([r,old]);advanced++;}
    else older++;
    revisions.push([tid,r.payload.id,r.revisionHash,r.json]);
   }
   if(fresh.length)await conn.query('INSERT INTO '+TABLE+' ('+columns+') VALUES ?',[fresh]);
   if(revisions.length)await conn.query('INSERT INTO '+REVISIONS+' (tenant_id,log_id,revision_hash,payload_json) VALUES ? ON DUPLICATE KEY UPDATE revision_hash=revision_hash',[revisions]);
   for(const [r,old] of updates){
    const [result]=await conn.query('UPDATE '+TABLE+' SET number_digits=?,status=?,outcome=?,occurred_ms=?,source_updated_ms=?,latest_hash=?,payload_json=? WHERE tenant_id=? AND log_id=? AND latest_hash=?',[r.numberDigits,r.payload.status,r.payload.outcome,r.occurred,r.updated,r.revisionHash,r.json,tid,r.payload.id,old.latest_hash]);
    if(result.affectedRows!==1)fail('CALL_ARCHIVE_WRITE_CONFLICT');
   }
  }
 }
 return {inserted,advanced,unchanged,older};
}
function strictDay(v){
 if(v==null||v==='')return null;
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('CALL_ARCHIVE_DATE_INVALID');
 const n=Date.parse(v+'T00:00:00Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==v)fail('CALL_ARCHIVE_DATE_INVALID');return n;
}
function integer(v,d,min,max){if(v==null||v==='')return d;if(!/^\d+$/.test(String(v)))fail('CALL_ARCHIVE_PAGE_INVALID');const n=Number(v);if(!Number.isSafeInteger(n)||n<min||n>max)fail('CALL_ARCHIVE_PAGE_INVALID');return n;}
function queryPlan(scope,filters={}){
 if(!scope||!validTenant(scope.tenantId)||!['owner','manager','caller'].includes(scope.role))fail('CALL_ARCHIVE_SCOPE_REQUIRED');
 const actor=text(scope.actorId,120,true),owner=['owner','manager'].includes(scope.role);
 const clauses=['a.tenant_id=?'],args=[Number(scope.tenantId)];
 if(!owner){clauses.push('a.actor_id=?');args.push(actor);}
 else if(filters.callerId){clauses.push('a.actor_id=?');args.push(text(filters.callerId,120));}
 for(const [k,col,max] of [['customerId','customer_id',120],['outcome','outcome',80],['status','status',32]]){
  if(filters[k]){clauses.push('a.'+col+'=?');args.push(text(filters[k],max));}
 }
 if(filters.number){const digits=text(filters.number,80).replace(/\D/g,'');if(!digits||digits.length>20)fail('CALL_ARCHIVE_NUMBER_INVALID');clauses.push('LOCATE(?,a.number_digits)>0');args.push(digits);}
 if(filters.business){clauses.push('EXISTS (SELECT 1 FROM sbc_customers c WHERE c.tenant_id=a.tenant_id AND c.id=a.customer_id AND LOCATE(?,c.business_name)>0)');args.push(text(filters.business,255));}
 const from=strictDay(filters.from),to=strictDay(filters.to);
 if(from!==null&&to!==null&&from>to)fail('CALL_ARCHIVE_DATE_INVALID');
 if(from!==null){clauses.push('a.occurred_ms>=?');args.push(from);}
 if(to!==null){clauses.push('a.occurred_ms<?');args.push(to+86400000);}
 return {where:clauses.join(' AND '),args,limit:integer(filters.limit,50,1,250),offset:integer(filters.offset,0,0,100000)};
}
async function list(conn,scope,filters={}){
 const p=queryPlan(scope,filters);
 const [[count]]=await conn.query('SELECT COUNT(*) AS total FROM '+TABLE+' a WHERE '+p.where,p.args);
 const [rows]=await conn.query('SELECT a.payload_json,(SELECT c.business_name FROM sbc_customers c WHERE c.tenant_id=a.tenant_id AND c.id=a.customer_id LIMIT 1) AS business_name FROM '+TABLE+' a WHERE '+p.where+' ORDER BY a.occurred_ms DESC,a.log_id ASC LIMIT ? OFFSET ?',[...p.args,p.limit,p.offset]);
 const total=Number(count.total);
 return {total,limit:p.limit,offset:p.offset,nextOffset:p.offset+p.limit<total?p.offset+p.limit:null,rows:rows.map(row=>({...JSON.parse(row.payload_json),businessName:String(row.business_name||'')}))};
}

// The previous committed workspace contains any call that was evicted by the
// in-memory 1,000-row cap. Capture it and the exact next workspace payload
// within the existing writer transaction, with no independent commit or DDL.
function workspaceCalls(payload){
 let data;try{data=JSON.parse(payload)}catch{fail('CALL_ARCHIVE_WORKSPACE_INVALID');}
 if(!data||typeof data!=='object'||Array.isArray(data)||!Array.isArray(data.callLogs))fail('CALL_ARCHIVE_WORKSPACE_INVALID');
 if(data.callLogs.length>20000)fail('CALL_ARCHIVE_BATCH_INVALID');
 return data.callLogs;
}
async function captureRollingSnapshot(conn,nextPayload,env=process.env){
 if(env.SBC_CALL_ARCHIVE_CAPTURE!=='YES')return {enabled:false};
 if(env.SBC_CALL_ARCHIVE_RETENTION_APPROVED!=='YES'||typeof env.SBC_CALL_ARCHIVE_RETENTION_POLICY_REF!=='string'||!env.SBC_CALL_ARCHIVE_RETENTION_POLICY_REF.trim()||env.SBC_CALL_ARCHIVE_RETENTION_POLICY_REF.length>120)fail('CALL_ARCHIVE_RETENTION_APPROVAL_REQUIRED');
 const next=workspaceCalls(nextPayload);
 const [previous]=await conn.query('SELECT payload FROM sbc_workspace WHERE id=1 FOR UPDATE');
 if(!Array.isArray(previous)||previous.length>1)fail('CALL_ARCHIVE_WORKSPACE_INVALID');
 const prior=previous.length?workspaceCalls(previous[0].payload):[];
 const oldResult=await appendBatch(conn,prior);
 const newResult=await appendBatch(conn,next);
 return {enabled:true,previous:oldResult,current:newResult};
}

module.exports={prepare,appendBatch,queryPlan,list,captureRollingSnapshot};

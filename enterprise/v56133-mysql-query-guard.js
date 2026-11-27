'use strict';
const TRANSIENT_CODES = new Set(['PROTOCOL_CONNECTION_LOST','ECONNRESET','EPIPE','ETIMEDOUT','ECONNREFUSED','EHOSTUNREACH','ER_CLIENT_INTERACTION_TIMEOUT','ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT','ECONNABORTED','PROTOCOL_SEQUENCE_TIMEOUT','PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR']);
function isTransientMySQLError(e) { const c=String(e?.code||'').toUpperCase(), m=String(e?.message||e||'').toLowerCase(); return TRANSIENT_CODES.has(c)||/packets out of order|client was disconnected|connection.*closed|connection.*lost|socket.*closed|closed state|inactivity|interaction timeout|broken pipe|epipe/.test(m); }
function isConnectionFailure(e) { const c=String(e?.code||'').toUpperCase(), m=String(e?.message||e||'').toLowerCase(); return new Set(['PROTOCOL_CONNECTION_LOST','ECONNRESET','EPIPE','ETIMEDOUT','ECONNREFUSED','EHOSTUNREACH','ER_CLIENT_INTERACTION_TIMEOUT','ECONNABORTED','PROTOCOL_SEQUENCE_TIMEOUT','PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR']).has(c)||/packets out of order|client was disconnected|connection.*closed|connection.*lost|socket.*closed|closed state|inactivity|interaction timeout|broken pipe|epipe/.test(m); }
// Retry eligibility, not a SQL authorization firewall. Unknown syntax is never replayed.
function isReadOnlySql(input,values){
 if(input&&typeof input==='object'&&!Array.isArray(input)){
  if(Object.keys(input).some(k=>!['sql','values','timeout'].includes(k)))return false;
  if(values!==undefined&&input.values!==undefined)return false;
  values=values===undefined?input.values:values;input=input.sql;
 }
 const safeValue=v=>v===null||['string','number','boolean','bigint'].includes(typeof v);
 if(values!==undefined&&(!Array.isArray(values)||!values.every(safeValue)))return false;
 if(typeof input!=='string')return false;
 const sql=input.trim().replace(/;$/,'').trim();
 if(!/^(?:SELECT\b|SHOW\b|DESCRIBE\b|DESC\b|EXPLAIN\s+SELECT\b)/i.test(sql))return false;
 if(/[;@\\\x00-\x1f]|\/\*|\*\/|--|#|:=/.test(sql.replace(/[\r\n\t]/g,' ')))return false;
 if(/\b(?:INTO|FOR|LOCK|PROCEDURE|SQL_CALC_FOUND_ROWS)\b|[\w`]+\s*\(/i.test(sql))return false;
 return true;
}
function ambiguousWrite(e){return Object.assign(new Error('SBC_MYSQL_AMBIGUOUS_WRITE: reconcile authoritative state before reissuing',{cause:e}),{code:'SBC_MYSQL_AMBIGUOUS_WRITE',originalCode:e?.code||'',reconciliationRequired:true});}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function isBroken(c){return Boolean(c?.__sbcBroken||c?._fatalError||c?._protocol?._fatalError||c?._closed);}
function destroy(c){try{if(c&&!c.__sbcDestroyed){c.__sbcDestroyed=true;c.destroy?.();}}catch{}}
function markBroken(c){try{if(c)c.__sbcBroken=true;}catch{}destroy(c);}
function wrapConnection(conn,{onRetry=()=>{}}={}) {
 if(!conn||conn.__sbcV6042ConnectionGuard)return conn;
 return new Proxy(conn,{get(target,prop,receiver){
  if(prop==='__sbcV6042ConnectionGuard')return true;
  if(prop==='__sbcBroken')return target.__sbcBroken===true;
  if(['query','execute','ping','beginTransaction','commit'].includes(prop))return async(...args)=>{if(isBroken(target))throw Object.assign(new Error('SBC_MYSQL_BROKEN_CONNECTION'),{code:'SBC_MYSQL_BROKEN_CONNECTION'});try{return await target[prop](...args)}catch(e){if(isConnectionFailure(e)){markBroken(target);if(prop==='commit'||(['query','execute'].includes(prop)&&!isReadOnlySql(args[0],args[1])))throw ambiguousWrite(e);}throw e;}};
  if(prop==='rollback')return async(...args)=>{try{return await target.rollback(...args)}catch(e){if(isConnectionFailure(e))markBroken(target);throw e;}};
  if(prop==='release')return(...args)=>{if(isBroken(target)){destroy(target);return;}return target.release(...args);};
  if(prop==='destroy')return()=>markBroken(target);
  return Reflect.get(target,prop,receiver);
 }});
}
function wrapPool(pool,{attempts=3,onRetry=()=>{},metrics=null}={}) {
 if(!pool||pool.__sbcV6042Guard)return pool;
 const max=Math.max(1,Math.min(4,Number(attempts)||3)), stats=metrics||{queries:0,retries:0,recycled:0,failures:0,active:0};
 async function runFresh(method,args){
  let last;
  for(let attempt=1;attempt<=max;attempt++){
   let conn=null,result,failure=null,retry=false,dispatched=false;
   try{stats.queries++;conn=await pool.getConnection();const guarded=wrapConnection(conn,{onRetry});dispatched=true;result=await guarded[method](...args);}
   catch(e){failure=e;last=e;const transient=isTransientMySQLError(e);if(conn&&(isBroken(conn)||isConnectionFailure(e))){stats.recycled++;markBroken(conn);}retry=transient&&attempt<max&&(!dispatched||isReadOnlySql(args[0],args[1]));if(!retry)stats.failures++;}
   finally{
    if(conn){
     if(isBroken(conn))destroy(conn);
     else {try{conn.release?.();}catch(_){destroy(conn);}}
    }
   }
   if(!failure)return result;
   if(!retry)throw failure;
   stats.retries++;const wait=Math.min(1200,150*2**(attempt-1));
   try{onRetry({operation:method,attempt,wait,code:failure?.code||'',message:String(failure?.message||'')});}catch{}
   await delay(wait);
  }
  throw last;
 }
 return new Proxy(pool,{get(target,prop,receiver){
  if(prop==='__sbcV6042Guard')return true;
  if(prop==='__sbcMysqlMetrics')return stats;
  if(prop==='query'||prop==='execute')return(...args)=>runFresh(prop,args);
  if(prop==='getConnection')return async(...args)=>wrapConnection(await target.getConnection(...args),{onRetry});
  return Reflect.get(target,prop,receiver);
 }});
}
module.exports={wrapPool,isTransientMySQLError,wrapConnection,isReadOnlySql};

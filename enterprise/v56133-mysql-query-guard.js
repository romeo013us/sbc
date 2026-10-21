'use strict';
const TRANSIENT_CODES = new Set(['PROTOCOL_CONNECTION_LOST','ECONNRESET','EPIPE','ETIMEDOUT','ECONNREFUSED','EHOSTUNREACH','ER_CLIENT_INTERACTION_TIMEOUT','ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT','ECONNABORTED']);
function isTransientMySQLError(e) { const c=String(e?.code||'').toUpperCase(), m=String(e?.message||e||'').toLowerCase(); return TRANSIENT_CODES.has(c)||/packets out of order|client was disconnected|connection.*closed|connection.*lost|socket.*closed|closed state|inactivity|interaction timeout|broken pipe|epipe/.test(m); }
function isConnectionFailure(e) { const c=String(e?.code||'').toUpperCase(), m=String(e?.message||e||'').toLowerCase(); return new Set(['PROTOCOL_CONNECTION_LOST','ECONNRESET','EPIPE','ETIMEDOUT','ECONNREFUSED','EHOSTUNREACH','ER_CLIENT_INTERACTION_TIMEOUT','ECONNABORTED']).has(c)||/packets out of order|client was disconnected|connection.*closed|connection.*lost|socket.*closed|closed state|inactivity|interaction timeout|broken pipe|epipe/.test(m); }
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function isBroken(c){return Boolean(c?.__sbcBroken||c?._fatalError||c?._protocol?._fatalError||c?._closed);}
function destroy(c){try{if(c&&!c.__sbcDestroyed){c.__sbcDestroyed=true;c.destroy?.();}}catch{}}
function markBroken(c){try{if(c)c.__sbcBroken=true;}catch{}destroy(c);}
function wrapConnection(conn,{onRetry=()=>{}}={}) {
 if(!conn||conn.__sbcV6042ConnectionGuard)return conn;
 return new Proxy(conn,{get(target,prop,receiver){
  if(prop==='__sbcV6042ConnectionGuard')return true;
  if(prop==='__sbcBroken')return target.__sbcBroken===true;
  if(['query','execute','ping','beginTransaction','commit'].includes(prop))return async(...args)=>{if(isBroken(target))throw Object.assign(new Error('SBC_MYSQL_BROKEN_CONNECTION'),{code:'SBC_MYSQL_BROKEN_CONNECTION'});try{return await target[prop](...args)}catch(e){if(isConnectionFailure(e))markBroken(target);throw e;}};
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
   let conn=null,result,failure=null,retry=false;
   try{stats.queries++;conn=await pool.getConnection();const guarded=wrapConnection(conn,{onRetry});result=await guarded[method](...args);}
   catch(e){failure=e;last=e;const transient=isTransientMySQLError(e);if(conn&&(isBroken(conn)||isConnectionFailure(e))){stats.recycled++;markBroken(conn);}retry=transient&&attempt<max;if(!retry)stats.failures++;}
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
module.exports={wrapPool,isTransientMySQLError,wrapConnection};

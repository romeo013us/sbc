'use strict';
const crypto = require('crypto');
const V452 = require('./v452-operations-hardening');

function createSessionStore({
  sessionSecret,
  mysqlPool,
  getMysqlPool,
  getRedisClient,
  isRedisReady,
  getUsers,
  jwtVerify,
  tenantDefaultId=1,
  ttlMs=604800000,
  logger=console
}) {
  const SESSION_TTL_MS=Math.max(5*60*1000,Number(ttlMs)||604800000);
  // V65.1.16: resolve MySQL lazily because this store is constructed before initMysql().
  const currentMysqlPool=()=>{try{return typeof getMysqlPool==='function'?getMysqlPool():mysqlPool;}catch{return null;}};
  // V45.2: session cache is isolated in a dedicated worker-thread partition.
  // No employee/session records are retained in the main-thread process-local Map.
  const persistTimeoutMs=15000;
  const withTimeout=(promise,ms)=>{let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('session store timeout')),ms);timer.unref?.();})]).finally(()=>{if(timer)clearTimeout(timer)});};
  const mysqlQuery=(sql,params=[])=>{const pool=currentMysqlPool();if(!pool){const e=new Error('MySQL durable session store is unavailable.');e.code='SESSION_STORE_UNAVAILABLE';throw e;}return pool.query({sql,timeout:persistTimeoutMs},params);};
  function sessionHash(token){return crypto.createHash('sha256').update(String(token)).digest('hex')}
  function sessionRedisKey(token){return `sbc:session:${sessionHash(token)}`}
  function sign(raw){return crypto.createHmac('sha256',String(sessionSecret||'')).update(raw).digest('hex')}
  function sessionCookieToken(req){const raw=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('sbc_session='))?.slice('sbc_session='.length)||'';try{return decodeURIComponent(raw.replace(/^\"|\"$/g,''))}catch{return raw.replace(/^\"|\"$/g,'')}}
  function makeSession(user){const raw=crypto.randomBytes(24).toString('hex');const token=raw+'.'+sign(raw);const createdAt=Date.now(),expiresAt=createdAt+SESSION_TTL_MS;return {token,record:{createdAt,userId:user.id,role:String(user.role||''),tenantId:Number(user.tenantId||tenantDefaultId),expiresAt}}}
  async function persistSession(token,rec){
    try{await withTimeout(V452.cacheSet(`session:${sessionHash(token)}`,rec,Math.max(1000,rec.expiresAt-Date.now())),persistTimeoutMs)}catch(e){logger.warn('[SBC AUTH] isolated session cache write:',e.message)}
    let redisDurable=false,mysqlDurable=false;
    const redis=getRedisClient();
    if(isRedisReady()&&redis){try{const ttl=Math.max(1,Math.ceil((rec.expiresAt-Date.now())/1000));await withTimeout(redis.set(sessionRedisKey(token),JSON.stringify(rec),{EX:ttl}),persistTimeoutMs);redisDurable=true;}catch(e){logger.warn('[SBC AUTH] Redis session write:',e.message)}}
    if(currentMysqlPool()){
      try{
        const hash=sessionHash(token);
        await withTimeout(mysqlQuery(`INSERT INTO sbc_sessions(token_hash,user_id,created_at,expires_at,last_seen_at) VALUES (?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),expires_at=VALUES(expires_at),last_seen_at=UTC_TIMESTAMP()`,[hash,rec.userId,new Date(rec.createdAt).toISOString().slice(0,19).replace('T',' '),new Date(rec.expiresAt).toISOString().slice(0,19).replace('T',' ')]),persistTimeoutMs+250);
        const [confirmed]=await withTimeout(mysqlQuery('SELECT user_id FROM sbc_sessions WHERE token_hash=? AND user_id=? AND expires_at>=UTC_TIMESTAMP() LIMIT 1',[hash,rec.userId]),persistTimeoutMs+250);
        mysqlDurable=Boolean(confirmed?.length && String(confirmed[0].user_id)===String(rec.userId));
        if(!mysqlDurable)logger.warn('[SBC AUTH] MySQL session persistence read-back did not confirm the row.');
      }catch(e){logger.warn('[SBC AUTH] MySQL session write/verification:',e.message)}
    }
    if(currentMysqlPool()){try{await withTimeout(mysqlQuery('INSERT INTO sbc_session_bindings(token_hash,role,created_at) VALUES (?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE role=VALUES(role)',[sessionHash(token),String(rec.role||'')]),persistTimeoutMs+250)}catch(e){logger.warn('[SBC AUTH] MySQL role binding write:',e.message)}}
    return {durable:Boolean(redisDurable||mysqlDurable),redis:redisDurable,mysql:mysqlDurable,localFallback:false};
  }
  async function dropSession(token){
    if(!token)return {cacheCleared:false,redisCleared:false,mysqlCleared:false};
    const hash=sessionHash(token);const result={cacheCleared:false,redisCleared:false,mysqlCleared:false};
    try{await withTimeout(V452.cacheDelete(`session:${hash}`),persistTimeoutMs);result.cacheCleared=true}catch(e){logger.warn('[SBC AUTH] isolated session cache cleanup:',e.message)}
    const cleanup=[];const redis=getRedisClient();
    if(isRedisReady()&&redis)cleanup.push(withTimeout(redis.del(sessionRedisKey(token)),persistTimeoutMs).then(()=>{result.redisCleared=true}).catch(e=>logger.warn('[SBC AUTH] Redis session cleanup:',e.message)));
    if(currentMysqlPool())cleanup.push(Promise.all([
      withTimeout(mysqlQuery('DELETE FROM sbc_sessions WHERE token_hash=?',[hash]),persistTimeoutMs+250),
      withTimeout(mysqlQuery('DELETE FROM sbc_session_bindings WHERE token_hash=?',[hash]),persistTimeoutMs+250)
    ]).then(()=>{result.mysqlCleared=true}).catch(e=>logger.warn('[SBC AUTH] MySQL session cleanup:',e.message)));
    await Promise.all(cleanup);return result;
  }
  // SBC_V6567_SESSION_BACKPRESSURE: coalesce duplicate token lookups and bound DB pressure.
  const MAX_SESSION_READS=Math.max(2,Math.min(32,Number(process.env.SBC_SESSION_READ_CONCURRENCY||12)));
  const durableReadInFlight=new Map();
  const lastSeenWriteAt=new Map();
  let durableReadBackoffUntil=0,durableReadFailureCount=0;
  function sessionStoreUnavailable(message){const e=new Error(message||'Session store temporarily unavailable.');e.code='SESSION_STORE_UNAVAILABLE';e.retryAfterSeconds=Math.max(1,Math.ceil((durableReadBackoffUntil-Date.now())/1000));return e;}
  function durableSessionLookup(token,hash){
    if(durableReadInFlight.has(hash))return durableReadInFlight.get(hash);
    if(Date.now()<durableReadBackoffUntil)return Promise.reject(sessionStoreUnavailable('Session lookup is briefly throttled after a durable-store failure.'));
    if(durableReadInFlight.size>=MAX_SESSION_READS){const e=sessionStoreUnavailable('Session lookup capacity is busy; retry shortly.');e.retryAfterSeconds=1;return Promise.reject(e);}
    const work=(async()=>{try{
      const [rows]=await withTimeout(mysqlQuery('SELECT s.user_id,UNIX_TIMESTAMP(s.created_at)*1000 AS created_ms,UNIX_TIMESTAMP(s.expires_at)*1000 AS expires_ms,UNIX_TIMESTAMP(s.last_seen_at)*1000 AS last_seen_ms,b.role FROM sbc_sessions s LEFT JOIN sbc_session_bindings b ON b.token_hash=s.token_hash WHERE s.token_hash=? AND s.expires_at>=UTC_TIMESTAMP() LIMIT 1',[hash]),persistTimeoutMs+250);
      durableReadFailureCount=0;durableReadBackoffUntil=0;
      if(!rows[0])return null;
      const rec={createdAt:Number(rows[0].created_ms),userId:rows[0].user_id,tenantId:tenantDefaultId,expiresAt:Number(rows[0].expires_ms),role:String(rows[0].role||'')};
      V452.cacheSet('session:'+hash,rec,Math.max(1000,rec.expiresAt-Date.now())).catch(()=>{});
      const redis=getRedisClient();if(isRedisReady()&&redis){const ttl=Math.max(1,Math.ceil((rec.expiresAt-Date.now())/1000));redis.set(sessionRedisKey(token),JSON.stringify(rec),{EX:ttl}).catch(()=>{});}
      const nowMs=Date.now(),last=lastSeenWriteAt.get(hash)||0;if(nowMs-last>=60000){lastSeenWriteAt.set(hash,nowMs);if(lastSeenWriteAt.size>5000)lastSeenWriteAt.delete(lastSeenWriteAt.keys().next().value);mysqlQuery('UPDATE sbc_sessions SET last_seen_at=UTC_TIMESTAMP() WHERE token_hash=?',[hash]).catch(()=>{});}
      return rec;
    }catch(error){durableReadFailureCount=Math.min(5,durableReadFailureCount+1);durableReadBackoffUntil=Date.now()+Math.min(2000,250*Math.pow(2,durableReadFailureCount-1));logger.warn('[SBC AUTH] bounded durable session read unavailable:',String(error&&error.code||error&&error.message||'store error'));throw sessionStoreUnavailable('Session store temporarily unavailable.');}})();
    let tracked;tracked=work.finally(()=>{if(durableReadInFlight.get(hash)===tracked)durableReadInFlight.delete(hash);});durableReadInFlight.set(hash,tracked);return tracked;
  }
  async function sessionUser(req){
    if(process.env.SBC_AUTH_MODE==='jwt'){const authHeader=String(req.headers.authorization||'');if(authHeader.startsWith('Bearer ')){const claims=jwtVerify(authHeader.slice(7).trim());if(claims?.sub){const u=(getUsers()||[]).find(x=>x.id===claims.sub&&x.active!==false);if(u){u.tenantId=Number(claims.tenantId||u.tenantId||tenantDefaultId);return u;}}}}
    const token=sessionCookieToken(req);if(!token)return null;let rec=await V452.cacheGet(`session:${sessionHash(token)}`).catch(()=>null);const redis=getRedisClient();
    if(isRedisReady()&&redis){try{const raw=await redis.get(sessionRedisKey(token));if(raw)rec=JSON.parse(raw);}catch(e){logger.warn('[SBC AUTH] Redis session read:',e.message)}}
    if(!rec&&currentMysqlPool()){rec=await durableSessionLookup(token,sessionHash(token));}
    if(!rec)return null;if(Date.now()>Number(rec.expiresAt||Number(rec.createdAt)+SESSION_TTL_MS)){await dropSession(token);return null}
    const u=(getUsers()||[]).find(x=>x.id===rec.userId&&x.active!==false);if(u&&rec.role&&String(u.role||'')!==String(rec.role))return (await dropSession(token),null);if(u?.expiresAt&&new Date(u.expiresAt+'T23:59:59')<new Date()){u.active=false;await dropSession(token);return null}return u||null;
  }
  async function validSession(req){return Boolean(await sessionUser(req))}
  async function cleanupExpired(){if(currentMysqlPool()){try{const [r]=await withTimeout(mysqlQuery('DELETE FROM sbc_sessions WHERE expires_at < UTC_TIMESTAMP()'),persistTimeoutMs+250);return {mysqlDeleted:Number(r.affectedRows||0)}}catch(e){logger.warn('[SBC AUTH] session cleanup:',e.message)}}return {mysqlDeleted:0}}
  async function redisHealth(){const redis=getRedisClient();if(!isRedisReady()||!redis)return {configured:false,ready:false,sessionKeyCount:null,ttlSeconds:null};let count=0,ttl=null,cursor='0';try{do{const out=await redis.scan(cursor,{MATCH:'sbc:session:*',COUNT:250});cursor=String(out.cursor);const keys=out.keys||[];count+=keys.length;if(ttl===null&&keys[0])ttl=await redis.ttl(keys[0]);}while(cursor!=='0');return {configured:true,ready:true,sessionKeyCount:count,ttlSeconds:ttl,ttlEnforced:ttl===null||ttl>0};}catch(e){return {configured:true,ready:false,error:e.message}}}
  return {sessionHash,sessionRedisKey,sessionCookieToken,makeSession,persistSession,dropSession,sessionUser,validSession,cleanupExpired,redisHealth};
}
module.exports={createSessionStore};

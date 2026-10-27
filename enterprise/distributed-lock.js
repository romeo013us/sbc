'use strict';

/**
 * Process-independent lock for clustered automation.
 * Redis is preferred; MySQL GET_LOCK is the fallback when Redis is unavailable.
 * This intentionally avoids a process-local mutex so multiple pods cannot run the
 * same automation cycle concurrently.
 */
function createDistributedLock({redisClient, redisReady, mysqlPool, logger=console}) {
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function acquire(name,{ttlSeconds=90,waitMs=0}={}){
    const key=`sbc:lock:${String(name).replace(/[^a-zA-Z0-9:_-]/g,'-')}`;
    const token=`${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const deadline=Date.now()+Math.max(0,Number(waitMs)||0);
    do {
      if(redisReady&&redisClient){
        try{
          const ok=await redisClient.set(key,token,{NX:true,EX:Math.max(5,Number(ttlSeconds)||90)});
          if(ok){
            return {acquired:true,fenceToken:token,verify:async()=>{try{return (await redisClient.get(key))===token}catch{return false}},release:async()=>{try{await redisClient.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",{keys:[key],arguments:[token]});}catch(e){logger.warn('[SBC LOCK] Redis release:',e.message)}}};
          }
        }catch(e){logger.warn('[SBC LOCK] Redis acquire:',e.message)}
      }
      if(mysqlPool){
        let conn=null;
        try{
          // IMPORTANT: MySQL named locks are connection-scoped. Never acquire with
          // pool.query() and release with another pooled connection; doing that
          // leaves the named lock attached to an arbitrary pool connection and can
          // make every subsequent automation cycle report distributed_lock_busy.
          conn=await mysqlPool.getConnection();
          const [rows]=await conn.query('SELECT GET_LOCK(?,0) AS acquired',[key.slice(0,64)]);
          if(Number(rows?.[0]?.acquired)===1){
            let released=false;
            return {
              acquired:true,
              fenceToken:token,
              verify:async()=>true,
              release:async()=>{
                if(released)return;
                released=true;
                try{await conn.query('SELECT RELEASE_LOCK(?)',[key.slice(0,64)])}
                catch(e){logger.warn('[SBC LOCK] MySQL release:',e.message)}
                finally{try{conn.release()}catch{}}
              }
            };
          }
          try{conn.release()}catch{}
          conn=null;
        }catch(e){
          try{if(conn)conn.release()}catch{}
          logger.warn('[SBC LOCK] MySQL acquire:',e.message)
        }
      }
      if(Date.now()>=deadline)break;
      await sleep(Math.min(250,Math.max(25,deadline-Date.now())));
    } while(Date.now()<deadline);
    return {acquired:false,release:async()=>{}};
  }
  return {acquire};
}
module.exports={createDistributedLock};

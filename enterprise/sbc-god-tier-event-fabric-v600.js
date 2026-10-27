'use strict';
const crypto = require('crypto');
const VERSION = '60.1.0';
const MAX_EVENT_BYTES = 256 * 1024;
const MAX_BATCH = Math.max(1, Math.min(100, Number(process.env.SBC_EVENT_BATCH || 25)));
const RETRY_BASE_SECONDS = 2;

function hash(v){ return crypto.createHash('sha256').update(String(v ?? '')).digest('hex'); }
function id(prefix='evt'){ return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`; }
function clean(v,n=191){ return String(v ?? '').trim().slice(0,n); }
function safeJson(v){ const s=JSON.stringify(v ?? {}); if(Buffer.byteLength(s,'utf8')>MAX_EVENT_BYTES) throw new Error('EVENT_PAYLOAD_TOO_LARGE'); return s; }
function sqlNow(){ return new Date().toISOString().slice(0,19).replace('T',' '); }

function createEventFabric({getPool, logger=console}={}){
  const metrics={published:0,processed:0,failed:0,deadLettered:0,replayed:0,duplicates:0,lastError:'',startedAt:new Date().toISOString()};
  let draining=false;
  let timer=null;

  async function ensureTables(){
    const pool=getPool?.(); if(!pool) return false;
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_god_event_ledger (
      ledger_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id VARCHAR(120) NOT NULL,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      event_type VARCHAR(120) NOT NULL,
      aggregate_type VARCHAR(80) NOT NULL DEFAULT 'system',
      aggregate_id VARCHAR(191) NOT NULL DEFAULT '',
      idempotency_key VARCHAR(191) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      event_hash CHAR(64) NOT NULL,
      origin_shard VARCHAR(64) NOT NULL DEFAULT 'core',
      recorded_at DATETIME(6) NOT NULL,
      PRIMARY KEY(ledger_id),
      UNIQUE KEY uq_god_ledger_event(event_id),
      UNIQUE KEY uq_god_ledger_idem(tenant_id,idempotency_key),
      KEY idx_god_ledger_timeline(tenant_id,recorded_at),
      KEY idx_god_ledger_shard(origin_shard,recorded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_god_events (
      event_id VARCHAR(120) NOT NULL,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      event_type VARCHAR(120) NOT NULL,
      aggregate_type VARCHAR(80) NOT NULL DEFAULT 'system',
      aggregate_id VARCHAR(191) NOT NULL DEFAULT '',
      idempotency_key VARCHAR(191) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
      attempts INT NOT NULL DEFAULT 0,
      available_at DATETIME NOT NULL,
      locked_at DATETIME NULL,
      processed_at DATETIME NULL,
      last_error VARCHAR(1000) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      PRIMARY KEY(event_id),
      UNIQUE KEY uq_god_event_idem(tenant_id,idempotency_key),
      KEY idx_god_event_ready(status,available_at,created_at),
      KEY idx_god_event_aggregate(tenant_id,aggregate_type,aggregate_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS sbc_god_event_dead_letters (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_id VARCHAR(120) NOT NULL,
      tenant_id BIGINT NOT NULL DEFAULT 1,
      event_type VARCHAR(120) NOT NULL,
      payload_json LONGTEXT NOT NULL,
      attempts INT NOT NULL,
      error_message VARCHAR(1000) NOT NULL,
      created_at DATETIME NOT NULL,
      PRIMARY KEY(id), UNIQUE KEY uq_god_dl_event(event_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    return true;
  }

  async function publish(eventType, {tenantId=1,aggregateType='system',aggregateId='',payload={},idempotencyKey}={}){
    const pool=getPool?.(); if(!pool) return {ok:false,reason:'mysql_unavailable'};
    const idem=clean(idempotencyKey || hash(`${tenantId}|${eventType}|${aggregateType}|${aggregateId}|${hash(safeJson(payload))}`));
    const eventId=id('evt'); const now=sqlNow();
    try{
      const payloadJson=safeJson(payload);
      const eventHash=hash(`${tenantId}|${eventType}|${aggregateType}|${aggregateId}|${payloadJson}`);
      if(typeof pool.getConnection==='function'){
        const conn=await pool.getConnection();
        try{
          await conn.beginTransaction();
          const [r]=await conn.query(`INSERT INTO sbc_god_event_ledger(event_id,tenant_id,event_type,aggregate_type,aggregate_id,idempotency_key,payload_json,event_hash,origin_shard,recorded_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))`,[eventId,Number(tenantId)||1,clean(eventType,120),clean(aggregateType,80),clean(aggregateId),idem,payloadJson,eventHash,clean(process.env.SBC_WORKER_SHARD||'core',64)]);
          if(!r.affectedRows){ await conn.rollback(); metrics.duplicates++; return {ok:true,duplicate:true}; }
          await conn.query(`INSERT INTO sbc_god_events(event_id,tenant_id,event_type,aggregate_type,aggregate_id,idempotency_key,payload_json,status,attempts,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'PENDING',0,?,?,?)`,[eventId,Number(tenantId)||1,clean(eventType,120),clean(aggregateType,80),clean(aggregateId),idem,payloadJson,now,now,now]);
          await conn.commit();
        }catch(e){try{await conn.rollback();}catch(_e){} throw e;} finally{conn.release?.();}
      }else{
        const [r]=await pool.query(`INSERT INTO sbc_god_events(event_id,tenant_id,event_type,aggregate_type,aggregate_id,idempotency_key,payload_json,status,attempts,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'PENDING',0,?,?,?)`,[eventId,Number(tenantId)||1,clean(eventType,120),clean(aggregateType,80),clean(aggregateId),idem,payloadJson,now,now,now]);
        if(!r.affectedRows){ metrics.duplicates++; return {ok:true,duplicate:true}; }
      }
      metrics.published++; return {ok:true,eventId,idempotencyKey:idem,eventHash};
    }catch(e){
      if(e && e.code==='ER_DUP_ENTRY'){ metrics.duplicates++; return {ok:true,duplicate:true,idempotencyKey:idem}; }
      metrics.lastError=String(e.message||e); throw e;
    }
  }

  async function claimBatch(limit=MAX_BATCH){
    const pool=getPool?.(); if(!pool) return [];
    // Recover abandoned PROCESSING events before claiming new work.
    await pool.query(`UPDATE sbc_god_events SET status='PENDING',locked_at=NULL,updated_at=UTC_TIMESTAMP() WHERE status='PROCESSING' AND locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)`);
    const [rows]=await pool.query(`SELECT event_id FROM sbc_god_events WHERE status='PENDING' AND available_at<=UTC_TIMESTAMP() ORDER BY created_at LIMIT ?`,[Math.max(1,Math.min(MAX_BATCH,Number(limit)||MAX_BATCH))]);
    const claimed=[];
    for(const row of rows){
      const [r]=await pool.query(`UPDATE sbc_god_events SET status='PROCESSING',locked_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE event_id=? AND status='PENDING'`,[row.event_id]);
      if(r.affectedRows){ const [full]=await pool.query(`SELECT * FROM sbc_god_events WHERE event_id=? LIMIT 1`,[row.event_id]); if(full[0]) claimed.push(full[0]); }
    }
    return claimed;
  }

  async function processOnce(handler){
    if(draining) return {ok:true,skipped:true,reason:'draining'};
    const pool=getPool?.(); if(!pool) return {ok:false,reason:'mysql_unavailable'};
    draining=true; let processed=0,failed=0;
    try{
      await ensureTables();
      const rows=await claimBatch();
      for(const row of rows){
        try{
          const payload=JSON.parse(row.payload_json||'{}');
          const out=await handler({eventId:row.event_id,tenantId:Number(row.tenant_id),eventType:row.event_type,aggregateType:row.aggregate_type,aggregateId:row.aggregate_id,payload,attempts:Number(row.attempts||0)});
          await pool.query(`UPDATE sbc_god_events SET status='PROCESSED',processed_at=UTC_TIMESTAMP(),last_error='',updated_at=UTC_TIMESTAMP() WHERE event_id=?`,[row.event_id]);
          metrics.processed++; processed++;
          if(out?.replay) metrics.replayed++;
        }catch(e){
          failed++; metrics.failed++; metrics.lastError=String(e.message||e).slice(0,1000);
          const attempts=Number(row.attempts||0)+1; const terminal=attempts>=6;
          if(terminal){
            await pool.query(`UPDATE sbc_god_events SET status='DEAD',attempts=?,last_error=?,updated_at=UTC_TIMESTAMP() WHERE event_id=?`,[attempts,metrics.lastError,row.event_id]);
            await pool.query(`INSERT INTO sbc_god_event_dead_letters(event_id,tenant_id,event_type,payload_json,attempts,error_message,created_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE attempts=VALUES(attempts),error_message=VALUES(error_message)`,[row.event_id,row.tenant_id,row.event_type,row.payload_json,attempts,metrics.lastError]);
            metrics.deadLettered++;
          }else{
            const delay=Math.min(300,RETRY_BASE_SECONDS*Math.pow(2,Math.min(6,attempts)));
            await pool.query(`UPDATE sbc_god_events SET status='PENDING',attempts=?,available_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),last_error=?,locked_at=NULL,updated_at=UTC_TIMESTAMP() WHERE event_id=?`,[attempts,delay,metrics.lastError,row.event_id]);
          }
        }
      }
      return {ok:true,processed,failed,batch:rows.length};
    }finally{ draining=false; }
  }

  async function health(){
    const pool=getPool?.();
    if(!pool) return {ok:false,storage:'mysql_unavailable',version:VERSION,metrics:{...metrics}};
    try{
      await ensureTables();
      const [rows]=await pool.query(`SELECT status,COUNT(*) count FROM sbc_god_events GROUP BY status`);
      const counts=Object.fromEntries(rows.map(x=>[x.status,Number(x.count)]));
      return {ok:true,version:VERSION,storage:'mysql',counts,metrics:{...metrics},backlog:Number(counts.PENDING||0),deadLetters:Number(counts.DEAD||0)};
    }catch(e){return {ok:false,storage:'mysql_error',error:e.message,version:VERSION,metrics:{...metrics}};}
  }

  function start(handler){ if(timer) return; const interval=Math.max(1000,Number(process.env.SBC_GOD_EVENT_INTERVAL_MS||3000)); timer=setInterval(()=>processOnce(handler).catch(e=>logger.warn?.('[SBC GOD EVENT FABRIC]',e.message)),interval); timer.unref?.(); }
  function stop(){ if(timer)clearInterval(timer); timer=null; }
  return {VERSION,ensureTables,publish,processOnce,health,start,stop,metrics};
}

module.exports={VERSION,createEventFabric,hash};

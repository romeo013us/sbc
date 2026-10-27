'use strict';

/**
 * SBC V46.2 Production Reliability & Recovery
 *
 * Goals:
 * - distributed state when Redis is available, with safe MySQL durability fallback
 * - non-blocking event submission
 * - HMAC-SHA256 webhook verification with timestamp/replay protection
 * - runtime memory throttling for background work
 * - isolated demo-worker launcher with strict timeout and bounded output
 *
 * This module is intentionally additive. It does not replace the existing V45
 * authentication, fulfillment, Kim, or database layers.
 */
const crypto = require('crypto');
const {spawn} = require('child_process');
const path = require('path');

function createV460Infrastructure({redisClient=null, redisReady=false, mysqlPool=null, getRedisClient=null, isRedisReady=null, getMysqlPool=null, logger=console}={}) {
  const redis = () => getRedisClient ? getRedisClient() : redisClient;
  const redisIsReady = () => isRedisReady ? Boolean(isRedisReady()) : Boolean(redisReady);
  const mysql = () => getMysqlPool ? getMysqlPool() : mysqlPool;
  const replayWindowMs = Math.max(30_000, Number(process.env.SBC_WEBHOOK_REPLAY_WINDOW_MS || 300_000));
  const eventPrefix = String(process.env.SBC_V460_EVENT_PREFIX || 'sbc:v460:event:');
  const maxAttempts = Math.max(1, Number(process.env.SBC_V462_MAX_EVENT_ATTEMPTS || 5));
  const idempotencyTtlSeconds = Math.max(60, Number(process.env.SBC_V462_IDEMPOTENCY_TTL_SECONDS || 86400));

  function safeKey(value) {
    return String(value || 'unknown').replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 180);
  }

  async function setState(key, value, ttlSeconds=3600) {
    const k = `sbc:v460:state:${safeKey(key)}`;
    const raw = JSON.stringify(value);
    if (redisIsReady() && redis()) {
      try {
        await redis().set(k, raw, {EX: Math.max(1, Number(ttlSeconds) || 3600)});
        return {backend:'redis', durable:true};
      } catch (e) {
        logger.warn('[SBC V46] Redis state write failed; falling back:', e.message);
      }
    }
    if (mysql()) {
      try {
        await mysql().query(
          `CREATE TABLE IF NOT EXISTS sbc_v460_runtime_state (
            state_key VARCHAR(191) PRIMARY KEY,
            state_json LONGTEXT NOT NULL,
            expires_at DATETIME NULL,
            updated_at DATETIME NOT NULL
          )`,
        );
        await mysql().query(
          `INSERT INTO sbc_v460_runtime_state(state_key,state_json,expires_at,updated_at)
           VALUES (?,?,DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND),UTC_TIMESTAMP())
           ON DUPLICATE KEY UPDATE state_json=VALUES(state_json),expires_at=VALUES(expires_at),updated_at=UTC_TIMESTAMP()`,
          [k, raw, Math.max(1, Number(ttlSeconds) || 3600)]
        );
        return {backend:'mysql', durable:true};
      } catch (e) {
        logger.warn('[SBC V46] MySQL state write failed:', e.message);
      }
    }
    return {backend:'none', durable:false};
  }

  async function getState(key) {
    const k = `sbc:v460:state:${safeKey(key)}`;
    if (redisIsReady() && redis()) {
      try {
        const raw = await redis().get(k);
        if (raw) return JSON.parse(raw);
      } catch (e) { logger.warn('[SBC V46] Redis state read failed:', e.message); }
    }
    if (mysql()) {
      try {
        const [rows] = await mysql().query(
          `SELECT state_json FROM sbc_v460_runtime_state WHERE state_key=? AND (expires_at IS NULL OR expires_at>UTC_TIMESTAMP()) LIMIT 1`, [k]
        );
        if (rows?.[0]?.state_json) return JSON.parse(rows[0].state_json);
      } catch (e) { logger.warn('[SBC V46] MySQL state read failed:', e.message); }
    }
    return null;
  }

  async function publishEvent(topic, payload, {id=null, idempotencyKey=null, ttlSeconds=86400}={}) {
    const eventId = id || crypto.randomUUID();
    const idem = idempotencyKey ? safeKey(idempotencyKey) : '';
    if (idem && redisIsReady() && redis()) {
      try {
        const key = `sbc:v462:idem:${idem}`;
        const existing = await redis().get(key);
        if (existing) return {accepted:true, duplicate:true, backend:'redis', eventId:existing};
        await redis().set(key, eventId, {EX:idempotencyTtlSeconds, NX:true});
        const raced = await redis().get(key);
        if (raced && raced !== eventId) return {accepted:true, duplicate:true, backend:'redis', eventId:raced};
      } catch (e) { logger.warn('[SBC V46.2] Redis idempotency check failed:', e.message); }
    }
    const envelope = {id:eventId, topic:String(topic || 'unknown'), payload:payload || {}, createdAt:new Date().toISOString(), attempts:0};
    if (redisIsReady() && redis()) {
      try {
        await redis().lPush(`${eventPrefix}${safeKey(topic)}`, JSON.stringify(envelope));
        await redis().expire(`${eventPrefix}${safeKey(topic)}`, Math.max(60, Number(ttlSeconds) || 86400));
        return {accepted:true, backend:'redis', eventId};
      } catch (e) { logger.warn('[SBC V46.2] Redis event publish failed:', e.message); }
    }
    if (mysql()) {
      try {
        await mysql().query(
          `CREATE TABLE IF NOT EXISTS sbc_v460_event_queue (
            id VARCHAR(64) PRIMARY KEY,
            topic VARCHAR(191) NOT NULL,
            payload_json LONGTEXT NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'READY',
            attempts INT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL,
            next_attempt_at DATETIME NULL,
            last_error TEXT NULL,
            idempotency_key VARCHAR(191) NULL,
            INDEX idx_topic_status(topic,status), INDEX idx_next_attempt(next_attempt_at), INDEX idx_idem(idempotency_key)
          )`,
        );
        if (idem) {
          const [dupes] = await mysql().query(`SELECT id FROM sbc_v460_event_queue WHERE idempotency_key=? LIMIT 1`, [idem]);
          if (dupes?.[0]?.id) return {accepted:true, duplicate:true, backend:'mysql', eventId:dupes[0].id};
        }
        await mysql().query(
          `INSERT INTO sbc_v460_event_queue(id,topic,payload_json,status,created_at,idempotency_key) VALUES (?,?,?,'READY',UTC_TIMESTAMP(),?)`,
          [eventId, String(topic || 'unknown'), JSON.stringify(payload || {}), idem || null]
        );
        return {accepted:true, backend:'mysql', eventId};
      } catch (e) { logger.warn('[SBC V46.2] MySQL event queue write failed:', e.message); }
    }
    return {accepted:false, backend:'none', eventId, reason:'No durable event backend configured'};
  }

  async function claimMySqlEvents({limit=10}={}) {
    if (!mysql()) return [];
    try {
      await mysql().query(`CREATE TABLE IF NOT EXISTS sbc_v460_event_queue (id VARCHAR(64) PRIMARY KEY, topic VARCHAR(191) NOT NULL, payload_json LONGTEXT NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'READY', attempts INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL, next_attempt_at DATETIME NULL, last_error TEXT NULL, idempotency_key VARCHAR(191) NULL, INDEX idx_topic_status(topic,status), INDEX idx_next_attempt(next_attempt_at), INDEX idx_idem(idempotency_key))`);
      const [rows] = await mysql().query(`SELECT id,topic,payload_json,attempts FROM sbc_v460_event_queue WHERE status='READY' AND (next_attempt_at IS NULL OR next_attempt_at<=UTC_TIMESTAMP()) ORDER BY created_at ASC LIMIT ?`, [Math.max(1,Math.min(100,Number(limit)||10))]);
      return rows.map(r=>({...r,payload:JSON.parse(r.payload_json||'{}')}));
    } catch(e){ logger.warn('[SBC V46.2] event claim failed:',e.message); return []; }
  }

  async function completeMySqlEvent(id) {
    if (!mysql()) return false;
    try { await mysql().query(`UPDATE sbc_v460_event_queue SET status='DONE',last_error=NULL WHERE id=?`,[id]); return true; } catch(e){ logger.warn('[SBC V46.2] event completion failed:',e.message); return false; }
  }

  async function failMySqlEvent(id, error) {
    if (!mysql()) return false;
    try {
      const [rows]=await mysql().query(`SELECT attempts FROM sbc_v460_event_queue WHERE id=? LIMIT 1`,[id]);
      const attempts=Number(rows?.[0]?.attempts||0)+1;
      const status=attempts>=maxAttempts?'DEAD':'READY';
      const delay=Math.min(3600,Math.pow(2,attempts)*5);
      await mysql().query(`UPDATE sbc_v460_event_queue SET status=?,attempts=?,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? SECOND),last_error=? WHERE id=?`,[status,attempts,delay,String(error||'unknown').slice(0,2000),id]);
      return {status,attempts};
    } catch(e){ logger.warn('[SBC V46.2] event failure update failed:',e.message); return {status:'ERROR'}; }
  }

  async function cleanupExpired({stateDays=7,eventDays=30}={}) {
    const result={stateDeleted:0,eventDeleted:0};
    if (!mysql()) return result;
    try { const [r]=await mysql().query(`DELETE FROM sbc_v460_runtime_state WHERE expires_at IS NOT NULL AND expires_at<UTC_TIMESTAMP()`); result.stateDeleted=Number(r.affectedRows||0); } catch(e){ logger.warn('[SBC V46.2] state cleanup failed:',e.message); }
    try { const [r]=await mysql().query(`DELETE FROM sbc_v460_event_queue WHERE status IN ('DONE','DEAD') AND created_at<DATE_SUB(UTC_TIMESTAMP(),INTERVAL ? DAY)`,[Math.max(1,Number(eventDays)||30)]); result.eventDeleted=Number(r.affectedRows||0); } catch(e){ logger.warn('[SBC V46.2] event cleanup failed:',e.message); }
    return result;
  }

  async function recoverState(key, fallback=null) { const state=await getState(key); return state===null?fallback:state; }

  function verifyHmac({rawBody='', signature='', secret='', timestamp=Date.now(), nonce=''}) {
    const supplied = String(signature || '').replace(/^sha256=/i, '').trim();
    const ts = Number(timestamp);
    if (!supplied || !secret || !Number.isFinite(ts)) return {ok:false, reason:'missing-signature-secret-or-timestamp'};
    if (Math.abs(Date.now() - ts) > replayWindowMs) return {ok:false, reason:'stale-or-future-timestamp'};
    const signed = `${ts}.${String(nonce || '')}.${Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody)}`;
    const expected = crypto.createHmac('sha256', String(secret)).update(signed).digest('hex');
    if (supplied.length !== expected.length) return {ok:false, reason:'invalid-signature'};
    try { return {ok:crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)), reason:'invalid-signature'}; }
    catch { return {ok:false, reason:'invalid-signature'}; }
  }

  function resourceState() {
    const m = process.memoryUsage();
    const rssMb = Math.round(m.rss / 1024 / 1024);
    const heapUsedMb = Math.round(m.heapUsed / 1024 / 1024);
    const limitMb = Math.max(128, Number(process.env.SBC_V460_MEMORY_LIMIT_MB || 512));
    const ratio = rssMb / limitMb;
    return {
      rssMb, heapUsedMb, limitMb, ratio:Number(ratio.toFixed(3)),
      pressure:ratio >= 0.90,
      throttle:ratio >= 0.75,
      emergency:ratio >= 0.95
    };
  }

  function backgroundPermit({cost='normal'}={}) {
    const r = resourceState();
    if (r.emergency) return {allowed:false, delayMs:60_000, reason:'memory-emergency'};
    if (r.pressure) return {allowed:cost==='critical', delayMs:15_000, reason:'memory-pressure'};
    if (r.throttle) return {allowed:cost!=='bulk', delayMs:3_000, reason:'memory-throttle'};
    return {allowed:true, delayMs:0, reason:'normal'};
  }

  function runDemoBuilder(job, {timeoutMs=120_000, maxOutputBytes=1_000_000}={}) {
    const token = String(process.env.SBC_DEMO_WORKER_TOKEN || '');
    if (!token) return Promise.reject(new Error('SBC_DEMO_WORKER_TOKEN is not configured'));
    const permit = backgroundPermit({cost:'bulk'});
    if (!permit.allowed) return Promise.reject(new Error(`Demo builder throttled: ${permit.reason}`));
    const script = path.join(__dirname, '..', 'workers', 'demo-builder.js');
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script], {stdio:['pipe','pipe','pipe'], env:{...process.env, NODE_ENV:'production'}});
      let stdout='', stderr='', total=0, finished=false;
      const timer=setTimeout(()=>{if(!finished){finished=true;child.kill('SIGKILL');reject(new Error('Demo builder timed out'));}}, Math.max(5_000, Number(timeoutMs)||120_000));
      const collect=(name,data)=>{
        total += Buffer.byteLength(data);
        if(total > maxOutputBytes && !finished){finished=true;clearTimeout(timer);child.kill('SIGKILL');reject(new Error('Demo builder output limit exceeded'));return;}
        if(name==='stdout') stdout += data; else stderr += data;
      };
      child.stdout.on('data',d=>collect('stdout',d.toString()));
      child.stderr.on('data',d=>collect('stderr',d.toString()));
      child.on('error',e=>{if(!finished){finished=true;clearTimeout(timer);reject(e);}});
      child.on('close',(code,signal)=>{
        if(finished)return;
        finished=true;clearTimeout(timer);
        if(code!==0)return reject(new Error(stderr || `Demo builder exited ${code || signal || 'unknown'}`));
        try{resolve(JSON.parse(stdout||'{}'));}catch(e){reject(new Error(`Demo builder returned invalid JSON: ${e.message}`));}
      });
      child.stdin.end(JSON.stringify({...job,workerToken:token}));
    });
  }

  return {setState,getState,recoverState,publishEvent,claimMySqlEvents,completeMySqlEvent,failMySqlEvent,cleanupExpired,verifyHmac,resourceState,backgroundPermit,runDemoBuilder,replayWindowMs,maxAttempts};
}

module.exports={createV460Infrastructure};

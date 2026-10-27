'use strict';
/**
 * SBC V46.3 Ultra Infrastructure
 * Additive reliability layer for Gateway, state sync, spool, pub/sub, telemetry,
 * provider dispatch, lead scrubbing and resource-aware scheduling.
 */
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const zlib=require('zlib');

function createV463Ultra({mysqlPool=null,redisClient=null,redisReady=false,logger=console}={}){
  const spoolDir=path.resolve(process.env.SBC_EVENT_SPOOL_DIR||path.join(process.cwd(),'runtime-spool'));
  const maxQueue=Math.max(100,Number(process.env.SBC_V463_MAX_QUEUE||5000));
  const stateIntervalMs=Math.max(250,Number(process.env.SBC_V463_STATE_SYNC_MS||2000));
  // Snapshot encryption reuses an already-provisioned application secret when a
  // dedicated snapshot secret is unavailable. A domain-separated SHA-256 KDF
  // prevents the raw session/gateway secret from being used directly as the
  // AES key, so V47 does not require a 51st GoDaddy environment variable.
  const secret=()=>String(
    process.env.SBC_V463_SNAPSHOT_KEY||
    process.env.SBC_VAULT_KEY||
    process.env.SBC_VAULT_BOOTSTRAP||
    process.env.SBC_SESSION_SECRET||
    process.env.SBC_GATEWAY_SECRET||
    process.env.SBC_PORTAL_SECRET||
    process.env.SBC_TENANT_CONTEXT_KEY||
    process.env.SBC_WEBHOOK_SECRET||
    process.env.SBC_ADMIN_PASSWORD||
    process.env.ADMIN_PASSWORD||
    process.env.CORE_FORTRESS_SALT||
    process.env.SBC_ENCRYPTION_KEY||
    process.env.SBC_APP_SECRET||
    process.env.APP_SECRET||
    process.env.JWT_SECRET||
    process.env.COOKIE_SECRET||
    process.env.SESSION_SECRET||
    ''
  );
  const secretSource=()=>
    process.env.SBC_V463_SNAPSHOT_KEY?'dedicated-snapshot-key':
    process.env.SBC_VAULT_KEY?'vault-key':
    process.env.SBC_VAULT_BOOTSTRAP?'vault-bootstrap-derived':
    process.env.SBC_SESSION_SECRET?'session-secret-derived':
    process.env.SBC_GATEWAY_SECRET?'gateway-secret-derived':
    process.env.SBC_PORTAL_SECRET?'portal-secret-derived':
    process.env.SBC_TENANT_CONTEXT_KEY?'tenant-context-derived':
    process.env.SBC_WEBHOOK_SECRET?'webhook-secret-derived':
    process.env.SBC_ADMIN_PASSWORD?'admin-password-derived':
    process.env.ADMIN_PASSWORD?'admin-password-derived':
    process.env.CORE_FORTRESS_SALT?'fortress-salt-derived':
    process.env.SBC_ENCRYPTION_KEY?'encryption-key-derived':
    process.env.SBC_APP_SECRET?'app-secret-derived':
    process.env.APP_SECRET?'app-secret-derived':
    process.env.JWT_SECRET?'jwt-secret-derived':
    process.env.COOKIE_SECRET?'cookie-secret-derived':
    process.env.SESSION_SECRET?'session-secret-derived':'unavailable';
  const derivedKey=()=>{
    const material=secret();
    if(!material) throw new Error('No existing SBC application secret is available for snapshot encryption');
    return crypto.createHmac('sha256',material).update('SBC-V47-STATE-SNAPSHOT-AES-256-GCM-V1').digest();
  };
  const ensureSpool=()=>{fs.mkdirSync(spoolDir,{recursive:true,mode:0o700});};

  function encryptSnapshot(value){
    const key=derivedKey();
    const iv=crypto.randomBytes(12); const input=zlib.gzipSync(Buffer.from(JSON.stringify(value)));
    const c=crypto.createCipheriv('aes-256-gcm',key,iv); const data=Buffer.concat([c.update(input),c.final()]);
    return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
  }
  function decryptSnapshot(blob){
    const key=derivedKey();
    const [v,ivS,tagS,dataS]=String(blob).split('.'); if(v!=='v1') throw new Error('unsupported snapshot');
    const d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivS,'base64url'));d.setAuthTag(Buffer.from(tagS,'base64url'));
    return JSON.parse(zlib.gunzipSync(Buffer.concat([d.update(Buffer.from(dataS,'base64url')),d.final()])).toString('utf8'));
  }
  async function persistStateSnapshot(scope,state){
    const blob=encryptSnapshot({scope:String(scope),savedAt:new Date().toISOString(),state});
    if(mysqlPool){
      await mysqlPool.query(`CREATE TABLE IF NOT EXISTS sbc_v463_state_snapshots(scope_key VARCHAR(191) PRIMARY KEY,snapshot_blob LONGTEXT NOT NULL,saved_at DATETIME NOT NULL) ENGINE=InnoDB`);
      await mysqlPool.query(`INSERT INTO sbc_v463_state_snapshots(scope_key,snapshot_blob,saved_at) VALUES(?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE snapshot_blob=VALUES(snapshot_blob),saved_at=UTC_TIMESTAMP()`,[String(scope).slice(0,191),blob]);
      return {backend:'mysql',saved:true};
    }
    ensureSpool(); const file=path.join(spoolDir,'state-'+crypto.createHash('sha256').update(String(scope)).digest('hex').slice(0,24)+'.snapshot'); fs.writeFileSync(file,blob,{mode:0o600}); return {backend:'file',saved:true};
  }
  async function restoreStateSnapshot(scope){
    let blob='';
    if(mysqlPool){try{const [rows]=await mysqlPool.query('SELECT snapshot_blob FROM sbc_v463_state_snapshots WHERE scope_key=? LIMIT 1',[String(scope)]);blob=rows?.[0]?.snapshot_blob||'';}catch(e){logger.warn('[V46.3] snapshot read:',e.message)}}
    if(!blob){ensureSpool();const file=path.join(spoolDir,'state-'+crypto.createHash('sha256').update(String(scope)).digest('hex').slice(0,24)+'.snapshot');if(fs.existsSync(file))blob=fs.readFileSync(file,'utf8')}
    return blob?decryptSnapshot(blob).state:null;
  }
  function signTelemetryToken(payload,{ttlSeconds=300}={}){
    const key=String(process.env.SBC_TELEMETRY_SIGNING_SECRET||process.env.SBC_SESSION_SECRET||''); if(!key) throw new Error('telemetry signing secret not configured');
    const body={...payload,iat:Date.now(),exp:Date.now()+Math.max(30,ttlSeconds)*1000}; const encoded=Buffer.from(JSON.stringify(body)).toString('base64url');
    const sig=crypto.createHmac('sha256',key).update(encoded).digest('base64url'); return `${encoded}.${sig}`;
  }
  function verifyTelemetryToken(token){try{const [b,s]=String(token).split('.');const key=String(process.env.SBC_TELEMETRY_SIGNING_SECRET||process.env.SBC_SESSION_SECRET||'');if(!b||!s||!key)return null;const e=crypto.createHmac('sha256',key).update(b).digest('base64url');if(!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)))return null;const p=JSON.parse(Buffer.from(b,'base64url').toString('utf8'));return Number(p.exp)>Date.now()?p:null;}catch{return null}}
  function scrubLead(lead={}){
    const out={...lead}; for(const k of Object.keys(out)){if(typeof out[k]==='string')out[k]=out[k].trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,2000)}
    const email=String(out.email||'').toLowerCase(); const phone=String(out.phone||'').replace(/\D/g,'');
    const validEmail=!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); const validPhone=!phone || phone.length>=10;
    const validBusiness=Boolean(String(out.businessName||out.business||out.company||'').trim());
    const evidence=Boolean(out.website||out.googleBusinessProfile||out.city||out.state||out.source||out.leadSource);
    const fingerprint=crypto.createHash('sha256').update([String(out.businessName||out.business||out.company||'').toLowerCase(),email,phone,String(out.website||'').toLowerCase()].join('|')).digest('hex');
    return {ok:Boolean(validEmail&&validPhone&&validBusiness&&(evidence||email||phone||out.website)),reason:!validBusiness?'missing-business':!validEmail?'invalid-email':!validPhone?'invalid-phone':'ok',lead:{...out,email,phone},fingerprint};
  }
  async function appendSpool(topic,payload){
    ensureSpool(); const file=path.join(spoolDir,'events.ndjson'); const line=JSON.stringify({id:crypto.randomUUID(),topic,payload,at:new Date().toISOString()})+'\n';
    if(fs.existsSync(file)&&fs.statSync(file).size>50*1024*1024)fs.renameSync(file,file+'.'+Date.now()); fs.appendFileSync(file,line,{mode:0o600}); return {queued:true,backend:'file-spool'};
  }
  async function publish(topic,payload){
    if(redisReady&&redisClient){try{await redisClient.lPush(`sbc:v463:bus:${String(topic).replace(/[^a-zA-Z0-9:_-]/g,'-')}`,JSON.stringify({id:crypto.randomUUID(),topic,payload,at:Date.now()}));return {queued:true,backend:'redis'};}catch(e){logger.warn('[V46.3] redis bus:',e.message)}}
    return appendSpool(topic,payload);
  }
  async function concurrentDispatch(tasks,{concurrency=4}={}){
    const list=Array.isArray(tasks)?tasks:[]; const results=new Array(list.length); let next=0;
    const worker=async()=>{while(true){const i=next++;if(i>=list.length)return;try{results[i]={ok:true,result:await list[i]()};}catch(e){results[i]={ok:false,error:e.message};}}};
    await Promise.all(Array.from({length:Math.max(1,Math.min(concurrency,list.length||1))},worker)); return results;
  }
  function resourcePolicy(){const m=process.memoryUsage();const limit=Math.max(128,Number(process.env.SBC_V463_MEMORY_LIMIT_MB||512));const ratio=m.rss/1024/1024/limit;return {rssMb:Math.round(m.rss/1024/1024),limitMb:limit,ratio:Number(ratio.toFixed(3)),mode:ratio>=.95?'EMERGENCY':ratio>=.8?'THROTTLE':'NORMAL',recommendedConcurrency:ratio>=.95?1:ratio>=.8?2:Math.max(2,Number(process.env.SBC_V463_DEFAULT_CONCURRENCY||6))};}
  function asyncRouter({handler=async payload=>payload,maxConcurrent=1000}={}){let active=0,queued=0;const queue=[];const run=async item=>{active++;try{item.resolve(await handler(item.payload,item.meta));}catch(e){item.reject(e)}finally{active--;pump()}};const pump=()=>{while(active<maxConcurrent&&queue.length)run(queue.shift())};return {submit(payload,meta){if(active>=maxConcurrent&&queue.length>=maxQueue)return Promise.reject(new Error('gateway backpressure: queue full'));return new Promise((resolve,reject)=>{queue.push({payload,meta,resolve,reject});queued=queue.length;pump()})},stats:()=>({active,queued:queue.length,maxConcurrent,maxQueue})};}
  return {encryptSnapshot,decryptSnapshot,persistStateSnapshot,restoreStateSnapshot,signTelemetryToken,verifyTelemetryToken,scrubLead,appendSpool,publish,concurrentDispatch,resourcePolicy,asyncRouter,stateIntervalMs,snapshotSecretSource:secretSource};
}
module.exports={createV463Ultra};

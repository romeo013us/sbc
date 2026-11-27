'use strict';
const {randomUUID}=require('node:crypto');
const C=require('./sbc-campaign-core.cjs');
const jobs='sbc_organic_deliveries',campaigns='sbc_organic_campaigns';
const schema=[
 `CREATE TABLE IF NOT EXISTS sbc_organic_campaigns (
 tenant BIGINT NOT NULL, id VARCHAR(64) NOT NULL, spec TEXT NOT NULL, active TINYINT NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
 `CREATE TABLE IF NOT EXISTS sbc_organic_deliveries (
 tenant BIGINT NOT NULL, at_ms BIGINT NOT NULL, platform VARCHAR(16) NOT NULL, spec TEXT NOT NULL,
 state VARCHAR(16) NOT NULL DEFAULT 'READY', lease VARCHAR(36), retry_ms BIGINT NOT NULL DEFAULT 0,
 attempts INT NOT NULL DEFAULT 0, code VARCHAR(80), provider_id VARCHAR(225) CHARACTER SET ascii COLLATE ascii_bin,
 accepted_ms BIGINT, verified_ms BIGINT, visit_count BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(tenant,at_ms,platform),
 UNIQUE KEY receipt(tenant,platform,provider_id), KEY pending(tenant,state,retry_ms)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
function unpack(r){
 return {...JSON.parse(r.spec),state:r.state,providerId:r.provider_id,acceptedAt:r.provider_id?(Number(r.accepted_ms)||null):null,verifiedAt:Number(r.verified_ms)||null,attempts:r.attempts,visits:Number(r.visit_count),code:r.code};
}
function createStore(pool,tenant){
 const query=(sql,values)=>pool.query(sql,values).then(([r])=>r);
 const key=s=>[tenant,s.at,s.platform];
 const where=' WHERE tenant=? AND at_ms=? AND platform=?';
 return {
  async setup(){for(const sql of schema)await query(sql);},
  async catalog(){
    const rows=await query('SELECT id,spec FROM '+campaigns+' WHERE tenant=? AND active=1 ORDER BY id LIMIT 200',[tenant]);
    return rows.map(r=>({...JSON.parse(r.spec),id:r.id}));
  },
  async add(spec){const id=randomUUID();await query('INSERT INTO '+campaigns+'(tenant,id,spec) VALUES(?,?,?)',[tenant,id,JSON.stringify(spec)]);return id;},
  async archive(id){return (await query('UPDATE '+campaigns+' SET active=0 WHERE tenant=? AND id=? AND active=1',[tenant,id])).affectedRows===1;},
  async seed(items){
    if(!items.length)return;
    const values=items.map(s=>[tenant,s.at,s.platform,JSON.stringify(s),s.missed?'MISSED':'READY']);
    await query('INSERT INTO '+jobs+'(tenant,at_ms,platform,spec,state) VALUES ? ON DUPLICATE KEY UPDATE at_ms=at_ms',[values]);
  },
  async latest(platform){
    const [r]=await query('SELECT MAX(at_ms) AS last FROM '+jobs+' WHERE tenant=? AND platform=?',[tenant,platform]);
    return Number(r.last)||null;
  },
  async recover(now){
    await query("UPDATE "+jobs+" SET state='UNKNOWN', lease=NULL, code='INTERRUPTED_AFTER_DISPATCH' WHERE tenant=? AND state='DISPATCHING' AND retry_ms<=?",[tenant,now]);
    await query("UPDATE "+jobs+" SET state='MISSED', lease=NULL, code='WINDOW_ELAPSED' WHERE tenant=? AND state IN ('READY','PREPARING') AND at_ms<=? AND retry_ms<=?",[tenant,now-C.INTERVAL,now]);
  },
  async claim(s,now){
    const token=randomUUID();
    const r=await query("UPDATE "+jobs+" SET state='PREPARING',attempts=attempts+1,lease=?,retry_ms=?"+where+" AND state IN ('READY','PREPARING') AND retry_ms<=? AND at_ms>? AND at_ms<=?",[token,now+180000,...key(s),now,now-C.INTERVAL,now]);
    return r.affectedRows===1?token:null;
  },
  async fence(s,token,now){
    return (await query("UPDATE "+jobs+" SET state='DISPATCHING',retry_ms=?,accepted_ms=?"+where+" AND state='PREPARING' AND lease=? AND retry_ms>? AND at_ms>?",[now+180000,now,...key(s),token,now,now-C.INTERVAL])).affectedRows===1;
  },
  // Record the dispatch boundary before sending. It is a lower bound on
  // delivery time, exposed only after a provider receipt is found. Explicit
  // rejection clears it; ambiguous responses and crash recovery retain it.
  async settle(s,token,state,code,retry,id,now){
    return (await query("UPDATE "+jobs+" SET state=?,code=?,retry_ms=?,provider_id=?,accepted_ms=CASE WHEN ? THEN COALESCE(accepted_ms,?) ELSE NULL END,lease=NULL"+where+" AND lease=? AND state IN ('PREPARING','DISPATCHING')",[state,code,retry,id,Boolean(id)||state==='UNKNOWN',id?now:null,...key(s),token])).affectedRows===1;
  },
  async due(now){
    const rows=await query("SELECT * FROM "+jobs+" WHERE tenant=? AND at_ms<=? AND retry_ms<=? AND state IN ('READY','PREPARING') ORDER BY at_ms DESC,platform LIMIT 8",[tenant,now,now]);
    return rows.map(unpack);
  },
  async pending(now){
    const rows=await query("SELECT * FROM "+jobs+" WHERE tenant=? AND at_ms>=? AND retry_ms<=? AND state IN ('ACCEPTED','UNKNOWN') ORDER BY retry_ms,at_ms LIMIT 8",[tenant,now-30*86400000,now]);
    return rows.map(unpack);
  },
  async reconcile(s,id,verified,now){
    const state=verified?'VERIFIED':id?'ACCEPTED':s.state;
    await query("UPDATE "+jobs+" SET state=?,provider_id=COALESCE(provider_id,?),accepted_ms=COALESCE(accepted_ms,?),verified_ms=?,retry_ms=?,code=?"+where+" AND state=? AND (provider_id IS NULL OR provider_id=?)",
      [state,id,id?now:null,verified?now:null,now+(now-s.at>C.INTERVAL?3600000:180000),verified?null:id?'AWAITING_READBACK':'AMBIGUOUS_DELIVERY',...key(s),s.state,id]);
  },
  async visit(at,platform,count){
    const [row]=await query("SELECT spec FROM "+jobs+where+" AND state IN ('DISPATCHING','UNKNOWN','ACCEPTED','VERIFIED')",[tenant,at,platform]);
    if(!row)return null;
    const s=JSON.parse(row.spec);
    if(!s.link||s.link===s.url)return null;
    if(count)await query('UPDATE '+jobs+' SET visit_count=visit_count+1'+where,[tenant,at,platform]);
    return s.url;
  },
  async history(from,to){
    const rows=await query('SELECT * FROM '+jobs+' WHERE tenant=? AND at_ms>=? AND at_ms<=? ORDER BY at_ms DESC,platform',[tenant,from,to]);
    return rows.map(unpack);
  }
 };
}
module.exports={createStore};

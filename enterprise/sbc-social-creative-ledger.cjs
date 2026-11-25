'use strict';
// Corporate artwork staging only. Existing external publisher remains the sole sender.
const crypto=require('node:crypto');
const {slots,duplicate,dhash}=require('./sbc-social-asset-engine.cjs');
const {CHANNELS,businessDate}=require('./sbc-marketing-readback.cjs');
const err=code=>{throw Error(code)};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const iso=n=>new Date(n).toISOString();
const TABLE='sbc_creative_inventory_v1',CLAIMS='sbc_creative_claim_v1';
function assertActor(actor,tenant,roles){
 if(!Number.isSafeInteger(tenant)||tenant<1||actor?.tenantId!==tenant||typeof actor.id!=='string'||!actor.id.trim()||actor.id.length>120||!roles.includes(actor.role))err('CREATIVE_ACCESS_DENIED');
 return actor;
}
function planReplenishment(now,rows){
 if(!Number.isFinite(now)||!Array.isArray(rows))err('INVALID_CREATIVE_PLAN');
 const day=businessDate(now),next=iso(Date.parse(day+'T00:00:00Z')+86400000).slice(0,10);
 const future=[...new Map([...slots(day),...slots(next)].map(s=>[s.key,s])).values()].filter(s=>Date.parse(s.at)>now).slice(0,14);
 if(future.length!==14)err('INCOMPLETE_SLOT_PLAN');
 const active=new Map(rows.filter(r=>['APPROVED','DRAFT'].includes(r.state)).map(r=>[r.key??r.slot_key,r]));
 const approved=future.filter(s=>active.get(s.key)?.state==='APPROVED').length;
 const drafts=future.filter(s=>active.get(s.key)?.state==='DRAFT').length;
 return {slots:future,approved,drafts,missing:future.filter(s=>!active.has(s.key)),low:approved<6,belowFloor:approved<14};
}
function receiptStatus(claim,proof,verifiedArtworkHash){
 if(!claim?.provider_id||!proof?.verified_at||proof.provider_id!==claim.provider_id||proof.day_et!==claim.day_et||proof.platform!==claim.platform||proof.slot!==claim.slot)return 'UNVERIFIED';
 const posted=Date.parse(proof.published_at),scheduled=Date.parse(claim.scheduled_at);
 if(!Number.isFinite(posted)||!Number.isFinite(scheduled)||posted<scheduled||businessDate(posted)!==claim.day_et)return 'UNVERIFIED';
 if(verifiedArtworkHash===undefined)return 'POST_VERIFIED_ARTWORK_UNVERIFIED';
 return verifiedArtworkHash===claim.asset_sha256?'PUBLISHED_VERIFIED':'ARTWORK_MISMATCH';
}
function createLedger({pool,corporateTenant,writerReady=()=>false,clock=Date.now,verifyPng}={}){
 if(!pool?.getConnection||!pool?.query||!Number.isSafeInteger(corporateTenant)||corporateTenant<1)err('CREATIVE_LEDGER_CONFIG_REQUIRED');
 const tenant=corporateTenant;
 const access=(actor,roles)=>assertActor(actor,tenant,roles);
 async function tx(actor,roles,fn){
  access(actor,roles);if(!writerReady())err('CREATIVE_WRITER_UNAVAILABLE');
  const c=await pool.getConnection();
  try{
   await c.beginTransaction();
   await c.query('INSERT INTO sbc_creative_inventory_lock_v1(tenant_id) VALUES(?) ON DUPLICATE KEY UPDATE tenant_id=tenant_id',[tenant]);
   await c.query('SELECT tenant_id FROM sbc_creative_inventory_lock_v1 WHERE tenant_id=? FOR UPDATE',[tenant]);
   if(!writerReady())err('CREATIVE_WRITER_UNAVAILABLE');
   const value=await fn(c);await c.commit();return value;
  }catch(e){await c.rollback();throw e;}finally{c.release();}
 }
 async function rows(c=pool){
  const [r]=await c.query('SELECT sha256,dhash,slot_key,scheduled_at,service,caption,width,height,state,approved_by,approved_at FROM '+TABLE+' WHERE tenant_id=? ORDER BY created_at,sha256',[tenant]);return r;
 }
 async function snapshot(actor){access(actor,['owner','system']);const inventory=await rows();return {...planReplenishment(clock(),inventory),assets:inventory};}
 async function stage(actor,candidates){
  access(actor,['owner','system']);
  if(!Array.isArray(candidates)||candidates.length<1||candidates.length>14||typeof verifyPng!=='function')err('CREATIVE_CANDIDATE_VERIFIER_REQUIRED');
  // Only the trusted importer supplies candidates; independently calculate both hashes.
  const checked=[];
  for(const row of candidates){
   if(!Buffer.isBuffer(row.png)||row.png.length>5*1024*1024||hash(row.png)!==row.sha256)err('ASSET_INTEGRITY');
   const pixels=await verifyPng(row.png);
   if(pixels.dhash!==row.dhash||pixels.width!==row.width||pixels.height!==row.height||!['1080x1080','1200x630'].includes(row.width+'x'+row.height))err('ASSET_INTEGRITY');
   if(!['Websites','Hosting','Printing','Office Box','SEO','Notary'].includes(row.service)||typeof row.caption!=='string'||!row.caption.trim()||row.caption.length>1000)err('INVALID_CREATIVE_COPY');
   checked.push({...row,png:Buffer.from(row.png)});
  }
  return tx(actor,['owner','system'],async c=>{
   const inventory=await rows(c),plan=planReplenishment(clock(),inventory),missing=new Map(plan.missing.map(s=>[s.key,s]));
   for(const row of checked){
    const slot=missing.get(row.key);
    if(!slot||slot.at!==row.at||duplicate(row,inventory))err('DUPLICATE_OR_UNAVAILABLE_CREATIVE');
    await c.query('INSERT INTO '+TABLE+' (tenant_id,sha256,dhash,slot_key,scheduled_at,service,caption,width,height,png,state) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[tenant,row.sha256,row.dhash,row.key,row.at,row.service,row.caption,row.width,row.height,row.png,'DRAFT']);
    inventory.push(row);missing.delete(row.key);
   }
   return {staged:checked.length};
  });
 }
 async function approve(actor,sha){
  if(!/^[a-f0-9]{64}$/.test(sha))err('INVALID_ASSET_HASH');
  return tx(actor,['owner'],async c=>{
   const [[row]]=await c.query('SELECT png,scheduled_at,state FROM '+TABLE+' WHERE tenant_id=? AND sha256=? FOR UPDATE',[tenant,sha]);
   if(!row||row.state!=='DRAFT'||Date.parse(row.scheduled_at)<=clock()||hash(row.png)!==sha)err('CREATIVE_NOT_APPROVABLE');
   await c.query('UPDATE '+TABLE+' SET state=?,approved_by=?,approved_at=UTC_TIMESTAMP(3) WHERE tenant_id=? AND sha256=?',['APPROVED',actor.id,tenant,sha]);
   return {approved:true,sha256:sha};
  });
 }
 async function artwork(actor,sha){
  access(actor,['owner','system']);if(!/^[a-f0-9]{64}$/.test(sha))err('INVALID_ASSET_HASH');
  const [[row]]=await pool.query('SELECT png,state FROM '+TABLE+' WHERE tenant_id=? AND sha256=?',[tenant,sha]);
  if(!row||hash(row.png)!==sha||(actor.role==='system'&&row.state!=='APPROVED'))err('ARTWORK_UNAVAILABLE');
  return row.png;
 }
 async function claim(actor,{day,platform,slot}={}){
  if(!Object.hasOwn(CHANNELS,platform)||!['AM','PM'].includes(slot))err('INVALID_SLOT');
  const wanted=slots(day).find(s=>s.day===day&&s.hour===(slot==='AM'?10:22));
  if(!wanted||Date.parse(wanted.at)>clock()||businessDate(clock())!==day)err('SLOT_NOT_DUE');
  return tx(actor,['system'],async c=>{
   const [[existing]]=await c.query('SELECT asset_sha256 FROM '+CLAIMS+' WHERE tenant_id=? AND day_et=? AND platform=? AND slot=? FOR UPDATE',[tenant,day,platform,slot]);
   if(existing)err('SLOT_ALREADY_CLAIMED_RECONCILE');
   const [[row]]=await c.query('SELECT sha256,png,caption FROM '+TABLE+' WHERE tenant_id=? AND slot_key=? AND state=? FOR UPDATE',[tenant,wanted.key,'APPROVED']);
   if(!row||hash(row.png)!==row.sha256)err('APPROVED_ARTWORK_UNAVAILABLE');
   await c.query('INSERT INTO '+CLAIMS+' (tenant_id,day_et,platform,slot,asset_sha256,scheduled_at) VALUES(?,?,?,?,?,?)',[tenant,day,platform,slot,row.sha256,wanted.at]);
   return {sha256:row.sha256,png:row.png,caption:row.caption,idempotencyKey:hash(tenant+':'+platform+':'+wanted.key+':'+row.sha256)};
  });
 }
 async function receipts(actor,day){
  access(actor,['owner','system']);slots(day);
  const [result]=await pool.query('SELECT c.*,r.provider_id,r.verified_at,r.published_at,r.permalink,r.day_et AS receipt_day FROM '+CLAIMS+' c LEFT JOIN sbc_marketing_slot_receipts r ON c.tenant_id=r.tenant_id AND c.day_et=r.day_et AND c.platform=r.platform AND c.slot=r.slot WHERE c.tenant_id=? AND c.day_et=? ORDER BY c.platform,c.slot',[tenant,day]);
  return result.map(r=>({...r,status:receiptStatus(r,r.receipt_day?{...r,day_et:r.receipt_day}:null)}));
 }
 return {snapshot,stage,approve,artwork,claim,receipts};
}
module.exports={assertActor,planReplenishment,receiptStatus,createLedger};

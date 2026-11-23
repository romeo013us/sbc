'use strict';
/* SBC call attempt ledger views. Raw rows are persisted via the existing call log
 * MySQL snapshot and never fabricated from a customer phone field. */
const stamp=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?t:0};
const dateStart=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?Date.parse(String(v)+'T00:00:00.000Z'):0;
const digits=v=>String(v||'').replace(/\D/g,'');
function list(callLogs,customers,opts={}){
 const tenant=Number(opts.tenantId),actor=String(opts.actorId||'');
 if(!Number.isSafeInteger(tenant)||tenant<=0||!actor)throw Error('VOICE_LEDGER_SCOPE_REQUIRED');
 const custMap=new Map((customers||[]).filter(c=>Number(c.tenantId??c.tenant_id)===tenant).map(c=>[String(c.id),c]));
 const from=dateStart(opts.from),to=dateStart(opts.to),phone=digits(opts.number);
 const pageSize=Math.min(250,Math.max(1,Number(opts.limit)||50)),offset=Math.max(0,Math.min(100000,Number(opts.offset)||0));
 const rows=(callLogs||[]).filter(log=>{
  if(Number(log.tenantId??log.tenant_id)!==tenant)return false;
  if(!opts.isOwner&&String(log.userId)!==actor)return false;
  if(opts.customerId&&String(log.customerId||'')!==String(opts.customerId))return false;
  if(opts.outcome&&String(log.outcome||'').toLowerCase()!==String(opts.outcome).toLowerCase())return false;
  if(opts.status&&String(log.status||'').toLowerCase()!==String(opts.status).toLowerCase())return false;
  if(phone&&!digits(log.to).includes(phone))return false;
  const when=stamp(log.endedAt||log.startedAt||log.createdAt);
  if(from&&when<from)return false;if(to&&when>=to+86400000)return false;return true;
 }).sort((a,b)=>stamp(b.endedAt||b.startedAt||b.createdAt)-stamp(a.endedAt||a.startedAt||a.createdAt));
 const total=rows.length;
 return {ok:true,total,offset,limit:pageSize,nextOffset:offset+pageSize<total?offset+pageSize:null,rows:rows.slice(offset,offset+pageSize).map(log=>({
  id:log.id,customerId:log.customerId||'',businessName:custMap.get(String(log.customerId))?.businessName||'',
  userId:log.userId||'',userName:log.userName||'',number:log.to||'',manualDial:log.manualDial===true,
  status:log.status||'',outcome:log.outcome||'Pending',notes:log.notes||'',nextAction:log.nextAction||'',
  followUpAt:log.followUpAt||'',durationSec:Number(log.durationSec||0),startedAt:log.startedAt||'',
  endedAt:log.endedAt||'',createdAt:log.createdAt||'',callSid:log.callSid||''
 }))};
}
module.exports=Object.freeze({list});

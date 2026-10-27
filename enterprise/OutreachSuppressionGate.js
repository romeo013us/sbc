'use strict';
const MARKETING_PURPOSES=new Set(['marketing','promotional','cold_outreach']);
const BYPASS_PURPOSES=new Set(['transactional','owner_initiated','customer_callback','existing_customer']);
function cleanPhone(v){return String(v||'').replace(/[^\d+]/g,'');}

class OutreachSuppressionGate{
  constructor(poolProvider,{dailyCap=Number(process.env.SBC_OUTREACH_DAILY_CAP||100),windowCap=Number(process.env.SBC_OUTREACH_24H_CAP||100)}={}){
    this.poolProvider=poolProvider;
    this.dailyCap=Math.max(1,Math.min(10000,dailyCap));
    this.windowCap=Math.max(1,Math.min(10000,windowCap));
  }
  async verifyOutboundPermission({tenantId,phone,channel='sms',purpose='marketing',suppressed=false,optInProof=null}={}){
    const p=String(purpose).toLowerCase(), ch=String(channel).toLowerCase(), clean=cleanPhone(phone);
    if(suppressed)return {status:'SUPPRESSED',allowed:false,action:'BLOCK_TWILIO_MUTATION',reason:'CONTACT_SUPPRESSED'};
    if(BYPASS_PURPOSES.has(p))return {status:'ALLOWED',allowed:true,action:'EXECUTE_OUTBOUND_CARRIER_PACKET',reason:'PURPOSE_ALLOWED'};
    if(!MARKETING_PURPOSES.has(p))return {status:'ALLOWED',allowed:true,action:'EXECUTE_OUTBOUND_CARRIER_PACKET',reason:'NON_MARKETING_PURPOSE'};
    const pool=this.poolProvider?.();
    if(!pool)return {status:'SUPPRESSED',allowed:false,action:'BLOCK_TWILIO_MUTATION',reason:'CONSENT_REGISTRY_UNAVAILABLE'};
    const [rows]=await pool.query('SELECT has_marketing_consent,opt_in_timestamp,suppressed FROM sbc_lead_consent_registry WHERE tenant_id=? AND phone=? LIMIT 1',[tenantId,clean]);
    const match=rows[0];
    if(!match || Number(match.suppressed)===1 || Number(match.has_marketing_consent)!==1 || !match.opt_in_timestamp){
      return {status:'SUPPRESSED',allowed:false,action:'BLOCK_TWILIO_MUTATION',reason:'EXPLICIT_MARKETING_CONSENT_REQUIRED',channel:ch};
    }
    const cap=await this.#reserveBudget(pool,tenantId,ch);
    if(!cap.allowed)return {...cap,channel:ch};
    return {status:'ALLOWED',allowed:true,action:'EXECUTE_OUTBOUND_CARRIER_PACKET',reason:'EXPLICIT_MARKETING_CONSENT_VERIFIED',channel:ch,optInProof:optInProof||'registry',budget:cap};
  }
  async #reserveBudget(pool,tenantId,channel){
    const dayKey=new Date().toISOString().slice(0,10);
    const hourWindow=Math.floor(Date.now()/3600000);
    try{
      await pool.execute(`INSERT INTO sbc_outreach_volume_ledger(tenant_id,day_key,hour_window,channel,count_24h,count_day,updated_at) VALUES(?,?,?,?,1,1,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE count_24h=count_24h+1,count_day=count_day+1,updated_at=UTC_TIMESTAMP()`,[tenantId,dayKey,hourWindow,channel]);
      const [dayRows]=await pool.execute(`SELECT COALESCE(SUM(count_day),0) AS count_day FROM sbc_outreach_volume_ledger WHERE tenant_id=? AND day_key=? AND channel=?`,[tenantId,dayKey,channel]);
      const [windowRows]=await pool.execute(`SELECT COALESCE(SUM(count_24h),0) AS count_24h FROM sbc_outreach_volume_ledger WHERE tenant_id=? AND updated_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR AND channel=?`,[tenantId,channel]);
      const row={count_day:Number(dayRows[0]?.count_day||0),count_24h:Number(windowRows[0]?.count_24h||0)};
      if(row.count_day>this.dailyCap || row.count_24h>this.windowCap){
        await pool.execute(`UPDATE sbc_outreach_volume_ledger SET count_day=GREATEST(count_day-1,0),count_24h=GREATEST(count_24h-1,0),updated_at=UTC_TIMESTAMP() WHERE tenant_id=? AND day_key=? AND hour_window=? AND channel=?`,[tenantId,dayKey,hourWindow,channel]);
        return {status:'THROTTLED',allowed:false,action:'HOLD_OUTREACH',reason:'OUTREACH_VOLUME_CAP'};
      }
      return {allowed:true,countDay:Number(row.count_day),count24h:Number(row.count_24h)};
    }catch(e){return {status:'THROTTLED',allowed:false,action:'HOLD_OUTREACH',reason:'VOLUME_LEDGER_UNAVAILABLE'};}
  }
}
module.exports={OutreachSuppressionGate,MARKETING_PURPOSES,BYPASS_PURPOSES,cleanPhone};

'use strict';
const crypto = require('crypto');

class OutreachControlNexus {
  constructor(poolProvider) { this.poolProvider = poolProvider; }
  async evaluateOutreachSuppression({tenantId, phone, channel, purpose, suppressed=false, optInProof=null}={}) {
    if (!tenantId) throw new Error('TENANT_REQUIRED');
    const cleanPhone = String(phone || '').replace(/[^\d+]/g,'');
    if (!cleanPhone) return {permitted:false, action:'SUPPRESS_OUTREACH', reason:'PHONE_REQUIRED'};
    const bypass = ['transactional','owner_initiated','customer_callback','existing_customer'];
    if (bypass.includes(String(purpose || '').toLowerCase())) {
      return {permitted: !suppressed, action: suppressed?'SUPPRESS_OUTREACH':'PROCEED_IMMEDIATE'};
    }
    if (suppressed) return {permitted:false,action:'SUPPRESS_OUTREACH',reason:'SUPPRESSION_FLAG_ACTIVE'};
    const pool=this.poolProvider?.();
    if (!pool) return {permitted:false,action:'SUPPRESS_OUTREACH',reason:'CONSENT_REGISTRY_UNAVAILABLE'};
    const [rows]=await pool.execute(
      `SELECT has_marketing_consent,opt_in_timestamp,consent_source
       FROM sbc_lead_consent_registry WHERE tenant_id=? AND phone=? LIMIT 1`,
      [tenantId,cleanPhone]
    );
    const consent=rows[0];
    if (!consent || Number(consent.has_marketing_consent)!==1 || !consent.opt_in_timestamp || !optInProof) {
      return {permitted:false,action:'SUPPRESS_OUTREACH',reason:'MARKETING_COMPLIANCE_HOLD'};
    }
    return {permitted:true,action:'PROCEED_COMPLIANCE_CLEARED'};
  }

  async advanceCallState({eventId,currentState,nextState,telemetry={}}={}) {
    const allowed = {
      READY:['CALLING','FROZEN'], CALLING:['CONVERSATION','NO_ANSWER','BUSY','FAILED'],
      CONVERSATION:['QUALIFIED','LOST','CALLBACK_QUEUED'], NO_ANSWER:['FOLLOW_UP_QUEUED','LOST'],
      BUSY:['FOLLOW_UP_QUEUED','LOST'], FAILED:['FOLLOW_UP_QUEUED','LOST'],
      FOLLOW_UP_QUEUED:['CALLING','FROZEN'], CALLBACK_QUEUED:['CALLING','FROZEN'],
      QUALIFIED:['CALLBACK_QUEUED','FROZEN'], LOST:['READY'], FROZEN:[]
    };
    const from=String(currentState||'').toUpperCase(), to=String(nextState||'').toUpperCase();
    if (!allowed[from] || !allowed[from].includes(to)) throw new Error(`INVALID_CALL_TRANSITION:${from}->${to}`);
    const pool=this.poolProvider?.();
    if (!pool) return {ok:true,persisted:false,eventId,nextState:to};
    const conn=await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows]=await conn.execute('SELECT status FROM sbc_agent_event_bus WHERE id=? FOR UPDATE',[eventId]);
      if (!rows.length) throw new Error('TARGET_EVENT_RECORD_NOT_FOUND');
      await conn.execute(
        `UPDATE sbc_agent_event_bus SET status=?,payload=JSON_MERGE_PATCH(COALESCE(payload,JSON_OBJECT()),?),processed_at=UTC_TIMESTAMP() WHERE id=?`,
        [to.toLowerCase(),JSON.stringify({call_telemetry:telemetry}),eventId]
      );
      await conn.commit();
      return {ok:true,persisted:true,eventId,nextState:to};
    } catch(e){await conn.rollback();throw e;} finally{conn.release();}
  }

  async queueAppointmentCallback(tenantId, prospectId, callbackPayload={}) {
    if(!tenantId || !prospectId) throw new Error('TENANT_AND_PROSPECT_REQUIRED');
    const tracking=`APT_CB_${tenantId}_${prospectId}_${callbackPayload.scheduled_timestamp||''}`;
    const idempotencyKey=crypto.createHash('sha256').update(tracking).digest('hex');
    const pool=this.poolProvider?.();
    if(!pool) return {status:'QUEUED',persisted:false,idempotencyKey};
    try {
      await pool.execute(
        `INSERT INTO sbc_agent_event_bus
         (event_type,aggregate_type,aggregate_id,source_agent,payload,idempotency_key,status,priority,created_at)
         VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`,
        ['appointment.callback','prospect',String(prospectId),'appointment_scheduler_agent',
         JSON.stringify({tenantId,...callbackPayload}),idempotencyKey,'pending',2]
      );
      return {status:'QUEUED',persisted:true,idempotencyKey};
    } catch(e){ if(e.code==='ER_DUP_ENTRY') return {status:'ALREADY_QUEUED',idempotencyKey}; throw e; }
  }
}
module.exports={OutreachControlNexus};

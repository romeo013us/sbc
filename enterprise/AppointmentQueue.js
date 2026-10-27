'use strict';
const crypto=require('crypto');
class AppointmentQueue{
  constructor(poolProvider){this.poolProvider=poolProvider;}
  async register({tenantId,prospectEmail,bookingMetadata={}}={}){
    if(!tenantId)throw new Error('TENANT_REQUIRED');
    if(!prospectEmail)throw new Error('PROSPECT_EMAIL_REQUIRED');
    const uid=`APT_BOOKING_${String(tenantId)}_${prospectEmail}_${bookingMetadata.scheduled_timestamp||''}`;
    const idempotencyKey=crypto.createHash('sha256').update(uid).digest('hex');
    const pool=this.poolProvider?.();
    if(!pool)return {status:'QUEUED',persisted:false,idempotencyKey};
    try{
      await pool.execute(`INSERT INTO sbc_agent_event_bus(event_type,aggregate_type,aggregate_id,source_agent,payload,idempotency_key,status,priority,created_at) VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP())`,['appointment.scheduled','prospect',prospectEmail,'appointment_setter_agent',JSON.stringify(bookingMetadata),idempotencyKey,'pending',2]);
      return {status:'QUEUED',persisted:true,idempotencyKey};
    }catch(e){if(e.code==='ER_DUP_ENTRY')return {status:'ALREADY_QUEUED',idempotencyKey};throw e;}
  }
}
module.exports={AppointmentQueue};

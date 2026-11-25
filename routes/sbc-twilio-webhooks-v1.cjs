'use strict';
// Preserve original provider authentication and event idempotency.
function createTwilioWebhooks(getContext){return {
inbound:async(req,res)=>{
 const ctx=getContext();const {inboundWebhookAuthorized,REVENUE_SUPERVISOR,ensureRevenueOSSchema,crypto,SBC_APPOINTMENT_RECOVERY}=ctx;
  if(!inboundWebhookAuthorized(req)) return res.status(401).json({ok:false,error:'Inbound webhook authentication failed.'});
  try{
    const b=req.body||{};
    const externalId=b.MessageSid||b.messageSid||b.id||req.get('x-idempotency-key')||'';
    const out=await REVENUE_SUPERVISOR.handleInbound({
      leadId:b.leadId||b.customerId,
      message:b.Body||b.body||b.message,
      email:b.Email||b.email,
      phone:b.From||b.from||b.phone,
      channel:'sms',
      externalId,
      metadata:{provider:b.provider||'twilio'}
    });
    res.status(out.ok===false?202:200).type('application/json').json(out);
  }catch(e){res.status(400).json({ok:false,error:e.message});}

},
status:async(req,res)=>{
 const ctx=getContext();const {inboundWebhookAuthorized,REVENUE_SUPERVISOR,ensureRevenueOSSchema,crypto,SBC_APPOINTMENT_RECOVERY}=ctx;
  if(!inboundWebhookAuthorized(req)) return res.status(401).json({ok:false,error:'Inbound webhook authentication failed.'});
  try{
    const b=req.body||{};
    const sid=String(b.MessageSid||b.CallSid||b.SmsSid||b.id||'');
    if(!sid) return res.status(400).json({ok:false,error:'Twilio event id is required.'});
    await ensureRevenueOSSchema();
    const state=String(b.MessageStatus||b.CallStatus||b.SmsStatus||'').toLowerCase();
    const idem=crypto.createHash('sha256').update(`twilio-status:${sid}:${state}`).digest('hex');
    if(ctx.mysqlPool) await ctx.mysqlPool.query(
      `INSERT INTO sbc_agent_event_bus
       (event_type,aggregate_type,aggregate_id,source_agent,payload,idempotency_key,status,priority,created_at)
       VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE id=id`,
      ['twilio.status','communication',sid,'twilio_webhook_listener',JSON.stringify(b),idem,'pending',2]
    );
    if(/^SM[a-f0-9]{32}$/i.test(sid))await SBC_APPOINTMENT_RECOVERY.delivery(sid,state);
    res.json({ok:true,queued:true,idempotencyKey:idem});
  }catch(e){res.status(503).json({ok:false,error:e.message});}

}
};}
module.exports={createTwilioWebhooks};

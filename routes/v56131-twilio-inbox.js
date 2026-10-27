'use strict';
const crypto=require('crypto');
const querystring=require('querystring');
const INTAKE=require('../enterprise/v56131-lead-intake');

function normalizePhone(v){return INTAKE.normalizePhone(v);}
function twilioUrl(req){
  const configured=String(process.env.SBC_TWILIO_WEBHOOK_PUBLIC_URL||'').trim();
  if(configured)return configured;
  const proto=String(req.headers['x-forwarded-proto']||req.protocol||'https').split(',')[0].trim();
  const host=String(req.headers['x-forwarded-host']||req.get('host')||'');
  return `${proto}://${host}${req.originalUrl}`;
}
function twilioAuthToken(){return String(process.env.SBC_TWILIO_AUTH_TOKEN||process.env.TWILIO_AUTH_TOKEN||'').trim();}
function validateTwilioRequest(req){
  const token=twilioAuthToken(); const signature=String(req.get('X-Twilio-Signature')||'').trim();
  if(!token||!signature)return false;
  try{
    const twilio=require('twilio');
    if(twilio?.validateRequest)return Boolean(twilio.validateRequest(token,signature,twilioUrl(req),req.body||{}));
  }catch{}
  return false;
}
function twiml(message){
  const body=String(message||'').slice(0,1500).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body}</Message></Response>`;
}
function optOut(text){return /^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(String(text||'').trim());}
function optIn(text){return /^(start|unstop|yes|y|opt in|optin)$/i.test(String(text||'').trim());}
function findCustomer(db,from){const p=normalizePhone(from);const d=String(from||'').replace(/global.__SBC_REQUIRE_TENANT(req)D/g,'');return (db.customers||[]).find(c=>normalizePhone(c.phone)===p || String(c.phone||'').replace(/global.__SBC_REQUIRE_TENANT(req)D/g,'')===d);}
async function generateKimReply({customer,body,history=[]}){
  const key=String(process.env.OPENAI_API_KEY||'').trim();
  if(!key)return `Thanks for reaching out. Romeo with SBC will follow up shortly. Reply STOP to opt out.`;
  const model=String(process.env.SBC_KIM_MASTER_MODEL||'gpt-6-astra');
  const context={businessName:customer?.businessName||'',industry:customer?.industry||'',opportunity:customer?.verificationReason||customer?.websiteStatus||'',history:history.slice(-8).map(x=>({direction:x.direction,body:String(x.body||'').slice(0,600)})),incoming:String(body||'').slice(0,1600)};
  const prompt=`You are Kim, the SBC sales assistant. Continue an inbound SMS conversation. Be concise, professional, human, and helpful. Do not claim a purchase, appointment, refund, verification, or provider action that has not happened. Do not send marketing blasts. If the person asks for a human, say Romeo/the sales team will follow up. Keep the reply under 500 characters and include no markdown. Context: ${JSON.stringify(context)}`;
  try{
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions:'You are Kim for Successful By Choice LLC.',input:prompt,max_output_tokens:220}),signal:AbortSignal.timeout(6000)});
    const j=await r.json(); if(!r.ok)throw new Error(j?.error?.message||'AI provider failed');
    const text=String(j.output_text||'').trim(); return text.slice(0,500)||'Thanks for reaching out. Romeo with SBC will follow up shortly.';
  }catch{return 'Thanks for reaching out. Romeo with SBC will follow up shortly. Reply STOP to opt out.';}
}
module.exports=function registerTwilioInbox(app,{getContext,addActivity,audit}){
  app.post('/webhooks/twilio/incoming-sms',async(req,res)=>{
    res.type('text/xml');
    if(!validateTwilioRequest(req))return res.status(403).send(twiml(''));
    const ctx=getContext(); const body=String(req.body?.Body||'').trim().slice(0,1600); const from=normalizePhone(req.body?.From||''); const sid=String(req.body?.MessageSid||req.body?.SmsMessageSid||'').trim();
    if(!from)return res.status(400).send(twiml(''));
    const messages=ctx.db.customerMessages=Array.isArray(ctx.db.customerMessages)?ctx.db.customerMessages:[];
    if(sid && messages.some(x=>x.providerMessageSid===sid))return res.status(200).send(twiml(''));
    const customer=findCustomer(ctx.db,from);
    if(!customer){
      messages.unshift({id:'sms_'+crypto.randomBytes(8).toString('hex'),providerMessageSid:sid,direction:'inbound',channel:'sms',from,to:req.body?.To||'',body,receivedAt:new Date().toISOString(),status:'unmatched'});
      ctx.db.customerMessages=messages.slice(0,2000); ctx.saveData?.();
      return res.status(200).send(twiml('Thanks for reaching out to SBC. We received your message and will have someone follow up shortly. Reply STOP to opt out.'));
    }
    customer.sbcSmsOptOut=optOut(body)?true:(optIn(body)?false:Boolean(customer.sbcSmsOptOut));
    customer.smsOptIn=customer.sbcSmsOptOut?false:(optIn(body)?true:customer.smsOptIn===true);
    customer.lastInboundSmsAt=new Date().toISOString();
    customer.sbcRevenueSmsContext=customer.sbcRevenueSmsContext||{messages:[]};
    customer.sbcRevenueSmsContext.messages=Array.isArray(customer.sbcRevenueSmsContext.messages)?customer.sbcRevenueSmsContext.messages:[];
    const inbound={id:'sms_'+crypto.randomBytes(8).toString('hex'),providerMessageSid:sid,direction:'inbound',channel:'sms',from,to:req.body?.To||'',body,customerId:customer.id,receivedAt:new Date().toISOString(),status:'received'};
    messages.unshift(inbound); customer.sbcRevenueSmsContext.messages.push({direction:'inbound',body,at:inbound.receivedAt}); customer.sbcRevenueSmsContext.messages=customer.sbcRevenueSmsContext.messages.slice(-20);
    if(optOut(body)){
      customer.smsOptOutAt=inbound.receivedAt; customer.pipelineStage='Contacted';
      Promise.resolve(ctx.saveData?.()).catch(()=>{}); audit?.({id:'system',name:'Twilio',role:'system'},'sms_opt_out',`SMS opt-out received from ${customer.businessName||customer.phone}`,{customerId:customer.id,messageSid:sid});
      return res.status(200).send(twiml('You have been opted out. SBC will not send further marketing texts.'));
    }
    const reply=await generateKimReply({customer,body,history:customer.sbcRevenueSmsContext.messages});
    customer.sbcRevenueSmsContext.messages.push({direction:'outbound',body:reply,at:new Date().toISOString(),channel:'sms'});
    customer.sbcRevenueLastReplyAt=new Date().toISOString(); customer.sbcRevenueLastInboundMessage=body;
    messages.unshift({id:'sms_'+crypto.randomBytes(8).toString('hex'),direction:'outbound',channel:'sms',to:from,body:reply,customerId:customer.id,sentAt:new Date().toISOString(),status:'twiml_response'});
    customer.sbcRevenueSmsContext.messages=customer.sbcRevenueSmsContext.messages.slice(-20);
    Promise.resolve(ctx.saveData?.()).catch(()=>{}); addActivity?.('sms_inbound',`Inbound SMS received from ${customer.businessName||customer.contactName||from}`,{customerId:customer.id,messageSid:sid,replyMode:'kim-twiml'});
    res.status(200).send(twiml(reply));
  });
};
module.exports._test={optOut,optIn,twiml,normalizePhone};

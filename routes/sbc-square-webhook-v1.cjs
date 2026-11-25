'use strict';
// Preserve signed receipt verification and existing durable-before-ACK contract.
function createSquareWebhook(getContext){return async(req,res)=>{
 const ctx=getContext();const {squareSignatureValid,safeJsonParse,squareWebhookRecords,processPendingSquareWebhooks,now,saveData,MONETIZATION_QUEUE}=ctx;
  const raw=req.rawBody?.toString('utf8')||JSON.stringify(req.body||{});
  const sig=req.headers['x-square-hmacsha256-signature'];
  if(!squareSignatureValid(raw,sig))return res.status(403).json({error:'Invalid Square webhook signature.'});
  let event=req.body;
  try{if(!event||typeof event!=='object')event=safeJsonParse(raw,{})}catch{return res.status(400).json({error:'Invalid webhook JSON.'})}
  const eventId=String(event.event_id||'');
  if(!eventId)return res.status(400).json({error:'Square event_id is required.'});
  const events=squareWebhookRecords();
  const existing=events.find(x=>x.eventId===eventId);
  if(existing){
    if(existing.status==='RETRY')processPendingSquareWebhooks().catch(e=>console.error('[SBC] Square retry worker:',e.message));
    return res.status(200).json({ok:true,duplicate:true,queued:existing.status!=='PROCESSED'});
  }
  const rec={eventId,type:String(event.type||''),status:'RECEIVED',createdAt:now(),receivedAt:now(),attempts:0,payload:event};
  events.unshift(rec);events.splice(5000);
  try{await saveData()}catch(e){
    events.splice(events.indexOf(rec),1);
    console.error('[SBC] Square receipt persistence failed:',e.message);
    return res.status(503).json({error:'Webhook receipt could not be durably recorded; please retry.'});
  }
  // Acknowledge only after durable persistence. Processing is deliberately decoupled.
  res.status(200).json({ok:true,received:true,queued:true});
  MONETIZATION_QUEUE.enqueue({pool:ctx.mysqlPool,tenantId:1,eventType:'square.webhook',payload:{event},idempotencyKey:`square:${eventId}`}).catch(e=>processPendingSquareWebhooks().catch(err=>console.error('[SBC] Square fallback worker:',err.message)));

};}
module.exports={createSquareWebhook};

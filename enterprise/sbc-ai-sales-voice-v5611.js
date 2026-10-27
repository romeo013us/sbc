// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const WebSocket = require('ws');
const crypto = require('crypto');
const {EliteCloser} = require('./sbc-elite-closer-v5612');
const {EliteHardening,discoveryTree,isolateObjection,STATE} = require('./sbc-elite-hardening-v56121');
const {evaluateLiveFriction,promptMatrix}=require('./sbc-consultative-sales-v56130');

function clean(v,n=12000){return String(v??'').slice(0,n);}
function now(){return new Date().toISOString();}

class AISalesVoiceBridge {
  constructor({db,closer,addActivity,audit,saveData}={}){this.db=db||{};this.closer=closer;this.addActivity=addActivity||(()=>{});this.audit=audit||(()=>{});this.saveData=saveData||(()=>Promise.resolve());this.sessions=new Map();this.hard=new EliteHardening({db:this.db,mysqlPool:closer?.pool,saveData:this.saveData});this.elite=new EliteCloser({db:this.db,mysqlPool:closer?.pool});}
  twilio(){return {sid:String(process.env.SBC_TWILIO_ACCOUNT_SID||process.env.TWILIO_ACCOUNT_SID||''),token:String(process.env.SBC_TWILIO_AUTH_TOKEN||process.env.TWILIO_AUTH_TOKEN||''),from:String(process.env.SBC_TWILIO_FROM||process.env.TWILIO_PHONE_NUMBER||'')};}
  customer(leadId){return (this.db.customers||[]).find(x=>String(x.id)===String(leadId));}
  prompt(c,profile){const eliteProfile=this.elite.profile(c,[]);return this.elite.prompt(c,eliteProfile,{transcript:'',objection:''})+`\n\nCONSULTATIVE STRATEGY MATRIX V56.13.0:\n${promptMatrix()}\n\nVOICE LAYER: Speak naturally, concisely and confidently. Use the approved conversation sequence. Handle interruptions immediately. Ask one question at a time. Never monologue. If a buying signal appears, move to trial close or close. If the customer requests a human, trigger the handoff tool.\n\nCUSTOMER FACTS: ${JSON.stringify({businessName:c?.businessName,contactName:c?.contactName,industry:c?.industry,website:c?.website,phone:c?.phone})}`;}
  async handle(socket,request,ticket,ticketConsumer){
    const ticketRecord=ticketConsumer?.(ticket);
    if(!ticketRecord){socket.close(1008,'invalid or expired sales ticket');return;}
    const c=this.customer(ticketRecord.leadId);if(!c){socket.close(1008,'lead unavailable');return;}
    const profile=await this.closer.profile(c,Number(__sbcRequireTenantId(c.tenantId)));const memory=await this.hard.memory(c.id,Number(__sbcRequireTenantId(c.tenantId)));const discovery=discoveryTree(c,profile,memory?[{transcript:memory.summary,discoveryIds:[]}]:[]);const liveSession=this.hard.sessionStart({leadId:c.id,tenantId:Number(__sbcRequireTenantId(c.tenantId)),channel:'PHONE',stage:profile.stage,intentScore:profile.intentScore});let twilioStreamSid='',twilioCallSid='',transcript='',startedAt=Date.now(),handoff=false,lastObjectionKey='';this.hard.sessionUpdate(liveSession.sessionId,{state:STATE.CONNECTING,meta:{discoveryNode:discovery.nextNode?.id||'',memory:Boolean(memory)}});
    const model=String(process.env.SBC_AI_VOICE_MODEL||'gpt-realtime-2.1');const apiKey=String(process.env.OPENAI_API_KEY||'');if(!apiKey){socket.close(1011,'AI provider unavailable');return;}
    const ai=new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,{headers:{Authorization:`Bearer ${apiKey}`,'OpenAI-Beta':'realtime=v1'}});
    const sendTwilio=(obj)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(obj));};
    const sendAI=(obj)=>{if(ai.readyState===WebSocket.OPEN)ai.send(JSON.stringify(obj));};
    let finished=false; const finish=async(outcome='COMPLETED')=>{if(finished)return;finished=true;global.__SBC_V56131_REVENUE_TELEMETRY?.record({eventType:'CALL_ENDED',leadId:c.id,callSid:twilioCallSid,state:outcome==='HANDOFF'?'HANDOFF':'ENDED',intentScore:Number(profile.intentScore||0),durationSeconds:Math.max(0,Math.round((Date.now()-startedAt)/1000)),payload:{outcome}});if(this.sessions.has(ticketRecord.leadId))this.sessions.delete(ticketRecord.leadId);this.hard.sessionEnd(liveSession.sessionId,outcome==='HANDOFF'?'HANDOFF':'ENDED');await this.hard.persistMemory(c,{summary:transcript.slice(-10000),objections:[],stage:profile.stage,intentScore:profile.intentScore,ownerDetails:{contactName:c.contactName||'',businessName:c.businessName||'',phone:c.phone||'',email:c.email||''}});const duration=Math.max(0,Math.round((Date.now()-startedAt)/1000));try{await this.closer.recordConversation({leadId:c.id,channel:'PHONE',durationSeconds:duration,transcript,closeOutcome:outcome,callScore:0,intentScore:Number(profile.intentScore||0),offerSku:profile.recommendedOffer?.sku||''});await this.closer.recordEvent({leadId:c.id,eventType:outcome==='COMPLETED'?'CALL_CONNECTED':'CALL_OUTCOME',channel:'PHONE',outcome,metadata:{twilioCallSid,twilioStreamSid,handoff}});await this.saveData();}catch(e){this.addActivity('ai_sales_logging_error',`AI sales call logging failed for ${c.businessName||c.id}: ${e.message}`,{customerId:c.id});}};
    ai.on('open',async()=>{const hook=await this.hard.chooseHook({tenantId:Number(__sbcRequireTenantId(c.tenantId)),name:'opening'}).catch(()=>null);const instructions=this.prompt(c,profile)+`\n\nDISCOVERY CONTEXT TREE: ${JSON.stringify(discovery)}\nPERSISTENT MEMORY: ${JSON.stringify(memory||{})}\nOPENING HOOK VARIANT: ${hook?.hook_text||'Use the approved consultative opening.'}`;sendAI({type:'session.update',session:{type:'realtime',model,audio:{input:{format:{type:'audio/pcmu'}},output:{format:{type:'audio/pcmu'},voice:String(process.env.SBC_AI_VOICE||'marin')}},instructions,turn_detection:{type:'server_vad',create_response:true,interrupt_response:true},input_audio_transcription:{model:'gpt-4o-mini-transcribe',language:'en'},tools:[{type:'function',name:'request_human_handoff',description:'Request a human sales handoff only when the buyer explicitly asks for a human or a protected action cannot be completed autonomously.',parameters:{type:'object',properties:{reason:{type:'string'},pain:{type:'string'},offerSku:{type:'string'},buyingSignal:{type:'string'}},required:['reason','buyingSignal'],additionalProperties:false}},{type:'function',name:'create_autonomous_checkout',description:'Create the authorized SBC Square checkout after the buyer clearly agrees to purchase. Never claim payment occurred. Return the checkout URL and instruct the buyer to complete payment.',parameters:{type:'object',properties:{packageId:{type:'string'},buyingSignal:{type:'string'}},required:['buyingSignal'],additionalProperties:false}}]}});if(hook)await this.hard.recordHookOutcome({tenantId:Number(__sbcRequireTenantId(c.tenantId)),name:'opening',variant:hook.variant,type:'IMPRESSION'}).catch(()=>{});});
    ai.on('message',async raw=>{let e;try{e=JSON.parse(raw.toString())}catch{return;}
      if(e.type==='response.audio.delta'&&e.delta){this.hard.sessionUpdate(liveSession.sessionId,{state:STATE.SPEAKING});sendTwilio({event:'media',streamSid:twilioStreamSid,media:{payload:e.delta}});}
      if(e.type==='response.audio_transcript.delta'){transcript+=clean(e.delta,4000);global.__SBC_V56131_REVENUE_TELEMETRY?.record({eventType:'AI_TRANSCRIPT',leadId:c.id,callSid:twilioCallSid,state:STATE.SPEAKING,intentScore:Number(profile.intentScore||0),payload:{text:clean(e.delta,1200)}});this.hard.sessionUpdate(liveSession.sessionId,{state:STATE.SPEAKING});}
      if(e.type==='conversation.item.input_audio_transcription.completed'){const customerText=clean(e.transcript,4000);transcript+=`\nCUSTOMER: ${customerText}`;const ob=isolateObjection(customerText);if(ob.matched){lastObjectionKey=ob.key;}else if(lastObjectionKey){global.__SBC_V56131_REVENUE_TELEMETRY?.record({eventType:'OBJECTION_RESOLVED',leadId:c.id,callSid:twilioCallSid,state:STATE.LISTENING,intentScore:Number(profile.intentScore||0),objectionKey:lastObjectionKey,payload:{resolutionText:customerText}});lastObjectionKey='';}global.__SBC_V56131_REVENUE_TELEMETRY?.record({eventType:ob.matched?'OBJECTION_DETECTED':'CUSTOMER_TRANSCRIPT',leadId:c.id,callSid:twilioCallSid,state:ob.matched?STATE.OBJECTION:STATE.LISTENING,intentScore:Number(profile.intentScore||0),objectionKey:ob.key,payload:{text:customerText,source:ob.source}});const friction=evaluateLiveFriction(customerText,ob.matched?[ob.key]:[]);this.hard.sessionUpdate(liveSession.sessionId,{state:ob.matched?STATE.OBJECTION:STATE.LISTENING,objectionKey:ob.key,meta:{objectionSource:ob.source,consultativeStrategy:friction.strategy,consultativeGoal:friction.goal}});}
      if(e.type==='input_audio_buffer.speech_started'){global.__SBC_V56131_REVENUE_TELEMETRY?.record({eventType:'INTERRUPTION',leadId:c.id,callSid:twilioCallSid,state:STATE.INTERRUPTED,intentScore:Number(profile.intentScore||0)});this.hard.sessionUpdate(liveSession.sessionId,{state:STATE.INTERRUPTED});sendTwilio({event:'clear',streamSid:twilioStreamSid});}
      if(e.type==='response.function_call_arguments.done'&&e.name==='create_autonomous_checkout'){
        let args={};try{args=JSON.parse(e.arguments||'{}')}catch{}
        const supervisor=global.__SBC_REVENUE_SUPERVISOR;
        let result={ok:false,action:'CHECKOUT_UNAVAILABLE'};
        try{
          if(!supervisor||typeof supervisor.createCheckoutForCustomer!=='function') throw new Error('Checkout service unavailable.');
          const checkout=await supervisor.createCheckoutForCustomer(c,args.packageId||c.sbcRevenueOfferPackageId||'starter');
          let delivery={sent:false,reason:'voice_session'};
          if(typeof supervisor.sendCheckout==='function') delivery=await supervisor.sendCheckout(c,checkout,'voice-purchase-intent');
          result={ok:true,action:'CHECKOUT_READY',url:String(checkout.url||''),orderId:String(checkout.order?.id||''),deliveryChannel:String(delivery.channel||''),paymentStatus:'PENDING'};
          global.__SBC_V56131_REVENUE_TELEMETRY?.record({eventType:'CHECKOUT_READY',leadId:c.id,callSid:twilioCallSid,state:STATE.CLOSING,intentScore:Number(profile.intentScore||0),payload:{orderId:result.orderId,offerSku:profile.recommendedOffer?.sku||'',deliveryChannel:result.deliveryChannel}});
        }catch(err){result={ok:false,action:'CHECKOUT_RECOVERY',error:clean(err.message||err,300)};this.addActivity('ai_sales_checkout_recovery',`Autonomous checkout recovery required for ${c.businessName||c.id}: ${clean(err.message||err,300)}`,{customerId:c.id});}
        sendAI({type:'conversation.item.create',item:{type:'function_call_output',call_id:e.call_id,output:JSON.stringify(result)}});
        sendAI({type:'response.create'});
      }
      if(e.type==='response.function_call_arguments.done'&&e.name==='request_human_handoff'){
        let args={};try{args=JSON.parse(e.arguments||'{}')}catch{}
        handoff=true;global.__SBC_V56131_REVENUE_TELEMETRY?.record({eventType:'HOT_LEAD_HANDOFF',leadId:c.id,callSid:twilioCallSid,state:STATE.HANDOFF,intentScore:Number(profile.intentScore||0),payload:{reason:args.reason||'',offerSku:args.offerSku||profile.recommendedOffer?.sku||'',buyingSignal:args.buyingSignal||''}});this.hard.freezeLead(c.id,'HOT_LEAD_HANDOFF');this.hard.sessionUpdate(liveSession.sessionId,{state:STATE.HANDOFF,stage:'HANDOFF'});await this.closer.recordEvent({leadId:c.id,eventType:'AI_HANDOFF_REQUESTED',channel:'PHONE',outcome:'HOT',metadata:{...args,twilioCallSid,offerSku:profile.recommendedOffer?.sku||''}});
        if(global.__SBC_RECENT_RUNTIME_EVENTS){global.__SBC_RECENT_RUNTIME_EVENTS.push({id:crypto.randomUUID(),event:'ai_sales_handoff',level:'WARN',component:'AI_REVENUE_CLOSER',context:{leadId:c.id,businessName:c.businessName,reason:args.reason||'',offerSku:args.offerSku||profile.recommendedOffer?.sku||''},at:now()});}
        sendAI({type:'conversation.item.create',item:{type:'function_call_output',call_id:e.call_id,output:JSON.stringify({ok:true,action:'HUMAN_HANDOFF_REQUESTED',message:'A human sales owner has been alerted. Tell the customer a specialist is joining the conversation now.'})}});
        sendAI({type:'response.create'});
      }
      if(e.type==='error'){this.addActivity('ai_sales_voice_error',`AI voice session error: ${clean(e.error?.message||'Unknown',300)}`,{customerId:c.id});}
    });
    ai.on('close',()=>{finish(handoff?'HANDOFF':'COMPLETED').catch(()=>{});});
    ai.on('error',()=>{});
    socket.on('message',data=>{let m;try{m=JSON.parse(data.toString())}catch{return;}
      if(m.event==='start'){twilioStreamSid=String(m.start?.streamSid||'');twilioCallSid=String(m.start?.callSid||'');this.sessions.set(ticket.leadId,{twilioStreamSid,twilioCallSid,leadId:c.id,startedAt});global.__SBC_V56131_REVENUE_TELEMETRY?.record({eventType:'CALL_CONNECTED',leadId:c.id,callSid:twilioCallSid,state:STATE.CONNECTED,intentScore:Number(profile.intentScore||0),payload:{streamSid:twilioStreamSid}});sendAI({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:'The customer has just answered the outbound call. Begin the approved opening now.'}]}});sendAI({type:'response.create'});}
      if(m.event==='media'&&m.media?.payload)sendAI({type:'input_audio_buffer.append',audio:m.media.payload});
      if(m.event==='stop'){try{ai.close()}catch{}finish('CALL_ENDED').catch(()=>{});}
    });
    socket.on('close',()=>{try{ai.close()}catch{}finish(handoff?'HANDOFF':'CALL_ENDED').catch(()=>{});});
    socket.on('error',()=>{try{ai.close()}catch{}});
  }
}
module.exports={AISalesVoiceBridge};

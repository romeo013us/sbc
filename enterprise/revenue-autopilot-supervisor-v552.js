'use strict';

/**
 * SBC V55.2 — Revenue Autopilot Supervisor
 * Manager + mechanic layer over the existing revenue engine.
 * No secrets are accepted from request bodies. Protected actions stay owner-gated.
 */
const crypto = require('crypto');

const RETRYABLE_HTTP = new Set([408,409,425,429,500,502,503,504]);
const INTENTS = new Set(['PURCHASE_INTENT','NEGOTIATION','PRICING_QUESTION','CALLBACK_REQUEST','GENERAL_QUESTION','REJECTION','OPT_OUT','UNCLEAR']);

function clean(v,max=4000){ return String(v ?? '').replace(/\u0000/g,'').trim().slice(0,max); }
function timingEqual(a,b){
  try { const aa=Buffer.from(String(a||''),'utf8'), bb=Buffer.from(String(b||''),'utf8'); return aa.length===bb.length&&aa.length>0&&crypto.timingSafeEqual(aa,bb); } catch { return false; }
}
function verifySecret(provided,expected){ return Boolean(expected && timingEqual(provided,expected)); }

function createSupervisor({db, saveData, addActivity, audit, sendEmail, sendSms, createSquarePaymentLinkForOrder, catalog, id, now, logger=console}={}){
  if(!db) throw new Error('Supervisor requires db.');
  const state = db.revenueSupervisor = db.revenueSupervisor || {version:'55.4.0',events:[],inbound:[],failures:[],provider:{},lastCycleAt:'',lastCycleResult:null};
  state.version='55.4.0'; state.events = Array.isArray(state.events)?state.events:[];
  state.inbound = Array.isArray(state.inbound)?state.inbound:[];
  state.failures = Array.isArray(state.failures)?state.failures:[];
  state.provider = state.provider && typeof state.provider==='object'?state.provider:{};

  function event(type,message,meta={}){
    const row={id:id('sup'),type,message,meta,createdAt:now()};
    state.events.unshift(row); state.events=state.events.slice(0,300);
    try{ addActivity?.('supervisor',message,{...meta,supervisor:true,type}); }catch{}
    return row;
  }
  function failure(provider,error,meta={}){
    const p=String(provider||'unknown'); const s=state.provider[p]||{failures:0,state:'CLOSED',openedUntil:0,lastError:''};
    s.failures=Number(s.failures||0)+1; s.lastError=clean(error,1000); s.lastFailureAt=now();
    const threshold=Math.max(2,Number(process.env.SBC_SUPERVISOR_CIRCUIT_THRESHOLD||3));
    const cooldown=Math.max(30000,Number(process.env.SBC_SUPERVISOR_CIRCUIT_COOLDOWN_MS||120000));
    if(s.failures>=threshold){s.state='OPEN';s.openedUntil=Date.now()+cooldown;}
    state.provider[p]=s;
    state.failures.unshift({id:id('fault'),provider:p,error:clean(error,1000),meta,createdAt:now(),state:s.state});
    state.failures=state.failures.slice(0,200);
    event('provider_fault',`${p} provider fault: ${clean(error,240)}`,{provider:p,state:s.state,failures:s.failures,...meta});
    return s;
  }
  function success(provider){ const p=String(provider||'unknown'); state.provider[p]={...(state.provider[p]||{}),failures:0,state:'CLOSED',openedUntil:0,lastSuccessAt:now()}; }
  function circuit(provider){ const s=state.provider[String(provider)]||{failures:0,state:'CLOSED',openedUntil:0}; if(s.state==='OPEN'&&Date.now()>=Number(s.openedUntil||0)){s.state='HALF_OPEN';s.halfOpenProbe=false;} return {...s,open:s.state==='OPEN'}; }

  async function withRetry(provider, fn, {attempts=3}={}){
    const cap=circuit(provider); if(cap.state==='OPEN') throw Object.assign(new Error(`${provider} circuit is open.`),{code:'CIRCUIT_OPEN',retryAfterMs:Math.max(0,cap.openedUntil-Date.now())});
    if(cap.state==='HALF_OPEN' && cap.halfOpenProbe) throw Object.assign(new Error(`${provider} half-open probe is busy.`),{code:'CIRCUIT_PROBE_BUSY'});
    if(cap.state==='HALF_OPEN'){state.provider[provider]={...(state.provider[provider]||{}),halfOpenProbe:true};}
    let last;
    for(let n=1;n<=attempts;n++){
      try{ const out=await fn(); success(provider); return out; }
      catch(e){ last=e; const status=Number(e.httpStatus||e.status||0); const retryable=!status||RETRYABLE_HTTP.has(status); if(!retryable||n===attempts) break; await new Promise(r=>setTimeout(r,Math.min(8000,250*Math.pow(2,n-1)+Math.floor(Math.random()*200)))); }
    }
    failure(provider,last?.message||last,{status:Number(last?.status||last?.httpStatus||0)});
    throw last;
  }

  function findCustomer(leadId,email,phone){
    const idv=String(leadId||''); const em=String(email||'').trim().toLowerCase(); const ph=String(phone||'').replace(/\D/g,'');
    return (db.customers||[]).find(c=>idv&&String(c.id)===idv) || (em && (db.customers||[]).find(c=>String(c.email||'').trim().toLowerCase()===em)) || (ph && (db.customers||[]).find(c=>String(c.phone||'').replace(/\D/g,'')===ph)) || null;
  }

  async function classify(message, context={}){
    const text=clean(message,8000); if(!text) return {intent:'UNCLEAR',confidence:0,packageId:null,reason:'empty'};
    if(/\b(stop|unsubscribe|remove me|do not contact|don't contact)\b/i.test(text)) return {intent:'OPT_OUT',confidence:.99,packageId:null,reason:'explicit opt-out'};
    const key=process.env.OPENAI_API_KEY;
    if(!key) return fallback(text);
    const model=process.env.SBC_KIM_INBOUND_MODEL||process.env.SBC_KIM_MASTER_MODEL||'gpt-5.6-terra';
    const prompt=`Classify this inbound SBC sales reply. Return JSON only with keys intent, confidence, packageId, reason. intent must be one of PURCHASE_INTENT, NEGOTIATION, PRICING_QUESTION, CALLBACK_REQUEST, GENERAL_QUESTION, REJECTION, OPT_OUT, UNCLEAR. packageId may be one of quickstart, starter, essentials, professional, growth or null. Never invent a package. PURCHASE_INTENT means the person is clearly asking to buy/start/pay, not merely interested. NEGOTIATION means custom price/terms/scope request. OPT_OUT is any request to stop contact. Context: ${JSON.stringify({businessName:context.businessName||'',lastOfferPackageId:context.lastOfferPackageId||''})}`;
    try{
      const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:prompt},{role:'user',content:text}]}) ,signal:AbortSignal.timeout(15000)});
      const j=await r.json(); if(!r.ok) throw new Error(j?.error?.message||`OpenAI classifier ${r.status}`);
      const parsed=JSON.parse(j?.choices?.[0]?.message?.content||'{}');
      const intent=INTENTS.has(parsed.intent)?parsed.intent:'UNCLEAR';
      const packageId=['quickstart','starter','essentials','professional','growth'].includes(parsed.packageId)?parsed.packageId:null;
      return {intent,confidence:Math.max(0,Math.min(1,Number(parsed.confidence)||0)),packageId,reason:clean(parsed.reason,500),model};
    }catch(e){
      failure('openai-inbound',e.message,{leadId:context.id||'',fallback:true});
      return {...fallback(text),fallback:true,error:clean(e.message,300)};
    }
  }

  function fallback(text){
    if(/\b(buy|purchase|pay|checkout|sign me up|let's do it|lets do it|ready to start|send me the link)\b/i.test(text)) return {intent:'PURCHASE_INTENT',confidence:.82,packageId:null,reason:'deterministic purchase signal'};
    if(/\b(price|pricing|cost|how much|quote)\b/i.test(text)) return {intent:'PRICING_QUESTION',confidence:.78,packageId:null,reason:'pricing question'};
    if(/\b(call|calling|talk|phone|tomorrow|later)\b/i.test(text)) return {intent:'CALLBACK_REQUEST',confidence:.72,packageId:null,reason:'callback signal'};
    if(/\b(no thanks|not interested|already have|pass)\b/i.test(text)) return {intent:'REJECTION',confidence:.82,packageId:null,reason:'rejection signal'};
    return {intent:'UNCLEAR',confidence:.45,packageId:null,reason:'requires review'};
  }

  // SBC_V6529_OPEN_READINESS: checkout requires explicit tenant provenance.
  async function createCheckoutForCustomer(c,packageId){
    if(!c||!Number.isInteger(Number(c.tenantId))||Number(c.tenantId)<=0)throw new Error('LEAD_TENANT_ASSOCIATION_REQUIRED: review this CRM record before preparing checkout.');
    const packages=Array.isArray(catalog?.packages)?catalog.packages:[];
    const chosen=packages.find(p=>p.id===packageId) || packages.find(p=>p.id===c?.sbcRevenueOfferPackageId) || packages.find(p=>p.id==='starter');
    if(!chosen) throw new Error('No approved SBC package is available for automated checkout.');
    // SBC_V6640_PAYMENT_EVIDENCE_AND_SQUARE_PREFLIGHT: reject a known-open Square circuit BEFORE changing order state.
    const sq=circuit('square');
    if(sq.state==='OPEN')throw Object.assign(new Error('square circuit is open.'),{code:'CIRCUIT_OPEN',retryAfterMs:Math.max(0,Number(sq.openedUntil||0)-Date.now())});
    if(sq.state==='HALF_OPEN'&&sq.halfOpenProbe)throw Object.assign(new Error('square half-open probe is busy.'),{code:'CIRCUIT_PROBE_BUSY'});
    let order=(db.orders||[]).find(o=>String(o.customerId)===String(c.id)&&['Pending','Quote','Checkout'].includes(String(o.status||''))&&String(o.paymentStatus||'').toLowerCase()!=='paid');
    if(!order){
      order={id:id('order'),tenantId:Number(c.tenantId),customerId:c.id,customerName:c.businessName||c.contactName||'',product:chosen.name,quantity:1,status:'Pending',cost:0,price:Number(chosen.price||0),paymentStatus:'Pending',fulfillmentStatus:'Awaiting Customer Payment',notes:'',salesRepId:c.assignedTo||'',createdAt:now(),updatedAt:now()};
      db.orders.unshift(order);
    } else { if(Number(order.tenantId)!==Number(c.tenantId))throw new Error('CHECKOUT_TENANT_MISMATCH: existing order does not match the lead tenant.'); order.product=chosen.name;order.price=Number(chosen.price||0);order.updatedAt=now(); }
    if(typeof createSquarePaymentLinkForOrder!=='function') throw new Error('Square checkout service unavailable.');
    const link=await withRetry('square',()=>createSquarePaymentLinkForOrder(order,{tenantId:Number(c.tenantId),user:{id:'revenue-supervisor',role:'system',tenantId:Number(c.tenantId)}}),{attempts:2});
    c.sbcRevenueOfferPackageId=chosen.id;c.sbcRevenueCheckoutOrderId=order.id;c.sbcRevenueCheckoutUrl=link.url||'';c.pipelineStage='Checkout';c.updatedAt=now();
    return {order,package:chosen,url:link.url};
  }

  function smsEligible(c){ return Boolean(c && (c.smsOptIn===true || c.smsConsent===true || c.twilioOptIn===true || String(c.messagingConsent||'').toLowerCase()==='granted')); }
  function demoUrlFor(c){ return String(c?.sbcRevenueDemoUrl||c?.demoUrl||c?.websiteDemoUrl||'').trim(); }
  async function sendCheckout(c, checkout, context='purchase-intent'){
    if(!checkout?.url) return {sent:false,reason:'missing_checkout_url'};
    const demo=demoUrlFor(c);
    const lines=[`Hi ${c.contactName||'there'},`,`
Absolutely — here is your secure SBC checkout link:`,checkout.url, demo?`
You can also preview your personalized SBC demo here:
${demo}`:'',`
Once payment is completed, SBC will move your order into fulfillment automatically.`,`
— Successful By Choice
Because Why Not?`].filter(Boolean).join('\n');
    if(c.email){ await withRetry('email',()=>sendEmail(c,'Your SBC checkout link',lines),{attempts:2}); return {sent:true,channel:'email'}; }
    if(c.phone && smsEligible(c)){ await withRetry('twilio',()=>sendSms(c,`SBC checkout: ${checkout.url}${demo?` | Demo: ${demo}`:''}`),{attempts:2}); return {sent:true,channel:'sms'}; }
    return {sent:false,reason:'no_eligible_delivery_channel'};
  }

  async function handleInbound({leadId,message,email,phone,channel='email',externalId='',metadata={}}={}){
    const text=clean(message,10000); if(!text) throw new Error('Inbound message is empty.');
    const c=findCustomer(leadId,email,phone);
    if(!c) return {ok:false,status:'UNMATCHED',action:'OWNER_REVIEW',reason:'No matching CRM lead/customer.'};
    const duplicate=externalId && state.inbound.find(x=>x.externalId===String(externalId));
    if(duplicate) return {ok:true,duplicate:true,record:duplicate};
    const classification=await classify(text,{...c,id:c.id,lastOfferPackageId:c.sbcRevenueOfferPackageId||''});
    const rec={id:id('inbound'),externalId:String(externalId||''),customerId:c.id,channel:String(channel),message:text,intent:classification.intent,confidence:classification.confidence,receivedAt:now(),status:'PROCESSED'};
    state.inbound.unshift(rec);state.inbound=state.inbound.slice(0,500);
    addActivity?.('inbound_reply',`Inbound ${channel} classified as ${classification.intent} for ${c.businessName||c.contactName||c.id}`,{customerId:c.id,intent:classification.intent,confidence:classification.confidence,externalId:externalId||''});
    if(classification.intent==='OPT_OUT'){
      c.status='Do Not Contact';c.salesSuppressed=true;c.salesSuppressionReason='Inbound opt-out';c.updatedAt=now();rec.action='SUPPRESS';
    } else if(classification.intent==='REJECTION'){
      c.pipelineStage='Closed - Not Interested';c.updatedAt=now();rec.action='CLOSE';
    } else if(classification.intent==='NEGOTIATION'){
      c.pipelineStage='Negotiation';c.sbcOwnerApprovalRequired=true;c.sbcOwnerApprovalReason=text.slice(0,1000);c.updatedAt=now();rec.action='OWNER_APPROVAL';
      db.tasks=db.tasks||[];db.tasks.unshift({id:id('task'),customerId:c.id,customerName:c.businessName||c.contactName||'',title:`Owner review — negotiation with ${c.businessName||c.contactName||'lead'}`,dueAt:now(),type:'Owner Approval',priority:'High',status:'Open',notes:text.slice(0,2000),assignedTo:'',assignedToName:'Romeo',createdBy:'revenue-supervisor',createdAt:now(),updatedAt:now()});
    } else if(classification.intent==='PURCHASE_INTENT'){
      try{
        const checkout=await createCheckoutForCustomer(c,classification.packageId);
        rec.action='CHECKOUT_SENT';rec.orderId=checkout.order.id;rec.checkoutUrl=checkout.url;
        const delivery=await sendCheckout(c,checkout,'purchase-intent'); rec.deliveryChannel=delivery.channel||'';
        if(!delivery.sent) rec.deliveryBlocked=delivery.reason||'delivery_failed';
      }catch(e){
        rec.action='CHECKOUT_PENDING';rec.error=clean(e.message,1000);c.pipelineStage='Checkout Pending';c.sbcOwnerApprovalRequired=false;c.sbcCheckoutRecovery=true;c.updatedAt=now();
        db.tasks=db.tasks||[];db.tasks.unshift({id:id('task'),customerId:c.id,customerName:c.businessName||c.contactName||'',title:`Checkout recovery — ${c.businessName||c.contactName||'lead'}`,dueAt:now(),type:'Revenue Recovery',priority:'High',status:'Open',notes:`Purchase intent received but checkout could not complete automatically: ${clean(e.message,1500)}`,assignedTo:'',assignedToName:'Romeo',createdBy:'revenue-supervisor',createdAt:now(),updatedAt:now()});
        event('revenue_recovery',`Purchase intent preserved for ${c.businessName||c.contactName||c.id}; checkout needs recovery`,{customerId:c.id,error:e.message});
      }
    } else if(classification.intent==='CALLBACK_REQUEST'){
      c.pipelineStage='Callback Requested';c.updatedAt=now();rec.action='CALLBACK_QUEUE';db.tasks=db.tasks||[];db.tasks.unshift({id:id('task'),customerId:c.id,customerName:c.businessName||c.contactName||'',title:`Callback requested — ${c.businessName||c.contactName||'lead'}`,dueAt:now(),type:'Sales Callback',priority:'High',status:'Open',notes:text.slice(0,1500),assignedTo:c.assignedTo||'',assignedToName:c.assignedToName||'Sales',createdBy:'revenue-supervisor',createdAt:now(),updatedAt:now()});
    } else if(classification.intent==='PRICING_QUESTION' || classification.intent==='GENERAL_QUESTION'){
      c.pipelineStage=classification.intent==='PRICING_QUESTION'?'Pricing Question':'Needs Response';c.sbcOwnerApprovalRequired=true;c.updatedAt=now();rec.action='REVIEW_QUEUE';db.tasks=db.tasks||[];db.tasks.unshift({id:id('task'),customerId:c.id,customerName:c.businessName||c.contactName||'',title:`Inbound response — ${c.businessName||c.contactName||'lead'}`,dueAt:now(),type:'Inbound Sales Review',priority:'Normal',status:'Open',notes:text.slice(0,2000),assignedTo:'',assignedToName:'Romeo',createdBy:'revenue-supervisor',createdAt:now(),updatedAt:now()});
    } else { c.pipelineStage='Inbound Review';c.updatedAt=now();rec.action='REVIEW_QUEUE'; }
    await saveData();
    try{audit?.({id:'system',name:'Kim Revenue Supervisor',role:'system'},'inbound_revenue_routing',`Inbound ${classification.intent} routed for ${c.businessName||c.contactName||c.id}`,{customerId:c.id,intent:classification.intent,action:rec.action});}catch{}
    return {ok:true,record:rec,classification,customerId:c.id};
  }

  async function providerHealth(){
    const checks=[];
    checks.push({provider:'openai',configured:Boolean(process.env.OPENAI_API_KEY)});
    checks.push({provider:'square',configured:Boolean(process.env.SQUARE_ACCESS_TOKEN&&process.env.SQUARE_LOCATION_ID),webhookConfigured:Boolean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)});
    checks.push({provider:'twilio',configured:Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_PHONE_NUMBER&&(process.env.TWILIO_AUTH_TOKEN||(process.env.TWILIO_API_KEY_SID&&process.env.TWILIO_API_KEY_SECRET)))});
    checks.push({provider:'smtp',configured:Boolean(process.env.SBC_SMTP_HOST&&process.env.SBC_SMTP_USER&&process.env.SBC_SMTP_PASS)});
    return checks.map(x=>({...x,circuit:circuit(x.provider)}));
  }

  function orderParsedSafe(o){ try { return o?.parsed && typeof o.parsed==='object' ? o.parsed : (o?.metadata && typeof o.metadata==='object'?o.metadata:{}); } catch { return {}; } }
  function updateOrderParsedSafe(o,patch){ o.metadata={...(o.metadata||{}),...patch}; o.updatedAt=now(); }

  async function maintenance(){
    const nowMs=Date.now(); let changed=0;
    state.events=state.events.filter(x=>nowMs-new Date(x.createdAt||0).getTime()<30*86400000); state.inbound=state.inbound.slice(0,500); state.failures=state.failures.filter(x=>nowMs-new Date(x.createdAt||0).getTime()<30*86400000);
    for(const [p,s] of Object.entries(state.provider||{})){if(s.state==='OPEN'&&nowMs>=Number(s.openedUntil||0)){s.state='HALF_OPEN';s.halfOpenProbe=false;changed++;}}
    // Requeue only explicitly recoverable supervisor tasks; never auto-complete or delete owner work.
    for(const t of (db.tasks||[])){
      if(t.status==='Open'&&['Revenue Recovery','Checkout Recovery'].includes(t.type)&&t.dueAt&&new Date(t.dueAt)<new Date(nowMs-6*3600000)){t.dueAt=new Date().toISOString();t.updatedAt=now();changed++;}
    }
    // Safe payment recovery notices: never retry a charge or mutate payment state locally.
    for(const o of (db.orders||[])){
      if(String(o.paymentStatus||'').toLowerCase()!=='failed' || !o.paymentUrl) continue;
      const c=(db.customers||[]).find(x=>String(x.id)===String(o.customerId)); if(!c) continue;
      const parsed=orderParsedSafe(o), last=Number(parsed.dunningLastAt||0), attempts=Number(parsed.dunningAttempts||0);
      if(attempts>=3 || (last && nowMs-last<24*3600000)) continue;
      try{
        const msg=`Your SBC payment could not be completed. If you still want to continue, you can securely retry here: ${o.paymentUrl}`;
        if(c.email) await withRetry('email',()=>sendEmail(c,'SBC payment needs attention',`Hi ${c.contactName||'there'},\n\n${msg}\n\nSuccessful By Choice`),{attempts:2});
        else if(c.phone && smsEligible(c)) await withRetry('twilio',()=>sendSms(c,msg),{attempts:2});
        else continue;
        updateOrderParsedSafe(o,{dunningLastAt:now(),dunningAttempts:attempts+1}); changed=true;
        event('payment_recovery','Sent safe payment-recovery notice.',{orderId:o.id,attempt:attempts+1});
      }catch(e){ failure(c.email?'email':'twilio',e.message,{orderId:o.id,dunning:true}); }
    }
    state.lastMaintenanceAt=now(); if(changed) await saveData(); return {ok:true,changed};
  }

  async function cycle(reason='scheduled'){
    const started=Date.now();
    try{
      const health=await providerHealth();
      const maintenanceResult=await maintenance();
      state.lastCycleAt=now();state.lastCycleResult={ok:true,reason,durationMs:Date.now()-started,health,maintenance:maintenanceResult};
      return state.lastCycleResult;
    }catch(e){state.lastCycleAt=now();state.lastCycleResult={ok:false,reason,error:clean(e.message,1000),durationMs:Date.now()-started};event('supervisor_fault','Supervisor cycle degraded',{error:e.message,reason});try{await saveData()}catch{}return state.lastCycleResult;}
  }

  function summary(){
    return {version:'55.4.0',lastCycleAt:state.lastCycleAt,lastCycleResult:state.lastCycleResult,provider:state.provider,inboundPending:(state.inbound||[]).filter(x=>['REVIEW_QUEUE','OWNER_APPROVAL','CHECKOUT_PENDING'].includes(x.action)).length,recentFailures:state.failures.slice(0,20),recentEvents:state.events.slice(0,20)};
  }
  return {handleInbound,classify,createCheckoutForCustomer,sendCheckout,smsEligible,cycle,maintenance,providerHealth,summary,withRetry,circuit};
}

module.exports={createSupervisor,verifySecret};

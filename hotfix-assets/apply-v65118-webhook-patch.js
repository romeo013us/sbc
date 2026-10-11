'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MARKER = 'SBC_V65118_PROVIDER_MATCH_TRACKING_EVIDENCE';

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error('V65.1.18 refused patch: ' + label + ' expected exactly one anchor, found ' + count + '.');
  return source.replace(before, after);
}

function apply(rootDir) {
  const serverPath = path.join(rootDir, 'server.js');
  let source = fs.readFileSync(serverPath, 'utf8');

  const handlerStart = 'async function handleVendorTrackingWebhook(provider,raw){';
  const handlerEnd = "\napp.post('/api/webhooks/4over4'";
  const start = source.indexOf(handlerStart);
  const end = source.indexOf(handlerEnd, start);
  if (start < 0 || end <= start) throw new Error('V65.1.18 refused patch: vendor tracking handler boundary not found.');

  const oldHandler = source.slice(start, end);
  const already = oldHandler.includes(MARKER);
  if (!already) {
    if (!oldHandler.includes('job.vendorStatus=status; job.trackingNumber=') ||
        !oldHandler.includes("if(/delivered|complete|fulfilled/.test(status))job.status='completed'")) {
      throw new Error('V65.1.18 refused patch: vendor tracking handler changed; manual review required.');
    }

    const newHandler = \`async function handleVendorTrackingWebhook(provider,raw){
  // SBC_V65118_PROVIDER_MATCH_TRACKING_EVIDENCE
  let body={};try{body=JSON.parse(raw.toString('utf8')||'{}')}catch{}
  const m=megaData();
  const normalizeVendor=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const expectedProvider=normalizeVendor(provider);
  const isExpectedVendor=job=>{
    const actual=normalizeVendor(job?.vendor);
    if(expectedProvider==='4over4')return ['4over4','fouroverfour'].includes(actual);
    if(expectedProvider==='vistaprint')return ['vistaprint'].includes(actual);
    return false;
  };
  const jobRef=String(body.jobId||body.fulfillmentJobId||'');
  const vendorOrderRef=String(body.orderNumber||body.vendorOrderNumber||'');
  const job=m.fulfillmentJobs.find(j=>{
    const refMatches=(jobRef&&String(j.id)===jobRef)||(vendorOrderRef&&String(j.vendorOrderNumber||'')===vendorOrderRef);
    return refMatches&&isExpectedVendor(j);
  });
  if(!job)return {ok:false,error:'Fulfillment job not found for authenticated provider.'};
  const status=String(body.status||body.event||'tracking_update').toLowerCase();
  const trackingNumber=String(body.trackingNumber||body.tracking_number||job.trackingNumber||'').trim();
  const shippingState=/shipped|dispatch|in_transit|tracking/.test(status);
  const terminalDelivery=/delivered|complete|fulfilled/.test(status);
  if((shippingState||terminalDelivery)&&!trackingNumber)return {ok:false,error:'tracking_number_required_for_shipping_status'};
  // State is mutated only after both authenticated-provider matching and tracking evidence pass.
  job.vendorStatus=status;job.trackingNumber=trackingNumber||job.trackingNumber||'';
  if(body.orderNumber||body.vendorOrderNumber)job.vendorOrderNumber=String(body.orderNumber||body.vendorOrderNumber);
  if(terminalDelivery)job.status='completed';
  else if(shippingState)job.status='shipped';
  job.updatedAt=now();
  m.automationEvents.unshift({id:id('evt'),type:'vendor_tracking_update',message:String(provider)+' tracking update for '+job.id,meta:{jobId:job.id,orderId:job.orderId,status:job.status,vendorStatus:job.vendorStatus,trackingNumber:job.trackingNumber},createdAt:now()});
  await megaSave(m);
  const order=(db.orders||[]).find(o=>String(o.id)===String(job.orderId));
  if(order){order.godKimTrackingUpdatedAt=now();order.fulfillmentStatus=job.status==='completed'?'Completed':job.status==='shipped'?'Shipped':'Fulfillment in Progress';order.updatedAt=now();await saveData();}
  return {ok:true,provider,jobId:job.id,orderId:job.orderId,status:job.status,trackingNumber:job.trackingNumber,vendorOrderNumber:job.vendorOrderNumber||''};
}\`;
    source = source.slice(0, start) + newHandler + source.slice(end);
  }

  source = replaceOnce(
    source,
    "try{res.status(200).json(await handleVendorTrackingWebhook('4over4',raw));}catch(e){res.status(500).json({error:e.message});}",
    "try{const result=await handleVendorTrackingWebhook('4over4',raw);res.status(result.ok?200:409).json(result);}catch(e){res.status(500).json({error:e.message});}",
    '4OVER4 webhook result status'
  );
  source = replaceOnce(
    source,
    "try{res.status(200).json(await handleVendorTrackingWebhook('vistaprint',raw));}catch(e){res.status(500).json({error:e.message});}",
    "try{const result=await handleVendorTrackingWebhook('vistaprint',raw);res.status(result.ok?200:409).json(result);}catch(e){res.status(500).json({error:e.message});}",
    'VistaPrint webhook result status'
  );

  fs.writeFileSync(serverPath, source);
  const finalSource = fs.readFileSync(serverPath, 'utf8');
  if (!finalSource.includes(MARKER)) throw new Error('V65.1.18 provider/tracking guard marker not found after patch.');
  if ((finalSource.match(/res\.status\(result\.ok\?200:409\)\.json\(result\)/g)||[]).length !== 2) {
    throw new Error('V65.1.18 webhook rejection handling must be present for both print vendors.');
  }
  return {version:'65.1.18',providerMatching:true,trackingRequiredForShippingAndCompletion:true};
}

module.exports={apply,MARKER};

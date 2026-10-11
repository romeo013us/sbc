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

    const newHandler = "async function handleVendorTrackingWebhook(provider,raw){\n  // SBC_V65118_PROVIDER_MATCH_TRACKING_EVIDENCE\n  let body={};try{body=JSON.parse(raw.toString('utf8')||'{}')}catch{}\n  const m=megaData();\n  const normalizeVendor=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');\n  const expectedProvider=normalizeVendor(provider);\n  const isExpectedVendor=job=>{\n    const actual=normalizeVendor(job?.vendor);\n    if(expectedProvider==='4over4')return ['4over4','fouroverfour'].includes(actual);\n    if(expectedProvider==='vistaprint')return ['vistaprint'].includes(actual);\n    return false;\n  };\n  const jobRef=String(body.jobId||body.fulfillmentJobId||'');\n  const vendorOrderRef=String(body.orderNumber||body.vendorOrderNumber||'');\n  const job=m.fulfillmentJobs.find(j=>{\n    const refMatches=(jobRef&&String(j.id)===jobRef)||(vendorOrderRef&&String(j.vendorOrderNumber||'')===vendorOrderRef);\n    return refMatches&&isExpectedVendor(j);\n  });\n  if(!job)return {ok:false,error:'Fulfillment job not found for authenticated provider.'};\n  const status=String(body.status||body.event||'tracking_update').toLowerCase();\n  const trackingNumber=String(body.trackingNumber||body.tracking_number||job.trackingNumber||'').trim();\n  const shippingState=/shipped|dispatch|in_transit|tracking/.test(status);\n  const terminalDelivery=/delivered|complete|fulfilled/.test(status);\n  if((shippingState||terminalDelivery)&&!trackingNumber)return {ok:false,error:'tracking_number_required_for_shipping_status'};\n  // State is mutated only after both authenticated-provider matching and tracking evidence pass.\n  job.vendorStatus=status;job.trackingNumber=trackingNumber||job.trackingNumber||'';\n  if(body.orderNumber||body.vendorOrderNumber)job.vendorOrderNumber=String(body.orderNumber||body.vendorOrderNumber);\n  if(terminalDelivery)job.status='completed';\n  else if(shippingState)job.status='shipped';\n  job.updatedAt=now();\n  m.automationEvents.unshift({id:id('evt'),type:'vendor_tracking_update',message:String(provider)+' tracking update for '+job.id,meta:{jobId:job.id,orderId:job.orderId,status:job.status,vendorStatus:job.vendorStatus,trackingNumber:job.trackingNumber},createdAt:now()});\n  await megaSave(m);\n  const order=(db.orders||[]).find(o=>String(o.id)===String(job.orderId));\n  if(order){order.godKimTrackingUpdatedAt=now();order.fulfillmentStatus=job.status==='completed'?'Completed':job.status==='shipped'?'Shipped':'Fulfillment in Progress';order.updatedAt=now();await saveData();}\n  return {ok:true,provider,jobId:job.id,orderId:job.orderId,status:job.status,trackingNumber:job.trackingNumber,vendorOrderNumber:job.vendorOrderNumber||''};\n}"
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

'use strict';
// Apply ONLY to disposable V66 GoDaddy staging source, never pinned master server.js.
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V66137_SMS_DELIVERY_TRUTH';
function exact(source,from,to,label){
  const count=source.split(from).length-1;
  if(count!==1)throw Error('V66137_SMS_STAGE_ANCHOR_'+label+'_COUNT_'+count);
  return source.replace(from,to);
}
function patchServer(source){
 if(typeof source!=='string'||!source.includes("app.post('/api/communications/sms'"))throw Error('V66137_SMS_SERVER_ROUTE_MISSING');
 if(source.includes(MARKER)){
  for(const required of ['SBC_V66137_SMS_TRUTH.destination(customer.phone)','SBC_V66137_SMS_TRUTH.receipt(data)','SBC_V66137_SMS_TRUTH.isSuppressed(customer)'])
   if(!source.includes(required))throw Error('V66137_SMS_PARTIAL_STAGE');
  return source;
 }
 let s=source;
 s=exact(s,'function acquisitionMessagingAllowed(customer){',
  "// "+MARKER+"\nconst SBC_V66137_SMS_TRUTH=require('./enterprise/v66137-sms-delivery-truth.cjs');\nfunction acquisitionMessagingAllowed(customer){\n  if(SBC_V66137_SMS_TRUTH.isSuppressed(customer))return {allowed:false,reason:'sms_opt_out_or_suppressed'};",
  'CONSENT');
 s=exact(s,
  '  const params=new URLSearchParams({To:customer.phone,From:from,Body:mergeTemplate(body,customer)});',
  '  const normalizedTo=SBC_V66137_SMS_TRUTH.destination(customer.phone);\n  const params=new URLSearchParams({To:normalizedTo,From:from,Body:mergeTemplate(body,customer)});',
  'PHONE');
 s=exact(s,
  "  const data=await r.json(); if(!r.ok) throw new Error(data.message||'Twilio SMS failed.');",
  '  const data=await r.json().catch(()=>({})); if(!r.ok)throw SBC_V66137_SMS_TRUTH.providerError(data,r.status);\n  const providerResult=SBC_V66137_SMS_TRUTH.receipt(data);',
  'PROVIDER');
 const tick=String.fromCharCode(96),dollar=String.fromCharCode(36);
 s=exact(s,
  "  addActivity('sms',"+tick+'SMS sent to '+dollar+'{customer.businessName||customer.contactName}'+tick+",{customerId:customer.id,to:customer.phone,sid:data.sid});",
  "  addActivity('sms',"+tick+'SMS submitted to Twilio for '+dollar+'{customer.businessName||customer.contactName}'+tick+",{customerId:customer.id,to:normalizedTo,sid:providerResult.sid,providerStatus:providerResult.providerStatus,deliveryConfirmed:providerResult.deliveryConfirmed});",
  'AUDIT');
 s=exact(s,
  '  return {sid:data.sid,to:customer.phone};',
  '  return {...providerResult,to:normalizedTo};',
  'RECEIPT');
 s=exact(s,"sms:{configured:smsConfigured,provider:'Twilio',missing:",
   "sms:{configured:smsConfigured,provider:'Twilio',deliveryVerified:false,a2pRegistration:'NOT_VERIFIED_BY_SBC',missing:",
   'STATUS');
 return s;
}
function main(argv=process.argv){
 const file=path.resolve(__dirname,'../server.js'),original=fs.readFileSync(file,'utf8');
 const next=patchServer(original);
 if(argv.includes('--apply')){if(next!==original)fs.writeFileSync(file,next);console.log('[SBC SMS V66137] staged SMS diagnostics and provider receipt truth');}
 else{if(argv.includes('--verify-staged')&&!next.includes(MARKER))throw Error('V66137_SMS_STAGE_NOT_APPLIED');console.log('[SBC SMS V66137] exact source anchors verified; source unchanged');}
}
if(require.main===module)main();
module.exports={MARKER,patchServer};

'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6661_WEB_INQUIRY_CONTACT_INTEGRITY';
const BT=String.fromCharCode(96),D=String.fromCharCode(36,123);
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' count='+n);return s.replace(a,b);}
function patchServer(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate');
 s=once(s,
  "function webLeadDuplicate(candidate,tenantId){const matches=leadDuplicateMatches(candidate).filter(x=>Number(x.customer?.tenantId)===Number(tenantId));return matches[0]||null}",
  "// "+MARKER+": a public inquiry cannot bind by business-name similarity alone.\n"+
  "function webLeadDuplicate(candidate,tenantId){const m=leadDuplicateMatches(candidate).filter(x=>Number(x.customer?.tenantId)===Number(tenantId)&&Array.isArray(x.reasons)&&x.reasons.some(r=>r==='email'||r==='phone'));return m.length===1?m[0]:null;}",
  'strong identity duplicate check');
 s=once(s,
  "  if(!webLeadRateLimit(req.ip)) return res.status(429).json({error:'Too many submissions. Please try again shortly.'});\n  let tenantId;try{tenantId=sbcVerifiedWebsiteTenant(req)}catch(e){return res.status(403).json({ok:false,code:e.code||'SITE_BRIDGE_UNAUTHORIZED'});}",
  "  // Verify signed website origin before consuming an IP rate quota.\n  let tenantId;try{tenantId=sbcVerifiedWebsiteTenant(req)}catch(e){return res.status(403).json({ok:false,code:e.code||'SITE_BRIDGE_UNAUTHORIZED'});}\n  if(!webLeadRateLimit(req.ip)) return res.status(429).json({error:'Too many submissions. Please try again shortly.'});",
  'signed request before rate counting');
 const oldD="    const c=dup.customer;c.updatedAt=now();c.webLead=true;c.lastWebLeadAt=now();c.webLeadCount=Number(c.webLeadCount||0)+1;c.webLeadMessage=c0.message||c.webLeadMessage||'';c.leadTemperature='Hot';c.leadScore=Math.max(Number(c.leadScore||0),95);c.pipelineStage=c.pipelineStage||'New Lead';\n"+
  "    if(c0.email)c.email=c0.email;if(c0.phone)c.phone=c0.phone;if(c0.contactName)c.contactName=c0.contactName;\n"+
  "    addActivity('web_lead',"+BT+"Repeat website inquiry from "+D+"c.businessName||c.contactName}"+BT+",{customerId:c.id,sourcePage:c0.sourcePage,duplicate:true});";
 const newD="    // Never overwrite a verified CRM contact from an anonymous public form.\n"+
  "    const c=dup.customer;c.webLead=true;c.lastWebLeadAt=now();c.webLeadCount=Math.min(100000,Number(c.webLeadCount||0)+1);\n"+
  "    c.webLeadPendingReview=true;\n"+
  "    c.webLeadInquiries=(Array.isArray(c.webLeadInquiries)?c.webLeadInquiries:[]).slice(-9).concat([{at:now(),sourcePage:c0.sourcePage,serviceInterest:c0.serviceInterest,quoteType:c0.quoteType,contactName:c0.contactName,phone:c0.phone,email:c0.email,message:c0.message}]);\n"+
  "    addActivity('web_lead',"+BT+"Website inquiry pending verification for "+D+"c.businessName||c.contactName}"+BT+",{customerId:c.id,sourcePage:c0.sourcePage,duplicate:true,contactChanged:false});";
 s=once(s,oldD,newD,'do not mutate established contact and lead score');
 s=once(s,"return res.status(200).json({ok:true,id:c.id,duplicate:true,assignedTo:c.assignedTo||''});",
 "return res.status(200).json({ok:true,id:c.id,duplicate:true,verificationRequired:true,assignedTo:c.assignedTo||''});",
 'duplicate response');
 s=once(s,"leadTemperature:'Hot',leadScore:95,pipelineStage:'New Lead',salesQueueState:''",
 "leadTemperature:'Cold',leadScore:0,verificationStatus:'Needs Verification',webLeadPendingReview:true,pipelineStage:'New Lead',salesQueueState:''",
 'do not fabricate qualification');
 const oldN="  normalizeLeadQuality(c);c.leadTemperature='Hot';c.leadScore=Math.max(Number(c.leadScore||0),95);c.pipelineStage='New Lead';\n"+
  "  db.customers.unshift(c);\n  assignLeadAutomatically(c);\n"+
  "  addActivity('web_lead',"+BT+"New HOT web lead from sbcmia.com: "+D+"c.businessName||c.contactName}"+BT+",{customerId:c.id,sourcePage:c0.sourcePage,serviceInterest:c0.serviceInterest,quoteType:c0.quoteType});";
 const newN="  normalizeLeadQuality(c);\n"+
  "  c.verificationStatus='Needs Verification';c.leadTemperature='Cold';c.leadScore=Math.min(49,Math.max(0,Number(c.leadScore)||0));c.webLeadPendingReview=true;\n"+
  "  db.customers.unshift(c);\n"+
  "  // Staff verification precedes any qualified-lead call or outbound automation.\n"+
  "  addActivity('web_lead',"+BT+"New SBCMIA inquiry requires verification: "+D+"c.businessName||c.contactName}"+BT+",{customerId:c.id,sourcePage:c0.sourcePage,qualified:false});";
 s=once(s,oldN,newN,'new web lead review queue');
 s=once(s,
 "res.status(201).json({ok:true,id:c.id,hot:true,assignedTo:c.assignedTo||'',assignedToName:c.assignedToName||''});",
 "res.status(201).json({ok:true,id:c.id,hot:false,verificationRequired:true,assignedTo:c.assignedTo||'',assignedToName:c.assignedToName||''});",
 'truthful lead acceptance response');
 new vm.Script(s,{filename:'server.js'});return s;
}
function apply(root){const p=path.join(root,'server.js');if(!fs.existsSync(p))throw Error(MARKER+': missing server');const changed=patchServer(fs.readFileSync(p,'utf8'));fs.writeFileSync(p,changed);return {marker:MARKER,files:['server.js'],noProductionWrites:true};}
module.exports={MARKER,patchServer,apply};

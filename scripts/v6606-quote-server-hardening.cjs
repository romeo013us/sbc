'use strict';
/*
 * SBC_V6606_QUOTE_WRITER_HARDENING
 * Apply to the V66 server.js ONLY on a vetted source branch; never patches production DB.
 * It does not change Square webhook verification, payment-status provenance, or recovery locks.
 */
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),vm=require('node:vm');
const MARK='SBC_V6606_QUOTE_WRITER_HARDENING';
function one(text,old,replacement,label){
 const parts=text.split(old);
 if(parts.length!==2)throw Error('SBC_V6606_PATCH_ANCHOR_MISMATCH '+label+' count='+(parts.length-1));
 return parts.join(replacement);
}
const createGate=`
/* SBC_V6606_QUOTE_WRITER_HARDENING: draft is not a payment or provisioning approval. */
function sbcV6606QuoteWriterReady(req,res){
  if(SBC_RUNTIME_READ_ONLY||sbcShutdownStarted||!mysqlPool||!MYSQL_RECOVERY_EVALUATED||
     MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady){
    res.status(423).json({ok:false,error:'QUOTE_WRITER_UNAVAILABLE',
      message:'Published writer and authoritative MySQL recovery clearance are required. No quote was changed.'});
    return false;
  }
  return true;
}
function sbcV6606QuoteCreateGate(req,res,next){
  if(!sbcV6606QuoteWriterReady(req,res))return;
  const tenant=requireRequestTenant(req);
  const body=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
  const status=String(body.status||'Draft').trim();
  if(!['Draft','Sent','Won'].includes(status))
    return res.status(409).json({ok:false,error:status==='Paid'?'PAYMENT_PROOF_REQUIRED':'INVALID_QUOTE_INITIAL_STATUS',
      message:'Paid can only follow verified Square settlement; create a Draft, Sent or Won quote.'});
  const requestId=String(body.clientRequestId||'').trim();
  if(requestId&&!/^[a-zA-Z0-9_-]{12,90}$/.test(requestId))
    return res.status(422).json({ok:false,error:'QUOTE_REQUEST_ID_INVALID'});
  req.sbcClientRequestId=requestId;
  if(requestId){
    const existing=db.quotes.find(q=>Number(q.tenantId)===tenant&&q.clientRequestId===requestId);
    if(existing)return res.status(200).json(existing); // idempotent retry; no duplicate quote or charge
  }
  if(status==='Draft'){
    // The original quote route only stores a draft, never executes Square or provisions work.
    // Remove any supplied payment URL so the draft is never mistaken for authorized checkout.
    req.body={...body,status:'Draft',paymentUrl:'',
      items:Array.isArray(body.items)?body.items.map(x=>({...x,paymentUrl:''})):body.items};
    req.sbcDraftUnpriced=true;
    return next();
  }
  return FINANCIAL_GOVERNOR.middleware('quote_generation')(req,res,next);
}
function sbcV6606QuoteUpdateGuard(req,res,next){
  if(!sbcV6606QuoteWriterReady(req,res))return;
  const tenant=requireRequestTenant(req);
  const q=db.quotes.find(x=>x.id===req.params.id&&Number(x.tenantId)===tenant);
  if(!q)return res.status(404).json({ok:false,error:'QUOTE_NOT_FOUND_IN_TENANT'});
  const body=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
  const allowed=['status','notes','validUntil'];
  if(Object.keys(body).some(k=>!allowed.includes(k)))
    return res.status(422).json({ok:false,error:'QUOTE_FINANCIAL_FIELDS_IMMUTABLE',
      message:'Totals, customer identity, tenant, payment URL and line items cannot be overwritten by a quote-status request.'});
  if(String(q.status||'').trim()==='Paid')
    return res.status(409).json({ok:false,error:'SETTLED_QUOTE_IMMUTABLE',
      message:'A settled quote cannot be changed through manual status editing.'});
  const status=String(body.status||q.status||'Draft').trim();
  if(status==='Paid')return res.status(409).json({ok:false,error:'PAYMENT_PROOF_REQUIRED',
      message:'Only a verified provider settlement workflow may mark this quote Paid or trigger a paid commission.'});
  if(!['Draft','Sent','Won','Lost'].includes(status))
    return res.status(422).json({ok:false,error:'QUOTE_STATUS_INVALID'});
  req.body={status,...(Object.prototype.hasOwnProperty.call(body,'notes')?{notes:String(body.notes||'').slice(0,10000)}:{}),
    ...(Object.prototype.hasOwnProperty.call(body,'validUntil')?{validUntil:String(body.validUntil||'').slice(0,40)}:{})};
  if(status!=='Sent'&&status!=='Won')return next();
  if(status===q.status)return next();
  // Check real tenant-scoped supplier costs before sending/accepting an obligation.
  const savedBody=req.body;
  req.body={...savedBody,items:q.items,total:q.total};
  return FINANCIAL_GOVERNOR.middleware('quote_status_change')(req,res,()=>{
    req.body=savedBody;
    next();
  });
}
`;
function patch(source){
 if(source.includes(MARK)){
   if(!source.includes('sbcV6606QuoteCreateGate')||!source.includes('sbcV6606QuoteUpdateGuard'))
     throw Error('SBC_V6606_PARTIAL_PATCH');
   return {source,alreadyApplied:true};
 }
 let s=source;
 const createOld="app.post('/api/quotes',auth,ownerOnly,FINANCIAL_GOVERNOR.middleware('quote_generation'),async(req,res)=>{";
 const createNew="app.post('/api/quotes',auth,ownerOnly,sbcV6606QuoteCreateGate,async(req,res)=>{";
 const updateOld="app.put('/api/quotes/:id',auth,ownerOnly,async(req,res)=>{";
 const updateNew="app.put('/api/quotes/:id',auth,ownerOnly,sbcV6606QuoteUpdateGuard,async(req,res)=>{";
 s=one(s,createOld,createGate+'\n'+createNew,'quote create middleware');
 s=one(s,updateOld,updateNew,'quote update middleware');
 const createStart=s.indexOf(createNew),updateStart=s.indexOf(updateNew),deleteStart=s.indexOf("app.delete('/api/quotes/:id'",updateStart);
 if(createStart<0||updateStart<createStart||deleteStart<updateStart)throw Error('SBC_V6606_QUOTE_ROUTE_ORDER_CHANGED');
 let create=s.slice(createStart,updateStart);
 create=one(create,"const q={id:id('quote'),tenantId:requireRequestTenant(req),quoteNumber:",
   "const q={id:id('quote'),tenantId:requireRequestTenant(req),clientRequestId:req.sbcClientRequestId||'',quoteNumber:",'quote idempotency identity');
 s=s.slice(0,createStart)+create+s.slice(updateStart);
 const pos=s.indexOf(updateNew),next=s.indexOf("app.delete('/api/quotes/:id'",pos);
 let upd=s.slice(pos,next);
 upd=one(upd,"const q=db.quotes.find(x=>x.id===req.params.id);",
   "const q=db.quotes.find(x=>x.id===req.params.id&&Number(x.tenantId)===requireRequestTenant(req));",'quote update tenant');
 upd=one(upd,"Object.assign(q,req.body||{},{id:q.id,updatedAt:now()});",
   "Object.assign(q,req.body||{},{id:q.id,tenantId:q.tenantId,updatedAt:now()});",'quote update whitelist');
 s=s.slice(0,pos)+upd+s.slice(next);
 // Owner-only vendor cost update must take its tenant from authenticated request.
 s=one(s,"FINANCIAL_GOVERNOR.upsertCost({itemId:b.itemId",
   "FINANCIAL_GOVERNOR.upsertCost({tenantId:requireRequestTenant(req),itemId:b.itemId",'verified supplier cost tenant');
 return {source:s,alreadyApplied:false};
}
function check(source){
 const out=patch(source);
 new vm.Script(out.source,{filename:'sbc-v6606-patched-server.js'});
 if(out.source===source)throw Error('SBC_V6606_NO_OP_UNEXPECTED');
 const again=patch(out.source);
 if(!again.alreadyApplied||again.source!==out.source)throw Error('SBC_V6606_NOT_IDEMPOTENT');
 if(!out.source.includes('QUOTE_FINANCIAL_FIELDS_IMMUTABLE')||!out.source.includes('PAYMENT_PROOF_REQUIRED'))throw Error('SBC_V6606_INCOMPLETE_GUARD');
 return out.source;
}
if(require.main===module){
 const file=path.resolve(__dirname,'..','server.js');
 const original=fs.readFileSync(file,'utf8');
 const next=check(original);
 const oldHash=crypto.createHash('sha256').update(original).digest('hex');
 const newHash=crypto.createHash('sha256').update(next).digest('hex');
 if(process.argv.includes('--apply')){
   if(process.env.SBC_ENABLE_V6606_SOURCE_WRITE!=='YES')throw Error('SBC_V6606_EXPLICIT_SOURCE_WRITE_APPROVAL_REQUIRED');
   fs.writeFileSync(file,next);
   console.log('[SBC V6606] Staged server source patched; update flat release identity and repackage before deployment.');
 }else console.log('[SBC V6606] PASS: patch parsed, all six anchors matched, idempotent and ready for staging (no source changed).');
 console.log('[SBC V6606] sha256 original='+oldHash+' patched='+newHash);
}
module.exports={patch,check,MARK};

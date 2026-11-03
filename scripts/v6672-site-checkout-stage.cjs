'use strict';
// Compile into CI's disposable flat GoDaddy runtime. No production writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARK='SBC_V6672_SIGNED_WEBSITE_CHECKOUT';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARK+' '+label+' expected once, found '+n);return s.replace(a,b)}
function patchServer(source){
 if(typeof source!=='string'||!source)throw Error(MARK+': server source required');
 if(source.includes(MARK))return {source,alreadyApplied:true};
 let s=source;
 s=once(s,"const PUBLIC_CHECKOUT_RATE=new Map();",
 "/* "+MARK+" */\nconst SBC_V6672_SITE_CHECKOUT=require('./enterprise/v6672-site-checkout-integrity.cjs');\nconst SBC_V6672_CHECKOUT_INFLIGHT=new Set();\nconst PUBLIC_CHECKOUT_RATE=new Map();",'setup');
 const start=s.indexOf("app.post('/api/public/checkout',async(req,res)=>{");
 const end=s.indexOf("\napp.get('/api/sales-orders'",start);
 if(start<0||end<start)throw Error(MARK+' checkout route missing');
 let block=s.slice(start,end);
 block=once(block,"app.post('/api/public/checkout',async(req,res)=>{\n  try{",
  "app.post('/api/public/checkout',async(req,res)=>{\n  let websiteCheckoutLock='';\n  try{",'request scope');
 block=once(block,"const tenantId=requireMappedRequestTenant(req);",
  "const siteSigned=Boolean(req.headers['x-sbc-website-host']);\n    let tenantId;try{tenantId=siteSigned?sbcVerifiedWebsiteTenant(req):requireMappedRequestTenant(req)}catch(e){return res.status(e.status||403).json({ok:false,code:e.code||'WEBSITE_CHECKOUT_TENANT_REQUIRED'})}\n    const websiteRequestId=siteSigned?String(b.clientRequestId||'').trim():'';",
  'signed tenant');
 block=once(block,
  "if(!name||!email||!phone)return res.status(400).json({error:'Business name, email and phone are required.'});",
  `if(!name||!email||!phone)return res.status(400).json({error:'Business name, email and phone are required.'});
    if(siteSigned){
      if(!['quickstart','starter','essentials'].includes(packageId))return res.status(422).json({ok:false,code:'WEBSITE_CHECKOUT_PACKAGE_UNAVAILABLE'});
      if(!SBC_V6672_SITE_CHECKOUT.requestIdValid(websiteRequestId))return res.status(422).json({ok:false,code:'WEBSITE_CHECKOUT_REQUEST_ID_REQUIRED'});
      const found=SBC_V6672_SITE_CHECKOUT.inspectExisting({tenantId,clientRequestId:websiteRequestId,packageId,email,businessName:name,orders:db.orders,customers:db.customers});
      if(found.found)return res.status(found.ok?200:found.status).json(found);
      const key=String(tenantId)+':'+websiteRequestId;
      if(SBC_V6672_CHECKOUT_INFLIGHT.has(key))return res.status(409).json({ok:false,code:'WEBSITE_CHECKOUT_IN_PROGRESS',noNewOrder:true,noNewPaymentLink:true,automaticRetry:false});
      SBC_V6672_CHECKOUT_INFLIGHT.add(key);websiteCheckoutLock=key;
    }`,'validated client request and lock');
 block=once(block,
  "source:'Public Checkout',createdAt:now()",
  "source:siteSigned?'sbcmia.com Checkout':'Public Checkout',createdAt:now()",
  'source attribution');
 block=once(block,
  "notes:JSON.stringify({publicCheckout:true,items,bundleId:pkg.id",
  "notes:JSON.stringify({publicCheckout:true,websiteCheckoutRequestId:siteSigned?websiteRequestId:'',websiteCheckoutSource:siteSigned?'sbcmia.com':'',items,bundleId:pkg.id",
  'order idempotency correlation');
 block=once(block,
  "}catch(e){res.status(400).json({ok:false,error:e.message||'Checkout could not be created.'});}\n});",
  "}catch(e){res.status(400).json({ok:false,error:e.message||'Checkout could not be created.'});}\n  finally{if(websiteCheckoutLock)SBC_V6672_CHECKOUT_INFLIGHT.delete(websiteCheckoutLock)}\n});",
  'lock release');
 s=s.slice(0,start)+block+s.slice(end);
 new vm.Script(s,{filename:'sbc-v6672-compiled-website-checkout.js'});
 return {source:s,alreadyApplied:false};
}
if(require.main===module){
 const f=path.resolve(__dirname,'../server.js'),source=fs.readFileSync(f,'utf8'),p=patchServer(source);
 if(patchServer(p.source).source!==p.source)throw Error(MARK+': non-idempotent');
 if(process.argv.includes('--apply')){
  if(process.env.SBC_ENABLE_V6672_SOURCE_WRITE!=='YES')throw Error(MARK+': CI write approval required');
  if(!p.alreadyApplied)fs.writeFileSync(f,p.source);
  console.log('[SBC V6672] staged signed website checkout compiled');
 }else console.log('[SBC V6672] PASS: signed checkout route built in-memory');
}
module.exports={patchServer,MARK};

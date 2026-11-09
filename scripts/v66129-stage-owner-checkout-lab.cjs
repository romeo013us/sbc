'use strict';
/* V66.129, compiled only into disposable GoDaddy release stage.
 * Internal QA orders are held in the persistent owner-only settings ledger,
 * NEVER in normal paid orders, vendor queues, subscriptions or CRM.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const FILE=path.resolve(__dirname,'../server.js');
const MARK='SBC_V66129_OWNER_ZERO_CHARGE_CHECKOUT_LAB';
function patchServer(src){
 if(src.includes(MARK)){
  assert(src.includes("require('./enterprise/v66129-owner-checkout-lab.cjs')"));
  return src;
 }
 const anchor='/* SBC_V6630_CUSTOMER_JOURNEY_ORDER_GUARDS: legacy CRUD cannot mint financial proof. */';
 const route=[
 '// '+MARK,
 "const SBC_V66129_LAB=require('./enterprise/v66129-owner-checkout-lab.cjs');",
 'function sbcV66129List(tenantId){',
 '  const all=Array.isArray(db.settings?.ownerCheckoutLab)?db.settings.ownerCheckoutLab:[];',
 '  return all.filter(o=>Number(o.tenantId)===Number(tenantId)&&SBC_V66129_LAB.isLab(o));',
 '}',
 "app.get('/api/owner/checkout-lab/catalog',auth,ownerOnly,(req,res)=>{",
 "  res.setHeader('Cache-Control','no-store');",
 "  try{requireRequestTenant(req);res.json({ok:true,kind:'INTERNAL_ZERO_DOLLAR_QA',",
 '    catalog:SBC_V66129_LAB.catalog(CATALOG),chargeCents:0,providerCalls:0});}',
 "  catch(_){res.status(403).json({ok:false,error:'OWNER_LAB_TENANT_REQUIRED'});}",
 '});',
 "app.get('/api/owner/checkout-lab/orders',auth,ownerOnly,(req,res)=>{",
 "  res.setHeader('Cache-Control','no-store');",
 '  try{',
 '   const t=requireRequestTenant(req);',
 "   if(!mysqlPool||MYSQL_RECOVERY_REQUIRED||!MYSQL_RECOVERY_EVALUATED)return res.status(503).json({ok:false,error:'OWNER_LAB_DB_NOT_READY'});",
 '   const records=sbcV66129List(t).slice(-80).reverse().map(SBC_V66129_LAB.publicRecord);',
 "   return res.json({ok:true,records,source:'PERSISTED_OWNER_QA_LEDGER',readOnly:true});",
 "  }catch(_){return res.status(503).json({ok:false,error:'OWNER_LAB_READ_UNAVAILABLE'});}",
 '});',
 "app.post('/api/owner/checkout-lab/order',auth,ownerOnly,async(req,res)=>{",
 "  res.setHeader('Cache-Control','no-store');",
 '  try{',
 '   const t=requireRequestTenant(req);SBC_V6649_REQUIRE_WRITER();',
 '   const b=req.body||{};',
 "   if(b.confirm!=='CREATE_ZERO_DOLLAR_QA'||Number(b.discountPercent)!==100)",
 "     return res.status(422).json({ok:false,error:'OWNER_LAB_EXACT_100_PERCENT_DISCOUNT_REQUIRED'});",
 "   if(Object.keys(b).some(k=>!['confirm','discountPercent','productId','requestId'].includes(k)))",
 "     return res.status(422).json({ok:false,error:'OWNER_LAB_UNEXPECTED_INPUT'});",
 "   const requestId=String(b.requestId||''),all=sbcV66129List(t);",
 '   const existing=all.find(o=>SBC_V66129_LAB.parse(o).ownerCheckoutLab?.requestId===requestId);',
 '   if(existing)return res.json({ok:true,existing:true,record:SBC_V66129_LAB.publicRecord(existing)});',
 '   const chosen=[...(CATALOG.packages||[]),...(CATALOG.services||[])].find(p=>p.id===b.productId&&!p.testOnly);',
 "   if(!chosen)return res.status(404).json({ok:false,error:'OWNER_LAB_PRODUCT_NOT_IN_CATALOG'});",
 "   const record=SBC_V66129_LAB.create({tenantId:t,product:chosen,requestId,actor:req.user,",
 "     orderId:id('qaorder'),at:now(),customerName:'SBC INTERNAL QA — DO NOT FULFILL'});",
 '   db.settings.ownerCheckoutLab=Array.isArray(db.settings.ownerCheckoutLab)?db.settings.ownerCheckoutLab:[];',
 '   db.settings.ownerCheckoutLab.push(record);',
 '   try{await saveData()}catch(_){return res.status(503).json({ok:false,',
 "     error:'OWNER_LAB_SAVE_UNCONFIRMED',orderId:record.id,automaticRetry:false});}",
 "   audit(req.user,'owner_checkout_lab_created','Created $0 internal checkout QA',{",
 '     qaOrderId:record.id,productId:String(chosen.id),listPriceCents:SBC_V66129_LAB.publicRecord(record).listPriceCents});',
 '   return res.status(201).json({ok:true,existing:false,record:SBC_V66129_LAB.publicRecord(record)});',
 "  }catch(e){return res.status(Number(e.status||503)).json({ok:false,error:String(e.code||'OWNER_LAB_CREATE_UNAVAILABLE')});}",
 '});',
 "app.post('/api/owner/checkout-lab/order/:orderId/advance',auth,ownerOnly,async(req,res)=>{",
 "  res.setHeader('Cache-Control','no-store');",
 '  try{',
 '   const t=requireRequestTenant(req);SBC_V6649_REQUIRE_WRITER();',
 "   const all=sbcV66129List(t),o=all.find(x=>String(x.id)===String(req.params.orderId||''));",
 "   if(!o)return res.status(404).json({ok:false,error:'OWNER_LAB_ORDER_NOT_FOUND'});",
 '   const result=SBC_V66129_LAB.next(o,{stage:req.body?.stage,actor:req.user,',
 '     at:now(),confirm:req.body?.confirm});',
 '   if(!result.unchanged){',
 '    const idx=db.settings.ownerCheckoutLab.findIndex(x=>String(x.id)===String(o.id));',
 '    db.settings.ownerCheckoutLab[idx]=result.order;',
 '    try{await saveData()}catch(_){return res.status(503).json({ok:false,',
 "      error:'OWNER_LAB_SAVE_UNCONFIRMED',orderId:o.id,automaticRetry:false});}",
 "    audit(req.user,'owner_checkout_lab_stage','Advanced internal QA fulfillment',{",
 '      qaOrderId:o.id,stage:req.body?.stage});',
 '   }',
 '   return res.json({ok:true,unchanged:result.unchanged,record:SBC_V66129_LAB.publicRecord(result.order)});',
 "  }catch(e){return res.status(Number(e.status||503)).json({ok:false,error:String(e.code||'OWNER_LAB_ADVANCE_UNAVAILABLE')});}",
 '});',
 ''
 ].join('\n');
 assert.equal(src.split(anchor).length-1,1,'unique secured checkout anchor expected');
 return src.replace(anchor,route+anchor);
}
if(require.main===module){
 const source=fs.readFileSync(FILE,'utf8'),out=patchServer(source);
 assert.equal(patchServer(out),out,'stage idempotence');
 if(process.argv.includes('--verify-staged'))assert.equal(source,out,'compiled QA route missing');
 else if(process.argv.includes('--apply')){
  if(process.env.SBC_V66129_ISOLATED_STAGE!=='YES')throw Error('DISPOSABLE_STAGE_ONLY');
  fs.writeFileSync(FILE,out);
 }
 console.log('[SBC V66.129] PASS owner $0 checkout lab staged, provider calls=0');
}
module.exports={MARK,patchServer};

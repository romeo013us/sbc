'use strict';
// Guard only sales-order intake and owner note spoofing, NOT Square webhooks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const MARK='SBC_V66120_OFFICEBOX_RECURRING_SQUARE_BOUNDARY';
const root=path.resolve(__dirname,'..'),file=path.join(root,'server.js');
function replaceOnce(source,before,after){
 assert.equal(source.split(before).length-1,1,'exact CC commerce anchor absent or duplicated');
 return source.replace(before,after);
}
function patchServer(source){
 if(source.includes(MARK)){
  assert(source.includes('SBC_V66120_OB_COMMERCE.guardOneTimeSquareSale'),'partial recurring checkout guard');
  assert(source.includes('SBC_V66120_OB_COMMERCE.protectedNotes(n)'),'partial notes protection');
  return source;
 }
 let s=replaceOnce(source,
  "const SBC_V6670_QUOTE_ORDER=require('./enterprise/v6670-quote-order-integrity.cjs');",
  "/* "+MARK+" */\nconst SBC_V66120_OB_COMMERCE=require('./enterprise/v66120-officebox-commerce-boundary.cjs');\nconst SBC_V6670_QUOTE_ORDER=require('./enterprise/v6670-quote-order-integrity.cjs');");
 s=replaceOnce(s,
  "const b=req.body||{},items=v25OrderItems(b.items);",
  "const b=req.body||{},items=v25OrderItems(b.items);"+
  "const obSale=SBC_V66120_OB_COMMERCE.guardOneTimeSquareSale(b,items);"+
  "if(!obSale.ok)return res.status(obSale.status).json({ok:false,code:obSale.code,noNewOrder:true,noNewPaymentLink:true,requiresRecurringCheckout:true,message:'Office Box subscription plans must use verified recurring subscription checkout; this Square order was not created.'});");
 s=replaceOnce(s,
  "if(!n||typeof n!=='object')return false;\n return ['squareOrderId'",
  "if(!n||typeof n!=='object')return false;\n if(SBC_V66120_OB_COMMERCE.protectedNotes(n))return true;\n return ['squareOrderId'");
 return s;
}
if(require.main===module){
 const existing=fs.readFileSync(file,'utf8'),staged=patchServer(existing);
 assert.equal(patchServer(staged),staged,'staging must be idempotent');
 if(process.argv.includes('--verify-staged'))assert.equal(existing,staged,'compiled stage must contain recurring boundary');
 else if(process.argv.includes('--apply')){
  if(process.env.SBC_V66120_ISOLATED_STAGE!=='YES')throw Error('OFFICEBOX_BOUNDARY_REQUIRE_DISPOSABLE_STAGE');
  fs.writeFileSync(file,staged);
 }
 console.log('[SBC V66.120] PASS: recurring checkout boundary '+(process.argv.includes('--apply')?'staged':process.argv.includes('--verify-staged')?'verified':'dry-run'));
}
module.exports={MARK,patchServer};

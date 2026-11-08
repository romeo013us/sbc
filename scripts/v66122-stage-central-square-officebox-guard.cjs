'use strict';
// Block all order-based one-time Square payment link attempts for standalone
// Office Box recurring plans; do not touch Square webhooks or existing bundles.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const MARK='SBC_V66122_OFFICEBOX_CENTRAL_SQUARE_LINK_GUARD';
const file=path.resolve(__dirname,'../server.js');
function patchServer(s){
 if(s.includes(MARK)){
  assert(s.includes('SBC_V66120_OB_COMMERCE.guardOneTimeSquareSale'),'central guard depends on trusted policy');
  return s;
 }
 assert(s.includes('SBC_V66120_OFFICEBOX_RECURRING_SQUARE_BOUNDARY'),'source must carry V66120 policy');
 const old="async function createSquarePaymentLinkForOrder(o,req){\n  if(RUNTIME_GATE.blocked('NEW_CHECKOUTS')){const e=new Error('NEW_CHECKOUTS_PAUSED_BY_OWNER');e.status=423;throw e;}\n  if(!o) throw new Error('Order not found.');";
 const repl=old+"\n  // "+MARK+"\n  const officeBoxSaleNotes=orderParsed(o);\n  const officeBoxSaleResult=SBC_V66120_OB_COMMERCE.guardOneTimeSquareSale({...officeBoxSaleNotes,name:String(o.product||''),items:officeBoxSaleNotes.items},officeBoxSaleNotes.items);\n  if(!officeBoxSaleResult.ok||o.officeBoxSku){const e=new Error('OFFICEBOX_RECURRING_CHECKOUT_REQUIRED');e.status=422;throw e;}";
 assert.equal(s.split(old).length-1,1,'unique Square payment link anchor required');
 return s.replace(old,repl);
}
if(require.main===module){
 const s=fs.readFileSync(file,'utf8'),out=patchServer(s);assert.equal(patchServer(out),out);
 if(process.argv.includes('--verify-staged'))assert.equal(s,out,'central Square guard missing');
 else if(process.argv.includes('--apply')){
  if(process.env.SBC_V66122_ISOLATED_STAGE!=='YES')throw Error('CENTRAL_SQUARE_GUARD_DISPOSABLE_STAGE_REQUIRED');
  fs.writeFileSync(file,out);
 }
 console.log('[SBC V66.122] PASS: central Square subscription safety');
}
module.exports={MARK,patchServer};

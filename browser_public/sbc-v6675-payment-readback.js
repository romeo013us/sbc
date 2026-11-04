/* SBC V66.75 — Owner-only read-only Square QA evidence. No checkout creation. */
(function(){
'use strict';
if(window.__SBC_V6675_PAYMENT_READBACK__)return;
window.__SBC_V6675_PAYMENT_READBACK__=true;
const byId=id=>document.getElementById(id);
const isOwner=()=>String(window.state?.me?.role||'').toLowerCase()==='owner';
function message(text){const n=byId('sbc-v6675-qa-feedback');if(n)n.textContent=String(text||'');}
window.sbcOpenSquareQaReadback=function(){
 if(!isOwner())return window.toast?.('Owner-only payment evidence.');
 if(typeof window.openModal!=='function'||typeof window.api!=='function')return window.toast?.('Authenticated Command Center services are unavailable.');
 window.openModal('Read-only $1 QA order verification',
  '<p class="install-tip"><strong>Evidence only.</strong> This check never creates orders, checkout links, charges, fulfillment or Office Box entitlements.</p>'+
  '<form id="sbc-v6675-qa-form"><label>Existing SBC $1 QA order ID<input type="text" id="sbc-v6675-qa-order" required maxlength="120" autocomplete="off" placeholder="ord_…"></label>'+
  '<div class="actions"><button class="btn primary" type="submit" id="sbc-v6675-qa-check">Check existing order (GET only)</button></div></form>'+
  '<p role="status" aria-live="polite" id="sbc-v6675-qa-feedback">Enter the original order ID. No financial action has been initiated.</p>');
 const form=byId('sbc-v6675-qa-form');
 if(!form)return;
 form.addEventListener('submit',async function(event){
  event.preventDefault();
  const orderId=String(byId('sbc-v6675-qa-order')?.value||'').trim();
  if(!/^ord_[a-zA-Z0-9_-]{5,110}$/.test(orderId))return message('Enter an existing SBC order ID beginning with ord_. Nothing was changed.');
  const button=byId('sbc-v6675-qa-check');
  if(button)button.disabled=true;
  message('Reading existing SBC order status…');
  try{
   const first=await window.api('/api/payments/square/order/'+encodeURIComponent(orderId),{method:'GET'});
   const order=first?.order;
   if(first?.ok!==true||!order||String(order.id)!==orderId)throw Error('ORDER_READBACK_UNCONFIRMED');
   const payment=String(order.paymentStatus||'Unknown');
   const fulfillment=String(order.fulfillmentStatus||'Unknown');
   const provider=String(order.squareStatus||'Unconfirmed');
   // The SBC record and Square settlement can differ until reconciled.
   if(payment.toUpperCase()==='PAID'){
    message('SBC order record: PAID · Fulfillment: '+fulfillment+' · Square evidence status: '+provider+'. Verify the actual Square transaction before closing reconciliation. Do not charge again.');
    return;
   }
   message('SBC order: '+payment+' · Fulfillment: '+fulfillment+'. Checking existing Square link evidence (read-only)…');
   const readback=await window.api('/api/owner/launch-qa/reconcile/'+encodeURIComponent(orderId),{method:'GET'});
   const classification=String(readback?.status||'UNCONFIRMED');
   if(readback?.ok!==true||!['PAID','MATCHED','NONE'].includes(classification)){
    message('STOP: Square outcome is not confirmed. Manually reconcile the original order in Square. No new order or checkout link was created.');
   }else if(classification==='MATCHED'){
    message('One existing Square checkout link was matched to this QA order. Check the original link and transaction in Square. Do not pay twice.');
   }else if(classification==='PAID'){
    message('Square/SBC reports an existing paid QA order. Verify the Square charge and the no-vendor-fulfillment hold. Do not pay again.');
   }else{
    message('No matching existing Square link was found in the read-only reconciliation check. This is NOT permission to create another link or charge; review Square first.');
   }
  }catch(_){
   message('STOP: Existing QA order or Square evidence could not be verified. Check the original order in Square and Command Center; do not retry payment.');
  }finally{if(button)button.disabled=false;}
 });
};
})();
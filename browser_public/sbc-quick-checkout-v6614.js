/* SBC_V6614_FAST_CHECKOUT: simplified sales entry and protected owner $1 QA.
 * Client-side only; existing tenant, payment, provider and margin gates apply.
 */
(function(){
'use strict';
if(window.__SBC_V6614_FAST_CHECKOUT__)return;
window.__SBC_V6614_FAST_CHECKOUT__=true;
var $=id=>document.getElementById(id);
var current=()=>typeof state==='object'&&state?state:window.state;
var esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var isOwner=()=>String(current()?.me?.role||'').toLowerCase()==='owner';
var canSell=()=>['owner','admin','manager','sales','sales_manager','sales_account_manager'].includes(String(current()?.me?.role||'').toLowerCase());
var clients=()=>Array.isArray(current()?.data?.customers)?current().data.customers.filter(c=>c&&!c._recoveryProjection):[];
var productList=()=>[...(current()?.catalog?.packages||[]),...(current()?.catalog?.services||[])].filter(p=>p&&!p.testOnly&&Number(p.price)>0&&!/launch qa|SBC_LAUNCH_QA_1USD/i.test(String(p.name||'')+' '+String(p.id||'')));
var setText=(id,message)=>{var el=$(id);if(el)el.textContent=message;};
var notify=s=>{if(typeof window.toast==='function')window.toast(s);};
var authFetch=(url,options)=>{if(typeof window.api!=='function')throw Error('Authenticated SBC service unavailable');return window.api(url,options);};
var modal=(title,html)=>{if(typeof window.openModal!=='function')throw Error('SBC modal unavailable');window.openModal(title,html);};
var locked=()=>!!(current()?.data?.recovery?.required||current()?.data?.readOnly||current()?.data?.mysqlRecoveryRequired);
function squareUrl(raw){
 try{var u=new URL(String(raw||''));return u.protocol==='https:'&&!u.username&&!u.password&&['square.link','checkout.square.site','square.site','squareup.com'].includes(u.hostname.toLowerCase())?u.href:'';}catch{return '';}
}
window.sbcOpenQuickCheckout=function(){
 if(!canSell())return notify('Sales or owner access required.');
 if(locked())return notify('Recovery/read-only lock: no checkout allowed.');
 var cs=clients(),products=productList();
 var customerOptions=cs.map(c=>'<option value="'+esc(c.id)+'" data-label="'+esc((c.businessName||c.contactName||'')+' '+(c.email||''))+'">'+esc(c.businessName||c.contactName||'Customer')+'</option>').join('');
 var productOptions=products.map((p,i)=>'<option value="'+i+'">'+esc(p.name)+' — $'+Number(p.price).toFixed(2)+'</option>').join('');
 modal('⚡ Quick Checkout','<p class="install-tip">Choose a customer and product. We will prefill the existing quote builder; verify supplier costs and the final total before using Square. No charge is created here.</p><form id="sbc-v6614-fast-form"><div class="form-grid"><label>Search customer<input type="search" id="sbc-v6614-search" placeholder="Name or email"></label><label>Customer<select id="sbc-v6614-customer" required><option value="">Choose customer</option>'+customerOptions+'</select></label><label>Product<select id="sbc-v6614-product" required><option value="">Choose package or service</option>'+productOptions+'</select></label></div><p id="sbc-v6614-fast-feedback" class="mini" role="status">Existing 20% margin and payment-verification protections remain active.</p><div class="actions"><button type="button" id="sbc-v6614-cancel" class="btn">Cancel</button><button class="btn primary" type="submit">Continue to prefilled quote</button></div></form>');
 $('sbc-v6614-cancel')?.addEventListener('click',()=>window.closeModal?.());
 $('sbc-v6614-search')?.addEventListener('input',e=>{
  var q=String(e.target.value||'').trim().toLowerCase();
  Array.from($('sbc-v6614-customer').options).slice(1).forEach(o=>{o.hidden=!!q&&!String(o.dataset.label||o.textContent).toLowerCase().includes(q);});
 });
 $('sbc-v6614-fast-form').addEventListener('submit',e=>{
  e.preventDefault();
  var id=$('sbc-v6614-customer')?.value;
  var selected=$('sbc-v6614-product')?.value;
  var c=cs.find(v=>String(v.id)===String(id));
  var p=selected!==''?products[Number(selected)]:null;
  if(!c||!p)return setText('sbc-v6614-fast-feedback','Choose a customer and a product.');
  if(typeof window.newQuote!=='function')return setText('sbc-v6614-fast-feedback','Quote builder unavailable. Nothing was charged.');
  window.newQuote();
  var picker=$('quoteCustomer');
  if(picker){picker.value=String(c.id);picker.dispatchEvent(new Event('change',{bubbles:true}));}
  var name=$('quoteCustomerName');if(name)name.value=c.businessName||c.contactName||'';
  var row=$('quoteItems')?.querySelector('.quote-line');
  var product=row?.querySelector('.line-name');
  if(product){
    product.value=String(p.name);
    if(product.value===String(p.name))product.dispatchEvent(new Event('change',{bubbles:true}));
    else notify('Product requires manual selection in quote. No charge made.');
  }
  notify('Prefilled quote ready. Review, save, then Build Order & Checkout.');
 });
};
window.sbcOpenOwnerDollarQA=function(){
 if(!isOwner())return notify('Owner-only checkout test.');
 if(locked())return notify('Recovery/read-only lock. Use verified Published writer.');
 var orderId='',linkAttempted=false;
 modal('🧪 Owner $1 Square test','<p class="install-tip"><strong>Owner-only internal test — $1.00 USD.</strong> No domain, print, commission or Office Box fulfillment. Each financial action requires your click and existing server authorization.</p><form id="sbc-v6614-qa-form"><label>Owner-controlled email<input type="email" id="sbc-v6614-email" required maxlength="254" autocomplete="email"></label><div class="actions"><button type="submit" class="btn primary" id="sbc-v6614-order-btn">1. Create / find $1 QA order</button></div></form><div id="sbc-v6614-qa-steps" hidden class="detail-box"><strong id="sbc-v6614-order-label"></strong><div class="actions"><button type="button" class="btn orange" id="sbc-v6614-link-btn">2. Generate Square link once</button><button type="button" class="btn" id="sbc-v6614-status-btn">3. Check payment status</button></div><div id="sbc-v6614-payment-link"></div><div id="sbc-v6614-payment-status"></div></div><p class="mini" role="status" aria-live="polite" id="sbc-v6614-qa-message">No payment or vendor action has been initiated.</p>');
 var msg=s=>setText('sbc-v6614-qa-message',s);
 var create=$('sbc-v6614-order-btn');
 function showLink(raw){
  var url=squareUrl(raw);
  if(!url)return false;
  var holder=$('sbc-v6614-payment-link'),a=document.createElement('a');
  a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.className='btn primary';a.textContent='Open Square $1 checkout';
  holder.replaceChildren(a);return true;
 }
 $('sbc-v6614-qa-form').addEventListener('submit',async e=>{
  e.preventDefault();if(orderId)return;
  create.disabled=true;
  msg('Verifying owner, tenant, cost, and writer controls…');
  try{
    var r=await authFetch('/api/owner/launch-qa/create-order',{method:'POST',body:JSON.stringify({email:String($('sbc-v6614-email').value||'').trim()})});
    if(!r?.ok||r.amountCents!==100||!r.orderId)throw Error('Exactly $1.00 was not confirmed; stop.');
    orderId=String(r.orderId);
    $('sbc-v6614-qa-steps').hidden=false;
    setText('sbc-v6614-order-label','Internal order '+orderId+' · $1.00 · '+String(r.paymentStatus||'Pending'));
    if(r.existing){linkAttempted=true;$('sbc-v6614-link-btn').disabled=true;msg('Existing test order reused. Checking provider link/status without creating a second payment link.');
      try{var existing=await authFetch('/api/payments/square/order/'+encodeURIComponent(orderId),{method:'GET'});var order=existing?.order||existing;
        if(showLink(order?.paymentUrl))msg('Original Square link recovered. Verify the merchant, $1.00 amount, and payment status before paying.');
        if(String(order?.paymentStatus||'').toLowerCase()==='paid')msg('This QA order is already marked Paid. Verify it in Square; do not charge again.');
      }catch(_){msg('Existing order found, but read-only link lookup failed. Do not generate a second link.');}
    }
    if(showLink(r.paymentUrl)){linkAttempted=true;$('sbc-v6614-link-btn').disabled=true;}
    msg(r.existing?'Existing order reused. Never create a duplicate charge.':'Order saved. No Square link or payment was created.');
  }catch(err){
    msg('STOP: '+String(err.message||'Unconfirmed order')+'. Verify existing order before trying again. No automatic retry.');
    // Button stays disabled on uncertain responses.
  }
 });
 $('sbc-v6614-link-btn').addEventListener('click',async()=>{
  if(!orderId||linkAttempted)return;
  if(!window.confirm('Create one Square checkout link for this verified $1 internal QA order?'))return;
  linkAttempted=true;$('sbc-v6614-link-btn').disabled=true;
  msg('Creating one checkout link. Do not repeat if the response is uncertain.');
  try{
    var r=await authFetch('/api/payments/square/create-link/'+encodeURIComponent(orderId),{method:'POST',body:'{}'});
    var url=r?.paymentUrl||r?.checkoutUrl||r?.url||r?.link?.url||r?.paymentLink?.url||r?.payment_link?.url;
    if(!showLink(url))throw Error('No valid Square URL returned. Reconcile in Payments/Square; do not create a second link.');
    msg('Link ready. On Square, confirm the merchant and $1.00 before paying once.');
  }catch(err){msg('STOP: '+String(err.message||'No checkout URL')+'. Reconcile the order; no automatic retry.');}
 });
 $('sbc-v6614-status-btn').addEventListener('click',async()=>{
  if(!orderId)return;
  try{
    var r=await authFetch('/api/payments/square/order/'+encodeURIComponent(orderId),{method:'GET'});
    var o=r?.order||r;
    var status=String(o?.paymentStatus||o?.squarePaymentStatus||'Pending');
    var hold=String(o?.fulfillmentStatus||'Unknown');
    setText('sbc-v6614-payment-status','Payment: '+status+' · Fulfillment: '+hold);
    msg(status.toLowerCase()==='paid'&&hold==='QA VERIFIED - NO FULFILLMENT'?
      'SBC reports Paid and no fulfillment. Confirm the same completed charge in Square.':
      'Not fully verified. Check Square Dashboard; do not mark Paid manually or repeat the charge.');
  }catch(err){msg('Read-only payment check unavailable: '+String(err.message||'Unknown'));}
 });
};
})();
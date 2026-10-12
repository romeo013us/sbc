/* SBC_V6525_CUSTOMER360_WORKSPACE — Customer 360 action workspace. No payment or outreach is triggered until the user confirms the final action. */
(function(){
  'use strict';
  if(window.__SBC_V6525_CUSTOMER360_WORKSPACE__) return;
  window.__SBC_V6525_CUSTOMER360_WORKSPACE__ = true;
  const byId = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const customers = () => (state && state.data && Array.isArray(state.data.customers)) ? state.data.customers : [];
  const quotes = () => (state && state.data && Array.isArray(state.data.quotes)) ? state.data.quotes : [];
  const customerById = id => customers().find(c => String(c.id ?? c.customer_id ?? c.customerId ?? '') === String(id));
  const quoteCustomerId = q => String(q.customerId ?? q.customer_id ?? q.customerID ?? '');
  const isLocked = () => Boolean(state?.data?.recovery?.required || state?.data?.recoveryRequired || state?.data?.readOnly || state?.data?.mysqlRecoveryRequired);
  const canSell = () => !['caller','demo'].includes(String(state?.me?.role || '').toLowerCase());
  function addButton(parent, label, cls, fn, disabled, title){
    const b = document.createElement('button'); b.type='button'; b.className='btn '+(cls||''); b.textContent=label;
    if(disabled){b.disabled=true;b.title=title||'Unavailable in the current safety state';}
    b.addEventListener('click',fn); parent.appendChild(b); return b;
  }
  function installActions(id){
    const host=document.querySelector('#modalBody .v322-360'); const c=customerById(id);
    if(!host||!c)return;
    host.querySelector('.v6525-customer-actions')?.remove();
    const bar=document.createElement('div');bar.className='actions v6525-customer-actions';
    const locked=isLocked(), phone=String(c.phone||c.phone_number||c.primary_phone||'').trim(), email=String(c.email||c.email_address||c.primary_email||'').trim();
    if(phone)addButton(bar,'☎ Call from SBC','primary',()=>{if(typeof window.openSbcDialer==='function')window.openSbcDialer(c.id);else toast('SBC dialer is not available in this release.');},locked,'Recovery/read-only mode blocks outreach.');
    if(email)addButton(bar,'✉ Email','',()=>{if(typeof window.sendEmailToLead==='function')window.sendEmailToLead(c.id);else toast('Email composer is not available.');},locked,'Recovery/read-only mode blocks outreach.');
    if(phone)addButton(bar,'▣ SMS','',()=>{if(typeof window.sendSmsToLead==='function')window.sendSmsToLead(c.id);else toast('SMS composer is not available.');},locked,'Recovery/read-only mode blocks outreach.');
    addButton(bar,'＋ Build Cart / Quote','',()=>window.sbcStartCustomerQuote(c.id),locked||!canSell(),locked?'Recovery/read-only mode blocks new quotes.':'This role cannot create quotes.');
    addButton(bar,'⚡ Fast Checkout','primary',()=>window.sbcCustomerFastCheckout(c.id),locked||!canSell(),locked?'Recovery/read-only mode blocks checkout preparation.':'This role cannot prepare checkout.');
    if(typeof window.generateWebsiteDemo==='function')addButton(bar,'Generate Demo','',()=>window.generateWebsiteDemo(c.id),locked,'Recovery/read-only mode blocks new actions.');
    if(typeof window.megaRequestRefund==='function')addButton(bar,'Request Refund','danger',()=>window.megaRequestRefund(c.id),locked,'Recovery/read-only mode blocks refund requests.');
    const before=host.querySelector(':scope > .actions');host.insertBefore(bar,before||null);
  }
  const originalOpen360=window.openV322Customer360;
  if(typeof originalOpen360==='function'){
    window.openV322Customer360=async function(id){
      const chosen=id||byId('v322CustomerSelect')?.value;
      const result=await originalOpen360.apply(this,arguments);
      const cid=String(chosen||'');
      if(cid)installActions(cid);
      return result;
    };
  }
  const originalSafeOpen=window.openCustomer360Safe;
  window.openCustomer360Safe=async function(id){
    let c=customerById(id);
    if(!c && typeof window.load==='function'){try{await window.load();}catch{} c=customerById(id);}
    if(!c){if(typeof toast==='function')toast('Customer record could not be loaded.');return;}
    if(typeof window.openV322Customer360==='function')return window.openV322Customer360(id);
    if(typeof originalSafeOpen==='function')return originalSafeOpen.call(this,id);
    if(typeof window.megaCustomer==='function')return window.megaCustomer(id);
  };
  window.sbcStartCustomerQuote=function(customerId){
    if(isLocked())return toast('Recovery/read-only mode blocks quote creation.');
    if(!canSell())return toast('Your role cannot create quotes. Ask the owner or manager.');
    const c=customerById(customerId);if(!c)return toast('Customer not found in the current CRM state.');
    if(typeof window.newQuote!=='function')return toast('Quote builder is not available.');
    window.newQuote();
    setTimeout(()=>{const select=byId('quoteCustomer');if(!select)return;select.value=String(c.id);select.dispatchEvent(new Event('change',{bubbles:true}));const name=byId('quoteCustomerName');if(name)name.value=c.businessName||c.contactName||'';},0);
  };
  window.sbcCustomerFastCheckout=function(customerId){
    if(isLocked())return toast('Recovery/read-only mode blocks checkout preparation.');
    if(!canSell())return toast('Your role cannot prepare checkout. Ask the owner or manager.');
    const c=customerById(customerId);if(!c)return toast('Customer not found.');
    const qs=quotes().filter(q=>quoteCustomerId(q)===String(customerId));
    if(!qs.length){toast('No quote exists for this customer yet. Build the cart/quote first.');return window.sbcStartCustomerQuote(customerId);}
    const rows=qs.map(q=>{
      const id=String(q.id||'');const url=String(q.paymentUrl||q.payment_url||'');const safeUrl=/^https:\/\//i.test(url)?url:'';
      const paid=['paid','won','completed'].includes(String(q.status||'').toLowerCase());
      return {id,number:String(q.quoteNumber||q.quote_number||q.id||'Quote'),status:String(q.status||'Draft'),total:Number(q.total||0),url:safeUrl,paid};
    });
    openModal('Fast Checkout — '+(c.businessName||c.contactName||'Customer'),`<div class="install-tip"><strong>Checkout safety:</strong> select the correct quote and confirm its total before sending a link. Paid/won quotes are not offered for a second charge.</div><div class="v6525-checkout-list">${rows.map(q=>`<div class="list-card"><div><strong>${esc(q.number)} · ${esc(q.status)}</strong><div class="meta">${esc('$'+q.total.toFixed(2))}${q.url?' · Checkout link attached':' · No checkout URL attached'}</div></div><div class="actions" style="margin:0"><button type="button" class="btn small" data-v6525-load="${esc(q.id)}" ${q.paid?'disabled':''}>${q.paid?'Already paid':'Load cart'}</button>${q.url&&!q.paid?`<button type="button" class="btn small primary" data-v6525-send="${esc(q.id)}" data-channel="email" ${c.email||c.email_address?'':'disabled'}>Email link</button><button type="button" class="btn small" data-v6525-send="${esc(q.id)}" data-channel="sms" ${c.phone||c.phone_number?'':'disabled'}>SMS link</button><a class="btn small" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">Open checkout</a>`:''}</div></div>`).join('')}</div><div class="actions"><button type="button" class="btn" onclick="closeModal()">Close</button><button type="button" class="btn primary" id="v6525-new-quote">Build new cart / quote</button></div>`);
    const body=byId('modalBody');
    body.querySelectorAll('[data-v6525-load]').forEach(b=>b.addEventListener('click',()=>{const q=quotes().find(x=>String(x.id)===b.dataset.v6525Load);if(!q)return toast('Quote no longer exists in the loaded state.');if(['paid','won','completed'].includes(String(q.status||'').toLowerCase()))return toast('This quote is already paid/won; do not create another charge.');if(typeof window.sbcLoadQuoteToCart!=='function')return toast('Cart loader is unavailable.');window.sbcLoadQuoteToCart(q.id);}));
    body.querySelectorAll('[data-v6525-send]').forEach(b=>b.addEventListener('click',()=>window.sbcConfirmSendCheckoutLink(customerId,b.dataset.v6525Send,b.dataset.channel)));
    byId('v6525-new-quote')?.addEventListener('click',()=>window.sbcStartCustomerQuote(customerId));
  };
  window.sbcConfirmSendCheckoutLink=function(customerId,quoteId,channel){
    if(isLocked())return toast('Recovery/read-only mode blocks outreach.');
    const c=customerById(customerId),q=quotes().find(x=>String(x.id)===String(quoteId));if(!c||!q)return toast('Customer or quote is no longer available.');
    if(['paid','won','completed'].includes(String(q.status||'').toLowerCase()))return toast('This quote is already paid/won; do not send a second checkout.');
    const url=String(q.paymentUrl||q.payment_url||'');if(!/^https:\/\//i.test(url))return toast('This quote has no valid HTTPS checkout URL. Load the cart to continue.');
    if(channel==='email'&&!String(c.email||c.email_address||'').trim())return toast('This customer has no email address.');
    if(channel==='sms'&&!String(c.phone||c.phone_number||'').trim())return toast('This customer has no phone number.');
    const subject='Your Successful By Choice checkout — '+String(q.quoteNumber||q.quote_number||'SBC quote');
    const message=`Hi ${c.contactName||''},\n\nHere is the checkout link for ${c.businessName||c.contactName||'your SBC order'} (${subject}).\n\nTotal: $${Number(q.total||0).toFixed(2)}\n\n${url}\n\nSuccessful By Choice`;
    openModal('Confirm '+(channel==='email'?'email':'SMS')+' checkout link',`<div class="detail-box"><strong>${esc(c.businessName||c.contactName||'Customer')}</strong><div>Quote: ${esc(q.quoteNumber||q.quote_number||q.id)}</div><div>Total: $${Number(q.total||0).toFixed(2)}</div><p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Review checkout link ↗</a></p></div><form id="v6525-send-checkout-form"><label>Message preview<textarea name="message" rows="6" required>${esc(message)}</textarea></label><label class="v6525-consent"><input type="checkbox" name="consent" required> I confirm this customer requested or consented to receive this checkout link through ${channel==='email'?'email':'SMS'}.</label><div class="actions"><button type="button" class="btn" onclick="closeModal()">Cancel</button><button type="submit" class="btn primary">Confirm & send ${channel==='email'?'email':'SMS'}</button></div></form>`);
    byId('v6525-send-checkout-form').onsubmit=async e=>{e.preventDefault();if(!e.target.consent.checked)return;const body=e.target.message.value;try{await window.api(channel==='email'?'/api/communications/email':'/api/communications/sms',{method:'POST',body:JSON.stringify(channel==='email'?{customerId,subject,body}:{customerId,body})});closeModal();toast((channel==='email'?'Email':'SMS')+' checkout link submitted to SBC communications.');if(typeof window.load==='function')await window.load();}catch(err){toast(err.message||'Checkout message could not be sent.');}};
  };
  console.log('[SBC_V6525_CUSTOMER360_WORKSPACE] Customer 360 call, email, SMS, quote/cart, fast checkout, and off-sidebar launcher loaded.');
})();

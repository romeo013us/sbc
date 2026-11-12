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
  // SBC_V6684_SMART_BUSINESS_BRIEF: purely local, no API calls or writes.
  // Prepared from already authorized CRM fields when a profile is opened.
  const briefText=(v,n=160)=>String(v==null?'':v).replace(/\s+/g,' ').trim().slice(0,n);
  function businessBrief(c){
    const name=briefText(c.businessName||c.business_name||c.companyName||'This business',140);
    const industry=briefText(c.industry||c.businessCategory||c.category||'',100);
    const city=briefText(c.city||'',75),region=briefText(c.region||c.state||'',50);
    const location=[city,region].filter(Boolean).join(', ');
    const website=briefText(c.website||c.website_url||'',240);
    const kind=industry.toLowerCase();
    const segments=[
      {match:/barber|salon|hair|beauty|nail|spa|groom/,audience:'Possibly nearby clients seeking grooming, styling, or beauty appointments',question:'Is it easy for someone new to find your services, hours and booking details online?'},
      {match:/restaur|cafe|caf[eé]|food|bakery|cater|coffee/,audience:'Possibly residents and visitors looking for food, menus or catering',question:'Can customers easily find your current menu, hours and contact details online?'},
      {match:/contract|plumb|electric|roof|repair|hvac|clean|landscap|paint|construct/,audience:'Possibly property owners looking for local service providers',question:'When someone gets your name from a referral, can they quickly see your services and request a quote?'},
      {match:/auto|car|vehicle|detail|mechanic|dealership/,audience:'Possibly local drivers looking for vehicles or automotive services',question:'When people hear about your business, how easily can they find your services and contact you?'},
      {match:/shop|store|boutique|retail|market/,audience:'Possibly local shoppers seeking your products',question:'Can new shoppers easily find your location, hours and what you sell?'},
      {match:/real estate|insurance|account|tax|consult|professional/,audience:'Possibly individuals or businesses seeking professional assistance',question:'When a prospect is referred to you, does your online presence explain what you do and how to contact you?'}
    ];
    const segment=segments.find(s=>s.match.test(kind));
    const currentYear=new Date().getFullYear();
    const rawYear=briefText(c.establishedYear||c.foundedYear||c.yearFounded||'',8);
    const year=/^\d{4}$/.test(rawYear)&&Number(rawYear)>=1800&&Number(rawYear)<=currentYear?rawYear:'';
    return {
      summary:industry?'CRM category: '+industry+(location?' · '+location:'')+'. Specific services and business history have not been independently checked.':
        'The CRM has a record for '+name+(location?' in '+location:'')+', but the business category and services have not been verified.',
      years:year?'Year on file: '+year+' (unverified)':'Not verified',
      customers:segment?segment.audience+' (industry-based estimate)':'Unknown — ask the business owner',
      website:website?'Website on file — not independently checked':'Not recorded — confirm before recommending a website',
      question:segment?segment.question:'What services do you focus on, and how do new customers usually find you?',
      offer:website?'Business Visibility · $99 (only if listing and printed materials are useful)':'Business Starter · $199 (only if a website is needed)',
      attribution:'Prepared from existing SBC CRM fields only. No AI API, no web research, no purchase or outreach.'
    };
  }
  function installBriefing(host,c){
    host.querySelector('.v6684-business-brief')?.remove();
    const brief=businessBrief(c);
    const panel=document.createElement('section');panel.className='card section v6684-business-brief';
    const head=document.createElement('div');head.className='card-head';
    const heading=document.createElement('h2');heading.textContent='✦ Smart Business Briefing';
    const flag=document.createElement('span');flag.className='badge blue';flag.textContent='FREE · CRM ONLY';
    head.appendChild(heading);head.appendChild(flag);panel.appendChild(head);
    const body=document.createElement('div');body.className='card-body';
    const summary=document.createElement('p');summary.className='mini';summary.textContent=brief.summary;body.appendChild(summary);
    const grid=document.createElement('div');grid.className='grid two';
    for(const [label,value] of [
      ['Years in business',brief.years],
      ['Likely customer types',brief.customers],
      ['Website',brief.website],
      ['Suggested SBC offer',brief.offer]
    ]){
      const tile=document.createElement('div');tile.className='detail-box';
      const title=document.createElement('strong');title.textContent=label;
      const detail=document.createElement('div');detail.textContent=value;
      tile.appendChild(title);tile.appendChild(detail);grid.appendChild(tile);
    }
    body.appendChild(grid);
    const prompt=document.createElement('div');prompt.className='detail-box';
    const promptLabel=document.createElement('strong');promptLabel.textContent='Suggested opening question';
    const promptText=document.createElement('div');promptText.textContent=brief.question;
    prompt.appendChild(promptLabel);prompt.appendChild(promptText);body.appendChild(prompt);
    const source=document.createElement('p');source.className='mini';source.textContent=brief.attribution;body.appendChild(source);
    panel.appendChild(body);
    host.insertBefore(panel,host.firstChild||null);
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
    if(typeof window.generateWebsiteDemo==='function')addButton(bar,'Build Website','',()=>window.generateWebsiteDemo(c.id),locked,'Recovery/read-only mode blocks new actions.');
    if(typeof window.megaRequestRefund==='function')addButton(bar,'Request Refund','danger',()=>window.megaRequestRefund(c.id),locked,'Recovery/read-only mode blocks refund requests.');
    const before=host.querySelector(':scope > .actions');host.insertBefore(bar,before||null);
    installBriefing(host,c);
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
      const paid=['paid'].includes(String(q.status||'').toLowerCase());
      return {id,number:String(q.quoteNumber||q.quote_number||q.id||'Quote'),status:String(q.status||'Draft'),total:Number(q.total||0),url:safeUrl,paid};
    });
    openModal('Fast Checkout — '+(c.businessName||c.contactName||'Customer'),`<div class="install-tip"><strong>Checkout safety:</strong> select the correct quote and confirm its total before sending a link. Won means the sale is agreed, not paid. Paid quotes remain blocked to avoid duplicate charges.</div><div class="v6525-checkout-list">${rows.map(q=>`<div class="list-card"><div><strong>${esc(q.number)} · ${esc(q.status)}</strong><div class="meta">${esc('$'+q.total.toFixed(2))}${q.url?' · Checkout link attached':' · No checkout URL attached'}</div></div><div class="actions" style="margin:0"><button type="button" class="btn small" data-v6525-load="${esc(q.id)}" ${q.paid?'disabled':''}>${q.paid?'Already paid':'Load cart'}</button>${q.url&&!q.paid?`<button type="button" class="btn small primary" data-v6525-send="${esc(q.id)}" data-channel="email" ${c.email||c.email_address?'':'disabled'}>Email link</button><button type="button" class="btn small" data-v6525-send="${esc(q.id)}" data-channel="sms" ${c.phone||c.phone_number?'':'disabled'}>SMS link</button><a class="btn small" href="${esc(q.url)}" target="_blank" rel="noopener noreferrer">Open checkout</a>`:''}</div></div>`).join('')}</div><div class="actions"><button type="button" class="btn" onclick="closeModal()">Close</button><button type="button" class="btn primary" id="v6525-new-quote">Build new cart / quote</button></div>`);
    const body=byId('modalBody');
    body.querySelectorAll('[data-v6525-load]').forEach(b=>b.addEventListener('click',()=>{const q=quotes().find(x=>String(x.id)===b.dataset.v6525Load);if(!q)return toast('Quote no longer exists in the loaded state.');if(['paid'].includes(String(q.status||'').toLowerCase()))return toast('This quote is already marked paid; verify its payment record before charging again.');if(typeof window.sbcLoadQuoteToCart!=='function')return toast('Cart loader is unavailable.');window.sbcLoadQuoteToCart(q.id);}));
    body.querySelectorAll('[data-v6525-send]').forEach(b=>b.addEventListener('click',()=>window.sbcConfirmSendCheckoutLink(customerId,b.dataset.v6525Send,b.dataset.channel)));
    byId('v6525-new-quote')?.addEventListener('click',()=>window.sbcStartCustomerQuote(customerId));
  };
  window.sbcConfirmSendCheckoutLink=function(customerId,quoteId,channel){
    if(isLocked())return toast('Recovery/read-only mode blocks outreach.');
    const c=customerById(customerId),q=quotes().find(x=>String(x.id)===String(quoteId));if(!c||!q)return toast('Customer or quote is no longer available.');
    if(['paid'].includes(String(q.status||'').toLowerCase()))return toast('This quote is already marked paid; verify its payment record before sending another checkout.');
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

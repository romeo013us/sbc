/* SBC Website Production v1 — full working sites, no small-demo UI. */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentRole = () => (typeof state !== 'undefined' && state.me && state.me.role) || '';
  const getCustomer = id => (typeof state !== 'undefined' && Array.isArray(state.data?.customers) ? state.data.customers : []).find(c => String(c.id) === String(id));
  // The Call Desk may show verified assigned leads beyond legacy CRM row limits.
  // This fallback is display-only. Server endpoints still enforce tenant and assignment.
  const salesCustomer = (id,hint) => getCustomer(id) || (hint && String(hint.customerId)===String(id) ? {
    id:String(id),businessName:String(hint.businessName||'Business').slice(0,120),
    contactName:String(hint.contactName||'').slice(0,100),phone:'',email:'',
    doNotContact:true,doNotCall:true,salesSuppressed:true
  } : null);
  const serviceApi = async (endpoint, options) => {
    if (typeof api !== 'function') throw new Error('Command Center connection unavailable. Refresh and try again.');
    return api(endpoint, options);
  };
  const absolute = v => { try { return new URL(String(v || ''), window.location.origin).href; } catch { return ''; } };
  const notify = message => typeof toast === 'function' ? toast(message) : console.info(message);
  let active = null;
  let busy = false;
  const basePath = demo => '/api/website-demos/' + encodeURIComponent(demo.id) + '/preview';
  const publicPath = demo => '/demo/' + encodeURIComponent(demo.slug || '');
  const isApproved = demo => demo?.status === 'Approved';
  // Generate presentation words from current CRM evidence, even for old saved demos.
  function scriptForWebsite(demo,customer){
    const brief=customer?.leadIntelligence?.researchBrief||{};
    const researched=['Verified','Sales Ready'].includes(String(customer?.verificationStatus||'')) &&
      customer?.researchRejected!==true;
    const input={
      businessName:customer?.businessName||customer?.contactName||'your business',
      googleVerified:researched && brief.googleBusinessPresence==='found',
      websitePresence:researched && ['found','not_found'].includes(brief.websitePresence)
        ? brief.websitePresence:'not_checked',
      approved:isApproved(demo)
    };
    const builder=window.SBC_WEBSITE_SALES_SCRIPT?.build;
    return typeof builder==='function'?builder(input):
      'Hey, is this the owner of '+input.businessName+'? [PAUSE] This is [your first name] from Successful By Choice. Do you have a website? [PAUSE] Would you have 10 minutes for a short Zoom later today or tomorrow to discuss a website example?';
  }


  function pageUrl(demo,page) {
    const start = isApproved(demo) ? publicPath(demo) : basePath(demo);
    return absolute(start + (page === 'home' ? '' : '?page=' + encodeURIComponent(page)));
  }
  function updateStatus(msg,error=false){
    const element=document.getElementById('sbcWebsiteFactoryStatus');
    if(element){ element.textContent=msg; element.style.color=error?'#a02c2c':'#334d63'; }
  }
  function reviewPanel(demo){
    if(isApproved(demo)) return '<section class="sbc-factory-light-panel sbc-factory-approved" style="padding:18px;border:1px solid #b6d8c7;border-radius:12px;background:#effaf3"><strong>Owner approved for prospect presentation</strong><p>The live concept link can now be shared with the prospect. Publishing to the client’s actual domain still requires a paid project and approved business details.</p></section>';
    if(currentRole()!=='owner')return '<p style="font-size:13px;color:#6b7280">This full website is an internal draft. The owner must approve its pages, content and media before it can be shared externally.</p>';
    return '<section class="sbc-factory-light-panel sbc-factory-checklist" style="padding:18px;border:1px solid #d7dce1;border-radius:12px;background:#fff">'+
      '<h4 style="margin:0 0 10px">Owner release checklist</h4>'+
      '<label style="display:block;margin:12px 0"><input type="checkbox" id="sbcFactoryCheckDetails"> Business identity, services and placeholder information are accurate and clearly labeled.</label>'+
      '<label style="display:block;margin:12px 0"><input type="checkbox" id="sbcFactoryCheckVisuals"> All pages work on phone and desktop; artwork and image rights are cleared.</label>'+
      '<label style="display:block;margin:12px 0"><input type="checkbox" id="sbcFactoryCheckContent"> No fabricated customer claims, certifications or reviews. Contact form does not submit data.</label>'+
      '<button type="button" id="sbcFactoryApprove" class="btn primary">Approve Website for Presentation</button></section>';
  }
  function appointmentPanel(demo){
    if(!isApproved(demo))return '';
    return '<section class="sbc-website-walkthrough sbc-factory-light-panel" style="padding:22px;border:1px solid #b7c5d5;border-radius:12px;background:#f5f8fe;margin:22px 0">'+
      '<h4 style="margin-top:0">Book a 10-minute website walkthrough</h4><p style="font-size:13px">Only create the appointment after the business owner agrees to meet. No texts, emails, or calendar invitations will be sent automatically.</p>'+
      '<label style="display:block;margin:12px 0">Confirmed meeting date and time (your local time) <input type="datetime-local" id="sbcFactoryMeetingTime" style="width:100%;padding:10px;margin-top:6px"></label>'+
      '<label style="display:block;margin:12px 0"><input type="checkbox" id="sbcFactoryMeetingConfirmed"> The prospect explicitly agreed to this date and time.</label>'+
      '<button type="button" class="btn primary" id="sbcFactoryBookMeeting">Book Walkthrough in Command Center</button></section>';
  }

  function hostingGuide(demo) {
    if(currentRole()!=='owner')return '';
    const starter=demo.offerTier==='starter';
    return '<details class="sbc-website-hosting-guide sbc-factory-light-panel" style="margin:18px 0;border:1px solid #b8cce0;border-radius:12px;padding:14px;background:#f3f8ff;color:#16334b">'+
     '<summary style="font-weight:900;cursor:pointer">Hosting & fulfillment · What to buy after payment</summary>'+
     '<div style="padding:12px 4px;font-size:13px;line-height:1.7">'+
      '<p><strong>Current generator:</strong> HTML + CSS + JavaScript. This preview is not an automatic import into WordPress, GoDaddy Airo, or Websites + Marketing.</p>'+
      (starter
       ? '<p><strong>$199 Business Starter:</strong> This package is currently advertised with one year of domain and GoDaddy Websites + Marketing. If you deliver that promised product, purchase the eligible Websites + Marketing plan and recreate/adapt this one-page design inside the builder; the exported custom HTML cannot simply be uploaded as its editable template. If you prefer to deliver the exact HTML/CSS/JavaScript design on cPanel instead, get the buyer’s agreement to a revised offer and check the cost/margin first.</p>'
       : '<p><strong>$349 Business Basic:</strong> The four-page HTML/CSS/JavaScript output can be hosted on compatible cPanel/static hosting after assets and contact integration are finalized. Check the customer quote for what domain, hosting, SSL, maintenance and transfer rights are included. WordPress requires conversion to a theme/pages; Websites + Marketing requires rebuilding the layout in its editor.</p>')+
      '<p><strong>Owner fulfillment checklist:</strong> Verify payment evidence, confirm domain ownership, select and record the hosting product and supplier cost, secure stock-image usage, add approved copy and photos, configure SSL and live forms, test mobile/navigation, then get final launch approval. No provider purchase or domain change happens from this guide.</p>'+
     '</div></details>';
  }

  function showSite(demo,customer,message='') {
    active={demo,customer};busy=false;
    const pages=demo.offerTier==='starter'?['home']:['home','services','about','contact'];
    const price=demo.offerTier==='starter'?'$199':'$349';
    const links=pages.map((page,i)=>'<button type="button" class="btn '+(i===0?'primary':'')+'" data-factory-page="'+esc(page)+'">'+esc(page[0].toUpperCase()+page.slice(1))+'</button>').join('');
    const html='<div class="v6526-studio" style="max-width:1100px">'+
      '<div class="v6526-studio-top"><div><p class="v6526-kicker">SBC WEBSITE PRODUCTION · REAL WORKING WEBSITES</p><h3>'+esc(customer.businessName||customer.contactName||'Website project')+'</h3><p>Built website: '+esc(demo.offerTier==='starter'?'Business Starter':'Business Basic')+' · '+price+' · '+pages.length+' page'+(pages.length>1?'s':'')+'. The remaining business-specific information is completed after purchase.</p></div><span class="v6526-ready">'+esc(demo.status||'Draft')+'</span></div>'+
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin:18px 0"><strong style="margin-right:12px">Visit website pages:</strong>'+links+'</div>'+
      '<div class="v6526-device-tabs" style="display:flex;gap:9px;margin:12px 0"><button type="button" class="btn" data-factory-device="desktop">Desktop</button><button type="button" class="btn" data-factory-device="mobile">Mobile</button></div>'+
      '<div class="v6526-preview-shell"><div class="v6526-browser"><small id="sbcFactoryAddress">SBC website production</small></div><iframe id="sbcFactoryFrame" src="'+esc(pageUrl(demo,'home'))+'" title="Full prospective customer website" referrerpolicy="no-referrer" style="width:100%;min-height:580px;border:0;background:white"></iframe></div>'+
      '<div style="margin:24px 0">'+reviewPanel(demo)+'</div>'+
      hostingGuide(demo)+
      '<section class="sbc-factory-pitch" style="margin:20px 0"><h4>Prospect presentation</h4><p style="line-height:1.7;white-space:pre-wrap" id="sbcFactoryPitch">'+esc(scriptForWebsite(demo,customer))+'</p><button type="button" class="btn" id="sbcFactoryCopyPitch">Copy sales opening</button></section>'+
      appointmentPanel(demo)+
      (isApproved(demo)?'<div class="v6526-link-row sbc-factory-light-panel"><div><strong>Approved presentation URL</strong><input id="sbcFactoryPublicUrl" readonly value="'+esc(pageUrl(demo,'home'))+'"></div><button type="button" class="btn" id="sbcFactoryCopyLink">Copy Website Link</button><a class="btn" href="'+esc(pageUrl(demo,'home'))+'" target="_blank" rel="noopener noreferrer">Open Website ↗</a></div>':'<p class="sbc-factory-light-panel sbc-factory-private-note" style="padding:12px;background:#fff4dc;border-radius:9px"><strong>Private production draft.</strong> No public URL or outbound message is available before owner approval.</p>')+
      '<div class="v6526-delivery sbc-factory-light-panel"><div><h4>Owner-authorized presentation delivery</h4><p>Only send after the business requests or consents to the link. Do not send to suppressed contacts.</p></div><div class="v6526-delivery-actions"><button type="button" class="btn" id="sbcFactoryEmail" '+(currentRole()==='owner'&&isApproved(demo)&&customer.email&&!customer.doNotContact&&!customer.salesSuppressed?'':'disabled')+'>Email Website</button><button type="button" class="btn" id="sbcFactorySms" '+(currentRole()==='owner'&&isApproved(demo)&&customer.phone&&(customer.smsConsent===true||customer.consentToSms===true)&&!customer.smsOptOut&&!customer.doNotCall&&!customer.doNotContact&&!customer.salesSuppressed?'':'disabled')+'>Text Website</button></div></div>'+
      '<p id="sbcWebsiteFactoryStatus" role="status" style="padding:12px 0">'+esc(message||(isApproved(demo)?'Website ready for a human-led sales presentation.':'Website built and awaiting owner verification.'))+'</p>'+
      '<p style="font-size:12px;color:#67757e">This is a fully navigable sales website. The customer’s final verified photos, branding, services and contact integration are completed during paid fulfillment. No live inquiry data is collected from this pre-sale site.</p></div>';
    if (typeof openModal !== 'function')throw Error('Command Center modal is unavailable.');
    openModal('SBC Website Production',html);
    const address=document.getElementById('sbcFactoryAddress');
    if(address)address.textContent=new URL(pageUrl(demo,'home')).host+new URL(pageUrl(demo,'home')).pathname;
    document.querySelectorAll('[data-factory-page]').forEach(button=>button.addEventListener('click',()=>{
      const page=button.dataset.factoryPage;const url=pageUrl(demo,page);
      const frame=document.getElementById('sbcFactoryFrame');if(frame)frame.src=url;
      if(address)address.textContent=new URL(url).host+new URL(url).pathname+(page==='home'?'':'?page='+page);
      document.querySelectorAll('[data-factory-page]').forEach(b=>b.classList.toggle('primary',b===button));
    }));
    document.querySelectorAll('[data-factory-device]').forEach(button=>button.addEventListener('click',()=>{
      document.querySelector('.v6526-preview-shell')?.classList.toggle('is-mobile',button.dataset.factoryDevice==='mobile');
    }));
    document.getElementById('sbcFactoryApprove')?.addEventListener('click',approve);
    document.getElementById('sbcFactoryBookMeeting')?.addEventListener('click',bookWalkthrough);
    document.getElementById('sbcFactoryCopyLink')?.addEventListener('click',()=>copyText(pageUrl(demo,'home'),'Website link copied.'));
    document.getElementById('sbcFactoryCopyPitch')?.addEventListener('click',()=>copyText(scriptForWebsite(demo,customer),'Sales opening copied.'));
    document.getElementById('sbcFactoryEmail')?.addEventListener('click',()=>send('email'));
    document.getElementById('sbcFactorySms')?.addEventListener('click',()=>send('sms'));
  }
  async function copyText(value,message){
    if(!value)return updateStatus('No text is available to copy.',true);
    try{await navigator.clipboard.writeText(value);updateStatus(message);}
    catch{updateStatus('Clipboard blocked. Select the text above and copy manually.',true);}
  }
  async function approve(){
    if(!active||busy||currentRole()!=='owner')return;
    if(!['sbcFactoryCheckDetails','sbcFactoryCheckVisuals','sbcFactoryCheckContent'].every(id=>document.getElementById(id)?.checked))
      return updateStatus('Review all three required items before release.',true);
    busy=true;
    try{
      const out=await serviceApi('/api/website-demos/'+encodeURIComponent(active.demo.id)+'/approve',{
        method:'POST',body:JSON.stringify({reviewedDetails:true,reviewedVisuals:true,reviewedContent:true})
      });
      if(!out?.demo||out.demo.status!=='Approved')throw Error(out?.error||'Website approval was not committed.');
      showSite(out.demo,active.customer,'Website approved. Its prospect presentation link is now available.');
    }catch(error){updateStatus(error.message||'Website approval failed.',true);}
    finally{busy=false;}
  }
  async function bookWalkthrough(){
    if(!active||busy||!isApproved(active.demo))return updateStatus('Owner-approved website required before scheduling.',true);
    const time=document.getElementById('sbcFactoryMeetingTime')?.value||'';
    const confirmed=document.getElementById('sbcFactoryMeetingConfirmed')?.checked===true;
    if(!confirmed)return updateStatus('Confirm the prospect agreed to the proposed appointment time.',true);
    if(!time||!Number.isFinite(new Date(time).valueOf()))return updateStatus('Choose a valid date and time.',true);
    busy=true;updateStatus('Saving the confirmed walkthrough in Command Center...');
    try{
      const result=await serviceApi('/api/website-production/appointments',{
        method:'POST',body:JSON.stringify({customerId:active.customer.id,websiteId:active.demo.id,startAt:new Date(time).toISOString(),prospectConfirmed:true})
      });
      if(!result?.ok||!result.appointment)throw Error(result?.code||'Appointment was not committed.');
      updateStatus('Confirmed website walkthrough booked for '+new Date(result.appointment.startAt).toLocaleString()+'. No message or call was sent.');
    }catch(error){updateStatus(error.message||'Unable to book appointment.',true)}
    finally{busy=false}
  }

  async function send(channel){
    if(!active||busy||currentRole()!=='owner'||!isApproved(active.demo))return updateStatus('Owner-approved website required before sending.',true);
    const {customer,demo}=active, url=pageUrl(demo,'home');
    if(customer.doNotContact||customer.salesSuppressed||customer.doNotCall)return updateStatus('Contact is suppressed. Delivery blocked.',true);
    if(channel==='sms'&&!(customer.smsConsent===true||customer.consentToSms===true)||channel==='sms'&&customer.smsOptOut)return updateStatus('Explicit SMS consent required.',true);
    if(!url)return updateStatus('Website URL unavailable.',true);
    const dest=channel==='email'?customer.email:customer.phone;
    if(!dest)return updateStatus('Recipient contact details unavailable.',true);
    if(!confirm('Send the approved website to '+dest+' by '+channel+'? Verify recipient request or applicable consent first.'))return;
    busy=true;updateStatus('Submitting the approved website through SBC communications…');
    const body='Hello '+(customer.contactName||'')+', Successful By Choice prepared a working website for '+(customer.businessName||'your business')+'. Take a look: '+url+'. This is a website proposal; you may reply to schedule a walkthrough. — Successful By Choice';
    try{
      const args=channel==='email'?{customerId:customer.id,subject:'Your website is ready to view',body}:{customerId:customer.id,body};
      const out=await serviceApi('/api/communications/'+channel,{method:'POST',body:JSON.stringify(args)});
      if(!out?.ok&&!out?.sid)throw Error(out?.error||'Provider did not confirm acceptance.');
      updateStatus(channel==='email'?'Email accepted by SBC provider; delivery is not guaranteed.':'SMS submitted to provider; delivery is not guaranteed.');
    }catch(error){updateStatus(error.message||'Delivery failed.',true);}
    finally{busy=false;}
  }

  async function buildWebsite(customerId,defaultTier='essentials',hint){
    const customer=salesCustomer(customerId,hint);
    if(!customer)return notify('CRM customer record not found. Reload Command Center.');
    if(typeof state!=='undefined'&&state.data&&(state.data.recovery?.required||state.data.recoveryRequired||state.data.readOnly||state.data.mysqlRecoveryRequired))
      return notify('Website production is blocked during recovery/read-only mode.');
    const tier=defaultTier==='starter'?'starter':'essentials';
    if(typeof openModal!=='function')return notify('Website Production cannot open the editor.');
    openModal('SBC Website Production',
      '<div class="v6526-studio"><h3>Build a working website for '+esc(customer.businessName||customer.contactName||'this business')+'</h3>'+
      '<p>Choose a full website package. No purchase, message, or outside contractor is triggered by building.</p>'+
      '<label style="display:block;margin:18px 0">Website package <select id="sbcFactoryTier" style="padding:12px;width:100%"><option value="starter"'+(tier==='starter'?' selected':'')+'>Business Starter · $199 · complete one-page website</option><option value="essentials"'+(tier==='essentials'?' selected':'')+'>Business Basic · $349 · four-page website</option></select></label>'+
      '<button class="btn primary" id="sbcFactoryBuildNow" type="button">Build Full Website</button><p id="sbcWebsiteFactoryStatus" role="status">Ready to assemble website pages from existing SBC components.</p></div>');
    document.getElementById('sbcFactoryBuildNow')?.addEventListener('click',async function(){
      if(busy)return;busy=true;this.disabled=true;
      const offerTier=document.getElementById('sbcFactoryTier')?.value||tier;
      updateStatus('Preparing real, navigable website pages…');
      try{
        const result=await serviceApi('/api/website-demos',{method:'POST',body:JSON.stringify({customerId:customer.id,fast:true,offerTier})});
        if(!result?.demo)throw Error(result?.error||'Website construction failed.');
        showSite(result.demo,customer,'Website pages generated. Check every page before approval.');
      }catch(error){updateStatus(error.message||'Build failed. No contact was sent.',true);this.disabled=false;}
      finally{busy=false;}
    });
  }
  async function openExisting(customerId,hint){
    const customer=salesCustomer(customerId,hint);
    if(!customer)return notify('Customer record unavailable. Reload the CRM.');
    if(typeof openModal==='function')openModal('SBC Website Production','<div class="v6526-studio"><h3>Opening existing website…</h3><p>Loading the latest saved site, not rebuilding or changing a client-approved website.</p></div>');
    try{
      const result=await serviceApi('/api/website-demos/'+encodeURIComponent(customer.id));
      if(!result||!result.id)throw Error(result?.error||'Saved website was not found.');
      showSite(result,customer,'Opened previously saved website. No rebuild, outreach, or payment was initiated.');
    }catch(error){
      if(typeof openModal==='function')openModal('SBC Website Production','<div role="alert" class="v6526-studio"><h3>Could not open the website</h3><p>'+esc(error.message||'Website unavailable')+'</p><p>Your previous website was not changed.</p></div>');
    }
  }

  window.SBC_WEBSITE_PRODUCTION = Object.freeze({build:buildWebsite,open:buildWebsite,openExisting});
  window.generateWebsiteDemo = buildWebsite; // existing Customer 360 compatibility, no small-demo UI
})();
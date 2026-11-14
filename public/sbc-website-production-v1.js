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
      '<label class="sbc-factory-meeting-label" style="display:block;margin:12px 0">Confirmed meeting date and time (your local time) <input type="datetime-local" id="sbcFactoryMeetingTime" style="width:100%;padding:10px;margin-top:6px"></label>'+
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


  // Owner-governed Website Studio: research notes never auto-populate approved facts.
  function studioPanel(){
    if(currentRole()!=='owner')return '';
    return '<section class="sbc-factory-light-panel" style="padding:20px;margin:24px 0;border:1px solid #c9d6e1;border-radius:12px">'+
      '<h4>Website Studio · Verified Business Profile</h4><p>Approve only facts you confirmed with the business. Search snippets, assumptions, and Lorna research do not become website claims automatically. This creates a <strong>private concept only</strong>.</p>'+
      '<form id="sbcStudioApprovalForm"><label>Business identity (from Account 360)<input name="businessName" type="text" readonly required style="width:100%"></label>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">'+
      '<label>Verified business category<input name="category" type="text" maxlength="90" required style="width:100%"></label>'+
      '<label>Verified city<input name="city" type="text" maxlength="90" style="width:100%"></label>'+
      '<label>Verified state/region<input name="region" type="text" maxlength="60" style="width:100%"></label></div>'+
      '<label>Verified services · one per line (optionally: Service | Confirmed description)<textarea name="services" rows="5" maxlength="4000" placeholder="Window Tinting | Discuss approved film options" style="width:100%"></textarea></label>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">'+
      '<label>Confirmed business phone<input name="phone" maxlength="32" type="tel" style="width:100%"></label>'+
      '<label>Confirmed business email<input name="email" maxlength="160" type="email" style="width:100%"></label></div>'+
      '<label style="display:flex;align-items:center;gap:8px;margin:12px 0"><input id="sbcStudioOwnerVerified" type="checkbox" required> I verified these business facts and approve their use in a private preview.</label>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit">Save approved business facts</button><button class="btn" id="sbcStudioViewPreview" type="button" disabled>View new Website Studio concept</button></div></form>'+
      '<p id="sbcStudioStatus" role="status" aria-live="polite">Loading verified profile…</p></section>';
  }
  const studioBase=demo=>'/api/website-production/sites/'+encodeURIComponent(demo.id)+'/studio';
  function studioMessage(value){const p=document.getElementById('sbcStudioStatus');if(p)p.textContent=value;}
  async function loadStudioProfile(demo){
    const form=document.getElementById('sbcStudioApprovalForm');if(!form)return;
    try{
      const out=await serviceApi(studioBase(demo));
      if(active?.demo?.id!==demo.id||!form.isConnected)return;
      if(!out?.ok)throw Error(out?.code||'Website Studio is unavailable.');
      const p=out.approvedProfile||null,suggested=out.suggestedProfile||null,b=p?.business||suggested?.business||out.identity||{},c=p?.contact||suggested?.contact||{};
      form.dataset.version=String(out.version||0);
      for(const [name,value] of Object.entries({businessName:b.name||'',category:b.category||'',city:b.city||'',region:b.region||'',phone:c.phone||'',email:c.email||''})){
        const field=form.elements.namedItem(name);if(field)field.value=String(value);
      }
      form.elements.namedItem('services').value=(p?.services||suggested?.services||[]).map(s=>s.name+(s.description?' | '+s.description:'')).join('\n');
      document.getElementById('sbcStudioViewPreview').disabled=!p;
      form.querySelectorAll('input:not([readonly]),textarea,button[type=submit]').forEach(el=>{el.disabled=!out.canApprove});
      studioMessage(p?'Business facts approved (revision '+out.version+'). Preview is ready.':out.canApprove?'CRM fields have been prefilled for REVIEW ONLY. Confirm the phone, services, and business details before approving this private concept.':'This site is locked; no approved Studio profile is available.');
    }catch(e){studioMessage(String(e?.message||'Website Studio unavailable.'));}
  }
  async function saveStudioProfile(event){
    event.preventDefault();const form=event.currentTarget;
    if(currentRole()!=='owner'||!active?.demo)return;
    const demo=active.demo;
    const get=name=>String(form.elements.namedItem(name)?.value||'').trim();
    const services=get('services').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
      const split=line.indexOf('|');return {name:(split<0?line:line.slice(0,split)).trim(),description:split<0?'':line.slice(split+1).trim()};
    });
    if(services.length>12)return studioMessage('Use up to 12 confirmed services.');
    if(!document.getElementById('sbcStudioOwnerVerified')?.checked)return studioMessage('Confirm that you verified these details first.');
    if(!window.confirm('Save these as OWNER-APPROVED business facts for the private Website Studio concept?'))return;
    const payload={expectedVersion:Number(form.dataset.version||0),ownerConfirmed:true,
      profile:{business:{name:get('businessName'),category:get('category'),city:get('city'),region:get('region')},services,contact:{phone:get('phone'),email:get('email')}}};
    try{
      studioMessage('Saving approved facts in Command Center…');
      const out=await serviceApi(studioBase(demo)+'/approved-profile',{method:'PATCH',body:JSON.stringify(payload)});
      if(!out?.ok||out.durable!==true)throw Error(out?.code||'Facts were not saved.');
      if(active?.demo?.id!==demo.id)return;
      await loadStudioProfile(demo);
      studioMessage('Approved facts saved to the correct account. You may now view the private Website Studio concept.');
    }catch(e){studioMessage(String(e?.message||'Unable to save facts. Reload and try again.'));}
  }
  async function previewStudioConcept(){
    if(currentRole()!=='owner'||!active?.demo)return;
    const demo=active.demo;
    try{
      const out=await serviceApi(studioBase(demo));
      if(active?.demo?.id!==demo.id)return;
      if(!out?.ok||!out.approvedProfile)throw Error('First approve this business’s verified profile.');
      const frame=document.getElementById('sbcFactoryFrame');
      if(!frame)throw Error('Website preview frame not available.');
      frame.src=studioBase(demo)+'/auto-preview';
      const address=document.getElementById('sbcFactoryAddress');if(address)address.textContent='SBC Website Studio · Private approved-facts concept';
      studioMessage('Showing private Website Studio concept. No form submissions or public publishing are enabled.');
    }catch(e){studioMessage(String(e?.message||'Unable to open Studio preview.'));}
  }

  function showSite(demo,customer,message='') {
    active={demo,customer};busy=false;
    const pages=demo.offerTier==='starter'?['home']:['home','services','about','contact'];
    const price=demo.offerTier==='starter'?'$199':'$349';
    const smartDraft=currentRole()==='owner'&&!isApproved(demo)&&demo.archived!==true;
    const smartUrl=smartDraft?absolute(studioBase(demo)+'/auto-preview'):'';
    let previewMode=smartDraft?'smart':'classic';
    active.previewMode=previewMode;
    active.previewPage='home';
    const links=pages.map((page,i)=>'<button type="button" class="btn '+(i===0?'primary':'')+'" data-factory-page="'+esc(page)+'">'+esc(page[0].toUpperCase()+page.slice(1))+'</button>').join('');
    const html='<div class="v6526-studio" style="max-width:1100px">'+
      '<div class="v6526-studio-top"><div><p class="v6526-kicker">SBC WEBSITE PRODUCTION · REAL WORKING WEBSITES</p><h3>'+esc(customer.businessName||customer.contactName||'Website project')+'</h3><p>Built website: '+esc(demo.offerTier==='starter'?'Business Starter':'Business Basic')+' · '+price+' · '+pages.length+' page'+(pages.length>1?'s':'')+'. The remaining business-specific information is completed after purchase.</p></div><span class="v6526-ready">'+esc(demo.status||'Draft')+'</span></div>'+
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin:18px 0"><strong style="margin-right:12px">Classic website pages:</strong>'+links+'</div>'+ 
      (smartDraft?'<div class="sbc-factory-light-panel" style="padding:15px;border:1px solid #bdd0de;border-radius:10px"><strong>Choose design preview</strong><div style="display:flex;gap:9px;flex-wrap:wrap;margin:10px 0"><button id="sbcFactorySmartMode" class="btn primary" type="button">★ Art-directed preview (default)</button><button id="sbcFactoryClassicMode" class="btn" type="button">Classic 4-page builder</button></div><p id="sbcFactoryModeInfo" role="status">The art-directed version is a PRIVATE '+(pages.length>1?'four-page':'one-page')+' concept. Example sections need fact approval. Your original '+(pages.length>1?'four-page':'one-page')+' site and its editor remain available under Classic.</p></div>':'')+
      '<div class="v6526-device-tabs" style="display:flex;gap:9px;margin:12px 0"><button type="button" class="btn" data-factory-device="desktop">Desktop</button><button type="button" class="btn" data-factory-device="mobile">Mobile</button></div>'+
      '<div class="v6526-preview-shell"><div class="v6526-browser"><small id="sbcFactoryAddress">SBC website production</small></div><iframe id="sbcFactoryFrame" src="'+esc(smartDraft?smartUrl:pageUrl(demo,'home'))+'" title="Full prospective customer website" referrerpolicy="no-referrer" style="width:100%;min-height:580px;border:0;background:white"></iframe></div>'+
      '<div style="margin:24px 0">'+reviewPanel(demo)+'</div>'+
      hostingGuide(demo)+qualityPanel(demo,customer)+nativeEditorPanel(demo)+studioPanel()+
      '<section class="sbc-factory-pitch" style="margin:20px 0"><h4>Prospect presentation</h4><p style="line-height:1.7;white-space:pre-wrap" id="sbcFactoryPitch">'+esc(scriptForWebsite(demo,customer))+'</p><button type="button" class="btn" id="sbcFactoryCopyPitch">Copy sales opening</button></section>'+
      appointmentPanel(demo)+
      (isApproved(demo)?'<div class="v6526-link-row sbc-factory-light-panel"><div><strong>Approved presentation URL</strong><input id="sbcFactoryPublicUrl" readonly value="'+esc(pageUrl(demo,'home'))+'"></div><button type="button" class="btn" id="sbcFactoryCopyLink">Copy Website Link</button><a class="btn" href="'+esc(pageUrl(demo,'home'))+'" target="_blank" rel="noopener noreferrer">Open Website ↗</a></div>':'<p class="sbc-factory-light-panel sbc-factory-private-note" style="padding:12px;background:#fff4dc;border-radius:9px"><strong>Private production draft.</strong> No public URL or outbound message is available before owner approval.</p>')+
      '<div class="v6526-delivery sbc-factory-light-panel"><div><h4>Owner-authorized presentation delivery</h4><p>Only send after the business requests or consents to the link. Do not send to suppressed contacts.</p></div><div class="v6526-delivery-actions"><button type="button" class="btn" id="sbcFactoryEmail" '+(currentRole()==='owner'&&isApproved(demo)&&customer.email&&!customer.doNotContact&&!customer.salesSuppressed?'':'disabled')+'>Email Website</button><button type="button" class="btn" id="sbcFactorySms" '+(currentRole()==='owner'&&isApproved(demo)&&customer.phone&&(customer.smsConsent===true||customer.consentToSms===true)&&!customer.smsOptOut&&!customer.doNotCall&&!customer.doNotContact&&!customer.salesSuppressed?'':'disabled')+'>Text Website</button></div></div>'+
      '<p id="sbcWebsiteFactoryStatus" role="status" style="padding:12px 0">'+esc(message||(isApproved(demo)?'Website ready for a human-led sales presentation.':'Website built and awaiting owner verification.'))+'</p>'+
      '<p style="font-size:12px;color:#67757e">This is a fully navigable sales website. The customer’s final verified photos, branding, services and contact integration are completed during paid fulfillment. No live inquiry data is collected from this pre-sale site.</p></div>';
    if (typeof openModal !== 'function')throw Error('Command Center modal is unavailable.');
    openModal('SBC Website Production',html);
    const address=document.getElementById('sbcFactoryAddress');
    if(address)address.textContent=smartDraft?'SBC Art-Directed · Unverified Private Concept':new URL(pageUrl(demo,'home')).host+new URL(pageUrl(demo,'home')).pathname;
    const switchPreview=(mode,page='home')=>{
      const frame=document.getElementById('sbcFactoryFrame');if(!frame)return;
      const smart=mode==='smart'&&smartDraft;
      previewMode=smart?'smart':'classic';
      if(active?.demo?.id===demo.id){active.previewMode=previewMode;active.previewPage=page;}
      const url=smart?(smartUrl+(page==='home'?'':'?page='+encodeURIComponent(page))):pageUrl(demo,page);
      frame.src=url;
      if(address)address.textContent=smart?'SBC Art-Directed · Private Draft · Not customer-ready':new URL(url).host+new URL(url).pathname+(page==='home'?'':'?page='+page);
      document.getElementById('sbcFactorySmartMode')?.classList.toggle('primary',smart);
      document.getElementById('sbcFactoryClassicMode')?.classList.toggle('primary',!smart);
      const info=document.getElementById('sbcFactoryModeInfo');if(info)info.textContent=smart?'Art-directed design concept. Every proposed service must be verified before customer delivery.':'Classic website pages. Existing owner editing controls apply to this layout.';
      document.querySelectorAll('[data-factory-page]').forEach(b=>b.classList.toggle('primary',!smart&&b.dataset.factoryPage===page));
    };
    document.getElementById('sbcFactorySmartMode')?.addEventListener('click',()=>switchPreview('smart'));
    document.getElementById('sbcFactoryClassicMode')?.addEventListener('click',()=>switchPreview('classic'));
    document.querySelectorAll('[data-factory-page]').forEach(button=>button.addEventListener('click',()=>{
      const page=button.dataset.factoryPage;const url=pageUrl(demo,page);
      switchPreview(previewMode,page);
    }));
    document.querySelectorAll('[data-factory-device]').forEach(button=>button.addEventListener('click',()=>{
      document.querySelector('.v6526-preview-shell')?.classList.toggle('is-mobile',button.dataset.factoryDevice==='mobile');
    }));
    document.getElementById('sbcInstantSiteEditor')?.addEventListener('submit',saveNativeEditor);
    loadNativeEditor(demo).catch(e=>console.warn('SBC editor load blocked',String(e.message||e)));
    loadStudioProfile(demo).catch(e=>console.warn('SBC Studio load blocked',String(e.message||e)));
    document.getElementById('sbcStudioApprovalForm')?.addEventListener('submit',saveStudioProfile);
    document.getElementById('sbcStudioViewPreview')?.addEventListener('click',previewStudioConcept);
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

  function qualityPanel(demo,customer){
    const engine=window.SBC_ACCOUNT_SUCCESS;
    if(!engine||typeof engine.siteQuality!=='function')return '';
    const report=engine.siteQuality(demo,customer);
    const label=state=>state==='recorded'?'Business record reviewed':state==='not_measured'?'Test required':'Not yet approved';
    const rows=report.checks.map(item=>'<li style="margin:9px 0"><strong>'+esc(item.label)+' · '+esc(label(item.state))+'</strong><span style="display:block;font-size:12px;margin-top:3px">'+esc(item.action)+'</span></li>').join('');
    return '<section class="sbc-site-quality-panel sbc-factory-light-panel" style="padding:18px;border:1px solid #c5d5e1;border-radius:12px;background:#fff;color:#172f41;margin:20px 0">'+
      '<h4 style="margin:0 0 8px">Site launch quality gate · SBC God Tier standard</h4>'+
      '<p style="font-size:13px;line-height:1.6;margin:0 0 8px">'+esc(report.buildMethod)+' '+esc(report.stage)+'.</p>'+
      '<p style="font-size:13px;margin:0 0 8px"><strong>Release status:</strong> Customer-domain publication not yet authorized. '+esc(report.scoreMeaning)+'</p>'+
      '<details><summary style="font-weight:700;cursor:pointer">Review '+report.checks.length+' launch requirements</summary><ol style="font-size:13px;line-height:1.45">'+rows+'</ol></details>'+
      '<p style="font-size:12px;margin-bottom:0">This checklist is not an automated performance test, paid order, domain provisioning, or permission to publish.</p></section>';
  }

  function nativeEditorPanel(demo){
    if(currentRole()!=='owner')return '';
    if(demo.status==='Approved')return '<p class="sbc-factory-light-panel" style="padding:15px;background:#f7f9fc;color:#243d4d">This concept is approved and locked. Owner must create a revision before editing or republishing it.</p>';
    if(demo.status!=='Draft'&&demo.status!=='Pending')return '';
    return '<section class="sbc-factory-light-panel" style="padding:18px;background:#fff;color:#152c3f;border:1px solid #d6e1ea;border-radius:12px;margin:20px 0">'+
     '<h4 style="margin:0 0 10px">SBC Instant Sites · Edit your website</h4>'+
     '<p class="mini">Edit the actual generated website. Save will update its private preview; no AI credits, email, payment, domain or public publishing.</p>'+
     '<form id="sbcInstantSiteEditor" aria-label="Instant Sites visual content editor" hidden>'+
      '<div class="sbc-profile-editgrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">'+
       '<label>Headline<input name="headline" maxlength="130" placeholder="Your memorable headline"></label>'+
       '<label>Design direction<select name="themeVariant"><option value="0">Smart industry default</option><option value="1">Signature</option><option value="2">Contemporary</option><option value="3">Editorial</option></select></label>'+
       '<label style="grid-column:1/-1">Supporting copy<textarea name="subheadline" maxlength="280" rows="3" placeholder="Introduce the business and its value"></textarea></label>'+
       '<label style="grid-column:1/-1">About section<textarea name="about" maxlength="1200" rows="4" placeholder="Approved story or business details"></textarea></label>'+
       '<label style="grid-column:1/-1">Service titles — one per line, maximum 6<textarea name="services" maxlength="600" rows="5" placeholder="Example: Haircuts&#10;Beard trimming&#10;Styling"></textarea></label>'+
      '</div><fieldset style="margin:18px 0"><legend>Website sections</legend>'+
      '<label style="display:block;margin:8px 0"><input type="checkbox" name="showGallery" checked> Show photo gallery</label>'+
      '<label style="display:block;margin:8px 0"><input type="checkbox" name="showVideo" checked> Show sample video</label>'+
      '<label style="display:block;margin:8px 0"><input type="checkbox" name="showFaq" checked> Show FAQ section</label></fieldset>'+
      '<button type="submit" class="btn primary" id="sbcInstantSiteSave">Save Website & Refresh Preview</button>'+
      '<span id="sbcInstantSiteVersion" class="mini" style="margin-left:12px"></span></form>'+
     '<p id="sbcInstantSiteEditorStatus" role="status" aria-live="polite">Loading the latest editable website revision…</p></section>';
  }
  async function loadNativeEditor(demo){
    if(currentRole()!=='owner'||!['Draft','Pending'].includes(demo?.status))return;
    const form=document.getElementById('sbcInstantSiteEditor'),message=document.getElementById('sbcInstantSiteEditorStatus');
    if(!form||!message)return;
    const id=String(demo.id);
    try{
      const result=await serviceApi('/api/website-production/sites/'+encodeURIComponent(id)+'/editor',{method:'GET'});
      if(active?.demo?.id!==id)return;
      if(!result?.ok||result.site?.id!==id||!Number.isSafeInteger(result.site.siteEditsVersion))throw Error('The editor did not return a verified version.');
      const edits=result.site.siteEdits||{};
      form.dataset.siteId=id;
      form.dataset.version=String(result.site.siteEditsVersion);
      for(const field of ['headline','subheadline','about'])form.elements.namedItem(field).value=String(edits[field]||'');
      form.elements.namedItem('services').value=(Array.isArray(edits.services)?edits.services:[]).join('\n');
      form.elements.namedItem('themeVariant').value=String(edits.themeVariant||0);
      for(const name of ['showGallery','showVideo','showFaq'])form.elements.namedItem(name).checked=edits[name]!==false;
      form.hidden=false;
      const version=document.getElementById('sbcInstantSiteVersion');
      if(version)version.textContent='Saved version '+result.site.siteEditsVersion;
      message.textContent='Ready to edit. Changes save to this private site only.';
    }catch(e){
      form.hidden=true;
      message.textContent='Editor unavailable: '+String(e.message||e)+'. The existing website has not changed.';
    }
  }
  async function saveNativeEditor(event){
    event.preventDefault();
    const form=event.currentTarget,submit=form.querySelector('button[type=submit]'),message=document.getElementById('sbcInstantSiteEditorStatus');
    if(busy||currentRole()!=='owner'||!active||!form.dataset.siteId||form.dataset.siteId!==String(active.demo.id))return;
    const id=form.dataset.siteId,version=Number(form.dataset.version);
    const services=String(form.elements.namedItem('services').value||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
    if(services.length>6){message.textContent='Maximum 6 services. Remove extra lines before saving.';return;}
    const siteEdits={
      headline:form.elements.namedItem('headline').value,
      subheadline:form.elements.namedItem('subheadline').value,
      about:form.elements.namedItem('about').value,
      services,
      themeVariant:Number(form.elements.namedItem('themeVariant').value),
      showGallery:form.elements.namedItem('showGallery').checked,
      showVideo:form.elements.namedItem('showVideo').checked,
      showFaq:form.elements.namedItem('showFaq').checked
    };
    busy=true;submit.disabled=true;message.textContent='Saving your website changes in SBC…';
    try{
      const result=await serviceApi('/api/website-production/sites/'+encodeURIComponent(id)+'/editor',{
        method:'PATCH',body:JSON.stringify({expectedVersion:version,siteEdits})
      });
      if(!result?.ok||result.durable!==true||result.site?.id!==id)throw Error(result?.code||'Website changes were not verified as saved.');
      if(active?.demo?.id!==id)return;
      form.dataset.version=String(result.site.siteEditsVersion);
      active.demo={...active.demo,siteEdits:result.site.siteEdits,siteEditsVersion:result.site.siteEditsVersion};
      const address=document.getElementById('sbcFactoryAddress');
      const frame=document.getElementById('sbcFactoryFrame');
      if(frame){
        const smart=active.previewMode==='smart'&&currentRole()==='owner'&&!isApproved(active.demo);
        const url=new URL(smart?absolute(studioBase(active.demo)+'/auto-preview'):pageUrl(active.demo,'home'));
        if(smart&&active.previewPage&&active.previewPage!=='home')url.searchParams.set('page',active.previewPage);
        url.searchParams.set('editVersion',String(result.site.siteEditsVersion));
        frame.src=url.href;
        if(address)address.textContent=smart?'SBC Art-Directed · Private Draft · Saved Design':url.host+url.pathname;
      }
      const badge=document.getElementById('sbcInstantSiteVersion');
      if(badge)badge.textContent='Saved version '+result.site.siteEditsVersion;
      message.textContent='Saved to SBC. Private preview refreshed; customer-domain website remains unchanged.';
    }catch(e){message.textContent='Not saved: '+String(e.message||e)+'. Refresh editor if another teammate changed this site.';}
    finally{busy=false;submit.disabled=false;}
  }
  function instantSiteBrief(customer){
    const planner=window.SBC_ACCOUNT_SUCCESS;
    if(!planner||typeof planner.plan!=='function')return '';
    const p=planner.plan(customer),b=p.siteBrief;
    const row=(label,value)=>'<span><strong>'+esc(label)+':</strong> '+esc(value||'Needs confirmation')+'</span>';
    return '<section class="sbc-factory-light-panel sbc-instant-site-brief" style="padding:16px;border:1px solid #c9d6e0;border-radius:12px;background:#f5f9fd;color:#152e42">'+
      '<h4 style="margin:0 0 8px">SBC Instant Sites · CRM design brief</h4>'+
      '<p style="margin:0 0 12px;font-size:13px">Start with the business account you already researched. No retyping the company name or category.</p>'+
      '<div style="display:grid;gap:7px;font-size:13px">'+row('Business',b.businessName)+row('Industry',b.industry)+row('Location',b.location)+
      row('Existing website',b.existingWebsite||'Not recorded')+row('Services',b.services||'Not independently verified')+
      row('Services check',b.servicesVerified?'Researcher marked verified — owner must still approve':'Verify services with the business owner')+'</div>'+
      '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Customer launch requirements</summary><ul style="font-size:13px;line-height:1.6">'+
      p.launchChecks.map(item=>'<li>'+esc(item)+'</li>').join('')+'</ul></details>'+
      '<p style="font-size:12px;margin-bottom:0">This creates a private site concept, not a published customer website. Domain, hosting, SSL, live forms, approved content and payment are separate fulfillment steps.</p></section>';
  }
  async function buildWebsite(customerId,defaultTier='essentials',hint){
    const customer=salesCustomer(customerId,hint);
    if(!customer)return notify('CRM customer record not found. Reload Command Center.');
    if(typeof state!=='undefined'&&state.data&&(state.data.recovery?.required||state.data.recoveryRequired||state.data.readOnly||state.data.mysqlRecoveryRequired))
      return notify('Website production is blocked during recovery/read-only mode.');
    const tier=defaultTier==='starter'?'starter':'essentials';
    if(typeof openModal!=='function')return notify('Website Production cannot open the editor.');
    openModal('SBC Instant Sites · Website Production',
      '<div class="v6526-studio"><h3>Build a working website for '+esc(customer.businessName||customer.contactName||'this business')+'</h3>'+
      '<p>Choose a full website package. No purchase, message, or outside contractor is triggered by building.</p>'+instantSiteBrief(customer)+
      '<label style="display:block;margin:18px 0">Website package <select id="sbcFactoryTier" style="padding:12px;width:100%"><option value="starter"'+(tier==='starter'?' selected':'')+'>Business Starter · $199 · complete one-page website</option><option value="essentials"'+(tier==='essentials'?' selected':'')+'>Business Basic · $349 · four-page website</option></select></label>'+
      '<button class="btn primary" id="sbcFactoryBuildNow" type="button">Build Full Website · Instant Site</button><p id="sbcWebsiteFactoryStatus" role="status">Ready to assemble website pages from existing SBC components.</p></div>');
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
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
      contactName:customer?.contactName||'',ownerVerified:researched && brief.ownerContactVerified===true,
      callerName:'John',
      googleVerified:researched && brief.googleBusinessPresence==='found',
      websitePresence:researched && ['found','not_found'].includes(brief.websitePresence)
        ? brief.websitePresence:'not_checked',
      approved:isApproved(demo)&&Boolean(demo?.slug)
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
      '<label id="sbcFactoryReviewAcknowledgment" style="display:none;margin:12px 0"><input type="checkbox" id="sbcFactoryReviewAcknowledged"> I reviewed the flagged business information and verified it with the owner.</label>'+
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
    return '<section id="sbcStudioReviewPanel" class="sbc-factory-light-panel" style="padding:16px;margin:10px 0;border:1px solid #c9d6e1;border-radius:12px">'+
      '<h4>Website Studio · Verified Business Profile</h4><p>Approve only facts confirmed with the business. CRM suggestions never become website claims automatically. This creates a <strong>private concept only</strong>.</p>'+
      '<div id="sbcStudioConsistency" role="status" aria-live="polite" style="padding:10px;border:1px solid #e0c282;background:#fff5de;border-radius:10px">Checking business data…</div>'+
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
      const businessReview=out.businessReview||{status:'needs_review',issues:[]};
      active.businessReview=businessReview;
      const warnings=Array.isArray(businessReview.issues)?businessReview.issues:[];
      const reviewBox=document.getElementById('sbcStudioConsistency');
      const banner=document.getElementById('sbcFactoryReviewBanner');
      const acknowledgment=document.getElementById('sbcFactoryReviewAcknowledgment');
      if(reviewBox){
        reviewBox.textContent=warnings.length?
          'Needs Review: '+warnings.map(x=>String(x.message||'Business information needs confirmation.')).join(' '):
          'Business consistency check passed for private drafting. Final customer approval is still required.';
        reviewBox.style.background=warnings.length?'#fff4de':'#effaf3';
      }
      if(banner){
        banner.textContent=warnings.length?
          'Needs Review · '+warnings.map(x=>String(x.message||'Confirm business facts.')).join(' '):
          'Private website preview · Business facts checked. Final presentation approval is separate.';
        banner.style.display=warnings.length?'block':'none';
      }
      if(acknowledgment)acknowledgment.style.display=warnings.length?'block':'none';
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


  function studioVisualPanel(demo){
    if(currentRole()!=='owner'||isApproved(demo)||demo.archived===true)return '';
    return '<section class="sbc-factory-light-panel" style="padding:20px;margin:24px 0;border:1px solid #acc5d5;border-radius:12px;background:#f4f8fd;color:#18334a">'+
      '<h4>Website Studio V3 · Visual Experience Lab</h4><p>Try design moods and layouts instantly. On the private preview, click the main headline or subtitle to edit the words right on the page. Edits are unsaved until you click Save Design & Preview. Verified facts remain protected. No AI credits used.</p>'+
      '<form id="sbcStudioVisualForm">'+
      '<label style="display:block;margin:10px 0">Website hero headline<input name="headline" type="text" maxlength="120" placeholder="Leave empty to use the business name" style="width:100%"></label>'+
      '<label style="display:block;margin:10px 0">Hero subtitle<textarea name="subheadline" rows="3" maxlength="280" placeholder="Leave empty to use the industry-specific copy" style="width:100%"></textarea></label>'+
      '<label style="display:block;margin:10px 0">Visual rhythm<select name="density" style="width:100%"><option value="original">Original art direction</option><option value="airy">Airy editorial spacing</option><option value="dense">Compact service-focused spacing</option></select></label>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">'+
      '<label>Design mood<select name="vibe" style="width:100%"><option value="original">Industry original</option><option value="cinematic">Cinematic premium</option><option value="minimal">Minimal editorial</option><option value="warm">Warm community</option></select></label>'+
      '<label>Hero layout<select name="heroStyle" style="width:100%"><option value="auto">Industry recommended</option><option value="split">Asymmetric split</option><option value="stacked">Editorial stack</option><option value="cinema">Dark cinema</option></select></label>'+
      '<label>Service layout<select name="serviceLayout" style="width:100%"><option value="auto">Industry recommended</option><option value="bento">Bento showcase</option><option value="grid">Modern grid</option><option value="editorial">Editorial cards</option></select></label></div>'+
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin:12px 0"><button type="button" class="btn" id="sbcStudioShuffleVibe">Shuffle Vibe</button><button type="button" class="btn" id="sbcStudioSwapLayout">Swap Layout</button><button type="button" class="btn" id="sbcStudioTryRemix">Preview these choices</button></div>'+
      '<fieldset style="border:1px solid #b9cbd6;border-radius:10px;padding:14px;margin:14px 0"><legend style="font-weight:800">Section Manager · Move and compare</legend>'+
      '<p style="font-size:.87rem">Rearrange the four optional design sections. Business facts, the hero and contact details stay protected.</p>'+
      '<input name="sectionOrder" id="sbcStudioSectionOrder" type="hidden" value="showcase,path,questions,conversion">'+
      '<label>Selected section<select name="sectionFocus" style="width:100%"><option value="showcase">Service showcase</option><option value="path">How it works</option><option value="questions">Frequently asked questions</option><option value="conversion">Call to action</option></select></label>'+
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:12px"><button class="btn" type="button" id="sbcStudioMoveSectionUp">Move Up ↑</button><button class="btn" type="button" id="sbcStudioMoveSectionDown">Move Down ↓</button><button class="btn" type="button" id="sbcStudioUndo">Undo Draft</button><button class="btn" type="button" id="sbcStudioRedo">Redo Draft</button></div>'+
      '<p style="font-size:.8rem">Undo/redo affects unsaved edits only. Save Design & Preview to persist a versioned revision.</p></fieldset>'+
      '<p style="font-size:.84rem">Zero-AI design works at $0 API cost. AI Polish remains disabled in this release until its application-side budget gate and fact review are verified.</p>'+
      '<details style="margin:14px 0"><summary style="cursor:pointer;font-weight:700">Illustrative industry photography (optional)</summary><p>Browse private photo ideas for the customer\'s business category. These are stock-style examples, NOT photographs of the customer\'s actual team or work. Verify license, depicted brands and individuals before use. Images load from Unsplash in your browser; no AI credits are used.</p>'+
      '<div style="display:flex;gap:9px;flex-wrap:wrap"><button type="button" id="sbcStudioBrowseMedia" class="btn">Find photo ideas</button><a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">Review Unsplash license</a></div>'+
      '<div id="sbcStudioMediaIdeas" role="region" aria-live="polite" aria-label="Illustrative photo suggestions" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:12px 0"></div>'+
      '<label style="display:block;margin:9px 0">Approved image URL<input name="photoUrl" type="url" maxlength="400" placeholder="https://images.unsplash.com/photo-…" style="width:100%"></label>'+
      '<label style="display:block;margin:9px 0">Accessible image description<input name="photoAlt" type="text" maxlength="180" style="width:100%"></label>'+
      '<label style="display:block;margin:9px 0"><input type="checkbox" name="rightsConfirmed"> I verified that we may use this image in the customer concept.</label></details>'+
      '<details style="margin:14px 0;border:1px solid #bdcbd6;border-radius:10px;padding:13px"><summary style="font-weight:800;cursor:pointer">V4 Brand Kit · Owner-confirmed colors</summary>'+
      '<p style="font-size:.88rem">Use two approved six-digit brand colors with readable white text. Logo uploads and automatic extraction are not enabled yet.</p>'+
      '<label>Primary color (#RRGGBB)<input id="sbcStudioBrandPrimary" name="brandPrimary" maxlength="7" placeholder="#163047" style="width:100%"></label>'+
      '<label>Accent color (#RRGGBB)<input id="sbcStudioBrandAccent" name="brandAccent" maxlength="7" placeholder="#99440D" style="width:100%"></label>'+
      '<label><input type="checkbox" name="brandConfirmed"> I confirm these colors belong to this customer or are approved for this draft.</label></details>'+
      '<div id="sbcStudioProControls" class="sbc-studio-pro-controls" aria-label="Advanced design tools">'+
      '<details style="margin:14px 0;border:1px solid #bdcbd6;border-radius:10px;padding:13px"><summary style="font-weight:800;cursor:pointer">V4 Authentic Before / After comparison</summary>'+
      '<p style="font-size:.88rem">Use TWO photos from the SAME real customer project. Supported source: direct HTTPS Cloudinary image links only (res.cloudinary.com). This is not for stock images or invented results.</p>'+
      '<label>Project description<input name="comparisonTitle" maxlength="110" placeholder="Owner-verified project photos" style="width:100%"></label>'+
      '<label>Before photo URL<input id="sbcStudioComparisonBefore" name="comparisonBefore" type="url" maxlength="350" style="width:100%" placeholder="https://res.cloudinary.com/.../image/upload/.../before.jpg"></label>'+
      '<label>After photo URL<input id="sbcStudioComparisonAfter" name="comparisonAfter" type="url" maxlength="350" style="width:100%" placeholder="https://res.cloudinary.com/.../image/upload/.../after.jpg"></label>'+
      '<label>Before photo description<input name="comparisonBeforeAlt" maxlength="180" style="width:100%"></label>'+
      '<label>After photo description<input name="comparisonAfterAlt" maxlength="180" style="width:100%"></label>'+
      '<label style="display:block"><input id="sbcStudioComparisonRights" type="checkbox" name="comparisonRights"> The business and photographer authorized BOTH images for this concept.</label>'+
      '<label style="display:block"><input id="sbcStudioActualWorkConfirmed" type="checkbox" name="actualWorkConfirmed"> Both images show the SAME actual project completed by this business, with permission to make that claim.</label>'+
      '<p style="font-size:.8rem">A comparison stays completely hidden until all fields and attestations are valid. No image is uploaded and nothing publishes automatically.</p></details>'+
      '<details id="sbcStudioGridInspector" style="margin:16px 0;padding:16px;border:1px solid #aac0d4;border-radius:12px;background:#fff"><summary style="font-weight:800;cursor:pointer">Freeform Grid · 12-column Style Inspector</summary>'+
      '<p>Opt-in: resize verified SERVICE cards only. Business facts, pricing, legal information and contact buttons remain protected. Desktop, tablet and mobile reflow automatically; no AI required.</p>'+
      '<label style="display:block"><input type="checkbox" name="gridEnabled" id="sbcStudioGridEnabled"> Enable freeform service grid for this private design</label>'+
      '<input name="gridState" id="sbcStudioGridState" type="hidden">'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:15px 0">'+
      '<label>Selected service card<select id="sbcStudioGridNode" name="gridNodeFocus"><option value="service-1">Service 1</option><option value="service-2">Service 2</option><option value="service-3">Service 3</option><option value="service-4">Service 4</option><option value="service-5">Service 5</option><option value="service-6">Service 6</option></select></label>'+
      '<label>Desktop columns (1-12)<input id="sbcStudioGridSpan" name="gridSpan" type="number" min="1" max="12" step="1" value="6"></label>'+
      '<label>Row span (1-3)<input name="gridRow" type="number" min="1" max="3" value="1"></label>'+
      '<label>Stacking order (1-5)<input name="gridZ" type="number" min="1" max="5" value="1"></label>'+
      '<label>Padding (0-64 px)<input id="sbcStudioGridPadding" name="gridPadding" type="number" min="0" max="64" value="24"></label>'+
      '<label>Corner radius (0-36 px)<input id="sbcStudioGridRadius" name="gridRadius" type="number" min="0" max="36" value="18"></label>'+
      '<label>Glass blur (0-18 px)<input name="gridBlur" type="number" min="0" max="18" value="0"></label>'+
      '<label>Tablet span<select name="gridTablet"><option value="6">Half width</option><option value="12">Full width</option></select></label>'+
      '<label>Mobile span<select id="sbcStudioGridMobile" name="gridMobile"><option value="12">Full width (recommended)</option><option value="6">Half width</option></select></label>'+
      '<label>Shadow<select name="gridShadow"><option value="none">None</option><option value="soft">Soft</option><option value="elevated">Elevated</option><option value="glow">Accent glow</option></select></label>'+
      '<label>Text alignment<select name="gridAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>'+
      '<label>Motion<select name="gridMotion"><option value="none">None</option><option value="fade-up">Fade up</option><option value="scale-in">Scale in</option><option value="hover-lift">Hover lift</option></select></label></div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="btn primary" id="sbcStudioGridApply">Apply grid to private preview</button><button type="button" class="btn" id="sbcStudioGridReset">Return to standard layout</button></div>'+
      '<p style="font-size:.83rem">Click a service card inside the private preview to select it, or drag its right-edge handle to change its desktop span. All edits remain unsaved until you choose Save Design & Preview.</p></details>'+
      '</div>'+
      '<button class="btn primary" type="submit">Save Design & Preview</button>'+
      '<details style="margin:16px 0;border:1px solid #b9cbd6;padding:12px;border-radius:10px"><summary style="cursor:pointer;font-weight:800">Saved design revisions</summary>'+
      '<p style="font-size:.87rem">Recover an earlier saved design without changing verified customer facts. Restoring creates a new saved version.</p>'+
      '<label>Choose saved design<select id="sbcStudioSavedRevisions" style="width:100%"><option value="">No previous revision selected</option></select></label>'+
      '<button type="button" class="btn" id="sbcStudioRestoreRevision" disabled>Restore selected design</button></details>'+
      '</form><p id="sbcStudioVisualStatus" role="status" aria-live="polite">Loading design controls…</p></section>';
  }
  const studioVisualMessage=text=>{const p=document.getElementById('sbcStudioVisualStatus');if(p)p.textContent=text;};
  // Private Preview runs in an opaque CSP sandbox. The only permitted channel
  // is bounded copy to an OWNER's unsaved form, never an automatic CRM write.
  window.addEventListener('message',function receiveStudioInlineEdit(event){
    const frame=document.getElementById('sbcFactoryFrame'),form=document.getElementById('sbcStudioVisualForm');
    if(!frame||event.source!==frame.contentWindow||currentRole()!=='owner'||
      active?.previewMode!=='smart'||!active?.demo||isApproved(active.demo)||active.demo.archived===true||
      !form||form.dataset.ready!=='1')return;
    const data=event.data;
    if(!data||typeof data!=='object'||data.type!=='SBC_STUDIO_V3_INLINE_TEXT')return;
    if(!['headline','subheadline'].includes(data.field)||typeof data.value!=='string')return;
    const text=data.value.trim(),max=data.field==='headline'?120:280;
    if(!text||text.length>max||/[<>\u0000-\u001f\u007f]/.test(text))return;
    const field=form.elements.namedItem(data.field);
    if(!field||field.disabled)return;
    field.value=text;
    rememberStudioDraft();
    studioVisualMessage('Edited on the private canvas. Click Save Design & Preview to keep this change.');
  });
  // Accept only messages from the current owner-visible, isolated Preview iframe.
  // Never accepts arbitrary CSS, node markup, PII or a visitor-supplied tenant.
  window.addEventListener('message',function receiveStudioGridInteraction(event){
    const frame=document.getElementById('sbcFactoryFrame');
    const form=document.getElementById('sbcStudioVisualForm');
    if(!frame||event.source!==frame.contentWindow||currentRole()!=='owner'||
       active?.previewMode!=='smart'||!active?.demo||isApproved(active.demo)||
       active.demo.archived===true||!form||form.dataset.ready!=='1')return;
    const msg=event.data;
    if(!msg||typeof msg!=='object'||!['SBC_STUDIO_GRID_SELECT','SBC_STUDIO_GRID_RESIZE'].includes(msg.type)||
       typeof msg.nodeId!=='string'||!/^service-[1-6]$/.test(msg.nodeId))return;
    selectStudioGridCard(msg.nodeId);
    if(msg.type==='SBC_STUDIO_GRID_RESIZE'){
      if(!Number.isInteger(msg.deltaColumns)||Math.abs(msg.deltaColumns)>12)return;
      const span=form.elements.namedItem('gridSpan');
      const current=Number(span.value);
      if(!Number.isInteger(current))return;
      span.value=String(Math.min(12,Math.max(1,current+msg.deltaColumns)));
      form.elements.namedItem('gridEnabled').checked=true;
      if(commitStudioGridInspector())tryStudioRemix();
    }
  });

  const v3SectionKeys=['showcase','path','questions','conversion'];
  const v3VisualFields=['headline','subheadline','density','vibe','heroStyle','serviceLayout','photoUrl','photoAlt','rightsConfirmed','sectionOrder','brandPrimary','brandAccent','brandConfirmed','comparisonTitle','comparisonBefore','comparisonAfter','comparisonBeforeAlt','comparisonAfterAlt','comparisonRights','actualWorkConfirmed','gridEnabled','gridState'];
  let v3History={site:null,present:null,undo:[],redo:[]};

  // Grid inspector is *presentation only*. The server validates the complete
  // allowlist and the existing tenant/owner/version gates before saving.
  const studioGridValue=form=>{
    const text=String(form?.elements.namedItem('gridState')?.value||'');
    try{
      const value=JSON.parse(text);
      if(value&&typeof value==='object'&&Array.isArray(value.nodes))return value;
    }catch{}
    return {enabled:false,nodes:[]};
  };
  const studioGridInt=(form,name,min,max)=>{
    const value=Number(form.elements.namedItem(name)?.value);
    if(!Number.isInteger(value)||value<min||value>max)throw Error('Invalid '+name+'; expected '+min+'-'+max);
    return value;
  };
  function syncStudioGridInspector(){
    const form=document.getElementById('sbcStudioVisualForm');
    if(!form)return;
    const value=studioGridValue(form),id=String(form.elements.namedItem('gridNodeFocus')?.value||'service-1');
    const node=value.nodes.find(n=>n.id===id)||{},g=node.grid||{},st=node.style||{},bp=node.breakpoints||{};
    const defaults={gridSpan:g.colSpan??6,gridRow:g.rowSpan??1,gridZ:g.zIndex??1,
      gridPadding:st.paddingPx??24,gridRadius:st.radiusPx??18,gridBlur:st.glassBlurPx??0,
      gridTablet:bp.tablet?.colSpan??6,gridMobile:bp.mobile?.colSpan??12,
      gridShadow:st.shadow??'soft',gridAlign:st.align??'left',gridMotion:node.motion??'none'};
    for(const [key,v] of Object.entries(defaults)){
      const field=form.elements.namedItem(key);if(field)field.value=String(v);
    }
    form.elements.namedItem('gridEnabled').checked=value.enabled===true;
  }
  function commitStudioGridInspector(){
    const form=document.getElementById('sbcStudioVisualForm');
    if(!form||form.dataset.ready!=='1'||currentRole()!=='owner'||!active?.demo||
      isApproved(active.demo)||active.demo.archived===true)return false;
    const enabled=form.elements.namedItem('gridEnabled').checked===true;
    if(!enabled){
      form.elements.namedItem('gridState').value=JSON.stringify({enabled:false,nodes:[]});
      rememberStudioDraft();return true;
    }
    const id=String(form.elements.namedItem('gridNodeFocus')?.value||'');
    if(!/^service-[1-6]$/.test(id))return false;
    try{
      const node={id,grid:{colSpan:studioGridInt(form,'gridSpan',1,12),
        rowSpan:studioGridInt(form,'gridRow',1,3),zIndex:studioGridInt(form,'gridZ',1,5)},
        style:{paddingPx:studioGridInt(form,'gridPadding',0,64),
          radiusPx:studioGridInt(form,'gridRadius',0,36),
          glassBlurPx:studioGridInt(form,'gridBlur',0,18),
          shadow:String(form.elements.namedItem('gridShadow')?.value||'soft'),
          align:String(form.elements.namedItem('gridAlign')?.value||'left')},
        motion:String(form.elements.namedItem('gridMotion')?.value||'none'),
        breakpoints:{tablet:{colSpan:studioGridInt(form,'gridTablet',6,12)},
          mobile:{colSpan:studioGridInt(form,'gridMobile',6,12)}}};
      if(![6,12].includes(node.breakpoints.tablet.colSpan)||![6,12].includes(node.breakpoints.mobile.colSpan))
        throw Error('Only half-width or full-width tablet/mobile spans are allowed.');
      const current=studioGridValue(form);
      const nodes=Array.isArray(current.nodes)&&current.enabled===true?current.nodes.filter(n=>n.id!==id):[];
      if(nodes.length>=12)throw Error('Maximum 12 service nodes');
      nodes.push(node);
      nodes.sort((a,b)=>Number(a.id.slice(8))-Number(b.id.slice(8)));
      const draft=JSON.stringify({enabled:true,nodes});
      if(draft.length>7000)throw Error('Grid draft is too large');
      form.elements.namedItem('gridState').value=draft;
      rememberStudioDraft();return true;
    }catch(error){studioVisualMessage('Grid not applied: '+String(error.message||error));return false}
  }
  function selectStudioGridCard(id){
    const form=document.getElementById('sbcStudioVisualForm');
    if(!form||form.dataset.ready!=='1'||!/^service-[1-6]$/.test(id))return;
    const choice=form.elements.namedItem('gridNodeFocus');
    if(!choice||!Array.from(choice.options).some(o=>o.value===id))return;
    choice.value=id;
    document.getElementById('sbcStudioGridInspector')?.setAttribute('open','');
    syncStudioGridInspector();
    studioVisualMessage('Selected '+id+'. Adjust the inspector then apply your private design.');
  }
  function resetStudioGrid(){
    const form=document.getElementById('sbcStudioVisualForm');
    if(!form||form.dataset.ready!=='1'||currentRole()!=='owner')return;
    form.elements.namedItem('gridEnabled').checked=false;
    form.elements.namedItem('gridState').value=JSON.stringify({enabled:false,nodes:[]});
    rememberStudioDraft();syncStudioGridInspector();tryStudioRemix();
  }

  function studioSnapshot(form){
    if(!form)return null;
    const result={};
    for(const key of v3VisualFields){
      const field=form.elements.namedItem(key);if(!field)return null;
      result[key]=['rightsConfirmed','brandConfirmed','comparisonRights','actualWorkConfirmed','gridEnabled'].includes(key) ? field.checked===true : String(field.value||'');
    }
    return JSON.stringify(result);
  }
  function rememberStudioDraft(){
    const form=document.getElementById('sbcStudioVisualForm'),site=active?.demo?.id;
    if(!form||form.dataset.ready!=='1'||currentRole()!=='owner'||v3History.site!==site)return;
    const current=studioSnapshot(form);
    if(!current||current===v3History.present)return;
    if(v3History.present!==null)v3History.undo.push(v3History.present);
    v3History.undo=v3History.undo.slice(-50);
    v3History.present=current;v3History.redo=[];
  }
  function restoreStudioSnapshot(snapshot){
    const form=document.getElementById('sbcStudioVisualForm');if(!form||!snapshot)return;
    const values=JSON.parse(snapshot);
    for(const key of v3VisualFields){
      const field=form.elements.namedItem(key);
      if(!field)continue;
      if(['rightsConfirmed','brandConfirmed','comparisonRights','actualWorkConfirmed','gridEnabled'].includes(key))field.checked=values[key]===true;
      else field.value=String(values[key]||'');
    }
  }
  function studioHistoryStep(direction){
    const stack=direction==='undo'?v3History.undo:v3History.redo;
    if(!stack.length||currentRole()!=='owner'||v3History.site!==active?.demo?.id)return;
    const opposite=direction==='undo'?v3History.redo:v3History.undo;
    opposite.push(v3History.present);v3History.present=stack.pop();
    restoreStudioSnapshot(v3History.present);syncStudioGridInspector();tryStudioRemix();
    studioVisualMessage('Restored unsaved '+direction+' state. Save to preserve this revision.');
  }
  async function loadStudioMediaIdeas(){
    const demo=active?.demo,form=document.getElementById('sbcStudioVisualForm'),grid=document.getElementById('sbcStudioMediaIdeas');
    if(!demo||!form||!grid||form.dataset.ready!=='1'||currentRole()!=='owner'||isApproved(demo)||demo.archived)return;
    grid.textContent='Loading industry photo suggestions…';
    try{
      const results=await serviceApi(studioBase(demo)+'/media-suggestions');
      if(!results?.ok||!Array.isArray(results.candidates))throw Error(results?.code||'Photo suggestions unavailable');
      if(active?.demo?.id!==demo.id||!grid.isConnected)return;
      grid.textContent='';
      if(!results.candidates.length){grid.textContent='No curated ideas for this business category yet.';return;}
      for(const item of results.candidates){
        const url=new URL(String(item.url||''));
        if(url.protocol!=='https:'||url.hostname!=='images.unsplash.com'||item.illustrativeOnly!==true||item.rightsConfirmed!==false)continue;
        const button=document.createElement('button');button.type='button';
        button.className='btn';button.style.cssText='display:grid;gap:8px;text-align:left;white-space:normal;padding:8px;background:#fff;color:#18334a;border:1px solid #b9ccdd';
        const picture=document.createElement('img');picture.src=url.href;picture.alt=String(item.alt||'Illustrative stock idea').slice(0,180);
        picture.loading='lazy';picture.decoding='async';picture.width=250;picture.height=140;
        picture.style.cssText='display:block;width:100%;height:140px;object-fit:cover;border-radius:8px';
        const title=document.createElement('span');title.textContent=String(item.title||'Illustrative photo idea').slice(0,100);
        const note=document.createElement('small');note.textContent='Illustrative only · rights review required';
        button.append(picture,title,note);
        button.addEventListener('click',()=>{
          if(form.dataset.ready!=='1'||active?.demo?.id!==demo.id)return;
          form.elements.namedItem('photoUrl').value=url.href;
          form.elements.namedItem('photoAlt').value=String(item.alt||'Illustrative stock photograph').slice(0,180);
          form.elements.namedItem('rightsConfirmed').checked=false;
          rememberStudioDraft();
          studioVisualMessage('Photo idea selected but NOT approved. Verify its individual license and depicted people/brands, then check image rights before saving. Never describe it as the customer\'s actual work.');
        });
        grid.append(button);
      }
    }catch(e){if(grid.isConnected)grid.textContent='Could not load photo ideas. You can still paste an authorized image URL.';}
  }
  function moveStudioSection(step){
    const form=document.getElementById('sbcStudioVisualForm');
    if(!form||form.dataset.ready!=='1'||currentRole()!=='owner')return;
    const field=form.elements.namedItem('sectionOrder'),selected=form.elements.namedItem('sectionFocus');
    const order=String(field.value||'').split(',');
    if(order.length!==4||new Set(order).size!==4||order.some(k=>!v3SectionKeys.includes(k)))return;
    const from=order.indexOf(selected.value),to=from+step;
    if(from<0||to<0||to>=order.length)return;
    [order[from],order[to]]=[order[to],order[from]];
    field.value=order.join(',');rememberStudioDraft();tryStudioRemix();
  }
  async function loadStudioVisual(demo){
    const form=document.getElementById('sbcStudioVisualForm');if(!form)return;
    try{
      const result=await serviceApi(studioBase(demo)+'/visual');
      if(active?.demo?.id!==demo.id||!form.isConnected)return;
      if(!result?.ok)throw Error(result?.code||'Visual Studio is unavailable');
      form.dataset.version=String(result.version||0);
      const v=result.visual||{};
      for(const field of ['headline','subheadline','photoUrl','photoAlt'])form.elements.namedItem(field).value=String(v[field]||'');
      form.elements.namedItem('density').value=v.density||'original';
      form.elements.namedItem('vibe').value=v.vibe||'original';
      form.elements.namedItem('heroStyle').value=v.heroStyle||'auto';
      form.elements.namedItem('serviceLayout').value=v.serviceLayout||'auto';
      form.elements.namedItem('sectionOrder').value=Array.isArray(v.sectionOrder)?v.sectionOrder.join(','):v3SectionKeys.join(',');
      form.elements.namedItem('rightsConfirmed').checked=v.rightsConfirmed===true;
      const brand=v.brandKit?.enabled?v.brandKit:{};
      form.elements.namedItem('brandPrimary').value=brand.primary||'';
      form.elements.namedItem('brandAccent').value=brand.accent||'';
      form.elements.namedItem('brandConfirmed').checked=brand.ownerConfirmed===true;
      const comparison=v.beforeAfter?.enabled?v.beforeAfter:{};
      for(const [field,key] of [['comparisonTitle','title'],['comparisonBefore','beforeUrl'],['comparisonAfter','afterUrl'],['comparisonBeforeAlt','beforeAlt'],['comparisonAfterAlt','afterAlt']])
        form.elements.namedItem(field).value=comparison[key]||'';
      form.elements.namedItem('comparisonRights').checked=comparison.rightsConfirmed===true;
      form.elements.namedItem('actualWorkConfirmed').checked=comparison.actualWorkConfirmed===true;
      const loadedGrid=v.freeformGrid?.enabled===true?v.freeformGrid:{enabled:false,nodes:[]};
      form.elements.namedItem('gridEnabled').checked=loadedGrid.enabled;
      form.elements.namedItem('gridState').value=JSON.stringify(loadedGrid);
      syncStudioGridInspector();
      form.dataset.ready='1';
      v3History={site:demo.id,present:studioSnapshot(form),undo:[],redo:[]};
      form.querySelectorAll('input,textarea,select,button').forEach(input=>{input.disabled=!result.canEdit});
      const allowedCards=Math.min(6,Math.max(0,Number(result.maxEditableServices)||0));
      const gridChoices=form.elements.namedItem('gridNodeFocus');
      if(gridChoices){
        for(const option of gridChoices.options){
          option.disabled=Number(option.value.slice(8))>allowedCards;
        }
        if(Number(gridChoices.value.slice(8))>allowedCards)gridChoices.value='service-1';
      }
      for(const id of ['sbcStudioGridEnabled','sbcStudioGridApply','sbcStudioGridReset']){
        const el=document.getElementById(id);if(el)el.disabled=!result.canEdit||allowedCards===0;
      }
      if(allowedCards===0&&result.canEdit){
        studioVisualMessage('Verify the business services first. The freeform grid cannot style unverified offerings.');
      }

      studioVisualMessage(result.canEdit?'Visual Studio revision '+result.version+' ready. These edits affect private smart previews only.':'This site is locked for editing.');
      loadStudioHistory(demo).catch(()=>undefined);
    }catch(e){studioVisualMessage(String(e?.message||'Visual Studio unavailable.'));}
  }
  // Instant, owner-only V2 remix. GET is read-only; Save remains an explicit,
  // versioned action. Preview overrides cannot change approved CRM facts.
  function tryStudioRemix(){
    const demo=active?.demo,form=document.getElementById('sbcStudioVisualForm');
    if(!demo||!form||isApproved(demo)||demo.archived===true)return;
    const value=name=>String(form.elements.namedItem(name)?.value||'');
    const page=active.previewPage||'home',url=new URL(absolute(studioBase(demo)+'/auto-preview'));
    if(page!=='home')url.searchParams.set('page',page);
    for(const name of ['vibe','heroStyle','serviceLayout','sectionOrder'])url.searchParams.set(name,value(name));
    // Read-only preview override uses server-side allowlist validation and
    // never saves to GoDaddy's shared Preview/Published database.
    if(form.dataset.ready==='1'){
      const gridDraft=String(form.elements.namedItem('gridState')?.value||'');
      if(gridDraft&&gridDraft.length<=7000)url.searchParams.set('freeformGrid',gridDraft);
    }
    const frame=document.getElementById('sbcFactoryFrame');if(frame)frame.src=url.href;
    active.previewMode='smart';
    studioVisualMessage('Previewing V2 design without saving or using AI. Save Design & Preview to keep these choices.');
  }
  function cycleStudioChoice(field,choices){
    const form=document.getElementById('sbcStudioVisualForm');
    if(!form||!active?.demo)return;
    const select=form.elements.namedItem(field);if(!select||select.disabled)return;
    const at=choices.indexOf(select.value);
    select.value=choices[(at+1)%choices.length];
    rememberStudioDraft();tryStudioRemix();
  }
  async function loadStudioHistory(demo){
    const dropdown=document.getElementById('sbcStudioSavedRevisions');
    const button=document.getElementById('sbcStudioRestoreRevision');
    if(!demo||!dropdown||!button||currentRole()!=='owner')return;
    try{
      const data=await serviceApi(studioBase(demo)+'/visual/history');
      if(!data?.ok||!Array.isArray(data.revisions))throw Error('History unavailable');
      if(active?.demo?.id!==demo.id||!dropdown.isConnected)return;
      dropdown.textContent='';
      const blank=document.createElement('option');blank.value='';blank.textContent='Select a saved design';dropdown.append(blank);
      for(const row of data.revisions){
        if(!Number.isSafeInteger(row.version)||row.version<0)continue;
        const option=document.createElement('option');
        option.value=String(row.version);
        option.textContent='Revision '+row.version+(row.editedAt?' · '+String(row.editedAt).slice(0,16):' · Initial design');
        dropdown.append(option);
      }
      button.disabled=!data.canRestore||data.revisions.length===0;
      dropdown.disabled=!data.canRestore||data.revisions.length===0;
    }catch(e){if(dropdown.isConnected){dropdown.textContent='';button.disabled=true;}}
  }
  async function restoreStudioRevision(){
    const demo=active?.demo,form=document.getElementById('sbcStudioVisualForm');
    const select=document.getElementById('sbcStudioSavedRevisions');
    if(!demo||!form||!select||currentRole()!=='owner'||isApproved(demo)||demo.archived||busy)return;
    if(select.value==='')return studioVisualMessage('Choose a previously saved design first.');
    const restoreVersion=Number(select.value),expectedVersion=Number(form.dataset.version);
    if(!Number.isSafeInteger(restoreVersion)||restoreVersion<0||!Number.isSafeInteger(expectedVersion)||expectedVersion<0)return;
    if(!window.confirm('Restore saved design revision '+restoreVersion+'? The currently saved design will remain in history. Approved customer facts and published websites will not change.'))return;
    busy=true;studioVisualMessage('Restoring selected private design…');
    try{
      const result=await serviceApi(studioBase(demo)+'/visual/restore',{method:'POST',
        body:JSON.stringify({expectedVersion,restoreVersion})});
      if(!result?.ok||result.durable!==true)throw Error(result?.code||'Restore failed');
      if(active?.demo?.id!==demo.id)return;
      await loadStudioVisual(demo);
      active.previewMode='smart';
      const url=new URL(absolute(studioBase(demo)+'/auto-preview'));
      const page=active.previewPage||'home';
      if(page!=='home')url.searchParams.set('page',page);
      url.searchParams.set('visualVersion',String(result.version));
      const frame=document.getElementById('sbcFactoryFrame');if(frame)frame.src=url.href;
      studioVisualMessage('Restored revision '+restoreVersion+' as new revision '+result.version+'. Nothing was published.');
    }catch(e){studioVisualMessage('Restore not completed: '+String(e?.message||e)+'. Reload and check current revision.');}
    finally{busy=false;}
  }
  async function saveStudioVisual(event){
    event.preventDefault();
    if(currentRole()!=='owner'||!active?.demo||busy)return;
    const demo=active.demo,form=event.currentTarget;
    const get=name=>String(form.elements.namedItem(name)?.value||'').trim();
    if(!commitStudioGridInspector())return studioVisualMessage('Fix the grid inspector inputs before saving.');
    const visual={headline:get('headline'),subheadline:get('subheadline'),density:get('density'),vibe:get('vibe'),heroStyle:get('heroStyle'),serviceLayout:get('serviceLayout'),sectionOrder:get('sectionOrder').split(','),photoUrl:get('photoUrl'),photoAlt:get('photoAlt'),rightsConfirmed:form.elements.namedItem('rightsConfirmed').checked};
    visual.freeformGrid=studioGridValue(form);
    if(visual.photoUrl&&(!visual.photoAlt||!visual.rightsConfirmed))return studioVisualMessage('An approved photo requires an alt description and your explicit image-rights confirmation.');
    const brandEnabled=Boolean(get('brandPrimary')||get('brandAccent')||form.elements.namedItem('brandConfirmed').checked);
    visual.brandKit=brandEnabled?{primary:get('brandPrimary'),accent:get('brandAccent'),
      ownerConfirmed:form.elements.namedItem('brandConfirmed').checked}:{};
    const comparisonEnabled=['comparisonTitle','comparisonBefore','comparisonAfter','comparisonBeforeAlt','comparisonAfterAlt'].some(k=>Boolean(get(k)))||
      form.elements.namedItem('comparisonRights').checked||form.elements.namedItem('actualWorkConfirmed').checked;
    visual.beforeAfter=comparisonEnabled?{
      title:get('comparisonTitle'),beforeUrl:get('comparisonBefore'),afterUrl:get('comparisonAfter'),
      beforeAlt:get('comparisonBeforeAlt'),afterAlt:get('comparisonAfterAlt'),
      rightsConfirmed:form.elements.namedItem('comparisonRights').checked,
      actualWorkConfirmed:form.elements.namedItem('actualWorkConfirmed').checked}:{};
    const submit=form.querySelector('button[type=submit]');
    busy=true;if(submit)submit.disabled=true;
    studioVisualMessage('Saving art direction to the correct customer website…');
    try{
      const out=await serviceApi(studioBase(demo)+'/visual',{method:'PATCH',body:JSON.stringify({expectedVersion:Number(form.dataset.version||0),visual})});
      if(!out?.ok||out.durable!==true)throw Error(out?.code||'Visual changes were not saved.');
      if(active?.demo?.id!==demo.id)return;
      form.dataset.version=String(out.version);
      v3History={site:demo.id,present:studioSnapshot(form),undo:[],redo:[]};
      active.previewMode='smart';
      const page=active.previewPage||'home';
      const url=new URL(absolute(studioBase(demo)+'/auto-preview'));
      if(page!=='home')url.searchParams.set('page',page);
      url.searchParams.set('visualVersion',String(out.version));
      const frame=document.getElementById('sbcFactoryFrame');if(frame)frame.src=url.href;
      const address=document.getElementById('sbcFactoryAddress');if(address)address.textContent='SBC Visual Studio · Private Saved Preview';
      document.getElementById('sbcFactorySmartMode')?.classList.add('primary');
      document.getElementById('sbcFactoryClassicMode')?.classList.remove('primary');
      studioVisualMessage('Saved design revision '+out.version+'. Private art-directed preview updated; no public website changed.');
      loadStudioHistory(demo).catch(()=>undefined);
    }catch(e){studioVisualMessage('Not saved: '+String(e?.message||e)+'. Reload Visual Studio if someone else edited this project.');}
    finally{busy=false;if(submit)submit.disabled=false;}
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
    const html='<div class="v6526-studio" style="width:min(1620px,95vw);max-width:100%">'+"<style>\n.sbc-studio-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,350px);gap:16px;align-items:start;margin:16px 0 24px}\n.sbc-studio-canvas{min-width:0;padding:12px;border-radius:16px;background:#eaf1f7;border:1px solid #bed0dd}\n.sbc-studio-rail{min-width:0;max-height:83vh;overflow:auto;overscroll-behavior:contain;background:#f7fafc;border:1px solid #c7d7e4;border-radius:15px;padding:14px;position:sticky;top:10px}\n.sbc-studio-workspace .sbc-studio-pro-controls{display:none}\n.sbc-studio-workspace.is-pro .sbc-studio-pro-controls{display:block}\n.sbc-studio-workspace .sbc-studio-rail h4{font-size:16px}\n.sbc-studio-workspace .sbc-studio-rail label,.sbc-studio-workspace .sbc-studio-rail input,.sbc-studio-workspace .sbc-studio-rail select,.sbc-studio-workspace .sbc-studio-rail textarea{max-width:100%;min-width:0}\n.sbc-studio-workspace .sbc-studio-rail label{overflow-wrap:anywhere}\n.sbc-studio-workspace .v6526-preview-shell{max-width:100%;box-shadow:0 14px 50px -37px #10344d;transition:width .18s ease}\n.sbc-studio-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:6px 0 12px}\n.sbc-studio-toolbar button[aria-pressed=true]{outline:2px solid #245f97}\n.sbc-studio-review-banner{padding:12px 16px;border:1px solid #e3b66b;border-radius:11px;background:#fff2d6;color:#453210;margin:12px 0}\n.sbc-studio-publish-drawer{margin:24px 0;border:1px solid #c6d5e2;border-radius:14px;background:#f8fafc;padding:16px}\n.sbc-studio-publish-drawer>summary{font-weight:800;cursor:pointer;padding:8px}\n.sbc-studio-canvas iframe{display:block;max-width:100%}\n@media(max-width:1080px){.sbc-studio-workspace{grid-template-columns:minmax(0,1fr) 300px}}\n@media(max-width:760px){.sbc-studio-workspace{grid-template-columns:minmax(0,1fr)}.sbc-studio-rail{position:static;max-height:none}.sbc-studio-canvas{padding:8px}.sbc-studio-toolbar{justify-content:flex-start}}\n@media(prefers-reduced-motion:reduce){.sbc-studio-workspace .v6526-preview-shell{transition:none}}\n</style>"+
      '<div class="v6526-studio-top"><div><p class="v6526-kicker">SBC WEBSITE PRODUCTION · REAL WORKING WEBSITES</p><h3>'+esc(customer.businessName||customer.contactName||'Website project')+'</h3><p>Built website: '+esc(demo.offerTier==='starter'?'Business Starter':'Business Basic')+' · '+price+' · '+pages.length+' page'+(pages.length>1?'s':'')+'. The remaining business-specific information is completed after purchase.</p></div><span class="v6526-ready">'+esc(demo.status||'Draft')+'</span></div>'+
      '<div id="sbcFactoryReviewBanner" class="sbc-studio-review-banner" role="status" aria-live="polite">Checking business details before this private presentation…</div>'+
      '<div id="sbcStudioWorkspace" class="sbc-studio-workspace"><main id="sbcStudioCanvas" class="sbc-studio-canvas" aria-label="Live website design canvas">'+
      '<div class="sbc-studio-toolbar"><strong>Live website preview</strong><div style="display:flex;flex-wrap:wrap;gap:6px">'+
      '<button id="sbcStudioTopUndo" type="button" class="btn" title="Undo unsaved design edit">Undo</button>'+
      '<button id="sbcStudioTopRedo" type="button" class="btn" title="Redo unsaved design edit">Redo</button>'+
      '<button id="sbcStudioTopSave" type="button" class="btn primary">Save Draft</button>'+
      '<button id="sbcStudioTopQA" type="button" class="btn">Publish &amp; QA</button></div></div>'+
      '<nav aria-label="Website pages" style="display:flex;gap:9px;flex-wrap:wrap;margin:12px 0"><strong>Pages:</strong>'+links+'</nav>'+ 
      (smartDraft?'<div class="sbc-factory-light-panel" style="padding:15px;border:1px solid #bdd0de;border-radius:10px"><strong>Choose design preview</strong><div style="display:flex;gap:9px;flex-wrap:wrap;margin:10px 0"><button id="sbcFactorySmartMode" class="btn primary" type="button">★ Art-directed preview (default)</button><button id="sbcFactoryClassicMode" class="btn" type="button">Classic 4-page builder</button></div><p id="sbcFactoryModeInfo" role="status">The art-directed version is a PRIVATE '+(pages.length>1?'four-page':'one-page')+' concept. Example sections need fact approval. Your original '+(pages.length>1?'four-page':'one-page')+' site and its editor remain available under Classic.</p></div>':'')+
      '<div class="v6526-device-tabs" style="display:flex;gap:9px;margin:12px 0"><button type="button" class="btn primary" data-factory-device="desktop">Desktop</button><button type="button" class="btn" data-factory-device="tablet">Tablet</button><button type="button" class="btn" data-factory-device="mobile">Mobile</button></div>'+
      '<div class="v6526-preview-shell"><div class="v6526-browser"><small id="sbcFactoryAddress">SBC website production</small></div><iframe id="sbcFactoryFrame" src="'+esc(smartDraft?smartUrl:pageUrl(demo,'home'))+'" title="Full prospective customer website" referrerpolicy="no-referrer" style="width:100%;min-height:760px;border:0;background:white"></iframe></div>'+
      '</main><aside id="sbcStudioToolRail" class="sbc-studio-rail" aria-label="Website editing tools">'+
      '<div class="sbc-studio-toolbar"><strong>Edit your website</strong><div role="group" aria-label="Editor difficulty"><button type="button" class="btn primary" id="sbcStudioModeSimple" aria-pressed="true">Simple</button><button type="button" class="btn" id="sbcStudioModePro" aria-pressed="false">Pro Design</button></div></div>'+
      studioVisualPanel(demo)+
      (currentRole()==='owner'?'<details id="sbcStudioHybridAI" style="margin:14px 0;border:1px solid #bacbde;padding:14px;border-radius:12px;background:#fff"><summary style="font-weight:800;cursor:pointer">✨ Hybrid AI Studio · $40 monthly cap</summary><p style="font-size:13px;line-height:1.6">New SBC-built sites receive automatic AI art direction when configured. Existing sites change only when you choose an upgrade. Customer facts, forms, payments and publishing are never automatically approved.</p><p id="sbcStudioAIBudget" role="status">Checking Studio AI allowance…</p><label for="sbcStudioAIProvider" style="display:block;font-weight:700;margin:10px 0 6px">Choose AI design engine</label><select id="sbcStudioAIProvider" style="width:100%;padding:10px;border:1px solid #bacbde;border-radius:8px;background:white;color:#182c44"><option value="openai">OpenAI · Hybrid AI</option><option value="gemini">Google Gemini · AI Studio-inspired design</option></select><p style="font-size:12px;color:#506477">Google Gemini uses Google’s Gemini API, not the AI Studio Build Mode interface. Both providers use the same private design editor and shared $40 Studio allowance.</p><button id="sbcStudioAIUpgrade" class="btn primary" type="button">'+(isApproved(demo)?'Upgrade existing website · private proposal':'✨ Upgrade This Website With AI')+'</button><p id="sbcStudioAIStatus" role="status" aria-live="polite">No external AI request will be made until you choose the button for this existing site.</p><div id="sbcStudioAIProposal" style="font-size:13px;line-height:1.5;white-space:pre-wrap"></div><p style="font-size:11px;color:#566">AI text is a suggestion only. Confirm all facts before customer use. Approved sites are never overwritten; they receive private proposals.</p></details>':'')+
      '<details id="sbcStudioBusinessDetails" style="margin:14px 0;border:1px solid #c5d7e5;padding:12px;border-radius:10px"><summary style="font-weight:700;cursor:pointer">Verify Business Details</summary>'+studioPanel()+'</details>'+
      '<details style="margin:14px 0;border:1px solid #c5d7e5;padding:12px;border-radius:10px"><summary style="font-weight:700;cursor:pointer">Classic Page Editor</summary>'+nativeEditorPanel(demo)+'</details>'+
      '</aside></div><details id="sbcFactoryPublishDrawer" class="sbc-studio-publish-drawer"><summary>Publish &amp; QA · Owner release review</summary><div style="padding:12px">'+
      reviewPanel(demo)+hostingGuide(demo)+qualityPanel(demo,customer)+
      '<section class="sbc-factory-pitch" style="margin:20px 0"><h4>Prospect presentation</h4><p style="line-height:1.7;white-space:pre-wrap" id="sbcFactoryPitch">'+esc(scriptForWebsite(demo,customer))+'</p><button type="button" class="btn" id="sbcFactoryCopyPitch">Copy sales opening</button></section>'+
      appointmentPanel(demo)+
      (isApproved(demo)?'<div class="v6526-link-row sbc-factory-light-panel"><div><strong>Approved presentation URL</strong><input id="sbcFactoryPublicUrl" readonly value="'+esc(pageUrl(demo,'home'))+'"></div><button type="button" class="btn" id="sbcFactoryCopyLink">Copy Website Link</button><a class="btn" href="'+esc(pageUrl(demo,'home'))+'" target="_blank" rel="noopener noreferrer">Open Website ↗</a></div>':'<p class="sbc-factory-light-panel sbc-factory-private-note" style="padding:12px;background:#fff4dc;border-radius:9px"><strong>Private production draft.</strong> No public URL or outbound message is available before owner approval.</p>')+
      '<div class="v6526-delivery sbc-factory-light-panel"><div><h4>Owner-authorized presentation delivery</h4><p>Only send after the business requests or consents to the link. Do not send to suppressed contacts.</p></div><div class="v6526-delivery-actions"><button type="button" class="btn" id="sbcFactoryEmail" '+(currentRole()==='owner'&&isApproved(demo)&&customer.email&&!customer.doNotContact&&!customer.salesSuppressed?'':'disabled')+'>Email Website</button><button type="button" class="btn" id="sbcFactorySms" '+(currentRole()==='owner'&&isApproved(demo)&&customer.phone&&(customer.smsConsent===true||customer.consentToSms===true)&&!customer.smsOptOut&&!customer.doNotCall&&!customer.doNotContact&&!customer.salesSuppressed?'':'disabled')+'>Text Website</button></div></div>'+
      '<p id="sbcWebsiteFactoryStatus" role="status" style="padding:12px 0">'+esc(message||(isApproved(demo)?'Website ready for a human-led sales presentation.':'Website built and awaiting owner verification.'))+'</p>'+
      '<p style="font-size:12px;color:#67757e">This is a fully navigable sales website. The customer’s final verified photos, branding, services and contact integration are completed during paid fulfillment. No live inquiry data is collected from this pre-sale site.</p></div></details></div>';
    if (typeof openModal !== 'function')throw Error('Command Center modal is unavailable.');
    openModal('SBC Website Production',html);
    const address=document.getElementById('sbcFactoryAddress');
    // Always report the actual iframe URL, not the last selected legacy page.
    function syncStudioPreviewAddress(){
      const frame=document.getElementById('sbcFactoryFrame');
      if(!address||!frame)return;
      try{
        const url=new URL(frame.src,window.location.href);
        const smart=url.pathname.includes('/studio/auto-preview');
        address.textContent=(smart?'Art-directed private draft · ':'Classic website · ')+url.pathname+url.search;
      }catch{address.textContent='SBC Website Studio · Preview unavailable';}
    }
    document.getElementById('sbcFactoryFrame')?.addEventListener('load',()=>{
      syncStudioPreviewAddress();
      const frame=document.getElementById('sbcFactoryFrame');
      const pro=document.getElementById('sbcStudioWorkspace')?.classList.contains('is-pro');
      if(frame?.contentWindow)frame.contentWindow.postMessage({type:'SBC_STUDIO_DESIGN_MODE',mode:pro?'pro':'simple'},'*');
    });
    syncStudioPreviewAddress();
    function switchStudioMode(pro){
      const workspace=document.getElementById('sbcStudioWorkspace');
      if(!workspace)return;
      workspace.classList.toggle('is-pro',pro===true);
      const simple=document.getElementById('sbcStudioModeSimple'),advanced=document.getElementById('sbcStudioModePro');
      if(simple){simple.classList.toggle('primary',!pro);simple.setAttribute('aria-pressed',String(!pro))}
      if(advanced){advanced.classList.toggle('primary',pro);advanced.setAttribute('aria-pressed',String(pro))}
      const frame=document.getElementById('sbcFactoryFrame');
      if(frame?.contentWindow)frame.contentWindow.postMessage({type:'SBC_STUDIO_DESIGN_MODE',mode:pro?'pro':'simple'},'*');
      // The iframe still enforces its own owner-only editing and sandbox rules.
    }
    document.getElementById('sbcStudioModeSimple')?.addEventListener('click',()=>switchStudioMode(false));
    document.getElementById('sbcStudioModePro')?.addEventListener('click',()=>switchStudioMode(true));
    document.getElementById('sbcStudioTopUndo')?.addEventListener('click',()=>document.getElementById('sbcStudioUndo')?.click());
    document.getElementById('sbcStudioTopRedo')?.addEventListener('click',()=>document.getElementById('sbcStudioRedo')?.click());
    document.getElementById('sbcStudioTopSave')?.addEventListener('click',()=>{
      const form=document.getElementById('sbcStudioVisualForm');
      if(currentRole()!=='owner'||isApproved(active?.demo))return;
      if(active?.previewMode==='classic'){
        const classic=document.getElementById('sbcInstantSiteEditor');
        if(classic&&!classic.hidden)classic.requestSubmit();
      }else if(form&&form.dataset.ready==='1')form.requestSubmit();
    });
    document.getElementById('sbcStudioTopQA')?.addEventListener('click',()=>{
      const drawer=document.getElementById('sbcFactoryPublishDrawer');
      if(drawer){drawer.open=true;drawer.scrollIntoView({behavior:'smooth',block:'start'});}
    });
    const switchPreview=(mode,page='home')=>{
      const frame=document.getElementById('sbcFactoryFrame');if(!frame)return;
      const smart=mode==='smart'&&smartDraft;
      previewMode=smart?'smart':'classic';
      if(active?.demo?.id===demo.id){active.previewMode=previewMode;active.previewPage=page;}
      const url=smart?(smartUrl+(page==='home'?'':'?page='+encodeURIComponent(page))):pageUrl(demo,page);
      frame.src=url;
      syncStudioPreviewAddress();
      document.getElementById('sbcFactorySmartMode')?.classList.toggle('primary',smart);
      document.getElementById('sbcFactoryClassicMode')?.classList.toggle('primary',!smart);
      const info=document.getElementById('sbcFactoryModeInfo');if(info)info.textContent=smart?'Art-directed design concept. Every proposed service must be verified before customer delivery.':'Classic website pages. Existing owner editing controls apply to this layout.';
      document.querySelectorAll('[data-factory-page]').forEach(b=>b.classList.toggle('primary',b.dataset.factoryPage===page));
    };
    document.getElementById('sbcFactorySmartMode')?.addEventListener('click',()=>switchPreview('smart'));
    document.getElementById('sbcFactoryClassicMode')?.addEventListener('click',()=>switchPreview('classic'));
    document.querySelectorAll('[data-factory-page]').forEach(button=>button.addEventListener('click',()=>{
      const page=button.dataset.factoryPage;const url=pageUrl(demo,page);
      switchPreview(previewMode,page);
    }));
    document.querySelectorAll('[data-factory-device]').forEach(button=>button.addEventListener('click',()=>{
      const selected=button.dataset.factoryDevice;
      const shell=document.querySelector('.v6526-preview-shell');
      if(!shell||!['desktop','tablet','mobile'].includes(selected))return;
      shell.classList.toggle('is-mobile',selected==='mobile');
      shell.style.width=selected==='tablet'?'min(100%, 820px)':selected==='mobile'?'min(100%, 390px)':'100%';
      shell.style.marginInline='auto';
      document.querySelectorAll('[data-factory-device]').forEach(b=>b.classList.toggle('primary',b===button));
    }));
    document.getElementById('sbcInstantSiteEditor')?.addEventListener('submit',saveNativeEditor);
    loadNativeEditor(demo).catch(e=>console.warn('SBC editor load blocked',String(e.message||e)));
    loadStudioProfile(demo).catch(e=>console.warn('SBC Studio load blocked',String(e.message||e)));
    loadStudioVisual(demo).catch(e=>console.warn('SBC Visual Studio load blocked',String(e.message||e)));
    loadHybridAI(demo).catch(e=>console.warn('SBC Hybrid AI status unavailable',String(e.message||e)));
    document.getElementById('sbcStudioAIUpgrade')?.addEventListener('click',upgradeHybridAI);
    document.getElementById('sbcStudioAIProvider')?.addEventListener('change',e=>{e.target.dataset.userSelected='true';});
    document.getElementById('sbcStudioVisualForm')?.addEventListener('submit',saveStudioVisual);
    document.getElementById('sbcStudioVisualForm')?.addEventListener('input',rememberStudioDraft);
    document.getElementById('sbcStudioVisualForm')?.addEventListener('change',rememberStudioDraft);
    document.getElementById('sbcStudioMoveSectionUp')?.addEventListener('click',()=>moveStudioSection(-1));
    document.getElementById('sbcStudioMoveSectionDown')?.addEventListener('click',()=>moveStudioSection(1));
    document.getElementById('sbcStudioUndo')?.addEventListener('click',()=>studioHistoryStep('undo'));
    document.getElementById('sbcStudioRedo')?.addEventListener('click',()=>studioHistoryStep('redo'));
    document.getElementById('sbcStudioRestoreRevision')?.addEventListener('click',restoreStudioRevision);
    document.getElementById('sbcStudioBrowseMedia')?.addEventListener('click',loadStudioMediaIdeas);
    document.getElementById('sbcStudioShuffleVibe')?.addEventListener('click',()=>cycleStudioChoice('vibe',['original','cinematic','minimal','warm']));
    document.getElementById('sbcStudioSwapLayout')?.addEventListener('click',()=>cycleStudioChoice('serviceLayout',['auto','bento','grid','editorial']));
    document.getElementById('sbcStudioTryRemix')?.addEventListener('click',tryStudioRemix);
    document.getElementById('sbcStudioGridNode')?.addEventListener('change',syncStudioGridInspector);
    document.getElementById('sbcStudioGridApply')?.addEventListener('click',()=>{
      if(commitStudioGridInspector())tryStudioRemix();
    });
    document.getElementById('sbcStudioGridReset')?.addEventListener('click',resetStudioGrid);
    document.getElementById('sbcStudioGridEnabled')?.addEventListener('change',()=>{
      if(document.getElementById('sbcStudioGridEnabled')?.checked){
        if(commitStudioGridInspector())tryStudioRemix();
      }else resetStudioGrid();
    });
    document.getElementById('sbcStudioApprovalForm')?.addEventListener('submit',saveStudioProfile);
    document.getElementById('sbcStudioViewPreview')?.addEventListener('click',previewStudioConcept);
    document.getElementById('sbcFactoryApprove')?.addEventListener('click',approve);
    document.getElementById('sbcFactoryBookMeeting')?.addEventListener('click',bookWalkthrough);
    document.getElementById('sbcFactoryCopyLink')?.addEventListener('click',()=>copyText(pageUrl(demo,'home'),'Website link copied.'));
    document.getElementById('sbcFactoryCopyPitch')?.addEventListener('click',()=>copyText(scriptForWebsite(demo,customer),'Sales opening copied.'));
    document.getElementById('sbcFactoryEmail')?.addEventListener('click',()=>send('email'));
    document.getElementById('sbcFactorySms')?.addEventListener('click',()=>send('sms'));
  }
  async function loadHybridAI(demo){
    if(currentRole()!=='owner')return;
    const budget=document.getElementById('sbcStudioAIBudget'),message=document.getElementById('sbcStudioAIStatus'),proposal=document.getElementById('sbcStudioAIProposal');
    if(!budget||!message||!proposal)return;
    try{
      const out=await serviceApi(studioBase(demo)+'/ai');
      if(active?.demo?.id!==demo.id||!budget.isConnected)return;
      if(!out?.ok)throw Error(out?.code||'AI status unavailable.');
      const b=out.budget||{};
      const aiSelect=document.getElementById('sbcStudioAIProvider');
      if(aiSelect&&b.defaultProvider&&['openai','gemini'].includes(b.defaultProvider)&&!aiSelect.dataset.userSelected)aiSelect.value=b.defaultProvider;
      if(aiSelect){aiSelect.dataset.googleAvailable=String(Boolean(b.providers?.gemini?.configured));}
      budget.textContent='Website Studio AI · $'+Number(b.usedUsd||0).toFixed(4)+' used of $40 · $'+Number(b.remainingUsd||0).toFixed(2)+' available this month · '+(b.configured?'Ready':'Disabled / key not configured')+' · Google Gemini: '+(b.providers?.gemini?.configured?'Ready':'Not configured');
      const a=out.ai;
      if(!a){message.textContent=b.configured?'No AI proposal saved for this website yet.':'Existing SBC design remains available without AI.';proposal.textContent='';return}
      message.textContent=a.status==='PROPOSAL_ONLY_APPROVED_SITE'?'AI upgrade is saved as a private proposal. The approved website was NOT modified.':a.status==='ENHANCED_PRIVATE_DRAFT'?'Private AI design is saved. Review its appearance and verify all customer facts.':String(a.status||'Review required');
      if(a.design){const d=a.design;proposal.textContent='Design: '+[d.vibe,d.heroStyle,d.serviceLayout,d.density].filter(Boolean).join(' · ')+'\nSuggested headline (not published): '+String(d.headlineSuggestion||'')+'\nSuggested subheadline (not published): '+String(d.subheadlineSuggestion||'')+'\nCreative direction: '+String(d.rationale||'');}
    }catch(e){if(message)message.textContent='AI status unavailable: '+String(e.message||e)}
  }
  async function upgradeHybridAI(){
    const demo=active?.demo,button=document.getElementById('sbcStudioAIUpgrade'),message=document.getElementById('sbcStudioAIStatus'),providerSelect=document.getElementById('sbcStudioAIProvider');
    if(!demo||currentRole()!=='owner'||!button||busy)return;
    const provider=providerSelect?.value==='gemini'?'gemini':'openai';
    if(provider==='gemini'&&providerSelect?.dataset.googleAvailable!=='true'){if(message)message.textContent='Google Gemini is not configured. Enable the server-side Gemini API key and budget guard before testing.';return;}
    if(!window.confirm('Request a budget-controlled '+(provider==='gemini'?'Google Gemini':'OpenAI')+' design upgrade for this website? Existing approved sites will receive PRIVATE proposals only.'))return;
    busy=true;button.disabled=true;if(message)message.textContent='Requesting AI art direction with Studio budget controls…';
    try{
      const result=await serviceApi(studioBase(demo)+'/ai/upgrade',{method:'POST',body:JSON.stringify({provider})});
      if(active?.demo?.id!==demo.id)return;
      if(!result?.ok)throw Error(result?.status||result?.code||'AI upgrade unavailable');
      await loadHybridAI(demo);
      if(result.status==='ENHANCED_PRIVATE_DRAFT'){
        // Refresh the private design only. NEVER refresh the public approved URL.
        if(active.previewMode==='smart'&&!isApproved(demo)){
          const frame=document.getElementById('sbcFactoryFrame');
          if(frame)frame.src=studioBase(demo)+'/auto-preview?aiRevision='+encodeURIComponent(String(Date.now()));
        }
        await loadStudioVisual(demo);
      }
      updateStatus(result.status==='PROPOSAL_ONLY_APPROVED_SITE'?'Private AI proposal saved. Approved site is unchanged.':'AI-enhanced private design saved. Review before presenting.');
    }catch(e){if(message)message.textContent='AI upgrade not completed: '+String(e.message||e)}
    finally{busy=false;if(button)button.disabled=false}
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
    if(active.businessReview?.requiresHumanReview===true&&!document.getElementById('sbcFactoryReviewAcknowledged')?.checked)
      return updateStatus('Review and acknowledge the flagged business information before presentation approval.',true);
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
  async function openAIProposalDesk(customer){
    if(!customer?.id)return notify('Save this lead as a CRM customer first.');
    if(!window.SBC_AI_SITE_HANDOFF){
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src='/sbc-ai-site-handoff-v1.js?v=20261116-zip-proposals';
        script.onload=resolve;
        script.onerror=()=>reject(Error('AI website handoff UI failed to load. Refresh and retry.'));
        document.head.appendChild(script);
      });
    }
    if(!window.SBC_AI_SITE_HANDOFF?.open)throw Error('AI handoff component unavailable');
    return window.SBC_AI_SITE_HANDOFF.open(customer,{serviceApi,openModal});
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
      '<p>Start with ChatGPT for the complete customer website ZIP and revisions; the native builder remains available as a backup.</p>'+instantSiteBrief(customer)+
      (currentRole()==='owner'?'<section style="margin:15px 0;padding:16px;border-radius:12px;border:1px solid #aacbe4;background:#eff7ff"><h4 style="margin-top:0">AI Website Production</h4><p>Prepare three customer-specific websites: $199, $499 and $799. Save each preview against this account.</p><button class="btn primary" id="sbcAIHandoffLaunch" type="button">Build & revise with ChatGPT</button><p style="font-size:12px">This opens a guided ChatGPT handoff; Direct ChatGPT session control is not connected; the customer-linked ZIP handoff stores finished builds and revisions.</p></section>':'')+
      '<details style="margin:15px 0"><summary style="font-weight:800;cursor:pointer">Legacy Website Studio · backup</summary>'+
      '<label style="display:block;margin:18px 0">Website package <select id="sbcFactoryTier" style="padding:12px;width:100%"><option value="starter"'+(tier==='starter'?' selected':'')+'>Business Starter · $199 · complete one-page website</option><option value="essentials"'+(tier==='essentials'?' selected':'')+'>Business Basic · $499 · four-page website</option></select></label>'+
      '<button class="btn" id="sbcFactoryBuildNow" type="button">Build Full Website · Native Backup</button><p id="sbcWebsiteFactoryStatus" role="status">Legacy builder available as backup.</p></details></div>');
    document.getElementById('sbcAIHandoffLaunch')?.addEventListener('click',()=>openAIProposalDesk(customer).catch(e=>notify(String(e?.message||e))));
    document.getElementById('sbcFactoryBuildNow')?.addEventListener('click',async function(){
      if(busy)return;busy=true;this.disabled=true;
      const offerTier=document.getElementById('sbcFactoryTier')?.value||tier;
      updateStatus('Preparing real, navigable website pages…');
      try{
        const result=await serviceApi('/api/website-demos',{method:'POST',body:JSON.stringify({customerId:customer.id,fast:true,offerTier})});
        if(!result?.demo)throw Error(result?.error||'Website construction failed.');
        showSite(result.demo,customer,result.ai?.status==='ENHANCED_PRIVATE_DRAFT'?'Website built with budget-controlled AI art direction. Review private design and customer facts.':'Website pages generated using SBC engine. AI: '+String(result.ai?.status||'not requested')+'. Check every page before approval.');
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

  window.SBC_WEBSITE_PRODUCTION = Object.freeze({build:buildWebsite,open:buildWebsite,openExisting,ai:async customerId=>{const customer=salesCustomer(customerId);if(customer)return openAIProposalDesk(customer);notify('Customer not found in CRM.');}});
  window.generateWebsiteDemo = buildWebsite; // existing Customer 360 compatibility, no small-demo UI
})();
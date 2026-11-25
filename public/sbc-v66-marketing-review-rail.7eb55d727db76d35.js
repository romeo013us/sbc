/* SBC V66 marketing-review-rail · checked-in scripts retain startup order */
/* BEGIN v33-5-marketing.js */
try {
(function(){
  let marketingCache=null, marketingCacheAt=0, marketingInflight=null;
  async function marketingSummary(force=false){
    const now=Date.now();
    if(!force && marketingCache && now-marketingCacheAt<15000)return marketingCache;
    if(marketingInflight)return marketingInflight;
    marketingInflight=api('/api/kim/v335/marketing/summary',{timeoutMs:7000}).then(x=>{marketingCache=x;marketingCacheAt=Date.now();return x}).finally(()=>{marketingInflight=null});
    return marketingInflight;
  }
  async function marketingView(){
    try{
      const r=await marketingSummary(false);
      const m=r.metrics||{}, c=r.counts||{};
      return `<div class="mkt-wrap">${typeof marketingGrowthPanel==='function'?marketingGrowthPanel():''}
        <div class="mkt-hero"><div><div class="eyebrow">GROWTH ENGINE</div><h2>📣 SBC Marketing Command Center</h2><p>Turn the SBC brand, offers, content, campaigns and customer stories into a measurable growth system.</p></div><div class="mkt-slogan">Because Why Not?</div></div>
        <div class="mkt-grid">
          <div class="mkt-card"><span>🎯</span><strong>${c.campaigns||0}</strong><small>Campaigns</small></div>
          <div class="mkt-card"><span>✍️</span><strong>${c.content||0}</strong><small>Content briefs</small></div>
          <div class="mkt-card"><span>🔗</span><strong>${c.utm||0}</strong><small>Tracked links</small></div>
          <div class="mkt-card"><span>💰</span><strong>$${Number(m.revenue||0).toFixed(0)}</strong><small>Attributed revenue</small></div>
        </div>
        <div class="grid two section"><div class="card"><div class="card-head"><h2>🧠 Kim's Marketing Workflow</h2><span class="badge blue">${r.features} capabilities</span></div><div class="card-body"><div class="mkt-flow"><span>Strategy</span><b>→</b><span>Campaign</span><b>→</b><span>Content</span><b>→</b><span>Distribution</span><b>→</b><span>Attribution</span><b>→</b><span>ROI</span></div><p class="mini">Marketing drafts stay reviewable. Email/SMS require consent, and publish actions can require approval.</p></div></div>
        <div class="card"><div class="card-head"><h2>🚦 Guardrails</h2></div><div class="card-body"><ul class="mkt-list"><li>Human review for campaign publishing</li><li>Consent required for email/SMS</li><li>Owner-controlled brand profile</li><li>UTM + attribution tracking</li><li>Experiment registry before optimization</li></ul></div></div></div>
        <div class="card section"><div class="card-head"><div><h2>⚡ Build the next campaign</h2><div class="mini">Create a focused campaign instead of blasting the entire lead pool.</div></div><button type="button" class="btn primary" data-sbc-marketing-action="campaign">+ New Campaign</button></div><div class="card-body"><div class="mkt-actions"><button type="button" class="btn" data-sbc-marketing-action="content">✍️ Content Brief</button><button type="button" class="btn" data-sbc-marketing-action="landing">🖥 Landing Page Brief</button><button type="button" class="btn" data-sbc-marketing-action="utm">🔗 UTM Link</button><button type="button" class="btn" data-sbc-marketing-action="approval">🔐 Approval Request</button></div></div></div>
      </div>`;
    }catch(e){return `<div class="card section"><div class="card-body"><h2>📣 Marketing</h2><p>${esc(e.message||'Marketing workspace unavailable.')}</p><button class="btn" onclick="marketingCache=null;marketingCacheAt=0;render()">Retry</button></div></div>`;}
  }
  window.marketingView=marketingView;
  if(!window.__sbcMarketingBound){
    window.__sbcMarketingBound=true;
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-sbc-marketing-action]'); if(!b)return;
      e.preventDefault();
      const a=b.dataset.sbcMarketingAction;
      const fn={campaign:window.createMktCampaign,content:window.createMktContent,landing:window.createMktLanding,utm:window.createMktUtm,approval:window.createMktApproval}[a];
      if(typeof fn==='function'){b.disabled=true;Promise.resolve(fn()).finally(()=>{b.disabled=false;});} else toast('Marketing control is still loading. Refresh once and try again.');
    });
  }
  window.createMktCampaign=async function(){const name=prompt('Campaign name:');if(!name)return;try{await api('/api/kim/v335/marketing/campaigns',{method:'POST',body:JSON.stringify({name,objective:'Generate qualified SBC opportunities',audience:'Focused target segment',channels:['email','social','direct']})});toast('Campaign created ✓');render()}catch(e){toast(e.message)}};
  window.createMktContent=async function(){const title=prompt('Content title:');if(!title)return;try{await api('/api/kim/v335/marketing/content',{method:'POST',body:JSON.stringify({title,type:'SOCIAL',channel:'linkedin',brief:'Educational SBC content for a focused small-business audience',cta:'Learn more'})});toast('Content brief created ✓');render()}catch(e){toast(e.message)}};
  window.createMktLanding=async function(){const name=prompt('Landing page name:');if(!name)return;try{await api('/api/kim/v335/marketing/landing-pages',{method:'POST',body:JSON.stringify({name,headline:'Run the business. Don’t just chase the business.',offer:'SBC personalized demo',cta:'Request a demo'})});toast('Landing-page brief created ✓');render()}catch(e){toast(e.message)}};
  window.createMktUtm=async function(){const campaign=prompt('Campaign key:');if(!campaign)return;try{await api('/api/kim/v335/marketing/utm',{method:'POST',body:JSON.stringify({source:'sbc',medium:'campaign',campaign,destination:'https://sbcmia.com'})});toast('UTM created ✓');render()}catch(e){toast(e.message)}};
  window.createMktApproval=async function(){try{await api('/api/kim/v335/marketing/approvals',{method:'POST',body:JSON.stringify({type:'MARKETING_PUBLISH',entityId:'pending-campaign',reason:'Marketing publish review'})});toast('Approval queued ✓');render()}catch(e){toast(e.message)}};
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v33-5-marketing.js", sbcBundleError);
}
/* END v33-5-marketing.js */
;
/* BEGIN v48-9-growth.js */
try {
/* SBC V54.2.1 — Growth Launch controls use delegated listeners so they remain functional after async view renders. */
(function(){
  async function launch(){
    if(!confirm('Build the SBC Growth Launch as DRAFTS only? This will create a campaign, content briefs, landing-page brief, tracked link, referral draft, review-request draft and partner-outreach draft. Nothing will publish or send automatically.')) return;
    try{
      await api('/api/kim/v335/marketing/growth-launch',{method:'POST',body:JSON.stringify({offer:'SBC Big 3 / Complete Business Launch',audience:'Miami-area small businesses and local service businesses'})});
      toast('Growth Launch built ✓ — drafts only');
      render();
    }catch(e){toast(e.message||'Could not build growth launch')}
  }
  window.launchSbcGrowth=launch;
  window.marketingGrowthPanel=function(){return `<div class="card section growth-launch-panel"><div class="card-head"><div><h2>🔥 SBC Growth Launch</h2><div class="mini">Turn “get people talking” into a repeatable acquisition system — without blasting people or publishing without review.</div></div><button type="button" class="btn primary" data-sbc-growth-action="launch">🚀 Build My Growth Launch</button></div><div class="growth-grid"><div><b>📣 Get attention</b><span>Social content briefs, local-search topics and educational posts.</span></div><div><b>🗣️ Get people talking</b><span>Referral requests, customer stories and local partner outreach.</span></div><div><b>📬 Follow up</b><span>Email/SMS drafts with consent and approval guardrails.</span></div><div><b>📊 Know what worked</b><span>UTM links, attribution and campaign ROI tracking.</span></div></div><div class="mini growth-note">Owner approval stays between draft and publish/send. The engine creates the work; it does not silently spend money or contact customers.</div></div>`}
  if(!window.__sbcGrowthBound){
    window.__sbcGrowthBound=true;
    document.addEventListener('click',e=>{
      const b=e.target.closest('[data-sbc-growth-action="launch"]');
      if(b){e.preventDefault();launch();}
    });
  }
})();
} catch (sbcBundleError) {
  console.error("[SBC V66 JS] Legacy controller failed: v48-9-growth.js", sbcBundleError);
}
/* END v48-9-growth.js */

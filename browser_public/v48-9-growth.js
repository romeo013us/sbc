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

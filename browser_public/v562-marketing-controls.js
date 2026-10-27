/* SBC V56.3.0 — Authoritative Marketing Control Surface
 * One click contract for the consolidated Growth/Marketing view.
 * Uses existing authenticated APIs; does not create new engines or secrets.
 */
(function(){
  'use strict';
  const V='56.3.0';
  const endpoints={
    campaign:'/api/v56/growth/toolkit',
    goal:'/api/kim/v335/marketing/goals',
    content:'/api/kim/v335/marketing/content',
    email:'/api/kim/v335/marketing/email',
    sms:'/api/kim/v335/marketing/sms',
    landing:'/api/kim/v335/marketing/landing-pages',
    utm:'/api/kim/v335/marketing/utm',
    approval:'/api/kim/v335/marketing/approvals'
  };
  const defaults={
    campaign:{name:'SBC Growth Play',objective:'Acquire qualified local business customers',audience:'Miami small businesses',offer:'SBC Complete Business Launch',status:'draft'},
    goal:{name:'SBC Revenue Growth Goal',targetRevenue:10000,period:'monthly',status:'active'},
    content:{title:'SBC Small Business Growth Brief',type:'SOCIAL',channel:'linkedin',brief:'Educational SBC content for a focused small-business audience',cta:'Learn more'},
    email:{name:'SBC Qualified Prospect Email',campaignId:'',status:'draft',objective:'Generate qualified SBC sales opportunities'},
    sms:{name:'SBC Qualified Prospect SMS',campaignId:'',status:'draft',objective:'Generate qualified SBC sales opportunities'},
    landing:{name:'SBC Business Launch Landing Page',headline:'Run the business. Don’t just chase the business.',offer:'SBC Complete Business Launch',cta:'Request a demo'},
    utm:{source:'sbc',medium:'campaign',campaign:'sbc-growth-play',destination:'https://sbcmia.com'},
    approval:{type:'MARKETING_PUBLISH',entityId:'pending-campaign',reason:'Marketing publish review'}
  };
  function toast(message){if(typeof window.toast==='function')return window.toast(message);const t=document.getElementById('toast');if(t){t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}}
  async function request(type){
    const endpoint=endpoints[type];
    if(!endpoint)return;
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(defaults[type])});
    let body={};try{body=await response.json();}catch{}
    if(!response.ok)throw new Error(body.error||(response.status===403?'Access denied for this workspace role.':`Marketing action failed (${response.status}).`));
    return body;
  }
  function refresh(){if(window.state?.view==='marketing'&&typeof window.render==='function')window.render();}
  async function run(type){
    const button=document.querySelector(`[data-growth="${type}"], [data-sbc-marketing-action="${type}"]`);
    if(button)button.disabled=true;
    try{
      const result=await request(type);
      if(type==='campaign' && result?.data){
        window.SBCV563GrowthKit=result.data;
        if(typeof window.SBCV563?.showCampaignPreview==='function') window.SBCV563.showCampaignPreview(result.data);
        else toast('✓ Smart campaign kit built. Review before deployment.');
      }else{
        const labels={goal:'Revenue goal created.',content:'Content brief created.',email:'Email sequence draft created.',sms:'SMS follow-up draft created.',landing:'Landing page brief created.',utm:'UTM link created.',approval:'Approval request queued.'};
        toast(`✓ ${labels[type]||'Marketing action completed.'}`);
        refresh();
      }
    }catch(error){toast(`Marketing: ${error.message||error}`);}finally{if(button)button.disabled=false;}
  }
  function openKim(button){
    const prompt=button?.dataset?.kimPrompt||'Review SBC marketing and tell me the next three moves most likely to increase revenue.';
    if(typeof window.sbcFlowOpenKim==='function')window.sbcFlowOpenKim(prompt);
    else if(typeof window.openSbcAI==='function')window.openSbcAI();
    else toast('Kim is still loading. Try again in a moment.');
  }
  function handle(e){
    const growth=e.target.closest?.('[data-growth]');
    if(growth){e.preventDefault();e.stopPropagation();const type=growth.dataset.growth;if(endpoints[type])run(type);return;}
    const legacy=e.target.closest?.('[data-sbc-marketing-action]');
    if(legacy){e.preventDefault();e.stopPropagation();const type=legacy.dataset.sbcMarketingAction;if(endpoints[type])run(type);return;}
    const kim=e.target.closest?.('[data-kim-prompt]');
    if(kim && (document.body.classList.contains('v56-flow-mode')||document.querySelector('.v56-shell'))){e.preventDefault();e.stopPropagation();openKim(kim);}
  }
  document.addEventListener('click',handle,true);
  window.SBCV562Marketing={version:V,run,refresh};
})();

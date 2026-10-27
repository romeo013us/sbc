/* SBC V56.13.2 — Universal Button / Navigation Safety Net
   Purpose: guarantee that navigation-bearing controls always reach a known endpoint.
   This is intentionally additive. It does not bypass server authorization or owner gates.
*/
(function(){
  'use strict';
  const ROUTES=new Set([
    'dashboard','crm','marketing','orders','workforce','kimcenter','signature','settings',
    'customers','quotes','communications','calendar','tasks','acquisition','training','timeclock','users',
    'leadresearch','leadimport','payments','renewals','followups','catalog','reports','presentation',
    'callcenter','missioncontrol','fantastic4','portal','kimops','v325control','ai','operations',
    'nextoperations','edgesuite','architecture','gateways','v340','v350','notary','kim380','kim391','kim400',
    'kim360','kim370','kim410','production-control','kim420','kimdeep','kimfortress','kimgodtier','v47','salesorder',
    'leadworkbench','salesworkbench','info','supernova','monetization','payroll','metrics','onboarding','leadverification'
  ]);
  const route=v=>{
    let view=String(v||'').trim();
    if(!view)return false;
    if((view==='production-control'||view==='supernova') && typeof window.sbcCriticalSurfaceGuardian?.setView==='function'){
      return window.sbcCriticalSurfaceGuardian.setView(view);
    }
    if(typeof window.sbcNavigate==='function'){window.sbcNavigate(view);return true;}
    if(window.state){window.state.view=view;(window.sbcPrimaryRender||window.render)?.();return true;}
    return false;
  };
  function handle(e){
    const raw=e.target?.closest?.('[data-view],[data-v5610-nav],[data-v23nav],[data-v56-action],[data-palette-action]');
    if(!raw)return;
    if(raw.disabled)return;
    if(raw.dataset.view){
      const view=raw.dataset.view;
      if(ROUTES.has(view)){e.preventDefault();e.stopPropagation();route(view);return;}
    }
    if(raw.dataset.v5610Nav){e.preventDefault();e.stopPropagation();route(raw.dataset.v5610Nav);return;}
    if(raw.dataset.v23nav){
      e.preventDefault();e.stopPropagation();
      if(typeof window.sbcV23View==='function')window.sbcV23View(raw.dataset.v23nav);
      else route('v23-'+raw.dataset.v23nav);
      return;
    }
    if(raw.dataset.v56Action){
      e.preventDefault();e.stopPropagation();
      const a=raw.dataset.v56Action;
      if(typeof window.sbcFlowAction==='function'){window.sbcFlowAction(a,raw);return;}
      const map={sales:'salesworkbench',lorna:'leadimport',leadimport:'leadimport',growth:'marketing',delivery:'orders',communications:'communications',reports:'reports',system:'fantastic4',admin:'settings'};
      if(a==='kim'||a==='kimPrompt'){window.openSbcAI?.(raw.dataset.v56Prompt||'Give me the next three useful actions for SBC.');return;}
      if(map[a])route(map[a]);
      return;
    }
    if(raw.dataset.paletteAction){
      e.preventDefault();e.stopPropagation();
      const a=raw.dataset.paletteAction;
      const map={sales:'salesworkbench',lorna:'leadimport',growth:'marketing',delivery:'orders',reports:'reports',admin:'settings'};
      if(a==='kim'){window.openSbcAI?.();return;}
      if(map[a])route(map[a]);
    }
  }
  document.addEventListener('click',handle,true);
  document.addEventListener('pointerup',e=>{
    const b=e.target?.closest?.('[data-view],[data-v5610-nav],[data-v23nav],[data-v56-action],[data-palette-action]');
    if(b && e.button===0 && !b.disabled) b.dataset.sbcBridgeSeen='1';
  },true);
  // Keep the hidden Kim surface from ever becoming a transparent click-blocking layer.
  function protectHiddenKim(){
    const d=document.getElementById('sbcAiDock');
    if(d?.classList.contains('hidden'))d.style.setProperty('pointer-events','none','important');
    else if(d)d.style.removeProperty('pointer-events');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',protectHiddenKim,{once:true});else protectHiddenKim();
  new MutationObserver(protectHiddenKim).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class','style']});
  window.SBCUniversalButtonRouter={version:'56.13.2',route,protectHiddenKim};
})();

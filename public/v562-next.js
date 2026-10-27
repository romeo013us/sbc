/* SBC V56.2 Next Experience Layer — additive, no page reloads required. */
(function(){
  'use strict';
  const views={home:()=>window.V56Templates?.homeContent?.(),sales:()=>window.V56Templates?.salesContentRails?.(),growth:()=>window.V56Templates?.growthEngineSuite?.(),delivery:()=>window.V56Templates?.deliveryFulfillmentCenter?.(),reports:()=>window.V56Templates?.reportsContent?.()};
  function shell(){return document.getElementById('sbc-viewport')||document.getElementById('content');}
  function loadView(key){const target=shell();const fn=views[String(key||'')];if(!target||!fn)return false;const html=fn();if(typeof html!=='string')return false;target.innerHTML=html;document.dispatchEvent(new CustomEvent('sbc:view-mounted',{detail:{view:key}}));return true;}
  async function optimisticRailTransition(cardId,destinationRailState){
    const card=document.querySelector(`[data-lead-id="${CSS.escape(String(cardId))}"]`);
    const target=document.querySelector(`[data-rail-state="${CSS.escape(String(destinationRailState))}"]`);
    if(!card||!target)return {ok:false,error:'Lead card or destination rail not found.'};
    const parent=card.parentNode,next=card.nextSibling;target.appendChild(card);
    try{
      const response=await fetch('/api/crm/leads/transition-pipeline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:String(cardId),target_state:String(destinationRailState)})});
      if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Pipeline state commit rejected.');
      return {ok:true,...await response.json()};
    }catch(error){if(next&&next.parentNode===parent)parent.insertBefore(card,next);else parent.appendChild(card);return {ok:false,error:error.message};}
  }
  window.SBCV562Shell={version:'56.2.0',views:Object.keys(views),loadView,optimisticRailTransition};
  window.addEventListener('DOMContentLoaded',()=>{document.body.dataset.sbcShellVersion='56.2.0';});
})();

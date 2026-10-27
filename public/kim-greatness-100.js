// V45.3.9: Floating orange Ask Kim launcher disabled. Use the authenticated SBC AI dock/in-page help instead.
(function(){
  function removeLegacyKimFab(){
    const el=document.getElementById('kimGreatnessFab');
    if(el) el.remove();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',removeLegacyKimFab,{once:true});
  else removeLegacyKimFab();
})();

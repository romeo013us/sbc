(function(){
'use strict';
/* SBC_V6667_PRIVATE_OWNER_CSV_IMPORT: launcher-free authenticated owner import page */
function begin(){
  const warning=document.getElementById('sbc-import-page-status');
  const launcher=document.getElementById('sbc-lead-import-launcher');
  const overlay=document.getElementById('sbc-lead-import-overlay');
  if(!launcher||!overlay){
    if(warning)warning.textContent='The lead importer did not load. No records were changed. Return to SBC and check the deployed release.';
    return;
  }
  launcher.style.display='none';
  launcher.setAttribute('aria-hidden','true');
  launcher.click();
  if(warning)warning.textContent='Owner-only CSV upload ready. Select your local CSV, preview duplicates and approve any import. No leads are bundled or imported automatically.';
  for(const id of ['sbc-lead-import-close','sbc-lead-import-x']){
    const b=document.getElementById(id);
    if(b)b.addEventListener('click',()=>{window.location.assign('/');});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});
else begin();
})();

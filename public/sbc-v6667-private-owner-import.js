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
  if(warning)warning.textContent='Owner import screen loaded. You can choose a CSV or load the verified 31-lead batch for review. No import runs automatically.';
  // One owner-only convenience action: load release CSV into the existing preview/import flow.
  const actions=document.getElementById('sbc-lead-import-actions');
  if(actions && !document.getElementById('sbc-packaged-leads-load')){
    const load=document.createElement('button');
    load.id='sbc-packaged-leads-load';load.type='button';
    load.textContent='Load Oct 26–27 batch (31 leads)';
    actions.prepend(load);
    load.addEventListener('click',async()=>{
      if(load.disabled)return;load.disabled=true;
      const oldLabel=load.textContent;load.textContent='Checking packaged batch…';
      try{
        const response=await fetch('/api/owner/lead-import/packaged-batch',{
          credentials:'same-origin',redirect:'manual',cache:'no-store',
          headers:{'Accept':'text/csv','Cache-Control':'no-store'}
        });
        if(!response.ok||response.redirected||response.type==='opaqueredirect')throw new Error('Cannot retrieve owner-only 31-lead batch (HTTP '+response.status+'). Check owner sign-in and the published release.');
        const csv=await response.text();
        if(typeof window.sbcOwnerLoadPackagedLeadCsv!=='function')throw new Error('Owner importer is not ready. No records were written.');
        const result=window.sbcOwnerLoadPackagedLeadCsv(csv);
        if(!result||result.total!==31)throw new Error('Packaged CSV failed its 31-lead validation. No records were written.');
        load.textContent='31 leads ready — Preview import next';
        return;
      }catch(e){
        if(warning)warning.textContent=String(e.message||e)+' No records were written.';
      }finally{load.disabled=false;if(load.textContent==='Checking packaged batch…')load.textContent=oldLabel;}
    });
  }
  for(const id of ['sbc-lead-import-close','sbc-lead-import-x']){
    const b=document.getElementById(id);
    if(b)b.addEventListener('click',()=>{window.location.assign('/');});
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});
else begin();
})();

/* SBC AI Website Production · private, customer-linked ZIP proposal desk. */
(function(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const TIERS=[{id:199,title:'Starter · One Page',description:'A polished single-page experience'},{id:499,title:'Custom · Multi-page',description:'Richer pages and content'},{id:799,title:'Advanced · Proposal',description:'Working interactive concept only'}];
 const LIMIT=20*1024*1024;
 async function open(customer,{serviceApi,openModal}){
  if(!customer?.id||typeof serviceApi!=='function'||typeof openModal!=='function')throw Error('AI website handoff unavailable');
  const base='/api/website-production/customers/'+encodeURIComponent(customer.id)+'/ai-proposals';
  openModal('AI Website Production','<div style="padding:20px" role="status">Loading website proposals for this account…</div>');
  let result;
  try{result=await serviceApi(base);if(!result?.ok)throw Error(result?.code||'Not available')}
  catch(e){openModal('AI Website Production','<p role="alert">Proposal desk unavailable: '+esc(e?.message||'Unknown error')+'</p>');return}
  let revision=Number(result.revision)||0;
  const cards=TIERS.map(t=>{
   const saved=result.variants?.[String(t.id)]||{};
   return '<section class="sbc-ai-tier" aria-labelledby="sbcAiTitle'+t.id+'">'+
    '<p class="sbc-ai-tier-kicker">SBC $'+t.id+'</p><h4 id="sbcAiTitle'+t.id+'">'+esc(t.title)+'</h4>'+
    '<p class="sbc-ai-tier-desc">'+esc(t.description)+'</p>'+
    '<label class="sbc-ai-upload-label" for="sbcAIFile'+t.id+'">Website ZIP file</label>'+
    '<input id="sbcAIFile'+t.id+'" data-sbc-ai-file="'+t.id+'" type="file" accept=".zip,application/zip" aria-describedby="sbcAIFileHelp'+t.id+'">'+
    '<small id="sbcAIFileHelp'+t.id+'">Upload the full website ZIP, up to 20 MB. Files are saved only to this customer account.</small>'+
    '<button type="button" class="btn primary sbc-ai-upload" data-sbc-ai-upload="'+t.id+'">Upload &amp; save proposal</button>'+
    '<div class="sbc-ai-current" id="sbcAICurrent'+t.id+'" aria-live="polite">Checking saved uploads…</div>'+
    '<details class="sbc-ai-other"><summary>Optional: use a separately hosted HTTPS preview</summary>'+
    '<label for="sbcAIUrl'+t.id+'">External preview URL</label>'+
    '<input type="url" id="sbcAIUrl'+t.id+'" value="'+esc(saved.previewUrl||'')+'" placeholder="https://example.com">'+
    '<label for="sbcAINotes'+t.id+'">Proposal notes</label><textarea id="sbcAINotes'+t.id+'" rows="2" maxlength="500">'+esc(saved.notes||'')+'</textarea>'+
    '<button type="button" class="btn" data-sbc-ai-save="'+t.id+'">Save external URL / notes</button></details>'+
    '<p class="sbc-ai-draft">Private draft · owner review required before sharing with the customer.</p></section>';
  }).join('');
  const html='<div class="sbc-ai-desk" id="sbcAiDesk">'+
   '<div class="sbc-ai-heading"><p class="sbc-ai-eyebrow">SBC WEBSITE PRODUCTION</p><h3>Three website proposals for '+esc(customer.businessName||'this customer')+'</h3>'+
   '<p><strong>New, simpler workflow:</strong> Build in ChatGPT → download a website ZIP → upload it directly to its package card → review the saved preview. No external hosting or manual URL entry required.</p></div>'+
   '<section class="sbc-ai-instructions"><button type="button" id="sbcAICopy" class="btn primary">Copy 3-site build instructions</button> '+
   '<a class="btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT ↗</a>'+
   '<details><summary>See / edit customer-approved website brief</summary><textarea id="sbcAIBrief" rows="13">'+esc(result.prompt||'')+'</textarea></details>'+
   '<small>No ChatGPT account access, customer outreach, website publication, or purchase occurs automatically.</small></section>'+
   '<div class="sbc-ai-grid">'+cards+'</div>'+
   '<p id="sbcAIState" class="sbc-ai-state" role="status" aria-live="polite">Loading saved proposal files…</p>'+
   '<section class="sbc-ai-preview"><div class="sbc-ai-preview-head"><h4>Owner review preview</h4><p>The website runs in a restricted preview frame. Forms cannot send submissions from this preview.</p></div>'+
   '<iframe id="sbcAIFrame" title="Owner-only website proposal preview" sandbox="allow-scripts" referrerpolicy="no-referrer" src="about:blank"></iframe></section></div>';
  openModal('SBC AI Website Production',html);
  let items=[];
  const say=(message,error=false)=>{const e=document.getElementById('sbcAIState');if(e){e.textContent=message;e.classList.toggle('sbc-ai-error',error)}};
  const frame=document.getElementById('sbcAIFrame');
  function preview(url,tier){
   if(!url)return say('Upload a ZIP or save a hosted HTTPS URL to preview this package.',true);
   try{
    const u=new URL(url,window.location.href);
    if(u.origin!==window.location.origin&&u.protocol!=='https:')throw Error('Invalid preview link');
    frame.src=u.href;
    say('Showing the $'+tier+' proposal. Preview content is isolated from your account session.');
   }catch(e){say(String(e.message||e),true)}
  }
  function render(){
   for(const t of TIERS){
    const host=document.getElementById('sbcAICurrent'+t.id);if(!host)continue;
    const list=items.filter(x=>Number(x.tier)===t.id),latest=list[0],external=document.getElementById('sbcAIUrl'+t.id)?.value.trim();
    if(!latest&&!external){host.innerHTML='<p class="sbc-ai-empty">No ZIP saved for this package yet.</p>';continue}
    const qa=latest?.previewAudit;
    const problemCount=Number(qa?.issueCount||0);
    const qaText=!qa?'Older ZIP: automatic preview-link checks not recorded.':problemCount?
     'Preview needs attention: '+problemCount+' broken or blocked reference'+(problemCount===1?'':'s')+'.':
     'Preview HTML links checked: no missing linked files detected. Manual review still required.';
    const friendly={MISSING_ASSET:'Missing image, stylesheet or script',MISSING_PAGE:'Missing linked page',
     ROOT_ABSOLUTE_PATH:'Root-relative path may not work in private preview',
     EXTERNAL_RESOURCE_BLOCKED:'Off-site resource blocked by private preview',
     BASE_HREF_BLOCKED:'HTML base path not supported in private preview',
     PATH_OUTSIDE_SITE:'Link escapes uploaded website',INVALID_REFERENCE:'Invalid file reference',MISSING_PAGE_HTML:'No HTML pages found'};
    const details=Array.isArray(qa?.issues)&&qa.issues.length?
     '<details class="sbc-ai-preview-audit"><summary>See preview problems ('+problemCount+')</summary><ul>'+
     qa.issues.map(i=>'<li><strong>'+esc(friendly[i.code]||i.code)+'</strong> · '+esc(i.page)+': '+esc(i.reference)+'</li>').join('')+
     '</ul><small>These are static link checks, not a published website test. Review before presenting.</small></details>':'';
    host.innerHTML=(latest?
      '<p class="sbc-ai-saved">✓ ZIP saved to this customer</p>'+
      '<p class="sbc-ai-meta">'+Number(latest.fileCount||0)+' web files · '+new Date(latest.createdAt).toLocaleString()+' · Owner review</p>'+
      '<p class="sbc-ai-meta" role="status">'+esc(qaText)+'</p>'+details+
      '<div class="sbc-ai-actions"><button type="button" class="btn" data-sbc-ai-preview="'+esc(latest.previewPath)+'" data-tier="'+t.id+'">Preview saved ZIP</button>'+
      '<a class="btn" href="'+esc(latest.downloadPath)+'" download>Download copy</a>'+
      '<a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(latest.previewPath)+'">Open preview ↗</a></div>'+
      (list.length>1?'<details><summary>Earlier versions ('+(list.length-1)+')</summary>'+
        list.slice(1).map((x,i)=>'<p><button class="btn" type="button" data-sbc-ai-preview="'+esc(x.previewPath)+'" data-tier="'+t.id+'">Preview version '+(list.length-1-i)+'</button></p>').join('')+'</details>':'')
     :'<p class="sbc-ai-meta">External preview saved · no ZIP uploaded</p>'+
      '<button class="btn" data-sbc-ai-external="'+t.id+'" type="button">Preview external URL</button>');
   }
   document.querySelectorAll('[data-sbc-ai-preview]').forEach(b=>b.addEventListener('click',()=>preview(b.dataset.sbcAiPreview,Number(b.dataset.tier))));
   document.querySelectorAll('[data-sbc-ai-external]').forEach(b=>b.addEventListener('click',()=>preview(document.getElementById('sbcAIUrl'+b.dataset.sbcAiExternal)?.value,Number(b.dataset.sbcAiExternal))));
  }
  async function refresh(){
   const res=await serviceApi(base+'/uploads');
   if(!res?.ok||!Array.isArray(res.uploads))throw Error(res?.code||'UPLOAD_LIBRARY_UNAVAILABLE');
   items=res.uploads;render();
  }
  document.getElementById('sbcAICopy')?.addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(document.getElementById('sbcAIBrief').value);say('Instructions copied. Paste them into ChatGPT.')}
   catch{say('Clipboard unavailable. Select and copy the expanded brief manually.',true)}
  });
  document.querySelectorAll('[data-sbc-ai-upload]').forEach(button=>button.addEventListener('click',async()=>{
   const tier=Number(button.dataset.sbcAiUpload),file=document.getElementById('sbcAIFile'+tier)?.files?.[0];
   if(!file)return say('Choose the website ZIP for $'+tier+' first.',true);
   if(!/\.zip$/i.test(file.name)||file.size<22||file.size>LIMIT)return say('Choose a valid ZIP no larger than 20 MB.',true);
   button.disabled=true;say('Uploading and validating the $'+tier+' website ZIP…');
   try{
    const response=await fetch(base+'/uploads/'+tier,{method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/zip','X-SBC-Proposal-Upload':'1','Accept':'application/json'},body:file});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.ok!==true||result.durable!==true)throw Error(result.code||'Upload was not saved');
    await refresh();
    preview(result.upload.previewPath,tier);
    say('$'+tier+' ZIP saved to '+String(customer.businessName||'this customer')+'. Review the preview before sharing.');
   }catch(e){say('Upload unsuccessful: '+String(e.message||e)+'. Your other proposals were not changed.',true)}
   finally{button.disabled=false}
  }));
  document.querySelectorAll('[data-sbc-ai-save]').forEach(button=>button.addEventListener('click',async()=>{
   const tier=Number(button.dataset.sbcAiSave),previewUrl=document.getElementById('sbcAIUrl'+tier)?.value.trim()||'',notes=document.getElementById('sbcAINotes'+tier)?.value||'';
   button.disabled=true;
   try{
    const res=await serviceApi(base,{method:'PATCH',body:JSON.stringify({tier,previewUrl,notes,expectedRevision:revision})});
    if(!res?.ok)throw Error(res?.code||'Save failed');
    revision=Number(res.revision);render();say('$'+tier+' notes / external preview saved to customer account.');
   }catch(e){say('Could not save: '+String(e.message||e)+'. Refresh if the account revision changed.',true)}
   finally{button.disabled=false}
  }));
  try{await refresh();say('Ready. Upload a ZIP and review the automatic link checks before approving the proposal.')}
  catch(e){say('ZIP library unavailable: '+String(e.message||e)+'. External URL slots remain available.',true)}
 }
 window.SBC_AI_SITE_HANDOFF=Object.freeze({open});
})();
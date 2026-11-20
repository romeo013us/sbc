/* SBC AI Website Production · private, customer-linked ZIP proposal desk. */
(function(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const TIERS=[{id:199,title:'Starter · One Page',description:'A polished single-page experience'},{id:499,title:'Custom · Multi-page',description:'Richer pages and content'},{id:799,title:'Advanced · Proposal',description:'Working interactive concept only'},{id:999,title:'Growth · Multi-page',description:'Premium growth-oriented site · verified functionality only'}];
 const LIMIT=20*1024*1024;
 const isOwner=()=>typeof state!=='undefined'&&state.me?.role==='owner';
 async function open(customer,{serviceApi,openModal}){
  if(!customer?.id||typeof serviceApi!=='function'||typeof openModal!=='function')throw Error('AI website handoff unavailable');
  const base='/api/website-production/customers/'+encodeURIComponent(customer.id)+'/ai-proposals';
  openModal('AI Website Production','<div style="padding:20px" role="status">Loading website proposals for this account…</div>');
  let result;
  try{result=await serviceApi(base);if(!result?.ok)throw Error(result?.code||'Not available')}
  catch(e){openModal('AI Website Production','<p role="alert">Proposal desk unavailable: '+esc(e?.message||'Unknown error')+'</p>');return}
  const ownerAuthorized=result.canRelease===true||(result.canRelease==null&&isOwner());
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
   '<div class="sbc-ai-heading"><p class="sbc-ai-eyebrow">SBC WEBSITE PRODUCTION</p><h3>Website for '+esc(customer.businessName||'this customer')+'</h3>'+
   '<p><strong>ChatGPT builds the website.</strong> You choose a package and review the result. No code writing, outside hosting, or URL entry required.</p></div>'+
   '<section class="sbc-ai-instructions" aria-label="Build a customer website">'+
   '<h4>1 · Choose the website package</h4>'+
   '<label for="sbcAIQuickTier">Website package</label>'+
   '<select id="sbcAIQuickTier" style="display:block;width:100%;max-width:420px;min-height:46px;padding:10px;border:1px solid #849fb7;border-radius:9px;background:#fff;color:#14283e;margin:8px 0 16px">'+
   TIERS.map(t=>'<option value="'+t.id+'">$'+t.id+' · '+esc(t.title)+'</option>').join('')+'</select>'+
   '<h4>2 · Let ChatGPT build the website</h4>'+
   '<p>I build the complete site and give you its downloadable ZIP here in ChatGPT. Just copy the request for your package and paste it into ChatGPT.</p>'+
   '<button type="button" id="sbcAICopy" class="btn primary">Copy website build request</button> '+
   '<a class="btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT ↗</a>'+
   '<h4>3 · Upload and preview the finished ZIP</h4>'+
   '<label for="sbcAIQuickFile">Finished website ZIP</label>'+
   '<input id="sbcAIQuickFile" type="file" accept=".zip,application/zip" aria-describedby="sbcAIQuickHelp">'+
   '<small id="sbcAIQuickHelp">Maximum 20 MB. Earlier saved versions stay with this customer account.</small>'+
   '<button type="button" id="sbcAIQuickUpload" class="btn primary sbc-ai-upload">Upload ZIP and preview</button>'+
   '<div id="sbcAIQuickCurrent" class="sbc-ai-current" aria-live="polite">Checking saved websites…</div>'+
   '<div id="sbcAIBackup" class="sbc-ai-current" aria-live="polite">Checking available customer backups…</div>'+
   '<small>No direct access to ChatGPT sessions, automatic customer messages, or publishing. You control approval.</small></section>'+
   '<details id="sbcAIAdvanced" class="sbc-ai-other"><summary>Advanced options · all packages, saved versions and hosted links</summary>'+
   '<details><summary>Original four-site brief</summary><textarea id="sbcAIBrief" rows="13">'+esc(result.prompt||'')+'</textarea></details>'+
   '<div class="sbc-ai-grid">'+cards+'</div></details>'+
   '<p id="sbcAIState" class="sbc-ai-state" role="status" aria-live="polite">Loading saved proposal files…</p>'+
   '<section class="sbc-ai-live-text-editor" aria-label="Edit website text without coding">'+
   '<h4>✏️ Quick Text Editor · edit your saved website</h4>'+
   '<p>Choose a visible heading or sentence, type its replacement and save. You get a new previewable ZIP version; the original never changes.</p>'+
   '<button type="button" id="sbcAILoadText" class="btn">Load editable website text</button>'+
   '<label for="sbcAITextField">Text to change</label>'+
   '<select id="sbcAITextField" disabled><option value="">Load a saved website first</option></select>'+
   '<label for="sbcAINewText">New wording</label>'+
   '<textarea id="sbcAINewText" rows="2" maxlength="240" disabled placeholder="Select a heading or sentence above."></textarea>'+
   '<div class="sbc-ai-actions"><button id="sbcAISaveText" class="btn primary" type="button" disabled>Save text as new website version</button></div>'+
   '<small id="sbcAITextHelp">Only plain visible text is editable here—no HTML, colors, scripts or contact functionality. Use the ChatGPT revision request below for design changes.</small></section>'+
   '<section class="sbc-ai-image-editor" aria-label="Replace customer website images without code">'+
   '<h4>🖼️ Quick Image Replace · no coding needed</h4>'+
   '<p>Choose an existing site image, upload a photo or logo in the same format, then save. Your original website stays in version history.</p>'+
   '<button type="button" id="sbcAILoadImages" class="btn">Load website images</button>'+
   '<label for="sbcAIImageField">Image to replace</label>'+
   '<select id="sbcAIImageField" disabled><option value="">Load website images first</option></select>'+
   '<img id="sbcAIImageCurrent" hidden alt="Existing website image selected for replacement" loading="lazy">'+
   '<label for="sbcAIReplacementImage">Choose replacement image</label>'+
   '<input type="file" id="sbcAIReplacementImage" accept="image/png,image/jpeg,image/webp" disabled>'+
   '<button id="sbcAISaveImage" type="button" class="btn primary" disabled>Save replacement as new website version</button>'+
   '<small>PNG, JPG/JPEG and WebP only; maximum 4 MB. Your file must match the original image format. SVG and executable uploads are not allowed.</small></section>'+
   '<section class="sbc-ai-edit-panel" aria-label="Request website edits without coding">'+
   '<h4>✏️ Request changes without editing code</h4>'+
   '<label for="sbcAIRevisionNotes">What would you like to change?</label>'+
   '<textarea id="sbcAIRevisionNotes" rows="3" maxlength="1800" placeholder="Example: Make the headline bolder, move the phone button higher, and update only verified services."></textarea>'+
   '<button id="sbcAIRevisionCopy" type="button" class="btn">Copy revision request for ChatGPT</button>'+
   '<small>Attach the saved ZIP to ChatGPT with this request; upload the improved ZIP as a new version. The original stays saved.</small></section>'+
   '<section class="sbc-ai-preview"><div class="sbc-ai-preview-head"><h4>Website preview</h4><p>Choose a device to inspect the actual website. This is a sandbox: forms and outbound requests are disabled.</p></div>'+
   '<div class="sbc-ai-device-toolbar" role="group" aria-label="Preview screen size">'+
   '<button type="button" class="btn" data-sbc-ai-device="desktop" aria-pressed="true">Desktop · full width</button>'+
   '<button type="button" class="btn" data-sbc-ai-device="tablet" aria-pressed="false">Tablet · 768px</button>'+
   '<button type="button" class="btn" data-sbc-ai-device="mobile" aria-pressed="false">Mobile · 390px</button></div>'+
   '<div id="sbcAIFrameStage" class="sbc-ai-device-stage" data-device="desktop">'+
   '<iframe id="sbcAIFrame" title="Private website proposal preview" sandbox="allow-scripts" referrerpolicy="no-referrer" src="about:blank"></iframe></div>'+
   '<section class="sbc-ai-release-review" aria-label="Customer site delivery quality check">'+
   '<h4>Final quality and publishing handoff</h4>'+
   '<button type="button" id="sbcAIRunQA" class="btn">Run quality check on saved ZIP</button>'+ 
   '<p id="sbcAIQAStatus" class="sbc-ai-meta" role="status">Select a saved website for review.</p>'+
   '<label><input type="checkbox" data-sbc-ai-release-check>Business details, services and claims verified with the owner</label>'+
   '<label><input type="checkbox" data-sbc-ai-release-check>Desktop, tablet and mobile preview checked</label>'+
   '<label><input type="checkbox" data-sbc-ai-release-check>All navigation, links and interactive features manually tested</label>'+
   '<label><input type="checkbox" data-sbc-ai-release-check>Owner approved this version and arranged a separate backup</label>'+
   '<button id="sbcAIPreparePublish" type="button" class="btn primary" disabled>Prepare publishing ZIP</button>'+
   '<small>This safely downloads the selected ZIP for a separate hosting deployment. It does NOT publish to GoDaddy, approve payment or contact the customer.</small>'+
   '</section></section></div>';
  openModal('SBC AI Website Production',html);
  if(!ownerAuthorized){
   const release=document.getElementById('sbcAiDesk')?.querySelector?.('.sbc-ai-release-review');
   if(release){release.querySelector('#sbcAIPreparePublish')?.remove();release.querySelectorAll('[data-sbc-ai-release-check]').forEach(x=>x.closest('label')?.remove());}
   const backup=document.getElementById('sbcAIBackup');if(backup)backup.textContent='Private proposal versions are retained in SBC. Final release and recovery exports require the owner.';
  }
  let items=[];
  const say=(message,error=false)=>{const e=document.getElementById('sbcAIState');if(e){e.textContent=message;e.classList.toggle('sbc-ai-error',error)}};
  const frame=document.getElementById('sbcAIFrame');
  const currentTier=()=>Number(document.getElementById('sbcAIQuickTier')?.value||199);
  const currentVersion=()=>items.find(x=>Number(x.tier)===currentTier()&&x.active===true)||
    items.find(x=>Number(x.tier)===currentTier())||null;
  let textEditingVersion=null,textEditingFields=[];
  const resetTextEditor=()=>{
   textEditingVersion=null;textEditingFields=[];
   const field=document.getElementById('sbcAITextField'),newText=document.getElementById('sbcAINewText');
   if(field){field.innerHTML='<option value="">Load editable website text first</option>';field.disabled=true;field.value=''}
   if(newText){newText.value='';newText.disabled=true}
   const save=document.getElementById('sbcAISaveText');if(save)save.disabled=true;
  };
  function textFieldSelected(){
   const id=String(document.getElementById('sbcAITextField')?.value||'');
   return textEditingFields.find(f=>f.id===id)||null;
  }
  function textEditCanSave(){
   const row=textFieldSelected(),text=String(document.getElementById('sbcAINewText')?.value||'').trim();
   return Boolean(row&&currentVersion()?.id===textEditingVersion&&text.length>0&&text.length<=240&&
    text!==String(row.text||'').trim()&&!/[\x00-\x1f\x7f]/.test(text));
  }
  document.getElementById('sbcAILoadText')?.addEventListener('click',async()=>{
   const active=currentVersion();
   if(!active)return say('Save a customer website ZIP first.',true);
   const button=document.getElementById('sbcAILoadText');
   if(button.disabled)return;
   button.disabled=true;
   try{
    const response=await serviceApi(base+'/uploads/'+active.id+'/text-fields');
    if(response?.ok!==true||response.readOnly!==true||response.current!==true||
       response.versionId!==active.id||!Array.isArray(response.fields))
     throw Error(response?.code||'Text editor unavailable');
    resetTextEditor();
    textEditingVersion=active.id;
    textEditingFields=response.fields.filter(f=>/^[a-f0-9]{32}$/.test(String(f.id))&&
      typeof f.text==='string'&&typeof f.page==='string').slice(0,100);
    const select=document.getElementById('sbcAITextField');
    if(select){
     select.innerHTML='<option value="">Choose the text you want to edit</option>'+
      textEditingFields.map(f=>'<option value="'+esc(f.id)+'">'+esc(f.page+' · '+f.tag.toUpperCase()+' · '+f.text.slice(0,90))+'</option>').join('');
     select.disabled=textEditingFields.length===0;
    }
    say(textEditingFields.length+' editable text pieces found. Choose one and enter your replacement.');
   }catch(e){resetTextEditor();say('Cannot load editable text: '+String(e.message||e),true)}
   finally{button.disabled=false}
  });
  document.getElementById('sbcAITextField')?.addEventListener('change',()=>{
   const row=textFieldSelected(),area=document.getElementById('sbcAINewText');
   if(area){area.disabled=!row;area.value=row?row.text:''}
   const save=document.getElementById('sbcAISaveText');if(save)save.disabled=true;
  });
  document.getElementById('sbcAINewText')?.addEventListener('input',()=>{
   const save=document.getElementById('sbcAISaveText');if(save)save.disabled=!textEditCanSave();
  });
  document.getElementById('sbcAISaveText')?.addEventListener('click',async()=>{
   const row=textFieldSelected(),button=document.getElementById('sbcAISaveText');
   if(!row||!textEditCanSave()||button.disabled)return say('Select an active text field and enter different wording.',true);
   const version=currentVersion();
   button.disabled=true;
   try{
    const response=await fetch(base+'/uploads/'+version.id+'/text-edit',{
     method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/json','X-SBC-Website-Text-Edit':'1','Accept':'application/json'},
     body:JSON.stringify({expectedActiveId:version.id,page:row.page,nodeId:row.id,
      text:String(document.getElementById('sbcAINewText')?.value||'').trim()})
    });
    const saved=await response.json().catch(()=>({}));
    if(!response.ok||saved.ok!==true||saved.durable!==true||saved.published!==false||!saved.upload?.previewPath)
     throw Error(saved.code||'Website edit was not saved');
    await refresh();
    await preview(saved.upload.previewPath,currentTier());
    say('Text updated! A new website ZIP version is saved to this customer. Original ZIP remains in version history.');
   }catch(e){say('Text update failed: '+String(e.message||e)+'. Original ZIP was not changed.',true)}
   finally{button.disabled=false}
  });
  let imageEditingVersion=null,imageEditingFields=[];
  function resetImageEditor(){
   imageEditingVersion=null;imageEditingFields=[];
   const select=document.getElementById('sbcAIImageField'),file=document.getElementById('sbcAIReplacementImage');
   if(select){select.innerHTML='<option value="">Load saved website images first</option>';select.value='';select.disabled=true}
   if(file){file.value='';file.disabled=true}
   const image=document.getElementById('sbcAIImageCurrent');
   if(image){image.hidden=true;image.removeAttribute?.('src')}
   const button=document.getElementById('sbcAISaveImage');if(button)button.disabled=true;
  }
  function selectedImage(){
   const key=String(document.getElementById('sbcAIImageField')?.value||'');
   return imageEditingFields.find(x=>x.path===key)||null;
  }
  function imageFileType(file){
   if(!file)return '';
   const ext=String(file.name||'').split('.').pop().toLowerCase();
   const known={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'}[ext]||'';
   return known&&(!file.type||file.type===known)?known:'';
  }
  function imageReadyToSave(){
   const row=selectedImage(),file=document.getElementById('sbcAIReplacementImage')?.files?.[0];
   return Boolean(row&&file&&file.size>0&&file.size<=4*1024*1024&&imageFileType(file)===row.mime&&
    imageEditingVersion===currentVersion()?.id);
  }
  document.getElementById('sbcAILoadImages')?.addEventListener('click',async()=>{
   const active=currentVersion(),button=document.getElementById('sbcAILoadImages');
   if(!active)return say('Save a customer website ZIP before replacing pictures.',true);
   if(button.disabled)return;
   button.disabled=true;
   try{
    const response=await serviceApi(base+'/uploads/'+active.id+'/images');
    if(response?.ok!==true||response.readOnly!==true||response.current!==true||
       response.versionId!==active.id||!Array.isArray(response.images))
     throw Error(response?.code||'Image library unavailable');
    resetImageEditor();imageEditingVersion=active.id;
    imageEditingFields=response.images.filter(x=>x&&typeof x.path==='string'&&
     ['image/png','image/jpeg','image/webp'].includes(x.mime)).slice(0,80);
    const select=document.getElementById('sbcAIImageField');
    if(select){
     select.innerHTML='<option value="">Choose an image from your website</option>'+
      imageEditingFields.map(x=>'<option value="'+esc(x.path)+'">'+
       esc(x.path+' · '+x.width+'×'+x.height+' · '+Math.round(x.bytes/1024)+' KB')+'</option>').join('');
     select.disabled=!imageEditingFields.length;
    }
    say(imageEditingFields.length+' replaceable images found. Choose an image and upload a replacement in the same format.');
   }catch(e){resetImageEditor();say('Image list unavailable: '+String(e.message||e),true)}
   finally{button.disabled=false}
  });
  document.getElementById('sbcAIImageField')?.addEventListener('change',()=>{
   const row=selectedImage(),file=document.getElementById('sbcAIReplacementImage');
   if(file){file.value='';file.disabled=!row}
   const image=document.getElementById('sbcAIImageCurrent');if(image){image.hidden=true;image.removeAttribute?.('src')}
   if(row&&image&&currentVersion()?.previewPath){
    try{
     const root=new URL('./',new URL(currentVersion().previewPath,window.location.href));
     const asset=row.path.split('/').map(encodeURIComponent).join('/');
     image.src=new URL(asset,root).href;image.hidden=false;
    }catch{/* failed thumbnail does not block replacing an archived asset */}
   }
   const save=document.getElementById('sbcAISaveImage');if(save)save.disabled=true;
  });
  document.getElementById('sbcAIReplacementImage')?.addEventListener('change',()=>{
   const save=document.getElementById('sbcAISaveImage');if(save)save.disabled=!imageReadyToSave();
   const row=selectedImage(),file=document.getElementById('sbcAIReplacementImage')?.files?.[0];
   if(file&&row&&imageFileType(file)!==row.mime)
    say('Choose a '+row.mime.replace('image/','').toUpperCase()+' file to match the existing image. Different formats need a revised website ZIP.',true);
  });
  document.getElementById('sbcAISaveImage')?.addEventListener('click',async()=>{
   const button=document.getElementById('sbcAISaveImage'),row=selectedImage(),
    file=document.getElementById('sbcAIReplacementImage')?.files?.[0],version=currentVersion();
   if(!imageReadyToSave()||button.disabled)return say('Select an image and a matching replacement file (4 MB or less).',true);
   button.disabled=true;say('Saving a new website version with the replacement image…');
   try{
    const res=await fetch(base+'/uploads/'+version.id+'/image-replace',{
     method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':row.mime,'X-SBC-Website-Image-Replace':'1',
      'X-SBC-Expected-Version':version.id,'X-SBC-Image-Asset':encodeURIComponent(row.path),'Accept':'application/json'},
     body:file
    });
    const saved=await res.json().catch(()=>({}));
    if(!res.ok||saved.ok!==true||saved.durable!==true||saved.published!==false||!saved.upload?.previewPath)
     throw Error(saved.code||'Image update failed');
    await refresh();
    await preview(saved.upload.previewPath,currentTier());
    say('Image replaced! Your updated website ZIP is saved and previewed. The old version is still available.');
   }catch(e){say('Image replacement failed: '+String(e.message||e)+'. Original website was not changed.',true)}
   finally{button.disabled=false}
  });
  const checks=()=>Array.from(document.querySelectorAll('[data-sbc-ai-release-check]'));
  function clearApprovals(){checks().forEach(x=>{x.checked=false});}
  function releaseAllowed(){
   const v=currentVersion(),qa=v?.previewAudit;
   const flags=qa?.deliveryReview?.flags;
   const blocking=Array.isArray(flags)?flags.filter(x=>x!=='FORM_BACKEND_MUST_BE_TESTED'):['AUDIT_MISSING'];
   return Boolean(v&&qa?.issueCount===0&&qa?.deliveryReview&&blocking.length===0&&checks().length===4&&checks().every(x=>x.checked===true));
  }
  function updateReleaseReview(){
   const v=currentVersion(),qa=v?.previewAudit,flags=qa?.deliveryReview?.flags||[];
   const summary=document.getElementById('sbcAIQAStatus');
   const descriptions={BUSINESS_FACTS_UNVERIFIED:'Verify business details before delivery',
    PAGE_TITLE_REVIEW:'Page title missing',MOBILE_VIEWPORT_REVIEW:'Mobile viewport not configured',
    FORM_BACKEND_MUST_BE_TESTED:'Live form endpoint must be tested',
    IMAGE_ALT_TEXT_REVIEW:'Image accessibility text needs review'};
   if(summary){
    const blockers=flags.filter(x=>x!=='FORM_BACKEND_MUST_BE_TESTED');
    summary.textContent=!v?'Upload a ZIP to begin quality review.':
      !qa||!qa.deliveryReview?'Older ZIP: click Run quality check to inspect it without re-uploading.':
      qa.issueCount||blockers.length?
       'Not ready for handoff: '+qa.issueCount+' missing or blocked file links; '+blockers.map(x=>descriptions[x]||x).join('; ')+'.':
       flags.includes('FORM_BACKEND_MUST_BE_TESTED')?
        'Static files passed. The live form backend must be tested outside this sandbox before owner approval.':
        'Static file checks passed. Complete the four manual confirmations before downloading for publishing.';
   }
   const btn=document.getElementById('sbcAIPreparePublish');
   if(btn)btn.disabled=!releaseAllowed();
  }
  document.querySelectorAll('[data-sbc-ai-release-check]').forEach(x=>x.addEventListener('change',updateReleaseReview));
  document.querySelectorAll('[data-sbc-ai-device]').forEach(button=>button.addEventListener('click',()=>{
   const device=button.dataset.sbcAiDevice;
   if(!['desktop','tablet','mobile'].includes(device))return;
   const stage=document.getElementById('sbcAIFrameStage');
   if(stage)stage.dataset.device=device;
   document.querySelectorAll('[data-sbc-ai-device]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));
  }));
  document.getElementById('sbcAIPreparePublish')?.addEventListener('click',()=>{
   if(!releaseAllowed())return say('Complete the quality checklist and resolve all ZIP review flags before preparing this site.',true);
   const item=currentVersion();
   const a=document.createElement('a');a.href=item.downloadPath;
   a.download='sbc-approved-for-manual-hosting-'+currentTier()+'.zip';
   document.body.appendChild(a);a.click();a.remove();
   say('Approved ZIP prepared for manual deployment. Not published; verify hosting and payment separately.');
  });
  document.getElementById('sbcAIRunQA')?.addEventListener('click',async()=>{
   const item=currentVersion(),button=document.getElementById('sbcAIRunQA');
   if(!item)return say('Upload a customer website ZIP before running quality checks.',true);
   if(button.disabled)return;
   button.disabled=true;say('Checking saved ZIP files and delivery details…');
   try{
    const response=await serviceApi(base+'/uploads/'+item.id+'/qa');
    if(response?.ok!==true||response.readOnly!==true||!response.previewAudit)throw Error(response?.code||'Quality check unavailable');
    item.previewAudit=response.previewAudit;
    clearApprovals();render();
    const issues=Number(response.previewAudit.issueCount||0),flags=response.previewAudit.deliveryReview?.flags||[];
    say('Quality check complete: '+issues+' asset/link problems, '+flags.length+' delivery review items. No website files changed.');
   }catch(e){say('Quality check unsuccessful: '+String(e.message||e),true)}
   finally{button.disabled=false}
  });
  document.getElementById('sbcAIRevisionCopy')?.addEventListener('click',async()=>{
   const tier=currentTier(),version=currentVersion(),notes=String(document.getElementById('sbcAIRevisionNotes')?.value||'').trim();
   if(!version)return say('Upload or select a saved website before requesting edits.',true);
   if(notes.length<5)return say('Describe the changes you want before copying a revision request.',true);
   const prompt=['Update ONE existing Successful By Choice customer website.',
    'Business: '+String(customer.businessName||'Business'),
    'Package: $'+tier+'. Keep this same package tier.',
    'Use the original website ZIP that I attach to ChatGPT as the baseline.',
    'Changes requested by owner:',notes,
    'Do not invent services, reviews, prices, hours, contact details or achievements.',
    'Preserve local assets, accessibility, responsive layout and working navigation.',
    'Return ONE complete revised website ZIP with index.html at its root.',
    'Test local HTML/CSS/JS references. List changes and anything requiring backend work.'].join('\n');
   try{await navigator.clipboard.writeText(prompt);say('Revision request copied. Attach the current saved ZIP in ChatGPT, then upload the newly built ZIP here.')}
   catch{say('Clipboard unavailable. Please copy your requested changes manually.',true)}
  });
  async function preview(url,tier,renew=false){
   if(!url)return say('Upload a ZIP or save a hosted HTTPS URL to preview this package.',true);
   try{
    // Owner-clicked previews renew the short-lived asset grant from the
    // authenticated customer account, including after a GoDaddy restart.
    if(renew&&/\/render\//.test(url)){
     const id=/\/uploads\/(up_[a-f0-9]{32})\/render\//.exec(new URL(url,window.location.href).pathname)?.[1];
     if(!id)throw Error('Invalid saved preview reference');
     const refreshed=await serviceApi(base+'/uploads');
     const item=refreshed?.ok===true&&Array.isArray(refreshed.uploads)?refreshed.uploads.find(x=>x.id===id):null;
     if(!item?.previewPath)throw Error('Saved website unavailable. Reopen the customer account and retry.');
     url=item.previewPath;
    }
    const u=new URL(url,window.location.href);
    if(u.origin!==window.location.origin&&u.protocol!=='https:')throw Error('Invalid preview link');
    frame.src=u.href;
    say('Showing the $'+tier+' website. Local CSS, JS, images and links can load; the sandbox blocks forms and outbound network.');
   }catch(e){say(String(e.message||e),true)}
  }
  function render(){
   for(const t of TIERS){
    const host=document.getElementById('sbcAICurrent'+t.id);if(!host)continue;
    const list=items.filter(x=>Number(x.tier)===t.id),latest=list.find(x=>x.active===true)||list[0],history=list.filter(x=>x.id!==latest?.id),external=document.getElementById('sbcAIUrl'+t.id)?.value.trim();
    if(!latest&&!external){host.innerHTML='<p class="sbc-ai-empty">No ZIP saved for this package yet.</p>';continue}
    const qa=latest?.previewAudit;
    const problemCount=Number(qa?.issueCount||0);
    const deliverFlags=qa?.deliveryReview?.flags||[];
    const qaExtra=deliverFlags.length?' · '+deliverFlags.length+' delivery item'+(deliverFlags.length===1?'':'s')+' need attention.':'';
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
      '<p class="sbc-ai-saved">✓ Current saved website for this customer</p>'+
      '<p class="sbc-ai-meta">'+Number(latest.fileCount||0)+' web files · '+new Date(latest.createdAt).toLocaleString()+' · Owner review</p>'+
      '<p class="sbc-ai-meta" role="status">'+esc(qaText+qaExtra)+'</p>'+details+
      '<div class="sbc-ai-actions"><button type="button" class="btn" data-sbc-ai-preview="'+esc(latest.previewPath)+'" data-tier="'+t.id+'">Preview saved ZIP</button>'+
      '<a class="btn" href="'+esc(latest.downloadPath)+'" download>Download copy</a>'+
      '<a class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(latest.previewPath)+'">Open preview ↗</a></div>'+
      (history.length?'<details><summary>Saved version history ('+history.length+' earlier version'+(history.length===1?'':'s')+')</summary>'+
        history.map((x,i)=>'<p><button class="btn" type="button" data-sbc-ai-preview="'+esc(x.previewPath)+'" data-tier="'+t.id+'">Preview earlier version '+(i+1)+'</button> '+
        (ownerAuthorized?'<button class="btn" type="button" data-sbc-ai-restore="'+esc(x.id)+'" data-tier="'+t.id+'" data-active-id="'+esc(latest.id)+'">Make current</button>' :'')+'</p>').join('')+'</details>':'')
     :'<p class="sbc-ai-meta">External preview saved · no ZIP uploaded</p>'+
      '<button class="btn" data-sbc-ai-external="'+t.id+'" type="button">Preview external URL</button>');
   }
   const quick=document.getElementById('sbcAIQuickCurrent');
   if(quick){
    const selected=Number(document.getElementById('sbcAIQuickTier')?.value||199);
    const latest=items.find(x=>Number(x.tier)===selected&&x.active===true)||items.find(x=>Number(x.tier)===selected);
    if(!latest)quick.textContent='No website saved for this package yet. Start with the ChatGPT request above.';
    else{
     const audit=latest.previewAudit;
     const count=Number(audit?.issueCount||0);
     const label=!audit?'Older ZIP · please review the files manually.':count?
      count+' potential preview link issue'+(count===1?'':'s')+' to review.':
      'Static website links checked; manual visual review still required.';
     quick.innerHTML='<p class="sbc-ai-saved">Saved website · $'+selected+'</p>'+
      '<p class="sbc-ai-meta">'+esc(label)+'</p>'+
      '<div class="sbc-ai-actions"><button class="btn" type="button" data-sbc-ai-preview="'+esc(latest.previewPath)+'" data-tier="'+selected+'">Preview saved website</button>'+
      '<a class="btn" href="'+esc(latest.downloadPath)+'" download>Download saved ZIP</a></div>'+
      (ownerAuthorized&&items.some(x=>Number(x.tier)===selected&&x.id!==latest.id)?
       '<details class="sbc-ai-other"><summary>Restore earlier version</summary>'+
       items.filter(x=>Number(x.tier)===selected&&x.id!==latest.id).slice(0,12).map((x,i)=>
        '<p><button class="btn" type="button" data-sbc-ai-restore="'+esc(x.id)+'" data-active-id="'+esc(latest.id)+'" data-tier="'+selected+'">Make version '+(i+1)+' current</button></p>').join('')+
       '</details>':'');
    }
   }
   const backup=document.getElementById('sbcAIBackup');
   if(backup){
    if(!ownerAuthorized)backup.textContent='Private revisions are saved to this assigned account. Owner controls full recovery exports.';
    else backup.innerHTML=items.length?
     '<p class="sbc-ai-saved">Protect your customer website files</p>'+
     '<p class="sbc-ai-meta">Original ZIP versions, all saved packages, and a checksum manifest in one portable file. Store this downloaded backup somewhere independent of GoDaddy.</p>'+
     '<a class="btn" href="'+esc(base+'/uploads/recovery/export')+'" download="sbc-customer-website-backup.zip">Download customer website backup</a>'+
     '<small>If the backup is too large or any original ZIP is missing, the export stops instead of silently omitting a version. Individual ZIP downloads remain available above.</small>':
     '<p class="sbc-ai-meta">Upload a website first; the customer recovery backup will appear here.</p>';
   }
   document.querySelectorAll('[data-sbc-ai-restore]').forEach(b=>b.addEventListener('click',async()=>{
    const versionId=String(b.dataset.sbcAiRestore||''),expectedActiveId=String(b.dataset.activeId||'');
    if(!/^up_[a-f0-9]{32}$/.test(versionId)||!/^up_[a-f0-9]{32}$/.test(expectedActiveId))return say('Invalid saved version.',true);
    b.disabled=true;
    try{
     const res=await fetch(base+'/uploads/'+versionId+'/select',{method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','X-SBC-Website-Version-Select':'1','Accept':'application/json'},
      body:JSON.stringify({expectedActiveId})});
     const answer=await res.json().catch(()=>({}));
     if(!res.ok||answer.ok!==true||answer.durable!==true)throw Error(answer.code||'Could not restore version');
     await refresh();
     const updated=items.find(x=>x.id===answer.activeId);
     if(updated)await preview(updated.previewPath,Number(updated.tier));
     say('Earlier ZIP restored as current. Nothing was deleted or published.');
    }catch(e){say('Restore failed: '+String(e.message||e)+'. Existing versions remain saved.',true)}
    finally{b.disabled=false}
   }));
   document.querySelectorAll('[data-sbc-ai-preview]').forEach(b=>b.addEventListener('click',()=>preview(b.dataset.sbcAiPreview,Number(b.dataset.tier),true)));
   document.querySelectorAll('[data-sbc-ai-external]').forEach(b=>b.addEventListener('click',()=>preview(document.getElementById('sbcAIUrl'+b.dataset.sbcAiExternal)?.value,Number(b.dataset.sbcAiExternal))));
   updateReleaseReview();
  }
  async function refresh(){
   const res=await serviceApi(base+'/uploads');
   if(!res?.ok||!Array.isArray(res.uploads))throw Error(res?.code||'UPLOAD_LIBRARY_UNAVAILABLE');
   items=res.uploads;clearApprovals();resetTextEditor();resetImageEditor();render();
  }
  document.getElementById('sbcAIQuickTier')?.addEventListener('change',()=>{clearApprovals();resetTextEditor();resetImageEditor();render();const saved=currentVersion();if(saved)preview(saved.previewPath,currentTier())});
  document.getElementById('sbcAICopy')?.addEventListener('click',async()=>{
   const tier=String(document.getElementById('sbcAIQuickTier')?.value||199);
   const prompt=result.prompts?.[tier]||result.prompt||'';
   if(!prompt)return say('Build request unavailable. Refresh this customer account.',true);
   try{await navigator.clipboard.writeText(prompt);say('$'+tier+' website request copied. Paste it into ChatGPT and I will build the ZIP.')}
   catch{say('Clipboard unavailable. Select and copy the website request manually.',true)}
  });
  async function uploadZip(tier,file,button){
   if(!TIERS.some(t=>t.id===tier))return say('Choose a website package first.',true);
   if(!file)return say('Choose the completed website ZIP file first.',true);
   if(!/\.zip$/i.test(file.name)||file.size<22||file.size>LIMIT)return say('Choose a ZIP no larger than 20 MB.',true);
   if(button.disabled)return;
   button.disabled=true;say('Saving your $'+tier+' website ZIP…');
   try{
    const response=await fetch(base+'/uploads/'+tier,{method:'POST',credentials:'same-origin',cache:'no-store',
     headers:{'Content-Type':'application/zip','X-SBC-Proposal-Upload':'1','Accept':'application/json'},body:file});
    const saved=await response.json().catch(()=>({}));
    if(!response.ok||saved.ok!==true||saved.durable!==true)throw Error(saved.code||'Upload was not saved');
    await refresh();
    preview(saved.upload.previewPath,tier);
    say('Website saved to '+String(customer.businessName||'this customer')+' · $'+tier+'. Review the preview and any link warnings before sharing.');
   }catch(e){say('Upload unsuccessful: '+String(e.message||e)+'. Existing proposals were not changed.',true)}
   finally{button.disabled=false}
  }
  document.getElementById('sbcAIQuickUpload')?.addEventListener('click',async()=>{
   const button=document.getElementById('sbcAIQuickUpload');
   const tier=Number(document.getElementById('sbcAIQuickTier')?.value);
   const file=document.getElementById('sbcAIQuickFile')?.files?.[0];
   await uploadZip(tier,file,button);
  });
  document.querySelectorAll('[data-sbc-ai-upload]').forEach(button=>button.addEventListener('click',async()=>{
   const tier=Number(button.dataset.sbcAiUpload),file=document.getElementById('sbcAIFile'+tier)?.files?.[0];
   await uploadZip(tier,file,button);
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
  try{await refresh();const saved=currentVersion();if(saved)await preview(saved.previewPath,currentTier());else say('Ready. Select a package, copy the ChatGPT request, and upload the finished ZIP.')}
  catch(e){say('ZIP library unavailable: '+String(e.message||e)+'. External URL slots remain available.',true)}
 }
 window.SBC_AI_SITE_HANDOFF=Object.freeze({open});
})();
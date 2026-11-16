/* SBC AI Website Handoff v1 · owner-initiated manual ChatGPT flow */
(function(){
 'use strict';
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function open(customer,{serviceApi,openModal}){
   if(!customer?.id||typeof serviceApi!=='function'||typeof openModal!=='function')throw Error('AI website handoff unavailable');
   const base='/api/website-production/customers/'+encodeURIComponent(customer.id)+'/ai-proposals';
   openModal('AI Website Production','<div style="padding:20px">Loading this customer’s three website proposal slots…</div>');
   let result;
   try{result=await serviceApi(base);if(!result?.ok)throw Error(result?.code||'Not available');}
   catch(e){openModal('AI Website Production','<div style="padding:20px" role="alert">Could not open the proposal desk: '+esc(e?.message||'Unknown error')+'</div>');return;}
   const tiers=[{id:199,title:'Starter — One Page',desc:'Premium one-page presentation'},{id:499,title:'Custom — Multipage',desc:'Multiple pages and richer interactions'},{id:799,title:'Advanced — Proposal',desc:'Only include features implemented and tested'}];
   let revision=Number(result.revision)||0;
   const saved=result.variants||{};
   const cards=tiers.map(t=>{
     const v=saved[String(t.id)]||{},url=String(v.previewUrl||'');
     return '<section style="padding:16px;border:1px solid #c2d1e0;background:#fff;border-radius:14px;min-width:0">'+
       '<h4 style="margin:4px 0;color:#185b97">SBC $'+t.id+' · '+esc(t.title)+'</h4><p style="font-size:12px">'+esc(t.desc)+'</p>'+
       '<label>Preview URL (HTTPS)<input id="sbcAIUrl'+t.id+'" type="url" value="'+esc(url)+'" placeholder="https://example.com" style="width:100%;padding:9px;display:block;border:1px solid #cad6e2;border-radius:7px"></label>'+
       '<label>Notes<textarea id="sbcAINotes'+t.id+'" maxlength="500" rows="2" style="width:100%;padding:9px;display:block;border:1px solid #cad6e2;border-radius:7px">'+esc(v.notes||'')+'</textarea></label>'+
       '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"><button type="button" data-sbc-ai-save="'+t.id+'" class="btn primary">Save to customer</button>'+
       '<button type="button" data-sbc-ai-view="'+t.id+'" class="btn">Preview below</button>'+
       '<a id="sbcAIOpen'+t.id+'" class="btn" target="_blank" rel="noopener noreferrer" href="'+esc(url||'#')+'" '+(url?'':'hidden')+'>Open site ↗</a></div>'+
       '<small style="color:#617080">Private draft · Owner review required before client sharing.</small></section>';
   }).join('');
   const html='<div style="padding:18px;color:#16324c;max-width:1180px;margin:auto">'+
     '<p style="font-size:12px;font-weight:900;letter-spacing:.12em;color:#1572b4">SBC AI WEBSITE PRODUCTION</p>'+
     '<h3>Three websites for '+esc(customer.businessName||'this customer')+'</h3>'+
     '<p>Copy the customer-approved brief to ChatGPT, build and deploy each website, then store its private preview link here. No outside AI request or purchase happens automatically.</p>'+
     '<section style="border-radius:13px;border:1px solid #add0e5;background:#e8f4ff;padding:15px;margin-bottom:14px">'+
     '<button id="sbcAICopy" type="button" class="btn primary">Copy 3-site build instructions</button> '+
     '<a class="btn" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT ↗</a>'+
     '<details style="margin-top:10px"><summary>See/edit website brief</summary><textarea id="sbcAIBrief" rows="14" style="width:100%;padding:10px;margin-top:6px">'+esc(result.prompt||'')+'</textarea></details>'+
     '<p style="font-size:12px">ChatGPT does not automatically receive your CRM data or send files back. Copy, build, deploy, and save the URLs as a first step toward full integration.</p></section>'+
     '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px">'+cards+'</div>'+
     '<p id="sbcAIState" role="status" aria-live="polite" style="font-weight:700;margin:12px 0">Connected to the correct customer record.</p>'+
     '<h4>Owner preview</h4><p style="font-size:12px">Some hosts block embedded previews; use Open site when needed.</p>'+
     '<iframe id="sbcAIFrame" title="Private website preview" sandbox="allow-scripts" referrerpolicy="no-referrer" src="about:blank" style="height:560px;width:100%;background:#fff;border:1px solid #cbd5e1;border-radius:10px"></iframe></div>';
   openModal('SBC AI Website Production',html);
   const say=(msg,error=false)=>{const p=document.getElementById('sbcAIState');if(p){p.textContent=msg;p.style.color=error?'#b91c1c':'#176638';}};
   document.getElementById('sbcAICopy')?.addEventListener('click',async()=>{
     try{await navigator.clipboard.writeText(document.getElementById('sbcAIBrief').value);say('Build instructions copied. Paste into ChatGPT.');}
     catch{say('Clipboard unavailable. Select and copy the expanded brief manually.',true);}
   });
   document.querySelectorAll('[data-sbc-ai-save]').forEach(button=>button.addEventListener('click',async()=>{
     const tier=Number(button.dataset.sbcAiSave),previewUrl=document.getElementById('sbcAIUrl'+tier)?.value.trim()||'';
     const notes=document.getElementById('sbcAINotes'+tier)?.value||'';
     button.disabled=true;say('Saving $'+tier+' preview to this customer…');
     try{
       const res=await serviceApi(base,{method:'PATCH',body:JSON.stringify({tier,previewUrl,notes,expectedRevision:revision})});
       if(!res?.ok)throw Error(res?.code||'Save failed');
       revision=Number(res.revision);
       const link=document.getElementById('sbcAIOpen'+tier);
       if(link){link.href=previewUrl||'#';link.hidden=!previewUrl;}
       say('$'+tier+' proposal saved. Review it before presenting.');
     }catch(e){say('Save failed: '+String(e?.message||e)+'. Reopen account and retry if its revision changed.',true);}
     finally{button.disabled=false;}
   }));
   document.querySelectorAll('[data-sbc-ai-view]').forEach(button=>button.addEventListener('click',()=>{
     const tier=Number(button.dataset.sbcAiView),input=document.getElementById('sbcAIUrl'+tier)?.value.trim()||'';
     try{const u=new URL(input);if(u.protocol!=='https:'||u.username||u.password)throw Error('Not HTTPS');
       document.getElementById('sbcAIFrame').src=u.href;say('Showing $'+tier+' preview; the host may block embedded pages.');
     }catch{say('Enter a valid HTTPS preview link first.',true);}
   }));
 }
 window.SBC_AI_SITE_HANDOFF=Object.freeze({open});
})();
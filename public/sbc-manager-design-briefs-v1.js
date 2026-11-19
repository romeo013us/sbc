/* SBC Account Manager — safe design brief handoff for assigned CRM accounts.
 * Separate from owner-only messaging, payment and site deployment.
 */
(function(win){
 'use strict';
 if(win.SBC_MANAGER_DESIGN_BRIEFS)return;
 let active='',customerName='',lastLink='',busy=false,seen=0;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const host=()=>document.getElementById('sbcManagerDesignRequests');
 const status=msg=>{const el=document.getElementById('sbcManagerDesignStatus');if(el)el.textContent=String(msg||'')};
 const label={WEBSITE:'Website',BUSINESS_CARDS:'Business cards'};
 async function api(url,method='GET',body){
  const res=await fetch(url,{method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(method!=='GET'?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.ok!==true)throw Error(data.code||data.error||'Operation was not confirmed by SBC.');
  return data;
 }
 const format=x=>x?new Date(x).toLocaleString():'—';
 function answerRows(a){
  const keys={businessName:'Business',contactName:'Contact',contactEmail:'Email',contactPhone:'Phone',style:'Style',
   primaryColor:'Primary color',secondaryColor:'Accent color',colorNotes:'Color ideas',
   summary:'Design request',services:'Services',pages:'Pages',features:'Features',audience:'Target clients',
   printedName:'Name to print',printedTitle:'Position',printedPhone:'Phone to print',printedEmail:'Email to print',
   printedAddress:'Address to print',printedWebsite:'Web to print',quantity:'Quantity',sides:'Sides',finish:'Finish',
   referenceUrls:'Inspiration links',logoUrl:'Logo link',imageUrl:'Photo link',notes:'Other ideas'};
  return Object.entries(keys).filter(([key])=>a[key]!==undefined&&a[key]!==null&&a[key]!=='').map(([key,value])=>{
   const cell=Array.isArray(a[key])?a[key].join(', '):String(a[key]);
   return '<div class="sbc-manager-brief-field"><strong>'+esc(value)+'</strong><div>'+esc(cell)+'</div></div>';
  }).join('');
 }
 function renderItems(list){
  const el=document.getElementById('sbcManagerDesignList');if(!el)return;
  el.innerHTML=list.length?list.map(b=>
   '<article class="sbc-manager-brief"><strong>'+esc(label[b.kind]||b.kind)+'</strong> · <span>'+esc(b.status)+'</span>'+
   '<p class="muted">Created '+esc(format(b.createdAt))+(b.submittedAt?' · Received '+esc(format(b.submittedAt)):'')+'</p>'+
   (b.answers?'<details><summary>Customer preferences</summary><div class="sbc-manager-brief-grid">'+answerRows(b.answers)+'</div></details>':'')+
   '<div class="controls">'+(b.status==='SUBMITTED'?'<button class="button secondary" type="button" data-manager-brief-review="'+esc(b.id)+'">Mark reviewed</button>':'')+
   (b.status==='OPEN'?'<button class="button secondary" type="button" data-manager-brief-revoke="'+esc(b.id)+'">Revoke unused link</button>':'')+'</div></article>').join(''):
   '<p class="muted">No design request has been created for this account.</p>';
 }
 async function refresh(id){
  try{const result=await api('/api/sbc/design-briefs/customer/'+encodeURIComponent(id));
   if(active!==id)return;renderItems(Array.isArray(result.briefs)?result.briefs:[]);
  }catch(e){if(active===id)status('Design requests unavailable: '+String(e.message||e));}
 }
 function render(){
  const el=host();if(!el||!active)return;
  el.hidden=false;
  el.innerHTML='<h3>🎨 Customer Design Request</h3>'+
   '<p class="muted">When '+esc(customerName)+' wants a website or business cards, create the right questionnaire and share the link after confirming they asked for it.</p>'+
   '<div class="controls"><button type="button" class="button" data-manager-brief-create="WEBSITE">Website form</button>'+
   '<button type="button" class="button secondary" data-manager-brief-create="BUSINESS_CARDS">Business card form</button>'+
   '<button type="button" class="button secondary" data-manager-brief-refresh>Refresh requests</button></div>'+
   '<div id="sbcManagerDesignShare"></div><div id="sbcManagerDesignStatus" class="muted" role="status"></div>'+
   '<h4>Customer submissions</h4><div id="sbcManagerDesignList" aria-live="polite">Loading…</div>'+
   '<p class="muted">Links last 14 days, can be submitted once, and never place an order or send a message automatically.</p>';
 }
 async function create(kind){
  if(busy||!active)return;
  if(!win.confirm('Create a '+(label[kind]||'design')+' form for '+customerName+'? Share it only after the customer requests it.'))return;
  busy=true;const id=active;status('Creating secure customer questionnaire…');
  try{
   const res=await api('/api/sbc/design-briefs','POST',{customerId:id,kind});
   if(active!==id)return;
   if(!/^\/request\/[a-f0-9]{64}$/.test(String(res.urlPath||'')))throw Error('Secure link was not verified.');
   lastLink=win.location.origin+res.urlPath;
   const box=document.getElementById('sbcManagerDesignShare');
   box.innerHTML='<label for="sbcManagerDesignLink">Copy this customer form link</label>'+
    '<input type="text" id="sbcManagerDesignLink" readonly value="'+esc(lastLink)+'" style="width:100%;max-width:600px;padding:12px;margin:8px 0;color:#0b1730;background:#fff">'+
    '<div class="controls"><button type="button" class="button" data-manager-brief-copy>Copy link</button>'+
    '<a class="button secondary" href="'+esc(lastLink)+'" target="_blank" rel="noopener noreferrer">Preview form</a></div>'+
    '<p class="muted">No text/email sent. Paste the link into an approved customer communication channel. If this link is lost, create a new one.</p>';
   status('Created. The link is ready for you to share. No customer message was sent.');
   await refresh(id);
  }catch(e){if(active===id)status('Not created: '+String(e.message||e))}
  finally{busy=false;}
 }
 async function change(id,mode){
  if(busy||!active)return;
  if(!win.confirm(mode==='revoke'?'Revoke this unused form link?':'Mark this customer submission as reviewed?'))return;
  const customerId=active;busy=true;
  try{await api('/api/sbc/design-briefs/'+encodeURIComponent(id)+'/'+mode,'POST',{});if(active===customerId){status('Request updated.');await refresh(customerId)}}
  catch(e){if(active===customerId)status('Update not confirmed: '+String(e.message||e))}
  finally{busy=false}
 }
 function open(id,labelText){
  const el=host();if(!el)return;
  const normalized=String(id||'');
  if(!normalized||!/^[A-Za-z0-9_.:-]{1,120}$/.test(normalized))return;
  active=normalized;customerName=String(labelText||'this customer');lastLink='';seen++;
  render();void refresh(active);
 }
 document.addEventListener('click',async e=>{
  const el=e.target.closest?.('[data-manager-brief-create],[data-manager-brief-refresh],[data-manager-brief-copy],[data-manager-brief-review],[data-manager-brief-revoke]');
  if(!el||!el.closest('#sbcManagerDesignRequests'))return;
  e.preventDefault();
  if(el.dataset.managerBriefCreate)return create(el.dataset.managerBriefCreate);
  if(el.hasAttribute('data-manager-brief-refresh'))return refresh(active);
  if(el.hasAttribute('data-manager-brief-review'))return change(el.dataset.managerBriefReview,'review');
  if(el.hasAttribute('data-manager-brief-revoke'))return change(el.dataset.managerBriefRevoke,'revoke');
  if(el.hasAttribute('data-manager-brief-copy')){
   const input=document.getElementById('sbcManagerDesignLink');if(!input||!lastLink)return;
   try{await navigator.clipboard.writeText(lastLink);status('Copied. Send only through an approved customer communication method.')}
   catch{input.focus();input.select();status('Select the link and copy it manually.')}
  }
 });
 const css=document.createElement('style');css.textContent=
  '#sbcManagerDesignRequests{padding:18px;border:1px solid #537195;border-radius:14px;margin:18px 0}#sbcManagerDesignRequests h3{margin:0 0 9px}.sbc-manager-brief{border-top:1px solid #47607f;padding:14px 0}.sbc-manager-brief summary{font-weight:700;cursor:pointer}.sbc-manager-brief-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:12px 0}.sbc-manager-brief-field{border:1px solid #4b6283;border-radius:10px;padding:9px;overflow-wrap:anywhere}.sbc-manager-brief-field strong{font-size:12px;display:block;margin-bottom:5px}';
 document.head.appendChild(css);
 win.SBC_MANAGER_DESIGN_BRIEFS=Object.freeze({open});
})(window);

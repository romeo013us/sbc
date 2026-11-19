/* SBC Customer Design Request Center: owner/manager-triggered forms only.
 * No customer message is sent simply by creating a form link.
 */
(function(win){
 'use strict';
 if(win.SBC_CUSTOMER_DESIGN_REQUESTS)return;
 const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const role=()=>String(win.state?.me?.role||'');
 const permitted=()=>['owner','account_manager','caller'].includes(role());
 const recovery=()=>Boolean(win.state?.data?.readOnly||win.state?.data?.recoveryRequired||win.state?.data?.mysqlRecoveryRequired||win.state?.data?.recovery?.required);
 const data=()=>win.state?.data||{};
 const customers=()=>Array.isArray(data().customers)?data().customers:[];
 const customer=id=>customers().find(x=>String(x.id)===String(id))||null;
 const name=c=>c?.businessName||c?.business_name||c?.contactName||'Customer account';
 const suppress=c=>Boolean(c&&(c.doNotContact||c.doNotCall||c.salesSuppressed||c.isSuppressed||['do not call','do not contact','dnc','opt out','unsubscribe'].includes(String(c.status||'').toLowerCase())));
 const plain=x=>String(x==null?'':x);
 const statusText={OPEN:'Awaiting customer',SUBMITTED:'Ready for your review',REVIEWED:'Reviewed',REVOKED:'Link revoked'};
 const kindText={WEBSITE:'Website',BUSINESS_CARDS:'Business Cards'};
 const labelText={businessName:'Business',contactName:'Contact',contactEmail:'Email',contactPhone:'Phone',
  preferredContact:'Preferred contact',style:'Style',primaryColor:'Primary color',secondaryColor:'Accent color',
  colorNotes:'Color ideas',summary:'What the customer wants',services:'Requested services',audience:'Target customers',
  existingWebsite:'Existing website',domain:'Preferred domain',pages:'Requested pages',features:'Requested features',
  callToAction:'Visitor action',contentReadiness:'Content ready',printedName:'Name to print',printedTitle:'Job title',
  printedPhone:'Phone to print',printedEmail:'Email to print',printedAddress:'Address to print',printedWebsite:'Web to print',
  tagline:'Tagline',quantity:'Quantity',sides:'Sides',orientation:'Orientation',finish:'Finish',qrUrl:'QR destination',
  referenceUrls:'Examples they like',logoUrl:'Logo reference',imageUrl:'Photo reference',notes:'Extra notes',
  specialInstructions:'Printing instructions',requestedDate:'Preferred deadline'};
 let selectedCall='',currentLink='',currentCustomerId='',currentKind='',pending=false,queued=false;
 const cache=new Map(),inflight=new Map();
 const api=async(path,opts)=>{if(typeof win.api!=='function')throw Error('SBC CRM API unavailable');const value=await win.api(path,opts);
  if(value?.ok===false)throw Error(value.code||value.error||'Operation was not confirmed');return value};
 const message=(id,msg)=>{const pane=document.getElementById(id);if(pane)pane.textContent=String(msg||'')};
 const linkFor=()=>currentLink||'';
 function briefCard(b){
  const answers=b.answers||{},keys=Object.keys(labelText).filter(k=>answers[k]!==undefined&&answers[k]!==null&&answers[k]!==''&&answers[k]!==false);
  const details=keys.map(k=>{
   let v=answers[k];if(Array.isArray(v))v=v.join(', ');if(typeof v==='object')v='Provided';
   return '<div class="sbc-design-field"><strong>'+escapeHtml(labelText[k])+'</strong><span>'+escapeHtml(v)+'</span></div>';
  }).join('');
  const canAct=permitted()&&!recovery();
  return '<article class="sbc-design-request-row"><div><strong>'+escapeHtml(kindText[b.kind]||b.kind)+' request</strong> <span class="sbc-design-pill">'+escapeHtml(statusText[b.status]||b.status)+'</span>'+
   '<p>'+escapeHtml(b.createdAt?new Date(b.createdAt).toLocaleString():'Date unknown')+(b.submittedAt?' · Received '+escapeHtml(new Date(b.submittedAt).toLocaleString()):'')+'</p></div>'+
   '<div class="sbc-design-actions">'+
    (b.status==='OPEN'?'<button type="button" class="btn small" data-sbc-design-revoke="'+escapeHtml(b.id)+'"'+(!canAct?' disabled':'')+'>Revoke link</button>':'')+
    (b.status==='SUBMITTED'?'<button type="button" class="btn small primary" data-sbc-design-review="'+escapeHtml(b.id)+'"'+(!canAct?' disabled':'')+'>Mark reviewed</button>':'')+
   '</div>'+
   (answers&&Object.keys(answers).length?'<details class="sbc-design-answers"><summary>View customer’s design answers</summary><div class="sbc-design-answergrid">'+details+'</div><p class="mini">Customer-provided preferences only. Confirm accuracy, prices and final proofs before publishing or printing.</p></details>':'')+
  '</article>';
 }
 function actionButtons(id){
  return '<div class="sbc-design-buttons"><button type="button" class="btn primary" data-sbc-design-create="WEBSITE" data-customer="'+escapeHtml(id)+'"'+(recovery()?' disabled':'')+'>🌐 Website request</button>'+
   '<button type="button" class="btn" data-sbc-design-create="BUSINESS_CARDS" data-customer="'+escapeHtml(id)+'"'+(recovery()?' disabled':'')+'>▤ Business card request</button></div>';
 }
 function mountAccount(){
  const host=document.getElementById('sbcLeadAccount360');if(!host||!permitted())return;
  const id=String(host.dataset.sbcLeadId||''),c=customer(id);if(!c)return;
  let pane=document.getElementById('sbcDesignRequestAccount');
  if(!pane){pane=document.createElement('section');pane.id='sbcDesignRequestAccount';pane.className='sbc-profile-panel sbc-design-account';
   (host.querySelector('.sbc-profile-columns')||host).prepend(pane)}
  if(pane.dataset.account===id)return;
  pane.dataset.account=id;pane.innerHTML='<div class="sbc-design-head"><div><h3>🎨 Customer Design Requests</h3><p class="mini">Send a website or business-card questionnaire. Every reply stays linked to this customer account.</p></div></div>'+
    actionButtons(id)+'<div class="sbc-design-head"><strong>Saved requests</strong><button class="btn small" type="button" data-sbc-design-refresh="'+escapeHtml(id)+'">Refresh</button></div>'+
    '<div class="sbc-design-list" data-sbc-design-list="'+escapeHtml(id)+'">Loading customer requests…</div><p class="mini">Form creation never sends a message or creates an order. You choose when to share the link.</p>';
  fetchList(id).catch(()=>{});
 }
 function mountCall(){
  const anchor=document.getElementById('sbcCallAppointments')||document.getElementById('sbcManualDialer');
  if(!anchor||!permitted())return;
  let pane=document.getElementById('sbcDesignRequestCall');
  if(!pane){pane=document.createElement('section');pane.id='sbcDesignRequestCall';pane.className='sbc-design-call';anchor.insertAdjacentElement('afterend',pane);}
  if(!customers().some(c=>String(c.id)===selectedCall))selectedCall='';
  const key=JSON.stringify([selectedCall,recovery(),customers().map(c=>[c.id,name(c)])]);if(key===pane.dataset.key)return;
  pane.dataset.key=key;const choices=customers().slice().sort((a,b)=>name(a).localeCompare(name(b))).map(c=>
   '<option value="'+escapeHtml(c.id)+'"'+(selectedCall===String(c.id)?' selected':'')+'>'+escapeHtml(name(c))+'</option>').join('');
  pane.innerHTML='<div class="sbc-design-head"><div><h3>🎨 Send a design request</h3><p class="mini">Customer interested in a site or cards? Pick the account and generate the right form.</p></div></div>'+
   '<label class="sbc-design-label">Customer account<select id="sbcDesignCallCustomer"><option value="">Choose an existing account</option>'+choices+'</select></label>'+
   (selectedCall?actionButtons(selectedCall):'<p class="mini">Choose a customer to create their personalized form link.</p>')+
   '<p class="mini">You control when to send the request. It never triggers outbound contact automatically.</p>';
 }
 function refresh(){mountAccount();mountCall()}
 async function fetchList(id){
  if(inflight.has(id))return inflight.get(id);
  const job=(async()=>{
   try{const response=await api('/api/sbc/design-briefs/customer/'+encodeURIComponent(id));
    const list=Array.isArray(response.briefs)?response.briefs:[];cache.set(id,list);
    const slot=document.querySelector('[data-sbc-design-list="'+CSS.escape(id)+'"]');
    if(slot)slot.innerHTML=list.length?list.map(briefCard).join(''):'<p class="mini">No design requests yet. Create a form when the customer is ready.</p>';
   }catch(e){const slot=document.querySelector('[data-sbc-design-list="'+CSS.escape(id)+'"]');
    if(slot)slot.textContent='Requests unavailable: '+String(e.message||e);
   }
  })();
  inflight.set(id,job);try{await job}finally{inflight.delete(id)}
 }
 async function create(kind,id){
  if(pending||!permitted()||recovery())return;
  const c=customer(id);if(!c)return win.toast?.('Select a valid CRM customer.');
  pending=true;
  try{
   const result=await api('/api/sbc/design-briefs',{method:'POST',body:JSON.stringify({customerId:id,kind})});
   if(!result?.urlPath)throw Error('The link was not confirmed by SBC.');
   currentLink=win.location.origin+result.urlPath;currentCustomerId=id;currentKind=kind;
   shareModal(c,result);
   await fetchList(id);
  }catch(e){win.toast?.('Form not created: '+String(e.message||e));}
  finally{pending=false;}
 }
 function shareModal(c,result){
  if(typeof win.openModal!=='function')return win.toast?.('Link created; open Customer Account 360 to retrieve it before leaving.');
  const expiration=new Date(result.expiresAt).toLocaleDateString();
  win.openModal('Share '+(kindText[currentKind]||'design')+' request',
   '<div class="sbc-design-share"><p><strong>'+escapeHtml(name(c))+'</strong> · '+escapeHtml(kindText[currentKind])+'</p>'+
    '<p class="mini">Your secure, one-use design questionnaire is ready. Expires '+escapeHtml(expiration)+'.</p>'+
    '<label class="sbc-design-label">Customer link<input id="sbcDesignShareLink" readonly value="'+escapeHtml(currentLink)+'"></label>'+
    '<div class="sbc-design-buttons"><button type="button" class="btn primary" id="sbcDesignCopy">Copy link</button>'+
    (c.email&&!suppress(c)?'<button type="button" class="btn" id="sbcDesignEmail">Send SBC email</button>':'')+
    (c.phone&&!suppress(c)?'<button type="button" class="btn" id="sbcDesignSms">Send SBC text</button>':'')+
    '<a class="btn" href="'+escapeHtml(currentLink)+'" target="_blank" rel="noreferrer noopener">Preview form</a></div>'+
    '<p class="mini">No message has been sent. Email/text buttons require your explicit action and a working SBC communications connection.</p>'+
    '<p id="sbcDesignShareStatus" role="status"></p></div>');
  document.getElementById('sbcDesignCopy')?.addEventListener('click',copy);
  document.getElementById('sbcDesignEmail')?.addEventListener('click',()=>send('email'));
  document.getElementById('sbcDesignSms')?.addEventListener('click',()=>send('sms'));
 }
 async function copy(){
  const input=document.getElementById('sbcDesignShareLink');if(!input||!linkFor())return;
  try{await navigator.clipboard.writeText(linkFor());message('sbcDesignShareStatus','Link copied. Paste it into your customer conversation.');}
  catch{input.focus();input.select();message('sbcDesignShareStatus','Select the link above and copy it manually.');}
 }
 async function send(channel){
  const c=customer(currentCustomerId);
  if(!c||!linkFor()||suppress(c)){message('sbcDesignShareStatus','Sending unavailable for this account.');return;}
  const destination=channel==='email'?c.email:c.phone;
  if(!destination){message('sbcDesignShareStatus','No confirmed contact destination on this account.');return;}
  const title=kindText[currentKind]||'Design';
  if(!win.confirm('Send '+title+' request to '+destination+' through SBC '+(channel==='email'?'email':'SMS')+' now? Only send if the customer requested this form and permits contact.'))return;
  const body='Hi! Thank you for speaking with Successful By Choice. To help us create your '+(currentKind==='WEBSITE'?'website':'business cards')+
    ', please share your ideas and preferred colors using this private form:\n'+linkFor()+
    '\nThis is a design request, not a purchase. Thank you!\nSuccessful By Choice';
  const url=channel==='email'?'/api/communications/email':'/api/communications/sms';
  message('sbcDesignShareStatus','Submitting the '+channel+' request to SBC…');
  try{
   const payload=channel==='email'?{customerId:c.id,subject:'Your '+title+' design request · Successful By Choice',body}:{customerId:c.id,body};
   const result=await api(url,{method:'POST',body:JSON.stringify(payload)});
   if(!result||typeof result!=='object'||result.ok===false||result.error)throw Error(result?.error||'No delivery confirmation returned.');
   message('sbcDesignShareStatus','SBC accepted the '+channel+' request. Check Communications for actual delivery status.');
  }catch(e){message('sbcDesignShareStatus','No confirmed message submission: '+String(e.message||e)+'. Copy and send the link manually.');}
 }
 async function review(id,mode,element){
  const pane=element.closest('[data-sbc-design-list]');const customerId=pane?.dataset.sbcDesignList;if(!customerId)return;
  if(!win.confirm(mode==='revoke'?'Revoke this unused customer link?':'Mark this customer design request as reviewed?'))return;
  try{await api('/api/sbc/design-briefs/'+encodeURIComponent(id)+'/'+mode,{method:'POST',body:'{}'});await fetchList(customerId);}
  catch(e){win.toast?.('Could not update request: '+String(e.message||e));}
 }
 function click(event){
  const btn=event.target.closest?.('[data-sbc-design-create],[data-sbc-design-refresh],[data-sbc-design-revoke],[data-sbc-design-review]');
  if(!btn)return;event.preventDefault();
  if(btn.dataset.sbcDesignCreate){create(btn.dataset.sbcDesignCreate,btn.dataset.customer);return;}
  if(btn.dataset.sbcDesignRefresh){fetchList(btn.dataset.sbcDesignRefresh);return;}
  if(btn.dataset.sbcDesignRevoke){review(btn.dataset.sbcDesignRevoke,'revoke',btn);return;}
  if(btn.dataset.sbcDesignReview){review(btn.dataset.sbcDesignReview,'review',btn);}
 }
 function install(){
  if(!permitted()||!win.MutationObserver)return;
  document.addEventListener('click',click);
  document.addEventListener('change',ev=>{if(ev.target.id==='sbcDesignCallCustomer'){selectedCall=ev.target.value;mountCall();}});
  const css=document.createElement('style');css.id='sbcDesignRequestStyles';css.textContent=
   '.sbc-design-account{grid-column:1/-1}.sbc-design-call{border:1px solid #8b9bb1;border-radius:15px;padding:18px;margin:14px 0;background:var(--card,#fff);color:var(--text,#18263c)}.sbc-design-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin:5px 0 14px}.sbc-design-head h3{margin:0}.sbc-design-buttons{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 18px}.sbc-design-buttons a{display:inline-flex;align-items:center;text-decoration:none}.sbc-design-label{display:block;font-size:13px;font-weight:750}.sbc-design-label input,.sbc-design-label select{width:100%;min-height:43px;border:1px solid #8498b4;border-radius:9px;padding:10px;margin:6px 0 8px;background:var(--card,#fff);color:var(--text,#172237)}.sbc-design-request-row{display:flex;gap:8px;justify-content:space-between;align-items:start;padding:12px 0;border-top:1px solid #a7b4c5;flex-wrap:wrap}.sbc-design-request-row p{font-size:12px;margin:4px 0;opacity:.84}.sbc-design-pill{display:inline-block;border:1px solid #7a91b6;border-radius:100px;padding:4px 8px;font-size:11px;font-weight:750}.sbc-design-answers{width:100%}.sbc-design-answers summary{cursor:pointer;font-weight:700}.sbc-design-answergrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:10px;margin:10px 0}.sbc-design-field{border:1px solid #abb9cc;padding:10px;border-radius:8px;overflow-wrap:anywhere}.sbc-design-field strong{display:block;font-size:11px;opacity:.8;margin-bottom:5px}.sbc-design-share{color:var(--text,#192941)}';
  document.head.appendChild(css);
  win.SBC_CUSTOMER_DESIGN_REQUESTS=Object.freeze({refresh,create});
  new win.MutationObserver(()=>{if(queued)return;queued=true;Promise.resolve().then(()=>{queued=false;refresh()});}).observe(document.documentElement,{childList:true,subtree:true});
  refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
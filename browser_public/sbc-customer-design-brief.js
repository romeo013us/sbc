/* SBC secure customer design intake. No paid services, cookies, automated messages, or third-party uploads. */
(()=>{'use strict';
 const $=q=>document.querySelector(q);
 const form=$('#sbcBriefForm'),loading=$('#sbcFormLoading'),failure=$('#sbcFormFailure'),done=$('#sbcFormDone'),error=$('#sbcFormError');
 const token=location.pathname.match(/^\/request\/([a-f0-9]{64})$/)?.[1]||'';
 let kind='',step=1,saving=false;
 const setText=(s,v)=>{const n=$(s);if(n)n.textContent=String(v||'')};
 const fail=(message)=>{loading.hidden=true;form.hidden=true;failure.hidden=false;failure.textContent=message||'This request link is not available. Please ask SBC for a new one.'};
 async function request(url,options){
  const reply=await fetch(url,{credentials:'omit',cache:'no-store',headers:{Accept:'application/json',...(options?.body?{'Content-Type':'application/json'}:{})},...options});
  const body=await reply.json().catch(()=>({}));
  if(!reply.ok||!body.ok)throw Error(body.code||('Request failed: '+reply.status));
  return body;
 }
 function show(n){
  step=n;error.textContent='';
  document.querySelectorAll('[data-step]').forEach(node=>node.hidden=Number(node.dataset.step)!==step);
  document.querySelectorAll('[data-progress]').forEach(node=>node.classList.toggle('active',Number(node.dataset.progress)<=step));
  setText('#sbcCurrentStep',step);$('#sbcFormBack').hidden=step===1;
  $('#sbcFormNext').hidden=step===3;$('#sbcFormSubmit').hidden=step!==3;
  document.querySelector('.card')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function validateStep(){
  const pane=document.querySelector('[data-step="'+step+'"]');
  for(const el of pane.querySelectorAll('input,select,textarea')){
   if(el.disabled||el.closest('[hidden]')||el.type==='hidden')continue;
   if(!el.checkValidity()){el.reportValidity();return false;}
  }
  if(step===1){
   const email=String(form.elements.contactEmail.value||'').trim(),phone=String(form.elements.contactPhone.value||'').trim();
   if(!email&&!phone){error.textContent='Please give us an email address or phone number so we can follow up.';form.elements.contactEmail.focus();return false;}
  }
  if(step===3&&kind==='BUSINESS_CARDS'&&!form.elements.printedName.value.trim()){
   error.textContent='Please tell us the name to print on your cards.';form.elements.printedName.focus();return false;
  }
  return true;
 }
 function configure(data){
  kind=data.kind;
  if(!['WEBSITE','BUSINESS_CARDS'].includes(kind))return fail('The request type could not be recognized.');
  loading.hidden=true;
  if(data.status==='SUBMITTED'||data.status==='REVIEWED'){done.hidden=false;return;}
  form.hidden=false;
  setText('#sbcFormType',kind==='WEBSITE'?'WEBSITE DESIGN REQUEST':'BUSINESS CARD DESIGN REQUEST');
  setText('#sbcDetailsHeading',kind==='WEBSITE'?'Your website details':'Your business card details');
  setText('#sbcFormBusiness',data.businessName||'your business');
  form.elements.businessName.value=data.businessName||'';
  ['sbcWebsiteQuestions','sbcCardQuestions'].forEach(id=>{
   const item=document.getElementById(id),enabled=(item.dataset.kind===kind);
   item.hidden=!enabled;item.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=!enabled);
  });
  const name=form.elements.printedName;
  if(kind==='BUSINESS_CARDS'){name.required=true;name.value=data.businessName||'';}
  show(1);
 }
 async function load(){
  if(!token)return fail('This request link is not valid. Please ask SBC for a new one.');
  try{configure(await request('/api/sbc/design-briefs/public/'+token));}
  catch(e){fail(/EXPIRED|NOT_FOUND|INVALID_REQUEST_TOKEN/.test(String(e.message))?
   'This link is unavailable or has expired. Please ask Successful By Choice for a new request link.':
   'We could not open your request. Please try again or email info@sbcmia.com.');}
 }
 $('#sbcFormNext').addEventListener('click',()=>{
  error.textContent='';if(validateStep()&&step<3)show(step+1);
 });
 $('#sbcFormBack').addEventListener('click',()=>{if(step>1)show(step-1)});
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();if(saving||!validateStep())return;
  const fd=new FormData(form),values=Object.fromEntries(fd.entries());
  const safeText=x=>String(x||'').trim();
  const brief={...values,consent:form.elements.consent.checked,
   pages:fd.getAll('pages'),features:fd.getAll('features'),
   referenceUrls:safeText(fd.get('referenceUrls')).split(/\n/).map(s=>s.trim()).filter(Boolean)};
  if(brief.websiteUrl)return;
  saving=true;const button=$('#sbcFormSubmit');button.disabled=true;button.textContent='Sending safely…';error.textContent='';
  try{
   await request('/api/sbc/design-briefs/public/'+token,{method:'POST',body:JSON.stringify(brief)});
   form.hidden=true;done.hidden=false;done.scrollIntoView({behavior:'smooth'});
  }catch(e){
   const code=String(e.message||'');
   error.textContent=/ALREADY_SUBMITTED/.test(code)?'This form has already been sent. Please ask SBC for another link if you need changes.':
     /LINK_EXPIRED/.test(code)?'This link has expired. Ask SBC for a new one.':
     /HTTPS_REFERENCE_REQUIRED/.test(code)?'Please use full HTTPS links, or leave the reference fields blank.':
     /INVALID|REQUIRED|TOO_MANY|TOO_LARGE|CONFIRMATION/.test(code)?'Please check your form details and try again. '+code.replace(/_/g,' ').toLowerCase():
     'We could not confirm your submission. Please try again, or contact info@sbcmia.com.';
  }finally{saving=false;button.disabled=false;button.textContent='Send my design ideas';}
 });
 load();
})();
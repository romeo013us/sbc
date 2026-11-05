/* SBC V66.23: emergency-safe login controller, installed before the legacy
 * dashboard bundle. No auth bypass, credential storage or automatic retries.
 * The existing /api/login remains the sole session authority.
 */
(function(){
 'use strict';
 var form=document.getElementById('loginForm'),error=document.getElementById('loginError');
 if(!form||!error)return;
 var busy=false;
 var submit=form.querySelector('button[type="submit"],button:not([type])');
 function show(message){error.textContent=String(message||'');error.setAttribute('role','alert');}
 form.addEventListener('submit',async function(event){
  event.preventDefault();
  event.stopImmediatePropagation(); // prevent duplicate POST from older app.js onsubmit
  if(busy)return;
  var username=String(document.getElementById('loginUsername')?.value||'').trim();
  var password=String(document.getElementById('loginPassword')?.value||'');
  if(!username||!password){show('Enter your username and password.');return;}
  busy=true;show('Signing in securely…');
  if(submit){submit.disabled=true;submit.textContent='Signing in…';}
  var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},18000);
  try{
   var response=await fetch('/api/login',{method:'POST',credentials:'same-origin',
    cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({username:username,password:password}),signal:controller.signal});
   var payload=null;
   try{payload=await response.json()}catch(_){}
   if(!response.ok||payload?.ok!==true){
    var detail=payload?.error||payload?.message||(response.status===429?'Too many sign-in attempts. Please try again later.':'Sign-in was not completed (HTTP '+response.status+').');
    throw Error(String(detail).slice(0,250));
   }
   show('Signed in. Loading your private workspace…');
   // SBC Research Workspace v1: bypass owner dashboard initialization for Lead Researchers.
   if(['lead_researcher','researcher','lead_generator','prospector'].includes(String(payload?.user?.role||'').toLowerCase())){
    window.location.replace('/lead-research.html');return;
   }
   if(typeof window.boot==='function'){
    await window.boot();
    if(document.getElementById('app')?.classList.contains('hidden')===false)return;
    throw Error('Session accepted, but the workspace did not open. Check account initialization.');
   }
   // Legacy bundle missing or failed; reload ONCE only after a confirmed login.
   window.location.replace('/?sbcAuthenticated=1');
  }catch(err){
   var message=err?.name==='AbortError'?
     'Login request timed out. Check your connection. Verify your session before retrying.':
     String(err?.message||'Login was not completed.');
   show(message);
   if(document.getElementById('app')?.classList.contains('hidden')===false){
    var content=document.getElementById('content');
    if(content){var p=document.createElement('p');p.setAttribute('role','alert');p.textContent=message;content.prepend(p);}
   }
  }finally{
   clearTimeout(timeout);busy=false;
   if(submit){submit.disabled=false;submit.textContent='Sign in';}
  }
 },true);
})();

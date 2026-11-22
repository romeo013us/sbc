'use strict';
/* Owner-only convenience link; backend RBAC remains the security boundary. */
(()=>{
 const link=document.getElementById('sbc-sales-command-owner-nav');
 if(!link)return;
 let seq=0;
 async function check(){
  const ticket=++seq;
  link.hidden=true;
  try{
   const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
   if(!response.ok)return;
   const body=await response.json();
   const u=body.user||body.me||body.profile||body;
   if(ticket===seq&&String(u?.role||'').toLowerCase()==='owner')link.hidden=false;
  }catch(_){}
 }
 const app=document.getElementById('app');
 if(app&&typeof MutationObserver!=='undefined')new MutationObserver(check).observe(app,{attributes:true,attributeFilter:['class']});
 document.getElementById('logoutBtn')?.addEventListener('click',()=>{seq++;link.hidden=true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
 check();
})();

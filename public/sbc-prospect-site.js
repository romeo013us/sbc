'use strict';
(function(){
 const nav=document.getElementById('siteNavigation');
 const toggle=document.querySelector('.mobile-toggle');
 if(nav&&toggle){
   toggle.addEventListener('click',function(){
     const open=nav.classList.toggle('is-open');
     toggle.setAttribute('aria-expanded',String(open));
     toggle.setAttribute('aria-label',open?'Close navigation':'Toggle navigation');
   });
   nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
     nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');
   }));
   document.addEventListener('keydown',event=>{
     if(event.key==='Escape'&&nav.classList.contains('is-open')){
       nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');toggle.focus();
     }
   });
 }
 document.querySelectorAll('[data-demo-form]').forEach(form=>{
   form.addEventListener('submit',event=>{
     event.preventDefault();
     const msg=form.querySelector('[role="status"]');
     if(msg)msg.textContent='This is a working design preview. No information was transmitted or saved. Live inquiries are activated only after the business approves its website.';
   });
 });
})();

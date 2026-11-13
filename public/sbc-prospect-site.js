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


/* Progressive enhancement only: animations are decorative; the content is visible without JS. */
(function(){
 'use strict';
 const reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 if(!reduced&&'IntersectionObserver' in window){
   const items=Array.from(document.querySelectorAll('.sbc-reveal'));
   if(items.length){
     const observer=new IntersectionObserver(entries=>{
       for(const entry of entries)if(entry.isIntersecting){
         entry.target.classList.add('sbc-in-view');
         observer.unobserve(entry.target);
       }
     },{threshold:.08,rootMargin:'0px 0px 60px 0px'});
     document.documentElement.classList.add('sbc-motion-enabled');
     items.forEach(item=>observer.observe(item));
   }
 }
 const synth=window.speechSynthesis;
 const supported=!!(synth&&typeof window.SpeechSynthesisUtterance==='function');
 let speaking=null;
 const update=(button,message)=>{
   const box=button.parentElement?.querySelector('[data-site-voice-state]');
   if(box)box.textContent=message;
 };
 for(const button of document.querySelectorAll('[data-site-voice]')){
   if(!supported){
     button.disabled=true;
     update(button,'Voice preview is not supported by this browser.');
     continue;
   }
   button.addEventListener('click',()=>{
     if(speaking===button&&synth.speaking){
       synth.cancel();speaking=null;button.textContent='▶ Hear a sample welcome';
       update(button,'Voice preview stopped.');
       return;
     }
     synth.cancel();
     const message=String(button.getAttribute('data-site-voice')||'').slice(0,550);
     if(!message)return;
     const utterance=new window.SpeechSynthesisUtterance(message);
     utterance.lang='en-US';utterance.rate=.97;utterance.pitch=1;
     speaking=button;
     button.textContent='■ Stop voice';
     update(button,'Playing a computer-generated example welcome.');
     const reset=(msg)=>{
       if(speaking!==button)return;
       speaking=null;button.textContent='▶ Hear a sample welcome';
       update(button,msg);
     };
     utterance.onend=()=>reset('Sample welcome finished.');
     utterance.onerror=()=>reset('Voice preview unavailable on this browser.');
     synth.speak(utterance);
   });
 }
 if(supported)window.addEventListener('pagehide',()=>synth.cancel());
})();

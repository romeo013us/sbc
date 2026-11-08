/* SBC V66.113: local-only demonstration of a customer inquiry.
 * No network requests, data storage, or automatic outreach.
 */
(function(){
'use strict';
function initialize(){
 const form=document.getElementById('sbcDemoRequest');
 const output=document.getElementById('sbcDemoRequestFeedback');
 if(!form||!output||form.dataset.bound==='1')return;
 form.dataset.bound='1';
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(form);
  const name=String(data.get('visitor')||'').trim().slice(0,70);
  const service=String(data.get('service')||'').trim().slice(0,100);
  const question=String(data.get('question')||'').trim().slice(0,600);
  if(!name){output.textContent='Enter a name to preview an inquiry.';return;}
  output.textContent='Sample inquiry prepared — NOT SENT.\n\nName: '+name+
   '\nService: '+service+'\nQuestion: '+(question||'(no question provided)')+
   '\n\nOn a completed customer website, SBC can connect this to an approved contact or booking system.';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();

/* SBC Workforce Theme V66.98.
 * Dark is the default. Each browser stores its choice per employee.
 * Presentation only; no CRM, authentication or payroll writes.
 */
(function(root,factory){
'use strict';
const theme=factory();
if(typeof module==='object'&&module.exports)module.exports=theme;
else{root.SBCWorkforceTheme=theme;theme.install(root);}
})(typeof window!=='undefined'?window:{},function(){
'use strict';
const KEY='sbc-workforce-theme-v1:';
const roleOf=role=>String(role||'').toLowerCase().includes('sales')?'caller':String(role||'').toLowerCase().includes('research')?'lead_researcher':String(role||'').toLowerCase();
const userKey=(role,id)=>KEY+roleOf(role)+':'+String(id||'guest').replace(/[^a-zA-Z0-9_.-]/g,'').slice(0,80);
const cleanTheme=v=>v==='light'?'light':'dark';
const safeStorage=w=>{try{return w.localStorage;}catch(_){return null;}};
function getSaved(storage,role,id){
 try{return cleanTheme(storage?.getItem(userKey(role,id)));}catch{return 'dark';}
}
function install(w){
 if(!w?.document)return;
 const doc=w.document;
 let currentRole='',currentId='',currentTheme='dark';
 function apply(theme,save){
  currentTheme=cleanTheme(theme);
  doc.documentElement.dataset.sbcTheme=currentTheme;
  doc.documentElement.style.colorScheme=currentTheme;
  doc.querySelectorAll('[data-sbc-theme-toggle]').forEach(btn=>{
   btn.setAttribute('aria-pressed',String(currentTheme==='light'));
   btn.setAttribute('aria-label',currentTheme==='dark'?'Switch to light mode':'Switch to dark mode');
   btn.title=currentTheme==='dark'?'Switch to light mode':'Switch to dark mode';
   btn.textContent=currentTheme==='dark'?'☀ Light Mode':'☾ Dark Mode';
  });
  if(save){try{safeStorage(w)?.setItem(userKey(currentRole,currentId),currentTheme);}catch(_){}}
  return currentTheme;
 }
 function attach(role,id){
  currentRole=roleOf(role||doc.body.dataset.workspaceRole||'employee');
  currentId=String(id||'guest');
  const saved=getSaved(safeStorage(w),currentRole,currentId);
  return apply(saved,false);
 }
 function toggle(){return apply(currentTheme==='dark'?'light':'dark',true);}
 function initialize(){
  doc.addEventListener('click',event=>{
   const button=event.target.closest('[data-sbc-theme-toggle]');
   if(!button)return;event.preventDefault();toggle();
  });
  if(!currentRole)attach(doc.body.dataset.workspaceRole||'employee','guest');
  else apply(currentTheme,false);
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
 w.SBCWorkforceTheme={attach,toggle,apply,getTheme:()=>currentTheme};
 return w.SBCWorkforceTheme;
}
return {install,cleanTheme,roleOf,userKey,getSaved};
});

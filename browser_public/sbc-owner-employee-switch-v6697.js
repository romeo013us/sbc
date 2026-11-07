/* SBC Owner Staff Desk V66.97. Owner can create expiring caller users;
 * View as Staff is read-only and never switches auth sessions.
 */
(function(){
'use strict';
const ID='sbcOwnerStaffSwitch';
let overlay=null,lastCredentials=null;
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(cls)e.className=cls;return e;};
function status(message){const target=document.getElementById('staff-status');if(target)target.textContent=String(message);}
async function api(url,options){
 const opts=Object.assign({credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}},options||{});
 if(opts.body)opts.headers=Object.assign({},opts.headers,{'Content-Type':'application/json'});
 const response=await fetch(url,opts);let data;
 try{data=await response.json();}catch{throw Error('SBC returned an invalid response.');}
 if(!response.ok||data?.ok===false)throw Error(data?.error||data?.message||'SBC request failed.');
 return data;
}
function generatePassword(size=24){
 if(!globalThis.crypto?.getRandomValues)throw Error('Secure password generation needs HTTPS.');
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%_-+';
 const stop=256-256%alphabet.length;let out='';
 while(out.length<size){const bytes=new Uint8Array(48);crypto.getRandomValues(bytes);for(const n of bytes){if(n>=stop)continue;out+=alphabet[n];if(out.length>=size)break;}}
 return out;
}
function close(){lastCredentials=null;overlay?.remove();overlay=null;}
async function listStaff(){
 const box=document.getElementById('staff-list');if(!box)return;
 box.replaceChildren(el('p','Loading team…'));
 try{
  const users=await api('/api/users');if(!Array.isArray(users))throw Error('Invalid employee directory.');
  box.replaceChildren();
  let listed=0;
  for(const u of users.filter(x=>['caller','lead_researcher','fulfillment'].includes(x.role))){
   listed++;
   const row=el('div',undefined,'staff-row'),details=el('div'),actions=el('div',undefined,'staff-actions');
   details.append(el('strong',(u.name||u.username||'Employee')+' · '+String(u.role).replace('_',' ')));
   details.append(el('small','Username: '+u.username+' · '+(u.active===false?'Inactive':'Active')+(u.expiresAt?' · Expires '+new Date(u.expiresAt).toLocaleDateString('en-US') :'')));
   if(['caller','lead_researcher'].includes(u.role)&&u.active!==false){
    const view=el('button','View Workstation (Read-only)');
    view.type='button';view.onclick=()=>window.open('/sales-caller.html?previewUserId='+encodeURIComponent(u.id),'_blank','noopener,noreferrer');
    actions.append(view);
   }
   row.append(details,actions);box.append(row);
  }
  if(!listed)box.append(el('p','No eligible workforce accounts found. Create the caller account below.'));
  status('Owner session verified. Viewing an employee is read-only; nothing is changed.');
 }catch(e){box.replaceChildren(el('p','Could not load staff: '+String(e?.message||e)));}
}
function open(){
 if(overlay)return;
 overlay=el('div');overlay.id=ID;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
 overlay.setAttribute('aria-label','Owner employee workstations');
 const modal=el('div',undefined,'staff-modal');
 const top=el('div',undefined,'staff-top'),heading=el('div');
 heading.append(el('h2','Employee Workstations'),el('p','Preview staff assignments using your existing owner login. You will not be signed in as an employee and cannot make calls, edit leads, or clock time from preview.'));
 const exit=el('button','Close');exit.type='button';exit.onclick=close;
 top.append(heading,exit);modal.append(top);
 const statusNode=el('div','Loading employee profiles…','staff-status');statusNode.id='staff-status';modal.append(statusNode);
 const list=el('div',undefined,'staff-box');list.id='staff-list';modal.append(list);
 const section=el('section',undefined,'staff-box');
 section.append(el('h3','Create Temporary Spanish Sales Caller Login'),el('p','This creates a caller-role account only after you confirm. Its password is generated securely on your computer, shown once, and expires after seven days. Owner onboarding and training approval are required before live calling.'));
 const form=el('form',undefined,'staff-form');
 const flds=[['Username','username','sbc.spanish.caller.temp'],['Employee display name','name','Spanish Sales Caller — Temporary']];
 for(const [label,key,value] of flds){const wrapper=el('label',label),i=el('input');i.id='staff-'+key;i.required=true;i.value=value;i.maxLength=key==='username'?40:100;wrapper.append(i);form.append(wrapper);}
 const action=el('button','Create Temporary Caller','staff-create');action.type='submit';action.id='staff-create-button';form.append(action);
 section.append(form);
 const receipt=el('div',undefined,'staff-result');receipt.id='staff-created';receipt.hidden=true;section.append(receipt);
 const copy=el('button','Copy Temporary Credentials');copy.type='button';copy.hidden=true;copy.id='staff-copy';section.append(copy);
 copy.onclick=()=>{if(!lastCredentials)return;navigator.clipboard?.writeText(lastCredentials).then(()=>status('Credentials copied. Share them securely with your new hire.')).catch(()=>status('Copy unavailable. Record the displayed password now.'));};
 form.onsubmit=async event=>{
  event.preventDefault();if(action.disabled)return;
  action.disabled=true;receipt.hidden=true;copy.hidden=true;lastCredentials=null;
  try{
   const username=document.getElementById('staff-username').value.trim().toLowerCase();
   const name=document.getElementById('staff-name').value.trim();
   if(!/^[a-z0-9._-]{3,40}$/.test(username)||name.length<3)throw Error('Enter a username (3–40 letters/numbers/dots/dashes) and display name.');
   const password=generatePassword();
   const expiresAt=new Date(Date.now()+7*86400000).toISOString();
   const created=await api('/api/users',{method:'POST',body:JSON.stringify({username,name,role:'caller',password,expiresAt})});
   if(!created?.id)throw Error('Account creation was not confirmed by SBC.');
   lastCredentials='SBC employee login\nURL: '+location.origin+'\nUsername: '+username+'\nTemporary password: '+password+'\nExpires: '+expiresAt;
   receipt.hidden=false;receipt.textContent=lastCredentials+'\nLive calling remains locked until owner clearance.';
   copy.hidden=false;
   status('Temporary caller created. The password is visible once; do not commit or store it in source control.');
   await listStaff();
  }catch(err){status('Account not created: '+String(err?.message||err));}
  finally{action.disabled=false;}
 };
 modal.append(section);overlay.append(modal);document.body.append(overlay);
 overlay.onclick=e=>{if(e.target===overlay)close();};
 listStaff();
}
async function init(){
 try{
  const current=await api('/api/me');
  if(current?.user?.role!=='owner'||document.getElementById('sbcOwnerStaffLauncher'))return;
  const launch=el('button','👥 View Staff / Create Login');launch.id='sbcOwnerStaffLauncher';launch.type='button';launch.onclick=open;document.body.append(launch);
 }catch(_){}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

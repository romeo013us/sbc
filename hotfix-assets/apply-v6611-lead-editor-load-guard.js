'use strict';
// P1: prevent asynchronous CRM record loads overwriting a user's in-progress
// typed values when a dialog is reopened or a network reply arrives late.
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6611_LEAD_EDITOR_LOAD_GUARD';
function once(s,before,after,name){
 const n=s.split(before).length-1;
 if(n!==1)throw Error(MARKER+': '+name+' expected 1 occurrence, got '+n);
 return s.replace(before,after);
}
function apply(root){
 const file=path.join(root,'public/sbc-lead-edit-v6606.js');
 const orig=fs.readFileSync(file,'utf8');
 if(orig.includes(MARKER))return {marker:MARKER,changed:false};
 let s=orig;
 s=once(s,
  "let activeId=null,activeRevision=null;",
  "let activeId=null,activeRevision=null,openSequence=0;\n  // "+MARKER+": disable editable fields until a verified lead fetch completes.\n  const enableFields=value=>{for(const input of form.querySelectorAll('input,select,textarea'))input.disabled=!value;};",
  'dialog state');
 s=once(s,
  "dlg.addEventListener('close',()=>{activeId=null;activeRevision=null});",
  "dlg.addEventListener('close',()=>{openSequence++;activeId=null;activeRevision=null;});",
  'invalidate pending requests on close');
 s=once(s,
  "activeId=button.dataset.sbcLeadEditId;activeRevision=null;",
  "activeId=button.dataset.sbcLeadEditId;activeRevision=null;const thisOpen=++openSequence;",
  'tokenize asynchronous fetch');
 s=once(s,
  "form.reset();submit.disabled=true;title.textContent='Loading lead…';note('Checking the current CRM record.');",
  "form.reset();enableFields(false);submit.disabled=true;title.textContent='Loading lead…';note('Checking the current CRM record.');",
  'prevent early typing');
 s=once(s,
  "if(activeId!==requestedId||String(data.data.id)!==requestedId)throw Error('CRM_IDENTITY_MISMATCH');",
  "if(thisOpen!==openSequence||activeId!==requestedId||String(data.data.id)!==requestedId)throw Error('CRM_IDENTITY_MISMATCH');",
  'reject outdated fetch');
 s=once(s,
  "submit.disabled=false;note('Save changes to update the authoritative CRM record.');",
  "enableFields(true);submit.disabled=false;note('Save changes to update the authoritative CRM record.');",
  'enable loaded fields');
 s=once(s,
  "}catch(err){note('Unable to load lead: '+String(err.message||err));}",
  "}catch(err){if(thisOpen===openSequence)note('Unable to load lead: '+String(err.message||err));}",
  'ignore stale fetch rejection');
 // Only a fully compatible reconstructed editor may be written.
 fs.writeFileSync(file,s);
 return {marker:MARKER,changed:true};
}
module.exports={MARKER,apply};

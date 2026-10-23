'use strict';
const fs=require('node:fs');
const path=require('node:path');
const MARKER='SBC_V6601_MASTER_PROSPECT_LIST';
const CSV_NAME='sbc-master-prospect-list-2026-10-23.csv';
function once(source,anchor,replacement,label){
 const count=source.split(anchor).length-1;
 if(count!==1)throw new Error(MARKER+': '+label+' anchor count '+count);
 return source.replace(anchor,replacement);
}
function apply(root){
 const sourceCsv=path.join(__dirname,CSV_NAME);
 const publicDir=path.join(root,'public');
 const publicCsv=path.join(publicDir,CSV_NAME);
 const uiFile=path.join(publicDir,'sbc-lead-import-v6541.js');
 if(!fs.existsSync(sourceCsv))throw new Error(MARKER+': missing bundled master list '+CSV_NAME);
 if(!fs.existsSync(uiFile))throw new Error(MARKER+': lead import UI not generated before master list patch');
 fs.mkdirSync(publicDir,{recursive:true});
 fs.copyFileSync(sourceCsv,publicCsv);
 let ui=fs.readFileSync(uiFile,'utf8');
 if(!ui.includes(MARKER)){
  const styleAnchor="const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);";
  const styleRepl=styleAnchor+"\n/* "+MARKER+" */\nconst masterStyle=document.createElement('style');masterStyle.id='sbc-master-prospect-list-style';masterStyle.textContent='#sbc-master-list-launcher{position:fixed;right:22px;bottom:136px;z-index:10020;border:0;border-radius:999px;padding:13px 18px;background:#ff6a00;color:#fff;font:700 14px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px #0b1f4433;cursor:pointer}#sbc-master-list-launcher:disabled{opacity:.6;cursor:progress}@media(max-width:600px){#sbc-master-list-launcher{right:12px;bottom:124px}}';document.head.appendChild(masterStyle);";
  ui=once(ui,styleAnchor,styleRepl,'master-list button style');
  const buttonAnchor='document.body.append(btn,overlay);';
  const buttonRepl=buttonAnchor+"\nconst masterBtn=document.createElement('button');masterBtn.id='sbc-master-list-launcher';masterBtn.type='button';masterBtn.textContent='Import Master List (253)';document.body.appendChild(masterBtn);";
  ui=once(ui,buttonAnchor,buttonRepl,'master-list launcher');
  const handlerAnchor="btn.addEventListener('click',()=>overlay.classList.add('open'));function close(){overlay.classList.remove('open');}";
  const handler=String.raw`masterBtn.addEventListener('click',async()=>{
 if(masterBtn.disabled)return;
 masterBtn.disabled=true;
 overlay.classList.add('open');
 rows=[];preview=null;previewBtn.disabled=true;commitBtn.disabled=true;fileInput.value='';
 byId('sbc-lead-import-summary').innerHTML='';byId('sbc-lead-import-tablewrap').hidden=true;
 setStatus('Loading the master prospect list and checking CRM duplicates. Preview is read-only…','');
 try{
  const response=await fetch('/${CSV_NAME}',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('Master list download failed (HTTP '+response.status+').');
  rows=parseCsv(await response.text());
  if(rows.length>500)throw new Error('Master list exceeds the safe 500-row import limit. Split it into smaller batches.');
  const invalid=rows.map((r,i)=>!r.business_name?i+1:null).filter(v=>v!==null);
  if(invalid.length)throw new Error('Business name missing on data row(s): '+invalid.join(', '));
  preview=await request({dryRun:true,rows:rows});
  renderResults(preview);
  previewBtn.disabled=false;
  const ready=Number(preview.ready||0),duplicates=Number(preview.duplicates||0);
  if(ready<=0){
   setStatus('Master-list check complete: no new leads to add; '+duplicates+' existing/duplicate lead(s) skipped. No records were written.', 'ok');
   commitBtn.disabled=true;
  }else{
   setStatus('Master-list check complete: '+ready+' new prospect(s), '+duplicates+' duplicate(s).', 'ok');
   if(window.confirm('Import '+ready+' new prospect(s) from the master list into the current SBC tenant? '+duplicates+' duplicate(s) will be skipped. The CRM will enforce tenant, recovery, and writer safeguards.')){
    previewBtn.disabled=true;commitBtn.disabled=true;
    const result=await request({dryRun:false,rows:rows});
    renderResults(result);preview=result;
    setStatus(result.message||('Import completed: '+Number(result.imported||0)+' added.'),'ok');
    commitBtn.disabled=true;
   }else{
    setStatus('Preview complete. Import cancelled; no records were written. Use Import new leads when ready.','');
    commitBtn.disabled=false;
   }
  }
 }catch(e){
  setStatus((e&&e.message?e.message:'Master-list import failed safely.')+' No partial import was committed.','error');
  commitBtn.disabled=true;
 }finally{
  masterBtn.disabled=false;
  previewBtn.disabled=!rows.length;
 }
});\n`;
  ui=once(ui,handlerAnchor,handlerAnchor+'\n'+handler,'master-list import workflow');
  fs.writeFileSync(uiFile,ui);
 }else if(!ui.includes('/'+CSV_NAME)){
  throw new Error(MARKER+': master-list marker exists but source URL is missing');
 }
 if(fs.statSync(publicCsv).size===0)throw new Error(MARKER+': public master-list CSV is empty');
 const finalUi=fs.readFileSync(uiFile,'utf8');
 if(!finalUi.includes("fetch('/"+CSV_NAME+"'")||!finalUi.includes('Import Master List (253)'))throw new Error(MARKER+': master list launcher or fetch registration missing');
 return {marker:MARKER,version:'66.0.1',rows:253,csv:CSV_NAME,ui:'public/sbc-lead-import-v6541.js',crmWrites:false,autoImport:false};
}
module.exports={apply,MARKER,CSV_NAME};

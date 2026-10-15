(function(){
'use strict';
if(window.__SBC_V6541_LEAD_IMPORT__)return;window.__SBC_V6541_LEAD_IMPORT__=true;
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const css=\`
#sbc-lead-import-launcher{position:fixed;right:22px;bottom:82px;z-index:10020;border:0;border-radius:999px;padding:13px 18px;background:#155eef;color:#fff;font:700 14px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px #0b1f4433;cursor:pointer}
#sbc-lead-import-overlay{position:fixed;inset:0;z-index:10030;background:#0b1020a8;display:none;align-items:center;justify-content:center;padding:18px;font:14px/1.45 system-ui,sans-serif;color:#172033}
#sbc-lead-import-overlay.open{display:flex}#sbc-lead-import-panel{width:min(1050px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px #0004}
#sbc-lead-import-head{padding:22px 24px;background:#101828;color:#fff;display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
#sbc-lead-import-head h2{margin:0 0 5px;font-size:21px}#sbc-lead-import-head p{margin:0;color:#cbd5e1}
#sbc-lead-import-body{padding:22px 24px}#sbc-lead-import-file{display:block;width:100%;padding:16px;border:1px dashed #98a2b3;border-radius:12px;background:#f8fafc;box-sizing:border-box}
#sbc-lead-import-status{margin:14px 0;padding:12px 14px;border-radius:10px;background:#f2f4f7;color:#344054;white-space:pre-wrap}
#sbc-lead-import-status.error{background:#fef3f2;color:#b42318}#sbc-lead-import-status.ok{background:#ecfdf3;color:#027a48}
#sbc-lead-import-summary{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}#sbc-lead-import-summary span{padding:8px 11px;border:1px solid #eaecf0;border-radius:9px;font-weight:650}
#sbc-lead-import-tablewrap{max-height:42vh;overflow:auto;border:1px solid #eaecf0;border-radius:10px}
#sbc-lead-import-table{width:100%;border-collapse:collapse;font-size:12px}#sbc-lead-import-table th,#sbc-lead-import-table td{text-align:left;padding:9px 10px;border-bottom:1px solid #eaecf0;vertical-align:top}#sbc-lead-import-table th{position:sticky;top:0;background:#f9fafb}
#sbc-lead-import-table .duplicate{color:#b54708;font-weight:700}#sbc-lead-import-table .ready{color:#027a48;font-weight:700}
#sbc-lead-import-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px}
#sbc-lead-import-actions button{border:1px solid #d0d5dd;border-radius:9px;padding:10px 14px;background:#fff;color:#344054;font-weight:700;cursor:pointer}
#sbc-lead-import-actions button.primary{background:#155eef;border-color:#155eef;color:#fff}#sbc-lead-import-actions button:disabled{opacity:.45;cursor:not-allowed}
@media(max-width:600px){#sbc-lead-import-launcher{right:12px;bottom:70px}#sbc-lead-import-body{padding:15px}#sbc-lead-import-head{padding:17px}#sbc-lead-import-table{font-size:11px}}
\`;
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
const btn=document.createElement('button');btn.id='sbc-lead-import-launcher';btn.type='button';btn.textContent='＋ Import Leads';
const overlay=document.createElement('div');overlay.id='sbc-lead-import-overlay';overlay.innerHTML='<section id="sbc-lead-import-panel" role="dialog" aria-modal="true" aria-labelledby="sbc-lead-import-title"><header id="sbc-lead-import-head"><div><h2 id="sbc-lead-import-title">Import Leads</h2><p>Upload CSV · Preview duplicates · Import safely into your tenant</p></div><button type="button" id="sbc-lead-import-x" aria-label="Close" style="border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer">×</button></header><div id="sbc-lead-import-body"><label for="sbc-lead-import-file"><strong>Select a CSV file</strong><p>Use the SBC lead import template. CSV files only; up to 500 rows per import.</p></label><input id="sbc-lead-import-file" type="file" accept=".csv,text/csv"><div id="sbc-lead-import-status">Choose a CSV file to begin. Preview does not write any records.</div><div id="sbc-lead-import-summary"></div><div id="sbc-lead-import-tablewrap" hidden><table id="sbc-lead-import-table"><thead><tr><th>Business</th><th>Contact</th><th>Phone</th><th>Email</th><th>Website</th><th>Import status</th></tr></thead><tbody></tbody></table></div><div id="sbc-lead-import-actions"><button type="button" id="sbc-lead-import-close">Close</button><button type="button" id="sbc-lead-import-preview" class="primary" disabled>Preview import</button><button type="button" id="sbc-lead-import-commit" class="primary" disabled>Import new leads</button></div></div></section>';
document.body.append(btn,overlay);
const byId=id=>document.getElementById(id),status=byId('sbc-lead-import-status'),previewBtn=byId('sbc-lead-import-preview'),commitBtn=byId('sbc-lead-import-commit'),fileInput=byId('sbc-lead-import-file');
let rows=[],preview=null;
function setStatus(message,kind){status.className=kind||'';status.textContent=message;}
function parseCsv(text){
 const out=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
  else if(ch==='"'&&field==='')quoted=true;else if(ch===','){row.push(field);field='';}
  else if(ch==='\n'){row.push(field);if(row.some(v=>v.trim()!==''))out.push(row);row=[];field='';}
  else if(ch!=='\r')field+=ch;
 }
 if(quoted)throw new Error('CSV has an unclosed quoted field.');
 if(field!==''||row.length){row.push(field);if(row.some(v=>v.trim()!==''))out.push(row);}
 if(out.length<2)throw new Error('CSV must include a header row and at least one lead.');
 const headers=out.shift().map(h=>h.replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s-]+/g,'_'));
 return out.map(values=>{const o={};headers.forEach((h,i)=>o[h]=String(values[i]||'').trim());return {
 business_name:o.business_name||o.businessname||o.business||'',contact_name:o.contact_name||o.contactname||o.contact||'',phone:o.phone||o.phone_number||'',email:o.email||'',website:o.website||'',website_status:o.website_status||'',lead_source:o.lead_source||o.source||'User-provided lead research',
 research_notes:[o.research_notes,o.decision_maker_notes,o.research_reference_url?('Research reference: '+o.research_reference_url):''].filter(Boolean).join(' | '),business_category:o.business_category||o.industry||'Barber Shop'
 };}).filter(r=>Object.values(r).some(v=>String(v).trim()));
}
async function request(body){const response=await fetch('/api/crm/leads/import',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body)});let data={};try{data=await response.json();}catch{}if(!response.ok||!data.ok)throw new Error(data.error||('Import request failed with HTTP '+response.status));return data;}
function renderResults(data){
 const body=byId('sbc-lead-import-table').querySelector('tbody');body.innerHTML='';const resultMap=new Map((data.results||[]).map(r=>[r.row,r]));
 rows.forEach((r,i)=>{const res=resultMap.get(i+1)||{status:'ready'};const tr=document.createElement('tr');tr.innerHTML='<td>'+esc(r.business_name)+'</td><td>'+esc(r.contact_name)+'</td><td>'+esc(r.phone)+'</td><td>'+esc(r.email)+'</td><td>'+esc(r.website)+'</td><td class="'+esc(res.status)+'">'+esc(res.status==='duplicate'?'Duplicate — skipped':res.status==='imported'?'Imported':'Ready')+(res.match?' · '+esc(res.match):'')+'</td>';body.appendChild(tr);});
 byId('sbc-lead-import-tablewrap').hidden=false;byId('sbc-lead-import-summary').innerHTML='<span>Total: '+esc(data.total)+'</span><span>New: '+esc(data.ready)+'</span><span>Duplicates: '+esc(data.duplicates)+'</span>'+(data.imported!==undefined?'<span>Added: '+esc(data.imported)+'</span>':'');
}
btn.addEventListener('click',()=>overlay.classList.add('open'));function close(){overlay.classList.remove('open');}
byId('sbc-lead-import-x').addEventListener('click',close);byId('sbc-lead-import-close').addEventListener('click',close);overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
fileInput.addEventListener('change',async()=>{rows=[];preview=null;previewBtn.disabled=true;commitBtn.disabled=true;byId('sbc-lead-import-summary').innerHTML='';byId('sbc-lead-import-tablewrap').hidden=true;const file=fileInput.files&&fileInput.files[0];if(!file)return;if(!/\.csv$/i.test(file.name)){setStatus('Please select a .csv file.','error');return;}try{rows=parseCsv(await file.text());if(rows.length>500)throw new Error('This file contains '+rows.length+' rows. Split it into batches of 500 or fewer.');const invalid=rows.map((r,i)=>!r.business_name?i+1:null).filter(v=>v!==null);if(invalid.length)throw new Error('Business name is missing on data row(s): '+invalid.join(', '));previewBtn.disabled=false;setStatus(rows.length+' leads loaded from '+file.name+'. Select Preview import to check duplicates.','');}catch(e){setStatus(e.message||'Unable to read CSV.','error');}});
previewBtn.addEventListener('click',async()=>{previewBtn.disabled=true;commitBtn.disabled=true;setStatus('Checking the CRM for duplicates. Preview is read-only…','');try{preview=await request({dryRun:true,rows});renderResults(preview);setStatus(preview.message||'Preview complete. No records were written.',Number(preview.ready||0)?'ok':'');commitBtn.disabled=Number(preview.ready||0)===0;}catch(e){setStatus(e.message+' No records were written.','error');}finally{previewBtn.disabled=!rows.length;}});
commitBtn.addEventListener('click',async()=>{if(!preview||!preview.ready)return;if(!window.confirm('Import '+preview.ready+' new lead(s) into the current SBC tenant? Duplicates will be skipped.'))return;commitBtn.disabled=true;previewBtn.disabled=true;setStatus('Importing leads. Please keep this window open…','');try{const result=await request({dryRun:false,rows});renderResults(result);setStatus(result.message||'Import complete.','ok');preview=result;commitBtn.disabled=true;}catch(e){setStatus(e.message,'error');commitBtn.disabled=false;}finally{previewBtn.disabled=!rows.length;}});
})();
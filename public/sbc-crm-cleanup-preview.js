/* SBC owner lead-cleanup preview, read-only. No API mutations. */
(function(root,factory){'use strict';const core=factory();if(typeof module==='object'&&module.exports)module.exports=core;else{root.SBCLeadCleanupPreview=core;core.install(root);}})(typeof window!=='undefined'?window:{},function(){
'use strict';
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const digits=v=>String(v||'').replace(/\D/g,'');
const phone=v=>{const x=digits(v);return x.length===11&&x[0]==='1'?x.slice(1):x;};
const isTest=c=>/\bSBC\b.*\b(test|qa)\b|\bdo not service\b|\binternal test\b/i.test(String(c?.businessName||'')+' '+String(c?.contactName||''));
function parse(text){
 if(typeof text!=='string'||!text.trim())throw Error('Select a non-empty CSV file.');
 if(text.length>800000)throw Error('CSV exceeds 800 KB.');
 if(/^PK[\x03\x05\x07]/.test(text)||/\[Content_Types\]\.xml|xl\/workbook\.xml/i.test(text))throw Error('Export the workbook to CSV UTF-8 first.');
 let rows=[],row=[],val='',quoted=false,atStart=true; text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'&&text[i+1]==='"'){val+='"';i++;}else if(c==='"')quoted=false;else val+=c;continue;}
  if(c==='"'&&atStart){quoted=true;atStart=false;continue;}
  if(c===','){row.push(val.trim());val='';atStart=true;continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(val.trim());if(row.some(Boolean))rows.push(row);if(rows.length>3000)throw Error('Maximum 3,000 CSV rows.');row=[];val='';atStart=true;continue;}
  val+=c;atStart=false;
 }
 if(quoted)throw Error('CSV has an unmatched quote.');
 row.push(val.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw Error('CSV has no business rows.');
 const headers=rows.shift().map(norm),index=names=>names.map(n=>headers.indexOf(n)).find(n=>n>=0)??-1;
 const positions={name:index(['businessname','business','companyname']),phone:index(['phone','phonenumber']),email:index(['email','emailaddress']),source:index(['source','researchsource']),owner:index(['forjonathansverification','forownerverification']),notes:index(['researchnotes','notes'])};
 if(positions.name<0)throw Error('Business Name column was not found.');
 return rows.map((r,i)=>{let get=k=>positions[k]<0?'':String(r[positions[k]]||'').trim();return {csvRow:i+2,name:get('name'),phone:get('phone'),email:get('email'),source:get('source'),owner:get('owner'),notes:get('notes')};}).filter(r=>r.name);
}
function compare(rows,customers){
 if(!Array.isArray(rows)||!Array.isArray(customers))throw Error('CSV and loaded CRM records are required.');
 const crm=customers.filter(c=>c&&!c._recoveryProjection),names=new Map(),phones=new Map(),emails=new Map();
 function add(map,key,lead){if(!key)return;if(!map.has(key))map.set(key,[]);map.get(key).push(lead);}
 for(const c of crm){add(names,norm(c.businessName),c);if(phone(c.phone).length===10)add(phones,phone(c.phone),c);add(emails,String(c.email||'').trim().toLowerCase(),c);}
 const matches=rows.map(r=>{
  const possible=new Map();for(const c of [...(names.get(norm(r.name))||[]),...(phones.get(phone(r.phone))||[]),...(emails.get(r.email.toLowerCase())||[])])possible.set(String(c.id),c);
  const candidates=[...possible.values()],exact=candidates.filter(c=>norm(c.businessName)===norm(r.name)&&phone(c.phone).length===10&&phone(c.phone)===phone(r.phone));
  const result=exact.length===1?'MATCH — name and phone':exact.length>1?'REVIEW — repeated exact record':candidates.length?'REVIEW — partial/conflicting match':'NOT MATCHED in loaded CRM';
  return {csv:r,candidates,exact,result,flags:[!r.source?'Missing research source':'',r.owner?'Owner verification note':'',/redirect|unusable|parked|inaccessible/i.test(r.notes)?'Website opportunity — check':''].filter(Boolean)};
 });
 const groups=new Map();
 for(const c of crm){const k=norm(c.businessName)+'|'+phone(c.phone);if(!norm(c.businessName)||phone(c.phone).length!==10)continue;add(groups,k,c);}
 return {crmCount:crm.length,matches,exact:matches.filter(m=>m.result==='MATCH — name and phone').length,review:matches.filter(m=>m.result.startsWith('REVIEW')).length,unmatched:matches.filter(m=>m.result.startsWith('NOT')).length,tests:crm.filter(isTest),repeated:[...groups.values()].filter(a=>a.length>1)};
}
function install(win){
 if(!win?.document||!win.MutationObserver)return;const doc=win.document;
 const owner=()=>{try{return typeof state!=='undefined'&&state?.me?.role==='owner'&&Array.isArray(state?.data?.customers);}catch(_){return false;}};
 const make=(tag,txt,styles)=>{const e=doc.createElement(tag);if(txt!==undefined)e.textContent=String(txt);if(styles)e.style.cssText=styles;return e;};
 function show(){
  if(!owner())return;doc.getElementById('sbc-cleanup-overlay')?.remove();
  const overlay=make('div',undefined,'position:fixed;inset:0;z-index:2147482900;background:#020916e8;display:flex;align-items:center;justify-content:center;padding:12px');
  overlay.id='sbc-cleanup-overlay';
  const box=make('section',undefined,'background:#13243b;color:#e9f5ff;border:2px solid #527baa;border-radius:14px;padding:20px;width:min(1100px,100%);max-height:94vh;overflow:auto;font:14px/1.5 system-ui,sans-serif');
  box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','CRM cleanup preview');
  const top=make('div');top.style.cssText='display:flex;justify-content:space-between;align-items:start;gap:12px';
  const heading=make('h2','CRM Cleanup Preview — Read Only');heading.style.margin='0';
  const close=make('button','Close');close.className='btn';close.type='button';close.onclick=()=>overlay.remove();top.append(heading,close);
  box.append(top,make('p','Select Lorna’s Master List CSV. This compares against CRM records currently loaded in your owner session. The file stays in this browser; no records are changed.'));
  const file=make('input');file.type='file';file.accept='.csv,text/csv';file.setAttribute('aria-label','Master list CSV');file.style.cssText='display:block;margin:12px 0';
  const status=make('p','');status.setAttribute('role','status');
  const results=make('div');results.style.cssText='overflow:auto;max-height:58vh';
  function section(title){const h=make('h3',title);results.append(h);}
  function table(headers,rows){
   const t=make('table');t.style.cssText='border-collapse:collapse;width:100%;font-size:12px';
   const th=make('tr');for(const h of headers){const c=make('th',h,'text-align:left;border:1px solid #445c78;padding:7px');th.append(c);}t.append(th);
   for(const row of rows){const tr=make('tr');for(const val of row){const c=make('td',val??'','border:1px solid #445c78;padding:7px;vertical-align:top');tr.append(c);}t.append(tr);}results.append(t);
  }
  function base(){
   const crm=state.data.customers.filter(c=>c&&!c._recoveryProjection),tests=crm.filter(isTest);
   status.textContent=crm.length+' CRM records loaded; '+tests.length+' possible internal test records. No changes made.';
   results.replaceChildren();section('Possible internal tests — check payment and history before removal');
   table(['CRM ID','Business','Status','Source'],tests.map(c=>[c.id,c.businessName,c.status,c.source]));
  }
  base();
  file.onchange=async()=>{
   const f=file.files?.[0];if(!f){base();return;}
   if(f.size>800000){status.textContent='File exceeds 800 KB. No changes made.';return;}
   status.textContent='Reading and comparing locally…';results.replaceChildren();
   try{
    const rows=parse(await f.text());if(!owner())throw Error('Owner session expired or records are unavailable.');
    const data=compare(rows,state.data.customers);
    status.textContent=rows.length+' named CSV leads · '+data.exact+' strong CRM matches · '+data.review+' needs match review · '+data.unmatched+' absent from loaded CRM · '+data.repeated.length+' repeated CRM groups · '+data.tests.length+' possible internal test records. ZERO deletions.';
    section('Possible internal tests — inspect before any deletion');
    table(['CRM ID','Business','Status','Source'],data.tests.map(c=>[c.id,c.businessName,c.status,c.source]));
    section('Repeated business name + phone in loaded CRM');
    table(['CRM ID(s)','Business','Phone','Status'],data.repeated.map(group=>[group.map(c=>c.id).join(', '),group[0].businessName,group[0].phone,group.map(c=>c.status||'—').join(' / ')]));
    section('Lorna master CSV compared with loaded CRM');
    table(['CSV row','Business','Match result','CRM ID(s)','Research flags'],data.matches.map(m=>[m.csv.csvRow,m.csv.name,m.result,m.candidates.map(c=>c.id).join(', '),m.flags.join('; ')]));
   }catch(e){status.textContent='Read-only comparison failed: '+String(e?.message||e).slice(0,220);results.replaceChildren();}
  };
  box.append(file,status,results);overlay.append(box);doc.body.append(overlay);file.focus();
 }
 function mount(){
  if(!owner())return;const target=doc.getElementById('deleteSelectedCustomers');if(!target||!target.parentNode||doc.getElementById('sbc-open-cleanup-preview'))return;
  const button=make('button','🛡 Cleanup Preview (Read Only)');button.id='sbc-open-cleanup-preview';button.className='btn';button.type='button';button.onclick=show;target.parentNode.insertBefore(button,target);
 }
 const target=doc.getElementById('app')||doc.body;
 new win.MutationObserver(mount).observe(target,{childList:true,subtree:true});mount();
}
return {parseCSV:parse,compare,install,phone,isTest};
});
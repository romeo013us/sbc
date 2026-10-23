'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const patch=require('./apply-v6601-master-prospect-list');
const csvPath=path.join(__dirname,'sbc-master-prospect-list-2026-10-23.csv');
const csv=fs.readFileSync(csvPath,'utf8');
function parseCsv(text){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
  else if(ch==='"'&&field==='')quoted=true;
  else if(ch===','){row.push(field);field='';}
  else if(ch==='\n'){row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}
  else if(ch!=='\r')field+=ch;
 }
 if(quoted)throw Error('CSV has an unclosed quoted field.');
 if(field!==''||row.length){row.push(field);if(row.some(x=>x.trim()))rows.push(row);}
 return rows;
}
function normalize(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');}
const parsed=parseCsv(csv);
assert.equal(parsed.length,254,'header + 253 unique master prospects');
const header=parsed[0];
assert.ok(['business_name','contact_name','phone','email','website','website_status','lead_source','research_notes','business_category'].every(h=>header.includes(h)));
const bi=header.indexOf('business_name');
assert.equal(new Set(parsed.slice(1).map(r=>normalize(r[bi]))).size,253,'business names must be unique after normalization');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-v6601-master-list-'));
try{
 const pub=path.join(root,'public');fs.mkdirSync(pub,{recursive:true});
 const fixture=[
  "(function(){",
  "const css='#sbc-lead-import-launcher{position:fixed;}';",
  "const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);",
  "const btn=document.createElement('button');btn.id='sbc-lead-import-launcher';",
  "const overlay=document.createElement('div');overlay.id='sbc-lead-import-overlay';",
  "document.body.append(btn,overlay);",
  "const byId=id=>document.getElementById(id),status=byId('sbc-lead-import-status'),previewBtn=byId('sbc-lead-import-preview'),commitBtn=byId('sbc-lead-import-commit'),fileInput=byId('sbc-lead-import-file');",
  "let rows=[],preview=null;",
  "function setStatus(){} function parseCsv(){} async function request(){} function renderResults(){}",
  "btn.addEventListener('click',()=>overlay.classList.add('open'));function close(){overlay.classList.remove('open');}",
  "})();"
 ].join('\n');
 fs.writeFileSync(path.join(pub,'sbc-lead-import-v6541.js'),fixture);
 const result=patch.apply(root);
 assert.equal(result.marker,patch.MARKER);
 assert.equal(result.rows,253);
 assert.equal(result.crmWrites,false);
 assert.equal(result.autoImport,false);
 assert.equal(fs.readFileSync(path.join(pub,'sbc-master-prospect-list-2026-10-23.csv'),'utf8'),csv);
 const uiFile=path.join(pub,'sbc-lead-import-v6541.js');
 const ui=fs.readFileSync(uiFile,'utf8');
 assert.ok(ui.includes('Import Master List (253)'));
 assert.ok(ui.includes("fetch('/sbc-master-prospect-list-2026-10-23.csv'"));
 assert.ok(ui.includes('request({dryRun:true,rows:rows})'));
 assert.ok(ui.includes('request({dryRun:false,rows:rows})'));
 assert.ok(ui.includes('window.confirm('));
 cp.execFileSync(process.execPath,['--check',uiFile],{stdio:'pipe'});
 assert.equal(patch.apply(root).rows,253,'reapplying patch must remain safe');
 console.log('[SBC V6601 MASTER LIST TEST] PASS: 253 unique prospects bundled, served, and wired to guarded preview/import workflow.');
}finally{fs.rmSync(root,{recursive:true,force:true});}

#!/usr/bin/env node
'use strict';
// Read-only relational candidate reconciliation. Never emits SQL mutations.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function parseCsv(text) {
  const rows=[]; let row=[], field='', quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const c=text[i]; if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field);rows.push(row);row=[];field='';}else if(c!=='\r')field+=c;}
  if(field.length||row.length){row.push(field);rows.push(row);} if(!rows.length)return [];
  const headers=rows.shift().map(v=>v.trim()); return rows.filter(r=>r.some(v=>v.trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
}
function norm(v){return String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function phone(v){const d=String(v||'').replace(/\D/g,'');return d.length>=10?d.slice(-10):'';}
function sqlUnquote(s){s=s.trim();if(/^NULL$/i.test(s))return null;if(s.length>=2&&s[0]==="'"&&s[s.length-1]==="'"){s=s.slice(1,-1).replace(/\\([\\'"nrt0bz])/g,(_,c)=>({'n':'\n','r':'\r','t':'\t','0':'\0','b':'\b','z':'\x1a'}[c]??c)).replace(/''/g,"'");return s;}return s;}
function splitSqlValues(s){const out=[];let start=0,q=false,esc=false;for(let i=0;i<s.length;i++){const c=s[i];if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c==="'"){if(s[i+1]==="'"){i++;continue;}q=false;}}else if(c==="'")q=true;else if(c===','){out.push(sqlUnquote(s.slice(start,i)));start=i+1;}}out.push(sqlUnquote(s.slice(start)));return out;}
function findInsertRows(sql, table){
  const needle=new RegExp('INSERT\\s+INTO\\s+`?'+table+'`?\\s*\\(([^;]*?)\\)\\s*VALUES\\s*','ig'); let m; const rows=[];
  while((m=needle.exec(sql))){const cols=[...m[1].matchAll(/`([^`]+)`/g)].map(x=>x[1]);let i=needle.lastIndex, start=-1, depth=0,q=false,esc=false;
    for(;i<sql.length;i++){const c=sql[i];if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c==="'"){if(sql[i+1]==="'"){i++;continue;}q=false;}continue;}if(c==="'"){q=true;continue;}if(c==='('){if(depth===0)start=i+1;depth++;}else if(c===')'){depth--;if(depth===0&&start>=0){const vals=splitSqlValues(sql.slice(start,i));if(vals.length===cols.length){const r={};cols.forEach((col,j)=>r[col]=vals[j]);rows.push(r);}start=-1;}}else if(c===';'&&depth===0)break;}
    needle.lastIndex=Math.max(i+1,needle.lastIndex);
  } return rows;
}
function get(r,...keys){for(const k of keys)if(r[k]!==undefined&&r[k]!==null&&String(r[k]).trim())return String(r[k]);return '';}
function keySet(r){return {name:norm(get(r,'business_name','Business Name','business')),email:norm(get(r,'email','Email')),phone:phone(get(r,'phone','Phone'))};}
function compare(csv, dbRows){const index={name:new Map(),email:new Map(),phone:new Map()};for(const r of dbRows){const k=keySet(r);for(const type of Object.keys(index)){if(k[type]){if(!index[type].has(k[type]))index[type].set(k[type],[]);index[type].get(k[type]).push(r);}}}return csv.map(c=>{const k=keySet(c),matches=[];for(const type of Object.keys(index)){if(k[type])for(const r of (index[type].get(k[type])||[]))matches.push({field:type,tableId:get(r,'id'),businessName:get(r,'business_name'),source:get(r,'source'),tenantId:get(r,'tenant_id')});}const unique=[...new Map(matches.map(m=>[`${m.field}:${m.tableId}`,m])).values()];return {sourceFile:c._sourceFile,businessName:get(c,'Business Name','business_name'),contactName:get(c,'Contact Name','contact_name'),email:get(c,'Email','email'),phone:get(c,'Phone','phone'),matchCount:unique.length,matches:unique,classification:unique.length?'MATCH_CANDIDATE':'NO_MATCH_FOUND'};});}
const sqlPath=process.argv[2]?path.resolve(process.cwd(),process.argv[2]):path.join(root,'database.sql');
if(!fs.existsSync(sqlPath)){console.error(JSON.stringify({ok:false,error:'SQL_DUMP_NOT_FOUND',path:sqlPath}));process.exit(2);}
const sql=fs.readFileSync(sqlPath,'utf8'); const csvDir=path.join(root,'starter-leads'); const files=fs.existsSync(csvDir)?fs.readdirSync(csvDir).filter(f=>f.toLowerCase().endsWith('.csv')).sort():[];
const csv=[];for(const file of files)for(const row of parseCsv(fs.readFileSync(path.join(csvDir,file),'utf8')))csv.push({...row,_sourceFile:file});
const customers=findInsertRows(sql,'sbc_customers');const mesh=findInsertRows(sql,'sbc_lead_mesh');const customerCompare=compare(csv,customers);const meshCompare=compare(csv,mesh);
const claims=[
 {id:244,name:'Lorna Ingest Entity 01',source:'SBC-Lorna-Barbershop-Batch-2026-10-09.csv',hash:'0x7a51f'},
 {id:245,name:'Lorna Ingest Entity 02',source:'SBC-Lorna-Barbershop-Batch-2026-10-09.csv',hash:'0x3c22b'},
 {id:246,name:'Retail Barbershop Lead A',source:'SBC-Jonathan-Barbershop-Backup-2026-10-09.csv',hash:'0xf6e62'},
 {id:247,name:'Retail Barbershop Lead B',source:'SBC-Jonathan-Barbershop-Backup-2026-10-09.csv',hash:'0x3cb64'},
 {id:248,name:'Historical Legacy Sync',source:'SBC-Lorna-Lead-Backup-2026-10-06.csv',hash:'0x19d78'}
].map(claim=>{const rows=csv.filter(r=>r._sourceFile===claim.source);const exactName=rows.some(r=>norm(get(r,'Business Name','business_name'))===norm(claim.name));return {...claim,sourceFilePresent:files.includes(claim.source),exactNamePresentInSourceCsv:exactName,assessment:exactName?'NAME_PRESENT_IN_SOURCE_NEEDS_ROW_VALIDATION':'CLAIMED_NAME_NOT_FOUND_IN_NAMED_SOURCE_CSV'};});
const report={reportType:'READ_ONLY_RELATIONAL_CANDIDATE_RECONCILIATION',readOnly:true,createdAt:new Date().toISOString(),sqlDump:path.relative(process.cwd(),sqlPath),sqlBytes:Buffer.byteLength(sql),tables:{sbc_customers:{parsedRows:customers.length},sbc_lead_mesh:{parsedRows:mesh.length}},sourceFiles:files.map(file=>({file,rows:parseCsv(fs.readFileSync(path.join(csvDir,file),'utf8')).length})),csvCandidateRows:csv.length,customerTableCandidateMatches:customerCompare.filter(r=>r.matchCount).length,leadMeshCandidateMatches:meshCompare.filter(r=>r.matchCount).length,claimedFiveRecordAudit:claims,customerCandidates:customerCompare,leadMeshCandidates:meshCompare,limitations:['This compares CSV candidates to rows in the supplied dump; it does not prove a historical baseline.','Name/email/phone matching identifies candidates, not guaranteed identity. Review ambiguous matches manually.','The five proposed IDs/names/hashes are unverified claims; hashes are not validated against source content.','No SQL patch is generated. No database is connected to or modified.','A genuine pre-incident snapshot is required to prove which records were missing.']};
console.log(JSON.stringify(report,null,2));

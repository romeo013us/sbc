'use strict';
const fs=require('node:fs'),path=require('node:path');
const MARKER='SBC_V6629_IMPORT_HTTP200_RESPONSE_CONTRACT';
function single(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' expected one, got '+n);return s.replace(a,b);}
function apply(root){
 const file=path.join(root,'public','sbc-lead-import-v6541.js');
 const htmlFile=path.join(root,'public','index.html');
 const swFile=path.join(root,'public','sw.js');
 let ui=fs.readFileSync(file,'utf8'),html=fs.readFileSync(htmlFile,'utf8'),sw=fs.readFileSync(swFile,'utf8');
 if(ui.includes(MARKER))throw Error(MARKER+': repeated patch');
 const a=ui.indexOf('async function request(body){'),b=ui.indexOf('function renderResults(data){');
 if(a<0||b<a||ui.indexOf('async function request(body){',a+2)!==-1)throw Error(MARKER+': unique import request function not found');
 const newRequest=[
  'async function request(body){',
  " const url='/api/crm/leads/import';",
  " const response=await fetch(url,{method:'POST',credentials:'same-origin',redirect:'manual',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});",
  " const contentType=String(response.headers.get('content-type')||'').toLowerCase();",
  " if(response.type==='opaqueredirect'||response.redirected){throw new Error('Import session was redirected. Sign in to SBC Published again, reload the page, and preview the CSV before importing. No records were confirmed saved.');}",
  " if(!contentType.includes('application/json')){throw new Error('Import API returned HTTP '+response.status+' with '+(contentType||'no content type')+' instead of JSON. This usually means a stale UI, an authentication redirect, or an HTML fallback route. No records were confirmed saved. Refresh SBC, sign in, and check the API Network response.');}",
  ' let data;',
  " try{data=await response.json();}catch(e){throw new Error('Import API returned malformed JSON (HTTP '+response.status+'). No records were confirmed saved.');}",
  " if(!response.ok||!data||data.ok!==true){const detail=String(data?.detail||'').slice(0,240);throw new Error(String(data?.error||data?.message||'Import API rejected request')+' (HTTP '+response.status+')'+(detail?' — '+detail:''));}",
  " if(body.dryRun===true && data.dryRun!==true)throw new Error('Import preview received a non-preview response. Do not retry automatically; no new writes were requested.');",
  " if(body.dryRun===false && (data.dryRun!==false||!Number.isFinite(Number(data.imported))))throw new Error('Import save was not explicitly confirmed by the API; check CRM before retrying to prevent duplicates.');",
  ' return data;',
  '}',
  '// '+MARKER+': HTTP 200 alone is never sufficient proof of an import preview or write.',
  ''
 ].join('\n');
 ui=ui.slice(0,a)+newRequest+ui.slice(b);
 const scriptRegex=/\/sbc-lead-import-v6541\.js\?v=[^"'<> ]+/g;
 const matches=[...html.matchAll(scriptRegex)];
 if(matches.length!==1)throw Error(MARKER+': importer script URL expected one, found '+matches.length);
 html=html.replace(scriptRegex,'/sbc-lead-import-v6541.js?v=66.29-import-http200-contract');
 const cache=sw.match(/const CACHE=['"][^'"]+['"]/);
 if(!cache)throw Error(MARKER+': service-worker cache ID missing');
 sw=sw.replace(cache[0],"const CACHE='sbc-static-v66-29-import-contract'");
 for(const [target,value] of [[file,ui],[htmlFile,html],[swFile,sw]])fs.writeFileSync(target,value);
 return {marker:MARKER,readOnlyPreview:true,jsonRequired:true,csrfCookiePreserved:true,writerControlsUnchanged:true,autoRetryDisabled:true};
}
module.exports={apply,MARKER};
'use strict';
// Temporary, read-only diagnostic in disposable reconstruction; never opens production.
const fs=require('node:fs'),path=require('node:path');
if(process.env.CI!=='true'||process.env.SBC_RUNTIME_ROLE!=='readonly')throw Error('REFUSE_OUTSIDE_READONLY_CI');
const target=path.resolve(process.env.SBC_RUNTIME_ROOT||'.sbc-isolated-runtime');
const file=path.join(target,'server.js');
const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
const hits=[];
for(let i=0;i<lines.length;i++){
 if(/\b(?:async\s+)?function\s+saveData\b|\b(?:const|let|var)\s+saveData\s*=|\bsaveData\s*:\s*(?:async\s*)?function/.test(lines[i])){
  hits.push({line:i+1,source:lines.slice(Math.max(0,i-2),Math.min(lines.length,i+38)).map((v,j)=>String(Math.max(0,i-2)+j+1).padStart(5)+' '+v).join('\n')});
 }
}
for(const [n,anchor] of ["create","app.post('/api/customers'"],["edit","app.put('/api/customers/:id'"],["notes","app.post('/api/customers/:id/account-notes'"],["single-delete","app.delete('/api/customers/:id'"],["bulk-delete","app.post('/api/customers/bulk-delete'"]]){
 const i=lines.findIndex(x=>x.includes(anchor));
 if(i>=0)hits.push({route:n,line:i+1,source:lines.slice(i,Math.min(lines.length,i+40)).map((v,j)=>String(i+j+1).padStart(5)+' '+v).join('\n')});
}
console.log('READONLY_LEGACY_DURABILITY_DIAGNOSTIC '+JSON.stringify({definitionCount:hits.filter(x=>x.line&&!x.route).length,samples:hits}).slice(0,22000));
if(!hits.length)throw Error('SAVE_DATA_AND_ROUTES_ABSENT');

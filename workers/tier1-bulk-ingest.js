'use strict';
const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const TIER1=require('../enterprise/v562-tier1-architecture');
const INTAKE=require('../enterprise/v56131-lead-intake');
(async()=>{
  const dir=path.resolve(process.argv[2]||'');if(!dir)throw new Error('Job directory required');
  const req=JSON.parse(await fsp.readFile(path.join(dir,'request.json'),'utf8'));
  const csv=Buffer.from(String(req.csvBase64||''),'base64');
  const rows=TIER1.parseCsvBinary(csv,{maxBytes:25*1024*1024,maxRows:INTAKE.MAX_ROWS});
  const out=INTAKE.enrichRows(rows,{batchId:req.batchId,source:req.source});
  const resultPath=path.join(dir,'result.ndjson');
  const ws=fs.createWriteStream(resultPath,{encoding:'utf8'});
  for(const lead of out.leads){if(!ws.write(JSON.stringify(lead)+'\n'))await new Promise(r=>ws.once('drain',r));}
  await new Promise((resolve,reject)=>{ws.once('finish',resolve);ws.once('error',reject);ws.end();});
  await fsp.writeFile(path.join(dir,'summary.json'),JSON.stringify({counts:out.counts,batchId:out.batchId,source:out.source,version:out.version}));
  if(process.send)process.send({status:'COMPLETE',resultPath,summaryPath:path.join(dir,'summary.json'),counts:out.counts});
  setTimeout(()=>process.exit(0),10);
})().catch(async e=>{try{await fsp.writeFile(path.join(path.resolve(process.argv[2]||'.'),'error.json'),JSON.stringify({error:String(e.message||e)}));}catch{};if(process.send)process.send({status:'ERROR',error:String(e.message||e)});process.exit(1);});

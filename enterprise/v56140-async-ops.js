// SBC_V6520_STRICT_TENANT_HARDENING
'use strict';

function __sbcRequireTenantId(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Object.assign(new Error('TENANT_CONTEXT_REQUIRED'),{code:'TENANT_CONTEXT_REQUIRED',status:403});return n;}
const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const {fork}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const JOB_ROOT=path.join(os.tmpdir(),'sbc-v56140-ingest');
const WORKER=path.join(ROOT,'workers','tier1-bulk-ingest.js');
const VERSION='56.14.0-ASYNC-OPS';
const MAX_CONCURRENCY=Math.max(1,Math.min(4,Number(process.env.SBC_INGEST_WORKERS||2)));
const MAX_QUEUE=Math.max(5,Math.min(100,Number(process.env.SBC_INGEST_QUEUE_MAX||25)));
const queue=[];const active=new Map();let configured=false;let completionHandler=null;
async function ensureRoot(){await fsp.mkdir(JOB_ROOT,{recursive:true});}
function jobId(){return `ING-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;}
function status(){return {version:VERSION,maxConcurrency:MAX_CONCURRENCY,maxQueue:MAX_QUEUE,queued:queue.length,active:active.size,capacity:Math.max(0,MAX_QUEUE-queue.length-active.size)};}
function configure({onComplete}={}){if(typeof onComplete==='function')completionHandler=onComplete;configured=true;return status();}
async function enqueue({tenantId=1,batchId,source='SBC Spreadsheet',csvBase64}){
  if(!configured) throw new Error('Async ingestion worker is not configured.');
  if(typeof csvBase64!=='string'||!csvBase64.trim()) throw new Error('csvBase64 is required.');
  if(queue.length+active.size>=MAX_QUEUE) throw Object.assign(new Error('Ingestion queue is at capacity. Retry shortly.'),{code:'INGEST_QUEUE_FULL'});
  await ensureRoot();
  const id=jobId();const dir=path.join(JOB_ROOT,id);await fsp.mkdir(dir,{recursive:true});
  await fsp.writeFile(path.join(dir,'request.json'),JSON.stringify({id,tenantId:Number(__sbcRequireTenantId(tenantId)),batchId:String(batchId||id),source:String(source||'SBC Spreadsheet'),csvBase64}),'utf8');
  const job={id,tenantId:Number(__sbcRequireTenantId(tenantId)),batchId:String(batchId||id),source:String(source||'SBC Spreadsheet'),dir,status:'QUEUED',createdAt:new Date().toISOString()};
  queue.push(job);pump();return {...job,status:'QUEUED',queue:status()};
}
function pump(){while(active.size<MAX_CONCURRENCY&&queue.length){const job=queue.shift();run(job).catch(()=>{});}}
async function run(job){active.set(job.id,job);job.status='RUNNING';job.attempts=Number(job.attempts||0)+1;let child;try{
  child=fork(WORKER,[job.dir],{stdio:['ignore','pipe','pipe'],execArgv:[]});
  const result=await new Promise((resolve,reject)=>{let settled=false;const done=(err,val)=>{if(settled)return;settled=true;err?reject(err):resolve(val)};child.on('message',m=>m?.status==='COMPLETE'?done(null,m):m?.status==='ERROR'?done(new Error(m.error||'Worker failed')):null);child.on('error',done);child.on('exit',(code,signal)=>{if(!settled)done(new Error(`Ingestion worker exited code=${code} signal=${signal||''}`));});});
  job.status='COMPLETE';job.resultPath=result.resultPath;job.completedAt=new Date().toISOString();
  if(completionHandler) await completionHandler(job,result);
}catch(e){job.status=job.attempts<3?'RETRY':'FAILED';job.error=String(e.message||e).slice(0,500);job.completedAt=new Date().toISOString();if(job.status==='RETRY'){setTimeout(()=>{queue.push({...job,status:'RETRY'});pump();},Math.min(30000,5000*job.attempts));}else if(completionHandler) await completionHandler(job,{status:'ERROR',error:job.error});}
finally{active.delete(job.id);pump();}}
async function recover(){await ensureRoot();const dirs=await fsp.readdir(JOB_ROOT,{withFileTypes:true});for(const d of dirs.filter(x=>x.isDirectory())){const dir=path.join(JOB_ROOT,d.name);const req=path.join(dir,'request.json');const done=path.join(dir,'result.ndjson');const merged=path.join(dir,'merged.ok');if(!fs.existsSync(req)||fs.existsSync(merged))continue;try{const payload=JSON.parse(await fsp.readFile(req,'utf8'));if(fs.existsSync(done)){if(completionHandler)await completionHandler({...payload,dir,status:'COMPLETE',resultPath:done},{status:'COMPLETE',resultPath:done,recovered:true});}else if(queue.length+active.size<MAX_QUEUE){queue.push({...payload,dir,id:payload.id,status:'RECOVERED'});}}catch(e){try{await fsp.writeFile(path.join(dir,'recovery.error'),String(e.message||e));}catch{}}}pump();return status();}
module.exports={VERSION,JOB_ROOT,WORKER,status,configure,enqueue,recover};

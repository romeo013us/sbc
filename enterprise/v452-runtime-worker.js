'use strict';
const {parentPort,workerData}=require('worker_threads');
const fs=require('fs');const path=require('path');
const cache=new Map();
const appendPath=path.join(__dirname,'..','data','v452-transaction.log');
function prune(){const now=Date.now();for(const [k,v] of cache)if(v.expiresAt&&v.expiresAt<=now)cache.delete(k)}
setInterval(prune,5000).unref();
function analytics(payload={}){
  const rows=Array.isArray(payload.rows)?payload.rows:[];
  return {accepted:true,count:rows.length,ts:new Date().toISOString()};
}
function vendorLoop(payload={}){
  return {accepted:true,provider:String(payload.provider||'unknown'),jobId:String(payload.jobId||''),ts:new Date().toISOString()};
}
parentPort.on('message',m=>{
  try{
    let result=null;
    if(workerData.kind==='cache'){
      if(m.op==='get'){const v=cache.get(m.key);if(v&&(!v.expiresAt||v.expiresAt>Date.now()))result=v.value;else cache.delete(m.key)}
      if(m.op==='set'){cache.set(m.key,{value:m.value,expiresAt:Date.now()+Math.max(1000,Number(m.ttlMs||60000))});result=true}
      if(m.op==='delete'){cache.delete(m.key);result=true}
    } else if(workerData.kind==='telemetry'){
      if(m.op==='event')result={accepted:true,ts:new Date().toISOString(),event:String(m.event||'event'),meta:m.meta||{}};
    } else if(workerData.kind==='append'){
      if(m.op==='append'){
        fs.mkdirSync(path.dirname(appendPath),{recursive:true});
        fs.appendFileSync(appendPath,JSON.stringify({ts:new Date().toISOString(),...m.record})+'\n',{encoding:'utf8'});
        result={accepted:true,path:'data/v452-transaction.log'};
      }
    } else if(workerData.kind==='analytics'){
      if(m.op==='analyze')result=analytics(m.payload);
    } else if(workerData.kind==='vendor'){
      if(m.op==='dispatch')result=vendorLoop(m.payload);
    }
    parentPort.postMessage({id:m.id,ok:true,result});
  }catch(e){parentPort.postMessage({id:m.id,ok:false,error:e.message})}
});

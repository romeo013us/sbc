'use strict';
const {parentPort,workerData}=require('worker_threads');
try{
 const type=String(workerData?.type||'noop');
 if(type==='parse'){const text=String(workerData.text||'');parentPort.postMessage({ok:true,result:{length:text.length,lines:text.split(/\r?\n/).length}});}
 else if(type==='evaluate'){parentPort.postMessage({ok:true,result:{ok:true,receivedAt:new Date().toISOString(),keys:Object.keys(workerData?.payload||{})}});}
 else parentPort.postMessage({ok:true,result:{ok:true,type}});
}catch(e){parentPort.postMessage({ok:false,error:e.message});}

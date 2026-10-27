'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

function createEventSpooler({file=path.join(process.cwd(),'runtime-spool','events.ndjson'),logger=console,maxBytes=5*1024*1024,maxEvents=20000,onEvent=async()=>{},reconcile=async()=>({ok:true})}={}){
 let running=false,offset=0,queue=[],processed=0,dropped=0,watcher=null,timer=null,stream=null,partial='',seq=0,lastHash='GENESIS',pendingWrites=0;
 const stateFile=`${file}.wal-state.json`;
 function digest(rec){return crypto.createHash('sha256').update(`${rec.prevHash}|${rec.seq}|${rec.at}|${JSON.stringify(rec.event)}`).digest('hex');}
 function loadState(){try{const s=JSON.parse(fs.readFileSync(stateFile,'utf8'));seq=Number(s.seq)||0;lastHash=String(s.hash||'GENESIS');}catch{}}
 function persistState(){const tmp=`${stateFile}.tmp`;fs.writeFileSync(tmp,JSON.stringify({seq,hash:lastHash,updatedAt:new Date().toISOString()}));fs.renameSync(tmp,stateFile);}
 function boundedPush(evt){if(queue.length>=maxEvents){queue.shift();dropped++;}queue.push(evt);}
 function readNew(){if(!fs.existsSync(file))return;const st=fs.statSync(file);if(st.size<offset)offset=0;if(st.size>maxBytes)offset=Math.max(0,st.size-maxBytes);const fd=fs.openSync(file,'r');const len=st.size-offset;if(len<=0){fs.closeSync(fd);return;}const buf=Buffer.alloc(len);fs.readSync(fd,buf,0,len,offset);fs.closeSync(fd);offset=st.size;const text=partial+buf.toString('utf8');const parts=text.split(/\r?\n/);partial=parts.pop()||'';for(const line of parts){if(!line.trim())continue;try{const rec=JSON.parse(line);if(!rec.wal||!rec.seq||!rec.hash){logger.warn('[GODKIM WAL] unsigned record ignored');continue;}if(rec.prevHash!==lastHash && rec.seq>seq+1){logger.warn('[GODKIM WAL] sequence/hash gap detected');}if(rec.hash!==digest(rec)){logger.warn('[GODKIM WAL] hash mismatch ignored');continue;}lastHash=rec.hash;seq=Math.max(seq,Number(rec.seq)||0);boundedPush(rec.event);persistState();}catch(e){logger.warn('[GODKIM SPOOL] malformed event ignored:',e.message)}}}
 async function drain(){while(queue.length){const evt=queue.shift();try{await onEvent(evt);processed++;}catch(e){logger.warn('[GODKIM SPOOL] handler failed:',e.message)}}}
 async function bootReconcile(){try{return await reconcile({seq,lastHash,file,stateFile});}catch(e){logger.warn('[GODKIM WAL] reconciliation failed:',e.message);return {ok:false,error:e.message};}}
 function start(){if(running)return;running=true;fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file))fs.writeFileSync(file,'');loadState();offset=fs.statSync(file).size;stream=fs.createWriteStream(file,{flags:'a',encoding:'utf8',highWaterMark:64*1024});stream.on('error',e=>logger.warn('[GODKIM SPOOL] write stream:',e.message));watcher=fs.watch(file,{persistent:false},()=>{try{readNew();drain().catch(()=>{})}catch(e){logger.warn('[GODKIM SPOOL] watch:',e.message)}});timer=setInterval(()=>{try{readNew();drain().catch(()=>{})}catch(e){logger.warn('[GODKIM SPOOL] poll:',e.message)}},250);timer.unref?.();}
 function stop(){running=false;try{watcher?.close()}catch{}if(timer)clearInterval(timer);try{stream?.end()}catch{}watcher=null;timer=null;stream=null;pendingWrites=0;}
 function append(evt){if(!stream)start();const rec={id:evt.id||crypto.randomUUID(),at:new Date().toISOString(),event:evt,wal:true,seq:seq+1,prevHash:lastHash};rec.hash=digest(rec);seq=rec.seq;lastHash=rec.hash;persistState();const line=JSON.stringify(rec)+'\n';pendingWrites++;const accepted=stream.write(line,'utf8',()=>{pendingWrites=Math.max(0,pendingWrites-1)});if(!accepted)logger.warn('[GODKIM SPOOL] backpressure engaged; event remains buffered by Node stream.');return rec;}
 function stats(){return {running,file,queueDepth:queue.length,processed,dropped,offset,pendingWrites,seq,lastHash,reconciliation:'boot-hook',mode:'WAL-hash-chain+non-blocking-write-stream+bounded-reader'};}
 return {start,stop,append,stats,readNew,drain,bootReconcile};
}
module.exports={createEventSpooler};

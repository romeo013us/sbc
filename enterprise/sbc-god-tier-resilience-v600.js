'use strict';
const VERSION='60.1.0';
function createCircuitBreaker({name,threshold=3,resetMs=30000}={}){
  let failures=0,state='CLOSED',openedAt=0,successes=0,rejections=0,halfOpenInFlight=false;
  return {
    name:name||'dependency',
    async execute(fn){
      const now=Date.now();
      if(state==='OPEN'){
        if(now-openedAt<resetMs){rejections++;const e=new Error(`CIRCUIT_OPEN:${name}`);e.code='CIRCUIT_OPEN';throw e;}
        if(halfOpenInFlight){rejections++;const e=new Error(`CIRCUIT_HALF_OPEN_BUSY:${name}`);e.code='CIRCUIT_HALF_OPEN_BUSY';throw e;}
        state='HALF_OPEN'; halfOpenInFlight=true;
      }
      try{const out=await fn();failures=0;successes++;state='CLOSED';openedAt=0;return out;}
      catch(e){failures++;if(state==='HALF_OPEN'||failures>=threshold){state='OPEN';openedAt=Date.now();}throw e;}
      finally{halfOpenInFlight=false;}
    },
    health(){return {name,state,failures,successes,rejections,openedAt,resetMs,threshold,halfOpenInFlight};},
    reset(){failures=0;state='CLOSED';openedAt=0;halfOpenInFlight=false;}
  };
}
function withTimeout(task,ms,name='operation') {
  const timeout=Math.max(1,Number(ms)||5000);
  let timer;
  const work=typeof task==='function'?Promise.resolve().then(task):Promise.resolve(task);
  return new Promise((resolve,reject)=>{
    timer=setTimeout(()=>{const e=new Error(`TIMEOUT:${name}`);e.code='TIMEOUT';reject(e);},timeout);
    work.then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});
  });
}
module.exports={VERSION,createCircuitBreaker,withTimeout};

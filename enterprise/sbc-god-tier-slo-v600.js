'use strict';
// Process-local, bounded 24-hour SLO aggregation. No per-request records,
// identities or raw URLs. The oldest partial minute is intentionally excluded.
const VERSION='60.2.0';
const MINUTE=60000,WINDOW_BUCKETS=1440;
const LIMITS=Object.freeze([0,5,10,25,50,75,100,150,200,250,300,400,500,750,1000,1500,2000,3000,5000,10000,30000,60000,120000,Infinity]);
function createSLORegistry({clock=Date.now}={}){
  const ring=new Array(WINDOW_BUCKETS);
  let latest=-Infinity;
  function minute(){
    const time=clock();
    if(!Number.isFinite(time)||time<0)throw Error('SLO_CLOCK_INVALID');
    latest=Math.max(latest,Math.floor(time/MINUTE));
    return latest;
  }
  function bucket(){
    const key=minute(),index=key%WINDOW_BUCKETS;
    let b=ring[index];
    if(!b||b.key!==key)b=ring[index]={key,counts:new Float64Array(6),hist:new Float64Array(LIMITS.length),max:0};
    return b;
  }
  function recordApi(statusCode,latencyMs){
    if(!Number.isInteger(statusCode)||statusCode<100||statusCode>599||!Number.isFinite(latencyMs)||latencyMs<0)return false;
    const b=bucket();
    b.counts[0]++;if(statusCode<500)b.counts[1]++;
    const index=LIMITS.findIndex(limit=>latencyMs<=limit);
    b.hist[index]++;b.max=Math.max(b.max,latencyMs);return true;
  }
  function recordBoolean(ok,index){
    if(typeof ok!=='boolean')return false;
    const b=bucket();b.counts[index]++;if(ok)b.counts[index+1]++;return true;
  }
  function recordEvent(ok){return recordBoolean(ok,2);}
  function recordDependency(ok){return recordBoolean(ok,4);}
  function check(value,target,lower=false){
    const pass=value!==null&&(lower?value<=target:value>=target);
    return {value,target,pass,status:value===null?'INSUFFICIENT_EVIDENCE':pass?'PASS':'FAIL'};
  }
  function snapshot(){
    const current=minute(),counts=new Float64Array(6),hist=new Float64Array(LIMITS.length);
    let activeBuckets=0,max=0;
    for(let i=0;i<ring.length;i++){
      const b=ring[i];if(!b)continue;
      if(b.key<=current-WINDOW_BUCKETS){ring[i]=undefined;continue;}
      activeBuckets++;max=Math.max(max,b.max);
      for(let j=0;j<counts.length;j++)counts[j]+=b.counts[j];
      for(let j=0;j<hist.length;j++)hist[j]+=b.hist[j];
    }
    const ratio=i=>counts[i]?counts[i+1]/counts[i]:null;
    const success=ratio(0),eventSuccess=ratio(2),depSuccess=ratio(4);
    let p95=null;
    if(counts[0]){
      const rank=Math.ceil(counts[0]*.95);let cumulative=0;
      for(let i=0;i<hist.length;i++){cumulative+=hist[i];if(cumulative>=rank){p95=Math.min(max,LIMITS[i]);break;}}
    }
    const checks={api_success:check(success,.999),api_p95:check(p95,300,true),event_processing:check(eventSuccess,.999),critical_dependency:check(depSuccess,.999)};
    const error=value=>value===null?null:Math.max(0,1-value);
    return {version:VERSION,pass:Object.values(checks).every(x=>x.pass),checks,
      sampleCounts:{api:counts[0],events:counts[2],dependencies:counts[4]},
      errorBudget:{api:error(success),events:error(eventSuccess),dependencies:error(depSuccess)},
      scope:'PROCESS_LOCAL_OBSERVED_SAMPLES',windowMs:WINDOW_BUCKETS*MINUTE,windowResolutionMs:MINUTE,
      percentileMethod:'NEAREST_RANK_HISTOGRAM_UPPER_BOUND',
      storage:{activeBuckets,maxBuckets:WINDOW_BUCKETS,retainedRequestObjects:0}};
  }
  return {VERSION,recordApi,recordEvent,recordDependency,snapshot};
}
module.exports={VERSION,createSLORegistry};

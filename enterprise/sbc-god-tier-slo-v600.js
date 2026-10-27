'use strict';
const VERSION='60.1.0';
function createSLORegistry(){
  const definitions={
    api_success:{target:0.999,windowMs:24*60*60*1000},
    api_p95:{target:300,windowMs:24*60*60*1000,lowerIsBetter:true},
    event_processing:{target:0.999,windowMs:24*60*60*1000},
    critical_dependency:{target:0.999,windowMs:24*60*60*1000}
  };
  const samples={api:[],events:[],dependencies:[]};
  function trim(arr,windowMs){const cut=Date.now()-windowMs;while(arr.length&&arr[0].ts<cut)arr.shift();}
  function recordApi(statusCode,latencyMs){samples.api.push({ts:Date.now(),ok:Number(statusCode)<500,latency:Number(latencyMs)||0});trim(samples.api,definitions.api_success.windowMs);}
  function recordEvent(ok){samples.events.push({ts:Date.now(),ok:Boolean(ok)});trim(samples.events,definitions.event_processing.windowMs);}
  function recordDependency(ok){samples.dependencies.push({ts:Date.now(),ok:Boolean(ok)});trim(samples.dependencies,definitions.critical_dependency.windowMs);}
  function percentile(values,p){if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor((a.length-1)*p))];}
  function snapshot(){
    const api=samples.api, ev=samples.events, dep=samples.dependencies;
    const success=api.length?api.filter(x=>x.ok).length/api.length:1;
    const p95=percentile(api.map(x=>x.latency),.95);
    const eventSuccess=ev.length?ev.filter(x=>x.ok).length/ev.length:1;
    const depSuccess=dep.length?dep.filter(x=>x.ok).length/dep.length:1;
    const checks={api_success:{value:success,target:definitions.api_success.target,pass:success>=definitions.api_success.target},api_p95:{value:p95,target:definitions.api_p95.target,pass:!p95||p95<=definitions.api_p95.target},event_processing:{value:eventSuccess,target:definitions.event_processing.target,pass:eventSuccess>=definitions.event_processing.target},critical_dependency:{value:depSuccess,target:definitions.critical_dependency.target,pass:depSuccess>=definitions.critical_dependency.target}};
    const pass=Object.values(checks).every(x=>x.pass);
    return {version:VERSION,pass,checks,sampleCounts:{api:api.length,events:ev.length,dependencies:dep.length},errorBudget:{api:Math.max(0,1-success),events:Math.max(0,1-eventSuccess),dependencies:Math.max(0,1-depSuccess)}};
  }
  return {VERSION,recordApi,recordEvent,recordDependency,snapshot};
}
module.exports={VERSION,createSLORegistry};

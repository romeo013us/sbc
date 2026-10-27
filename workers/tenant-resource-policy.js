"use strict";
const limits={starter:{maxConcurrent:1,memoryMb:256},business:{maxConcurrent:2,memoryMb:384},pro:{maxConcurrent:4,memoryMb:768},enterprise:{maxConcurrent:8,memoryMb:1536}};
const active=new Map();
function policy(plan){return limits[String(plan||'starter')]||limits.starter}
function acquire(tenantId,plan){const p=policy(plan),n=Number(active.get(tenantId)||0);if(n>=p.maxConcurrent)return {ok:false,reason:'TENANT_WORKER_THROTTLED',limit:p.maxConcurrent,active:n};active.set(tenantId,n+1);return {ok:true,limit:p.maxConcurrent,active:n+1,memoryMb:p.memoryMb}}
function release(tenantId){const n=Number(active.get(tenantId)||0)-1;if(n<=0)active.delete(tenantId);else active.set(tenantId,n)}
function snapshot(){return [...active.entries()].map(([tenant_id,active])=>({tenant_id,active}))}
module.exports={policy,acquire,release,snapshot};

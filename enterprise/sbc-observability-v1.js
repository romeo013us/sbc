'use strict';
/**
 * SBC Observability V1 — lightweight production observability for the single-host runtime.
 * No Loki, Kubernetes, or external dependency required.
 */
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');
const storage = new AsyncLocalStorage();
const TRACE_VERSION='00';
const TRACE_FLAGS='01';
function newTraceId(){ return crypto.randomBytes(16).toString('hex'); }
function newSpanId(){ return crypto.randomBytes(8).toString('hex'); }
function parseTraceparent(value){
  const m=String(value||'').match(/^(00)-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
  return m ? {version:m[1],traceId:m[2].toLowerCase(),parentSpanId:m[3].toLowerCase(),flags:m[4].toLowerCase()} : null;
}
function makeTraceparent(traceId,spanId){return `${TRACE_VERSION}-${traceId}-${spanId}-${TRACE_FLAGS}`;}
function contextFromRequest(req){
  const incoming=parseTraceparent(req?.headers?.traceparent);
  const traceId=incoming?.traceId||newTraceId();
  const spanId=newSpanId();
  return {traceId,spanId,parentSpanId:incoming?.parentSpanId||'',traceparent:makeTraceparent(traceId,spanId)};
}
function getContext(){return storage.getStore()||{};}
function run(ctx,fn){return storage.run(ctx,fn);}
function normalizeEvent({level='info',event,component='SBC_RUNTIME',version='',meta={}}){
  const c=getContext();
  return {
    timestamp:new Date().toISOString(),
    trace_id:meta.traceId||meta.trace_id||c.traceId||crypto.randomUUID(),
    span_id:meta.spanId||meta.span_id||c.spanId||'',
    component:meta.component||component,
    event:String(event||'event'),
    level:String(level||'info').toUpperCase(),
    version,
    context:{...meta,traceId:undefined,trace_id:undefined,spanId:undefined,span_id:undefined,component:undefined}
  };
}
module.exports={newTraceId,newSpanId,parseTraceparent,makeTraceparent,contextFromRequest,getContext,run,normalizeEvent};

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const hardening=require('../enterprise/sbc-runtime-hardening-v56130.js');

async function request({path,route,originalUrl=path,status=200}={}){
 const req={method:'GET',path,originalUrl,url:originalUrl,headers:{},route:route?{path:route}:undefined};
 const res=new EventEmitter();res.statusCode=status;res.writableEnded=false;
 res.status=function(code){this.statusCode=code;return this};res.json=function(){return this};res.setHeader=function(){};
 let events=[];let warns=[];
 const oldWarn=console.warn;console.warn=(...x)=>warns.push(x.join(' '));
 try{
  hardening.runtimeMiddleware({slowMs:-1,timeoutMs:0,onEvent:(event)=>events.push(event)})(req,res,()=>{});
  res.writableEnded=true;res.emit('finish');
  return {events,warns};
 }finally{console.warn=oldWarn}
}

test('slow request emits route template, HTTP status and latency to plain GoDaddy logs, never query secrets',async()=>{
 const out=await request({path:'/api/v9/customer/jane@example.com',route:'/api/v9/customer/:customerId',originalUrl:'/api/v9/customer/jane@example.com?token=SENSITIVE_SECRET'});
 const event=out.events.find(e=>e.type==='slow_request');
 assert(event);
 assert.equal(event.path,'/api/v9/customer/:customerId');
 assert.equal(event.status,200);
 assert(Number.isFinite(event.latencyMs));
 assert(out.warns.some(s=>s.includes('route=/api/v9/customer/:customerId')&&s.includes('status=200')&&s.includes('latencyMs=')));
 assert(!JSON.stringify(out).includes('SENSITIVE_SECRET'));
 assert(!JSON.stringify(out).includes('jane@example.com'));
});

test('unknown route is sanitized rather than logging raw customer identifiers',async()=>{
 const out=await request({path:'/api/v9/leads/alice@example.com',originalUrl:'/api/v9/leads/alice@example.com?password=SECRET'});
 assert(!JSON.stringify(out).includes('alice@example.com'));
 assert(!JSON.stringify(out).includes('password=SECRET'));
 assert(out.events[0].path.includes(':id'));
});

test('active request snapshot exposes no query tokens or customer IDs',()=>{
 const req={method:'GET',path:'/api/customer/romeo@example.com',originalUrl:'/api/customer/romeo@example.com?key=SECRET',headers:{}};
 const res=new EventEmitter();res.statusCode=200;res.writableEnded=false;res.setHeader=function(){};
 hardening.runtimeMiddleware({slowMs:100000,timeoutMs:0})(req,res,()=>{});
 const active=JSON.stringify(hardening.activeRequestSnapshot());
 assert(!active.includes('romeo@example.com'));
 assert(!active.includes('key=SECRET'));
 res.writableEnded=true;res.emit('finish');
});

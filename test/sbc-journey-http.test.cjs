'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {fixture}=require('./helpers/connected-journey-fixture.cjs');
const BRIDGE=require('../enterprise/v6660-website-bridge.cjs');
test('HTTP signed intake, staff authorization and booking use the live hydrated account store',async()=>{
 const f=await fixture();try{
  const call=(path,{actor,body,headers={}}={})=>fetch(f.url+path,{method:body?'POST':'GET',headers:{...(actor?{'x-test-actor':actor}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  const body={requestId:'inquiry_http_01234567890123456789',businessName:'Synthetic Miami Garage',contactName:'Test Contact',email:'test@example.invalid',serviceSlug:'website-design',packageId:'starter',intent:'quote',message:'A synthetic website quote request.'};
  assert.equal((await call('/api/web-lead',{body})).status,403);assert.equal((await call('/api/sbc/journey/queue')).status,401);
  const at=String(Math.floor(Date.now()/1000)),nonce=crypto.randomBytes(16).toString('hex'),raw=JSON.stringify(body);
  const headers={'x-sbc-website-host':'sbcmia.com','x-sbc-website-timestamp':at,'x-sbc-website-nonce':nonce,'x-sbc-website-signature':BRIDGE.signature({key:f.bridgeKey,host:'sbcmia.com',method:'POST',path:'/api/web-lead',at,nonce,body:raw})};
  const receipt=await (await call('/api/web-lead',{body,headers})).json();assert.equal(receipt.accepted,true);
  const cid=f.db.customers[0].id;assert.notEqual(receipt.id,cid);
  assert.equal((await (await call('/api/sbc/journey/queue',{actor:'am'})).json()).rows.length,0);
  assert.equal((await call('/api/sbc/journey/accounts/'+cid,{actor:'am'})).status,404);
  const hydrated=JSON.parse(JSON.stringify(f.db));hydrated.customers[0].assignedTo='am1';f.hydrate(hydrated);
  assert.equal((await (await call('/api/sbc/journey/queue',{actor:'am'})).json()).rows[0].customerId,cid);
  const start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+87000000).toISOString();
  const booked=await call('/api/appointments',{actor:'am',body:{customerId:cid,title:'Synthetic discovery meeting',startAt:start,endAt:end,location:'https://zoom.us/j/123456789'}});assert.equal(booked.status,201);
  const listed=await call('/api/appointments?customerId='+cid,{actor:'am'});assert.equal((await listed.json()).appointments.length,1);
  assert.equal((await call('/api/sbc/journey/reconcile',{actor:'am',body:{}})).status,403);
 }finally{await f.close()}
});

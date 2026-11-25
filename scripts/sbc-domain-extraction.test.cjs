'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {createTrainingHandlers}=require('../routes/sbc-legacy-training-v2.cjs');
const {createSquareWebhook}=require('../routes/sbc-square-webhook-v1.cjs');
const {createTwilioWebhooks}=require('../routes/sbc-twilio-webhooks-v1.cjs');
function response(){return {code:200,body:null,headers:{},status(n){this.code=n;return this},type(){return this},setHeader(k,v){this.headers[k]=v},json(b){this.body=b;return this}}}
test('legacy Academy reads use the current recovery snapshot and never persist repair during recovery',async()=>{
 let writes=0,current={users:[],settings:{trainingCenterV2:{courses:[],assignments:[]}}};
 const TRAINING_SYSTEM={repairCourseCatalog(d){d.settings.trainingCenterV2.courses.push('repaired');return {state:d.settings.trainingCenterV2,changed:true}},ensureAssignmentsForWorkforce(){},getForUser(){return {available:[]}},dashboard(){return {}},overview(){return {}},saveState(){writes++}};
 const h=createTrainingHandlers(()=>({db:current,MYSQL_RECOVERY_REQUIRED:true,TRAINING_SYSTEM,trainingAdmin:()=>true,saveData(){writes++}}));
 let r=response();await h.catalog({user:{role:'owner'},query:{}},r);assert.equal(r.body.readOnly,true);assert.equal(writes,0);assert.deepEqual(current.settings.trainingCenterV2.courses,[]);
 current={users:[],settings:{trainingCenterV2:{courses:['new'],assignments:[]}}};r=response();await h.catalog({user:{role:'owner'},query:{}},r);assert.deepEqual(current.settings.trainingCenterV2.courses,['new']);
});
test('Square extracted webhook rejects bad signature, waits for durable receipt, and reconciles exact duplicate',async()=>{
 const events=[];let saves=0,queued=0,fail=true;
 const h=createSquareWebhook(()=>({squareSignatureValid:(raw,sig)=>sig==='valid',safeJsonParse:JSON.parse,squareWebhookRecords:()=>events,now:()=> '2026-11-25T00:00:00Z',saveData:async()=>{saves++;if(fail)throw Error('synthetic disk failure')},MONETIZATION_QUEUE:{enqueue:async()=>{queued++}},mysqlPool:null,processPendingSquareWebhooks:async()=>{}}));
 const req={body:{event_id:'synthetic_event',type:'payment.updated'},headers:{'x-square-hmacsha256-signature':'invalid'}};
 let r=response();await h(req,r);assert.equal(r.code,403);assert.equal(saves,0);
 req.headers['x-square-hmacsha256-signature']='valid';r=response();await h(req,r);assert.equal(r.code,503);assert.equal(events.length,0);assert.equal(queued,0);
 fail=false;r=response();await h(req,r);assert.equal(r.code,200);assert.equal(events.length,1);assert.equal(queued,1);
 r=response();await h(req,r);assert.equal(r.body.duplicate,true);assert.equal(saves,2);assert.equal(queued,1);
});
test('Twilio extracted handlers authenticate first and preserve stable event idempotency key',async()=>{
 const crypto=require('node:crypto');let ensured=0,insertions=[],inbound=0,delivered=0;
 const h=createTwilioWebhooks(()=>({inboundWebhookAuthorized:req=>req.authorized===true,REVENUE_SUPERVISOR:{handleInbound:async()=>{inbound++;return {ok:true}}},ensureRevenueOSSchema:async()=>{ensured++},crypto,mysqlPool:{query:async(...args)=>insertions.push(args)},SBC_APPOINTMENT_RECOVERY:{delivery:async()=>{delivered++}}}));
 let r=response();await h.status({body:{}},r);assert.equal(r.code,401);assert.equal(ensured,0);
 r=response();await h.inbound({body:{}},r);assert.equal(r.code,401);assert.equal(inbound,0);
 const req={authorized:true,body:{MessageSid:'SM'+'a'.repeat(32),MessageStatus:'delivered'}};
 r=response();await h.status(req,r);const key=r.body.idempotencyKey;r=response();await h.status(req,r);assert.equal(r.body.idempotencyKey,key);assert.equal(insertions.length,2);assert.match(insertions[0][0],/ON DUPLICATE KEY UPDATE id=id/);assert.equal(delivered,2);
});
test('domain handlers mounted once with existing auth and no duplicate route registrations',()=>{
 const src=fs.readFileSync(path.join(root,'server.js'),'utf8');
 for(const [needle,name] of [["app.get('/api/training',auth", 'training'],["app.post('/api/webhooks/square'", 'square'],["app.post('/api/webhooks/inbound/sms'", 'sms'],["app.post('/api/webhooks/twilio/status'", 'twilio']])assert.equal(src.split(needle).length-1,1,name);
 assert.match(src,/createTrainingHandlers/);assert.match(src,/createSquareWebhook/);assert.match(src,/createTwilioWebhooks/);
 assert(src.indexOf('app.use(createRecoveryWriteGuard(')<src.indexOf("app.post('/api/training/progress'"));
});

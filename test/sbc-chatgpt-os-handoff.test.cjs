'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {register}=require('../enterprise/sbc-chatgpt-os-handoff.cjs');
const {sectionFor,buildPrompt,redact}=require('../public/sbc-chatgpt-os-v1.js');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const focus=fs.readFileSync(path.join(root,'public/sbc-command-center-focus-v1.js'),'utf8');
const routes=fs.readFileSync(path.join(root,'enterprise/sbc-website-production-routes.cjs'),'utf8');
test('global assistant is installed outside Website Studio and guarded by existing owner route auth',()=>{
 assert.match(html,/id="sbc-chatgpt-os-launch"[^>]*hidden/);
 assert.match(html,/sbc-command-center-focus-v1\.js/);
 assert.match(focus,/sbc-chatgpt-os-v1\.js/);
 assert.match(focus,/sbc-chatgpt-os-v1\.css/);
 assert.match(routes,/require\('\.\/sbc-chatgpt-os-handoff\.cjs'\)/);
 assert.match(routes,/ChatGPTOs\.register\(app,/);
});
test('all operational sections use department-specific prompts without copying loaded customer records',()=>{
 assert.equal(sectionFor('customers'),'Leads & Accounts');
 assert.equal(sectionFor('crm'),'Sales');
 assert.equal(sectionFor('orders'),'Fulfillment');
 assert.equal(sectionFor('workforce'),'Team');
 assert.equal(sectionFor('training'),'Training');
 assert.equal(sectionFor('Unknown customer private string'),'Operations');
 const prompt=buildPrompt({view:'crm',task:'Plan customer follow-ups',notes:'Contact Jane jane@example.com or 305-555-0181 with API key sk-secret-hello123'});
 assert.match(prompt,/Sales/);assert.doesNotMatch(prompt,/jane@example\.com|305-555-0181|sk-secret-hello123/);
 assert.match(prompt,/no automatic access/);
 assert.doesNotMatch(prompt,/I can access your database/i);
});
test('owner-approved business memory is opt-in, not silently added to prompts',()=>{
 const profile={content:'Successful By Choice INTERNAL_PROFILE_TEST_REFERENCE about our projects'};
 assert.doesNotMatch(buildPrompt({view:'crm',profile}),/INTERNAL_PROFILE_TEST_REFERENCE/);
 assert.match(buildPrompt({view:'crm',profile,includeMemory:true}),/INTERNAL_PROFILE_TEST_REFERENCE/);
});
test('secret and personal-contact redactor covers common patterns',()=>{
 const cleaned=redact('agent@domain.com +1 (305) 555-1212 sk-test-XYZZZZ PASSWORD=abc12345 123-45-6789');
 assert.doesNotMatch(cleaned,/agent@domain\.com|305\) 555-1212|sk-test-XYZZZZ|abc12345|123-45-6789/);
});
function harness({writer=true,saveOk=true}={}){
 let store={sbcChatGPTOwnerReviews:[]},saves=0;const paths={};
 const app={get:(path,...chain)=>paths['GET '+path]=chain,post:(path,...chain)=>paths['POST '+path]=chain};
 const auth=(req,res,next)=>req.user?next():res.status(401).json({ok:false});
 const ownerOnly=(req,res,next)=>req.user?.role==='owner'?next():res.status(403).json({ok:false});
 let queue=Promise.resolve();const serializeSiteMutation=job=>{const task=queue.then(job);queue=task.catch(()=>{});return task};
 register(app,{auth,ownerOnly,requireTenant:req=>req.user?.tenantId,getStore:()=>store,saveStore:async next=>{saves++;if(saveOk)store=next;return {ok:saveOk}},writerReady:()=>writer,serializeSiteMutation});
 async function call(method,{body={},user={id:'ownerA',role:'owner',tenantId:7}}={}){
  const chain=paths[method+' /api/owner/chatgpt-handoff/reviews'];assert.ok(chain);
  const req={body,user},res={statusCode:200,status(n){this.statusCode=n;return this},setHeader(){},json(obj){this.body=obj;return this}};
  for(let i=0;i<chain.length;i++){let moved=false;await chain[i](req,res,()=>{moved=true});if(i<chain.length-1&&!moved)break}
  return res;
 }
 return {call,saves:()=>saves,store:()=>store};
}
const valid={requestId:'sbc-os-0123456789abcdef0123456789abcdef',section:'Sales',task:'Prepare a follow-up plan',brief:'Pipeline needs review',response:'Review the sales queue; approve each follow-up manually.',reviewed:true};
test('reviewed advice saves only owner notes, supports idempotency and no CRM/payment actions',async()=>{
 const h=harness();const wrote=await h.call('POST',{body:valid});assert.equal(wrote.statusCode,201);assert.equal(wrote.body.record.externalAction,false);
 assert.equal(h.saves(),1);assert.equal(h.store().customers,undefined);
 const read=await h.call('GET');assert.equal(read.body.records.length,1);
 const duplicate=await h.call('POST',{body:valid});assert.equal(duplicate.statusCode,200);assert.equal(duplicate.body.duplicate,true);
 assert.equal(h.saves(),1);
 const conflict=await h.call('POST',{body:{...valid,response:'Changed previously saved response'}});assert.equal(conflict.statusCode,409);
});
test('nonowners and other tenants cannot access saved advice',async()=>{
 const h=harness();assert.equal((await h.call('POST',{body:valid,user:null})).statusCode,401);
 assert.equal((await h.call('POST',{body:valid,user:{id:'staff',role:'sales',tenantId:7}})).statusCode,403);
 assert.equal((await h.call('POST',{body:valid,user:{id:'ownerA',role:'owner',tenantId:null}})).statusCode,403);
 assert.equal((await h.call('POST',{body:valid})).statusCode,201);
 assert.equal((await h.call('GET',{user:{id:'ownerB',role:'owner',tenantId:7}})).body.records.length,0);
 assert.equal((await h.call('GET',{user:{id:'ownerA',role:'owner',tenantId:8}})).body.records.length,0);
});
test('invalid and non-durable writes fail closed',async()=>{
 const h=harness();
 for(const body of [{...valid,reviewed:false},{...valid,section:'Invalid person name'},{...valid,response:'x'.repeat(13000)},{...valid,requestId:'bad'}])
  assert.equal((await h.call('POST',{body})).statusCode,422);
 const locked=harness({writer:false});assert.equal((await locked.call('POST',{body:valid})).statusCode,423);
 const broken=harness({saveOk:false});assert.equal((await broken.call('POST',{body:valid})).statusCode,503);
 assert.equal(broken.store().sbcChatGPTOwnerReviews.length,0);
});

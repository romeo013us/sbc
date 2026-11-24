'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('server compiles and both new routes are bound to authenticated staff',()=>{
 const s=read('server.js');new vm.Script(s);
 assert.match(s,/require\('\.\/enterprise\/sbc-call-routing-v1\.cjs'\)/);
 assert.match(s,/require\('\.\/enterprise\/sbc-voice-ledger-v1\.cjs'\)/);
 assert.match(s,/app\.get\('\/api\/sales\/call-history',auth,/);
 assert.match(s,/app\.post\('\/api\/sales\/spanish-callbacks\/\:id\/move',auth,/);
 assert.match(s,/SBC_CALL_ROUTING\.eligibleForEnglish\(c,db\.callLogs\|\|\[\],tenant/);
 assert.match(s,/SBC_CALL_ROUTING\.routingUpdate\(customer,log,stamp\)/);
 assert.match(s,/const allowedOutcome=new Set\(\[[^\n]*'Spanish callback needed'/);
});
test('Call Center has the owner-requested explicit Spanish buttons and searchable number history',()=>{
 const p=read('public/app.js'),b=read('browser_public/app.js');
 new vm.Script(p);new vm.Script(b);assert.equal(p,b);
 for(const x of ['Move to Spanish Queue','moveSbcLeadToSpanishQueue','loadSbcSpanishCallbackQueue','loadSbcCallLedger','Spanish callback needed'])
  assert.ok(p.includes(x),x);
 assert.match(p,/if\(final\&\&typeof loadSalesQueue==='function'\)/);
});
test('Account Manager inbox is visible and permissions are narrow',()=>{
 const p=read('public/sbc-account-manager-v1.html'),b=read('browser_public/sbc-account-manager-v1.html');
 assert.equal(p,b);assert.match(p,/id="sbcSpanishAmQueue"/);assert.match(p,/sbc-spanish-am-queue-v1\.js/);
 const js=read('public/sbc-spanish-am-queue-v1.js');new vm.Script(js);
 assert.equal(js,read('browser_public/sbc-spanish-am-queue-v1.js'));
 const gate=require('../enterprise/sbc-account-manager-role-gate-v2.cjs');
 assert.equal(gate.allowed('GET','/api/sales/spanish-callbacks'),true);
 assert.equal(gate.allowed('POST','/api/sales/spanish-callbacks/cust_123/claim'),true);
 assert.equal(gate.allowed('POST','/api/sales/spanish-callbacks/cust_123/move'),false);
 assert.equal(gate.allowed('GET','/api/sales/call-history'),false);
});

test('failed calling queue refresh clears stale leads and shows a safe retry, in both mirrored clients',async()=>{
 for(const file of ['public/app.js','browser_public/app.js']){
  const source=read(file),start=source.indexOf('async function loadSalesQueue(){'),end=source.indexOf('\nfunction salesQueuePanel(){',start);
  assert.ok(start>=0&&end>start,file+' function missing');
  const view={innerHTML:'OLD QUEUE: call this person'};
  const state={me:{role:'owner'},salesQueue:{leads:[{id:'old'}]}};
  const sandbox={state,api:async()=>{throw new Error('network unavailable')},$:()=>view,salesQueuePanel:()=>'<p>stale</p>',loadSbcSpanishCallbackQueue:()=>{},loadSbcCallLedger:()=>{},console:{warn:()=>{}}};
  const run=vm.runInNewContext(source.slice(start,end)+'\nloadSalesQueue',sandbox,{timeout:1000});
  assert.equal(await run(),null);
  assert.equal(state.salesQueue,null,file+' stale state retained');
  assert.match(view.innerHTML,/Calling Queue Unavailable/,file+' error not announced');
  assert.match(view.innerHTML,/Retry Calling Queue/,file+' retry missing');
  assert.doesNotMatch(view.innerHTML,/OLD QUEUE/,file+' stale lead still callable');
 }
});

test('queue replenishment announces no replacement inventory rather than implying leads will appear',()=>{
 for(const file of ['public/app.js','browser_public/app.js']){
  const source=read(file),start=source.indexOf('function salesQueuePanel(){'),end=source.indexOf('\nconst SBC_SPANISH_HANDOFF_REASON',start);
  assert.ok(start>=0&&end>start,file+' queue panel missing');
  const render=available=>vm.runInNewContext(source.slice(start,end)+'\nsalesQueuePanel',{state:{salesQueue:{target:50,count:1,available,leads:[]}},esc:v=>String(v)},{timeout:1000})();
  assert.match(render(0),/No replacement leads available/,file+' falsely implies inventory');
  assert.doesNotMatch(render(5),/No replacement leads available/,file+' hides available pool');
 }
});

test('ending a call waits for an outstanding autosave before the final durable event',async()=>{
 const source=read('public/app.js');
 const first=source.indexOf('async function finishSbcBusinessCall('),last=source.indexOf('\nfunction openCallerAccount(',first);
 assert.ok(first>0&&last>first,'call finishing source must exist');
 let release;const activeSave=new Promise(resolve=>{release=resolve});
 const records=[],panel={textContent:''};
 const sandbox={
  sbcVoiceFinishing:false,sbcVoiceConnection:null,sbcVoiceStartedAt:Date.now()-1000,
  sbcVoiceSessionId:'synthetic-one',sbcVoiceCustomerId:'lead-1',sbcVoiceOpenCustomerId:'lead-1',
  sbcVoiceStartedAtIso:new Date(Date.now()-1000).toISOString(),sbcVoiceNotesSnapshot:{notes:'Genuine test note'},
  sbcVoiceCallStatus:'in-progress',sbcVoiceSaveInFlight:true,sbcVoiceSaveSettled:activeSave,
  sbcVoiceSaveAgain:false,sbcVoicePendingFinalStatus:'',sbcVoiceSaveTimer:null,
  $:()=>panel,loadSbcRecentCallLogs:()=>Promise.resolve(),saveSbcBusinessCallNotes:async(_manual,finalStatus)=>{
   records.push(finalStatus);return true;
  }
 };
 const finish=vm.runInNewContext(source.slice(first,last)+'\nfinishSbcBusinessCall',sandbox,{timeout:1000});
 const request=finish('ended');await Promise.resolve();
 assert.equal(records.length,0,'final completion must not race an in-flight autosave');
 release();await request;
 assert.deepEqual(records,['ended'],'terminal call must be durably saved only after the pending write');
 assert.match(panel.textContent,/saved to SBC/);
});
test('next-lead action appears only when a verified fresh queue actually excludes the completed lead',()=>{
 for(const file of ['public/app.js','browser_public/app.js']){
  const source=read(file),first=source.indexOf('function sbcVoicePresentNextEligible('),
   last=source.indexOf('\nasync function sbcOpenDetailedCallReport(',first);
  assert.ok(first>0&&last>first,file+' next-lead helper absent');
  let opened=null;
  const panel={textContent:'',children:[],replaceChildren(){this.children=[];this.textContent='';},
   appendChild(x){this.children.push(x)}};
  const sandbox={
   $:selector=>selector==='#sbcNextEligibleCall'?panel:null,
   document:{createElement:tag=>({tag,textContent:'',type:'',className:'',onclick:null})},
   openSbcDialer:id=>{opened=id}
  };
  const show=vm.runInNewContext(source.slice(first,last)+'\nsbcVoicePresentNextEligible',sandbox,{timeout:1000});
  show('lead-1',{leads:[{id:'lead-2',businessName:'Safe next prospect'}]});
  const btn=panel.children.find(x=>x.tag==='button');
  assert.ok(btn,file+' no next-lead button on verified rotation');
  assert.match(panel.textContent,/Safe next prospect/);
  btn.onclick();assert.equal(opened,'lead-2');
  opened=null;show('lead-1',{leads:[{id:'lead-1',businessName:'Same business'},{id:'lead-2',businessName:'Next'}]});
  assert.equal(panel.children.filter(x=>x.tag==='button').length,0,'never offer next lead while old contact remains callable');
  assert.match(panel.textContent,/still appears|not confirmed/i);
  show('lead-1',null);
  assert.equal(panel.children.filter(x=>x.tag==='button').length,0,'no action on failed queue refresh');
 }
});
test('fifty-lead completed Pending call persists same-shift rotation without fabricated disposition',()=>{
 const flow=require('../enterprise/sbc-call-routing-v1.cjs'),at='2026-11-23T15:00:00Z',tenantId=1;
 const accounts=Array.from({length:50},(_,i)=>({id:'lead-'+(i+1),tenantId,status:'Lead',phone:'+13055550100'}));
 const ledger=[{id:'call-1',customerId:'lead-1',tenantId,status:'ended',outcome:'Pending',endedAt:at}];
 assert.equal(flow.routingUpdate(accounts[0],ledger[0],at).queueState,'contacted_review');
 let queue=accounts.filter(a=>flow.eligibleForEnglish(a,ledger,tenantId,new Date('2026-11-23T15:01:00Z')));
 assert.equal(queue.length,49);assert.equal(queue[0].id,'lead-2');
 const persisted=JSON.parse(JSON.stringify({accounts,ledger}));
 queue=persisted.accounts.filter(a=>flow.eligibleForEnglish(a,persisted.ledger,tenantId,new Date('2026-11-23T17:00:00Z')));
 assert.equal(queue[0].id,'lead-2');
 assert.equal(queue.some(a=>a.id==='lead-1'),false);
 assert.equal(persisted.accounts[0].status,'Lead','pending is not Not Interested or DNC');
});

test('reassigned active Account Manager and caller portfolios cannot remain in another caller queue',async()=>{
 const source=read('server.js');
 const from=source.indexOf('async function replenishSalesQueue('),end=source.indexOf('\nfunction removeFromSalesQueue(',from);
 assert.ok(from>=0&&end>from,'server queue refresher not found');
 const users=[{id:'owner1',role:'owner',tenantId:1,active:true},{id:'am2',role:'account_manager',tenantId:1,active:true},{id:'caller3',role:'caller',tenantId:1,active:true}];
 const customers=[
  {id:'am-owned',tenantId:1,assignedTo:'am2',phone:'+13055550101',status:'Lead',verificationStatus:'Sales Ready'},
  {id:'caller-owned',tenantId:1,assignedTo:'caller3',phone:'+13055550102',status:'Lead',verificationStatus:'Sales Ready'},
  {id:'owner-owned',tenantId:1,assignedTo:'owner1',phone:'+13055550103',status:'Lead',verificationStatus:'Sales Ready'}
 ];
 const q={target:3,leadIds:['am-owned','caller-owned','owner-owned']};
 const m={settings:{salesQueueTarget:3},salesQueues:{owner1:q},automationEvents:[]};
 const sandbox={db:{users,customers,callLogs:[]},queueForCaller:()=>({m,q}),tenantIdForUser:()=>1,
  SBC_CALL_ROUTING:{eligibleForEnglish:()=>true},SBC_PHONE_RECOVERY:{isHeld:()=>false,hasUnreachableLog:()=>false},
  salesQueueCandidates:()=>[],megaSave:async()=>{},now:()=>new Date().toISOString(),id:()=> 'evt-1'};
 const refresh=vm.runInNewContext(source.slice(from,end)+'\nreplenishSalesQueue',sandbox,{timeout:1000});
 await refresh('owner1');
 assert.equal(q.leadIds.join(','),'owner-owned','reassigned sales portfolios must be removed from the old queue');
 const start=source.indexOf('function salesQueueCandidates('),stop=source.indexOf('\nasync function replenishSalesQueue(',start);
 assert(start>=0&&stop>start,'server candidate selector not found');
 q.leadIds=[];
 const candidates=vm.runInNewContext(source.slice(start,stop)+'\nsalesQueueCandidates',sandbox,{timeout:1000});
 assert.equal(candidates('owner1').map(x=>x.id).join(','),'owner-owned','candidate refill must also exclude other active sales owners');
});

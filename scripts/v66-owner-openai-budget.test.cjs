'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const modulePath=path.resolve(__dirname,'../enterprise/production-hardening-v56-25-3.js');
function probe(vars={}){
 const code='const m=require('+JSON.stringify(modulePath)+'); const gate=m.createRuntimeGate({pool:null}); process.stdout.write(JSON.stringify({daily:m.DEFAULT_SPEND_CAP,monthly:m.MONTHLY_SPEND_CAP,keyAvailable:Boolean(process.env.OPENAI_API_KEY),status:gate.snapshot()}));';
 const r=spawnSync(process.execPath,['-e',code],{encoding:'utf8',env:{...process.env,OPENAI_API_KEY:'fake-key-for-test',...vars}});
 assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
test('Owner budget defaults to $0.75/day and $25/month, never $50/day',()=>{
 const p=probe({SBC_AI_DAILY_SPEND_CAP_USD:''});
 assert.equal(p.daily,0.75);
 assert.equal(p.monthly,25);
 assert.equal(p.status.aiSpend.dailyCapUsd,0.75);
 assert.equal(p.status.aiSpend.monthlyCapUsd,25);
});
test('Environment cannot raise daily or monthly budget beyond owner-approved maxima',()=>{
 for(const setting of ['50','500','Infinity','NaN','-1','2']){
  const p=probe({SBC_AI_DAILY_SPEND_CAP_USD:setting,SBC_AI_MONTHLY_SPEND_CAP_USD:'999'});
  assert(p.daily<=0.75&&p.daily>=0,JSON.stringify({setting,cap:p.daily}));
  assert(p.monthly<=25&&p.monthly>=0,JSON.stringify({setting,cap:p.monthly}));
 }
});
test('All server-side OpenAI access pauses until provider hard spend cap is confirmed',()=>{
 assert.equal(probe().keyAvailable,false);
 assert.equal(probe({SBC_OPENAI_HARD_CAP_CONFIRMED:'NO'}).keyAvailable,false);
 assert.equal(probe({SBC_OPENAI_HARD_CAP_CONFIRMED:'YES'}).keyAvailable,true);
});
test('Missing spend ledger cannot authorize a paid AI request from the guarded endpoints',async()=>{
 const m=require(modulePath);
 const gate=m.createRuntimeGate({pool:null});
 await assert.rejects(gate.recordSpend({tenantId:1,amountUsd:0.05}),/AI_SPEND_LEDGER_UNAVAILABLE|AI_SPEND_HARD_CAP_UNVERIFIED/);
});

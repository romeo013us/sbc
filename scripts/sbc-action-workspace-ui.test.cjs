'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const {planActions}=require('../enterprise/sbc-free-action-focus.cjs');
const source=fs.readFileSync(path.join(__dirname,'../public/sbc-free-actions-v1.js'),'utf8');
const row=(id,patch={})=>({id,tenant_id:7,business_name:'Fixture '+id,phone:'5550100',status:'Lead',assigned_to:'manager_001',follow_up:null,...patch});
const rows=[row('lead_due',{follow_up:'2026-11-24'}),row('lead_hold',{status:'Do Not Call'}),row('lead_soon',{follow_up:'2026-11-28'}),row('lead_new')];
const next=()=>new Promise(r=>setTimeout(r,20));
test('workstation renders actual lane decisions, reuses authorized account opening and fails closed',async()=>{
 const dom=new JSDOM('<!doctype html><main id="view-accounts"><input class="sbc-account-search"></main>',{runScripts:'outside-only',url:'https://example.invalid',pretendToBeVisual:true});
 const {window:w}=dom;let calls=0,fail=false,opened='';
 const payload={...planActions({tenantId:7,actor:{id:'manager_001',role:'account_manager'},rows,today:'2026-11-25'}),sampledRecords:4,moreRecordsPossible:false};
 w.fetch=async()=>{calls++;return {ok:!fail,json:async()=>fail?{ok:false}:payload}};
 w.document.addEventListener('click',e=>{if(e.target.dataset.action==='open-account')opened=e.target.dataset.id});
 try{
  w.eval(source);await next();
  const q=s=>w.document.querySelector(s);
  assert.equal(q('.sbc-actions-title').textContent,'Your priority workspace');
  assert.equal(w.document.querySelectorAll('.sbc-actions-lane').length,4);
  assert.match(q('.sbc-actions-items').textContent,/lead_due/);
  q('[data-lane="review"]').click();assert.match(q('.sbc-actions-items').textContent,/lead_hold/);
  q('[data-lane="upcoming"]').click();assert.match(q('.sbc-actions-items').textContent,/lead_soon/);
  q('.sbc-actions-go').click();assert.equal(opened,'lead_soon');assert.equal(calls,1,'lane selection must not issue another API call');
  q('[data-lane="pipeline"]').click();assert.match(q('.sbc-actions-items').textContent,/qualification queue/i);
  fail=true;await w.SBC_FREE_ACTIONS_V1.refresh();assert.equal(w.document.querySelectorAll('.sbc-actions-lane').length,0);assert.match(q('.sbc-actions-status').textContent,/cannot be verified/);assert.equal(q('.sbc-actions-board').getAttribute('aria-busy'),'false');
 }finally{w.close()}
});

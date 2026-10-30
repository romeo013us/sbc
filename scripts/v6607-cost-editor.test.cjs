'use strict';
// Customer data is never mutated by this unit test. All API calls are mocked.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
const mirror=fs.readFileSync(path.join(root,'browser_public/app.js'),'utf8');
assert.equal(ui,mirror);
assert.match(ui,/id="sbcVerifiedVendorCosts"/);
assert.match(ui,/onclick="sbcSaveVerifiedVendorCost\(\)"/);
const start=ui.indexOf('async function sbcSaveVerifiedVendorCost(){');
const end=ui.indexOf('async function saveQuote(e){',start);
assert.ok(start>0&&end>start);
const code=ui.slice(start,end);
function fixture({role='owner',name='SBC WEB DESIGN',cost='20',shipping='3'}={}){
  let calls=[],feedback='',button={disabled:false,textContent:'Save verified vendor cost'};
  const input={sbcCostItemId:name,sbcCostWholesale:cost,sbcCostShipping:shipping};
  const document={getElementById(id){
    if(id==='sbcVerifiedVendorCosts')return {querySelector:()=>button};
    if(id==='sbcVendorCostFeedback')return {set textContent(s){feedback=s}};
    return {value:input[id]};
  }};
  const api=async(url,opts)=>{calls.push({url,opts});return {ok:true};};
  const fn=new Function('state','document','quoteItems','api',code+'\nreturn sbcSaveVerifiedVendorCost;')(
    {me:{role}},document,()=>[{name:'SBC WEB DESIGN',qty:1,unitPrice:199}],api);
  return {async run(){await fn();return {calls,feedback,button}}};
}
(async()=>{
  const accepted=await fixture().run();
  assert.equal(accepted.calls.length,1);
  assert.equal(accepted.calls[0].url,'/api/economic/costs');
  assert.equal(accepted.calls[0].opts.method,'POST');
  const payload=JSON.parse(accepted.calls[0].opts.body);
  assert.equal(payload.itemId,'SBC WEB DESIGN');
  assert.equal(payload.wholesaleCost,20);
  assert.equal(payload.shippingCost,3);
  assert.equal(payload.source,'owner-verified-vendor-price');
  assert.match(accepted.feedback,/No customer was charged/);
  assert.equal(accepted.button.disabled,false);
  const wrong=await fixture({name:'NOT ON THIS QUOTE'}).run();
  assert.equal(wrong.calls.length,0);
  const zero=await fixture({cost:'0'}).run();
  assert.equal(zero.calls.length,0);
  const bad=await fixture({cost:'NaN'}).run();
  assert.equal(bad.calls.length,0);
  const staff=await fixture({role:'caller'}).run();
  assert.equal(staff.calls.length,0);
  console.log('[SBC V6607 COST EDITOR] PASS: exact quote item, real cost validation, owner-only, no checkout, no unauthorized request');
})().catch(e=>{console.error(e);process.exitCode=1});

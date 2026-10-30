'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const ui=get('public/app.js');
const mirror=get('browser_public/app.js');
assert.equal(ui,mirror,'browser app mirrors must be identical');
assert.match(ui,/async function saveQuote\(e\)/);
assert.match(ui,/ECONOMIC_COST_DATA_REQUIRED/);
assert.match(ui,/sbcQuoteSaveError/);
assert.match(ui,/sbcQuoteSaving/);
assert.match(ui,/Quote saved, but account refresh failed/);
const css=get('public/sbc-light-contrast-v6601.css');
assert.equal(css,get('browser_public/sbc-light-contrast-v6601.css'));
assert.ok(css.includes('body[data-theme="light"]'));
assert.ok(!css.includes('body[data-theme="dark"]'),'light fix must not change dark mode');
for(const html of ['public/index.html','browser_public/index.html']){
  const s=get(html);
  const stylesheet='/sbc-light-contrast-v6601.css?v=66.0.1';
  const recovery='/sbc-browser-view-repair-v6601.js?v=66.0.1';
  assert.equal(s.split(stylesheet).length-1,1,'light layer is included exactly once in '+html);
  assert.equal(s.split(recovery).length-1,1,'repair helper is included exactly once in '+html);
  assert.ok(s.indexOf('sbc-v6636-canonical-styles')<s.indexOf(stylesheet),'light layer follows existing canonical CSS');
}
const fix=get('public/sbc-browser-view-repair-v6601.js');
assert.equal(fix,get('browser_public/sbc-browser-view-repair-v6601.js'));
assert.ok(!/localStorage\.(?:clear|removeItem)|indexedDB\.deleteDatabase|document\.cookie\s*=/.test(fix),'never delete user-owned browser state');
assert.match(fix,/sbcRepair/);
assert.match(fix,/\/sw\.js/);
assert.match(fix,/sbc-static-v/);
console.log('[SBC V66.0.1 UI/REVENUE] PASS: scoped contrast, deliberate cache repair, quote feedback and mirrored assets.');

const start=ui.indexOf('async function saveQuote(e){');
const finish=ui.indexOf('\nfunction sbcLoadQuoteToCart',start);
assert.ok(start>=0&&finish>start,'quote handler is extractable');
const excerpt=ui.slice(start,finish);
new Function(ui); // syntax compile only: never boot or call production APIs
new Function(get('public/sbc-browser-view-repair-v6601.js'));
async function exercise(kind){
  const notes=[],alerts=[];let calls=0,closed=0,release;
  const button={textContent:'Save quote',disabled:false,isConnected:true};
  const form={dataset:{},querySelector(selector){
    if(selector==='button.btn.primary')return button;
    if(selector==='#sbcQuoteSaveError')return null;
    if(selector==='.actions')return {before:el=>alerts.push(el)};
    return null;
  },appendChild:el=>alerts.push(el)};
  class FormDataStub{entries(){return [['customerId','test-customer'],['status','Draft']].values();}}
  const documentStub={createElement:()=>({setAttribute(){},textContent:''})};
  const pending=new Promise(done=>release=done);
  const apiStub=async()=>{
    calls++;
    if(kind==='cost')throw Error('ECONOMIC_COST_DATA_REQUIRED:SBC CHECKOUT TEST');
    if(kind==='duplicate')await pending;
    return {ok:true};
  };
  const loadStub=async()=>{if(kind==='refresh')throw Error('Read-only refresh error');};
  const save=new Function('api','FormData','quoteItems','closeModal','load','toast','document','console',
    excerpt+'\nreturn saveQuote;')(
    apiStub,FormDataStub,()=>[{name:'Test',qty:1,unitPrice:.01}],
    ()=>closed++,loadStub,t=>notes.push(t),documentStub,{warn(){}}
  );
  const event={preventDefault(){},target:form};
  if(kind==='duplicate'){const a=save(event),b=save(event);release();await Promise.all([a,b]);}
  else await save(event);
  assert.equal(button.disabled,false,'submit re-enabled after completion');
  assert.equal(form.dataset.sbcQuoteSaving,undefined,'request guard released');
  return {calls,closed,alerts,notes};
}
(async()=>{
  const blocked=await exercise('cost');
  assert.equal(blocked.calls,1);
  assert.equal(blocked.closed,0,'rejected quote must leave form open');
  assert.match(blocked.alerts[0].textContent,/vendor cost/i);
  const refresh=await exercise('refresh');
  assert.equal(refresh.closed,1,'saved quote closes modal');
  assert.ok(refresh.notes.some(s=>s.includes('Quote saved')),'successful write not mislabeled as failure');
  const duplicate=await exercise('duplicate');
  assert.equal(duplicate.calls,1,'only one POST on double-click');
  console.log('[SBC V66.0.1 UI/REVENUE] PASS: cost gate feedback, post-write refresh, duplicate-submit guard.');
})().catch(err=>{console.error(err);process.exitCode=1;});


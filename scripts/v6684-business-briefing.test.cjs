'use strict';
// V66.84: offline Customer 360 proof. No network, DB, card charges or outreach.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'public/sbc-customer360-workspace-v6525.js'),'utf8');
assert.equal(code,fs.readFileSync(path.join(root,'browser_public/sbc-customer360-workspace-v6525.js'),'utf8'),'public mirrors must match');
assert.match(code,/SBC_V6684_SMART_BUSINESS_BRIEF/);
assert.match(code,/function installBriefing\(host,c\)/);
assert.match(code,/installBriefing\(host,c\);/);
function el(tag='div'){
 const o={tagName:tag,className:'',textContent:'',children:[],disabled:false,title:'',parent:null,
   appendChild(child){child.parent=this;this.children.push(child);return child},
   insertBefore(child,other){child.parent=this;const i=other?this.children.indexOf(other):-1;this.children.splice(i<0?this.children.length:i,0,child);return child},
   querySelector(selector){if(selector===':scope > .actions')return null;if(selector[0]==='.')return this.children.find(x=>x.className?.split(' ').includes(selector.slice(1)))||null;return null},
   remove(){if(this.parent){const i=this.parent.children.indexOf(this);if(i>=0)this.parent.children.splice(i,1)}},
   addEventListener(){}};
 return o;
}
const texts=o=>[o.textContent,...o.children.flatMap(texts)].filter(Boolean).join(' | ');
const state={me:{role:'caller'},data:{customers:[],quotes:[],recoveryRequired:false}};
let host=el(),opens=0,network=0,writes=0;
const window={
 openV322Customer360:async()=>{opens++;host=el();return {ok:true}},
 openCustomer360Safe:()=>{},
 fetch:()=>{network++;throw Error('Unexpected network')}
};
const document={querySelector:s=>s==='#modalBody .v322-360'?host:null,getElementById:()=>null,createElement:el};
vm.runInNewContext(code,{window,document,state,console:{log(){}},
 fetch:()=>{network++;throw Error('Unexpected fetch')},
 api:()=>{network++;throw Error('Unexpected API')},
 saveData:()=>{writes++;throw Error('Unexpected write')},
 openModal:()=>{writes++;throw Error('Unexpected modal')}
},{timeout:2500});
async function show(c,role='caller',recovery=false){
 state.me.role=role;state.data.recoveryRequired=recovery;state.data.customers=[c];
 await window.openCustomer360Safe(c.id);
 const panel=host.querySelector('.v6684-business-brief');
 assert.ok(panel,'Business brief must appear inside 360');
 assert.equal(host.children.filter(x=>x.className?.includes('v6684-business-brief')).length,1);
 return texts(panel);
}
(async()=>{
 const a=await show({id:'lead-1',businessName:'Sunshine Barbershop',industry:'Barbershop',city:'Miami',region:'FL',website:'https://example.test'});
 assert.match(a,/CRM category: Barbershop · Miami, FL/);
 assert.match(a,/grooming, styling, or beauty appointments/);
 assert.match(a,/industry-based estimate/);
 assert.match(a,/Not verified/);
 assert.match(a,/Business Visibility · \$99/);
 assert.match(a,/FREE · CRM ONLY/);
 const b=await show({id:'lead-2',businessName:'Undescribed Company'});
 assert.match(b,/business category and services have not been verified/);
 assert.match(b,/Unknown — ask the business owner/);
 assert.match(b,/Not recorded — confirm/);
 assert.match(b,/Business Starter · \$199 \(only if a website is needed\)/);
 const c=await show({id:'lead-3',businessName:'Year Test',industry:'Restaurant',establishedYear:2018},'owner');
 assert.match(c,/Year on file: 2018 \(unverified\)/);
 assert.match(c,/current menu, hours/);
 const malicious='<img src=x onerror=alert(1)>';
 const d=await show({id:'lead-4',businessName:'Injected',industry:malicious});
 assert.match(d,/CRM category: <img src=x onerror=alert\(1\)>/);
 const panel=host.querySelector('.v6684-business-brief');
 assert.ok(panel&&!panel.innerHTML,'User input is rendered through textContent rather than HTML');
 const e=await show({id:'lead-5',businessName:'Auto',industry:'Auto detailing'},'caller',true);
 assert.match(e,/automotive services/);
 assert.equal(network,0,'Briefing must not contact AI, Google or any other API');
 assert.equal(writes,0,'Briefing must not write data or contact leads');
 assert.equal(opens,5,'Normal Customer 360 open path preserved');
 assert.doesNotMatch(code,/OPENAI_API_KEY|places\.googleapis\.com|fetch\(/);
 console.log('[SBC V66.84] PASS: 5 profile opens, truthful unknowns, mobile-compatible DOM, safe text, 2 roles, read-only state, zero network/write');
})().catch(e=>{console.error(e);process.exitCode=1});

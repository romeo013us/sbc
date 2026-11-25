'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {createPrivateConcept}=require('../enterprise/website-studio/index.cjs');
const profile={schemaVersion:1,business:{name:'Synthetic Studio',category:'Barber Shop',city:'Miami',region:'FL'},services:[{name:'Confirmed service',description:'Synthetic example.',provenance:{kind:'owner_confirmed'}}],reviews:[],contact:{phone:'305-555-0110'},verification:{approvedBy:'synthetic-owner',approvedAt:'2026-11-01T00:00:00Z'}};
function fixture(){
 const handlers=()=>{const events=new Map();return {addEventListener(name,fn){events.set(name,fn)},dispatch(name,event={}){events.get(name)?.(event)}}};
 const attrs={'aria-expanded':'false'},classes=new Set();
 let focused=false;
 const toggle={...handlers(),getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v,focus:()=>{focused=true}};
 const nav={...handlers(),classList:{toggle:(k,force)=>force?classes.add(k):classes.delete(k),remove:k=>classes.delete(k)}};
 const checkbox={checked:false,value:'Confirmed service'},count={},status={},prepare=handlers();
 const form={...handlers(),querySelectorAll:()=>[checkbox],querySelector:s=>({'[data-quote-count]':count,'[data-quote-status]':status,'[data-quote-prepare]':prepare})[s]};
 const document={...handlers(),querySelector:()=>toggle,getElementById:()=>nav,querySelectorAll:()=>[form]};
 const {bundle}=createPrivateConcept({verified_profile:profile,quoteEstimatorEnabled:true});
 vm.runInNewContext(bundle.files['site.js'],{document});
 return {toggle,nav,classes,document,form,checkbox,count,status,prepare,focused:()=>focused};
}
test('Escape closes an open mobile menu and restores focus to its toggle',()=>{
 const f=fixture();f.toggle.dispatch('click');assert.equal(f.toggle.getAttribute('aria-expanded'),'true');
 f.document.dispatch('keydown',{key:'Escape',preventDefault(){}});
 assert.equal(f.toggle.getAttribute('aria-expanded'),'false');assert.equal(f.classes.has('is-open'),false);assert.equal(f.focused(),true);
});
test('private quote preview prevents native form submission and still summarizes selections',()=>{
 const f=fixture();let prevented=false;f.form.dispatch('submit',{preventDefault(){prevented=true}});assert.equal(prevented,true);
 f.checkbox.checked=true;f.form.dispatch('change');assert.equal(f.count.textContent,'1 service selected');f.prepare.dispatch('click');assert.match(f.status.textContent,/Confirmed service.*No message has been sent/);
});

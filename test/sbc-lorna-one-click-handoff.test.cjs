'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

function leadRow(c,owns=true,inQueue=false){
 const js=read('public/lead-research.js');
 const start=js.indexOf('function canQuickHandoff(');
 const end=js.indexOf('function openReview(',start);
 assert(start>=0&&end>start,'Lorna quick handoff eligibility and row rendering should be installed');
 const selected=[];
 function element(tag,cls,value){
  return {tag,cls,textContent:value||'',children:[],events:{},style:{},
   append(...nodes){this.children.push(...nodes)},
   addEventListener(name,fn){this.events[name]=fn},
   setAttribute(){},click(){return this.events.click?.()}};
 }
 const scope={element,submittedIds:new Set(owns?[String(c.id)]:[]),
  isException:()=>false,secondaryPhoneLabel:()=>'',leadAutomationStatus:()=>c.leadAssistStatus,
  openReview(){},window:{SBCLornaHandoff:{openForLead(lead){selected.push(lead)}}},
  String,Boolean};
 vm.runInNewContext(js.slice(start,end),scope,{filename:'lead-research-shortcut.js'});
 const row=scope.displayLead(c,inQueue);
 const buttons=row.children[1].children.filter(x=>x.tag==='button');
 return {buttons,selected};
}

test('Lorna can hand off a verified submitted business directly without copying a CRM ID',()=>{
 const lead={id:'c-verified',businessName:'119th Barber Shop',status:'Lead',leadAssistStatus:'AUTO_VERIFIED'};
 const {buttons,selected}=leadRow(lead,true,false);
 const handoff=buttons.find(x=>x.textContent==='Send for owner review');
 assert(handoff,'verified row must offer direct owner handoff');
 handoff.click();
 assert.equal(selected.length,1);
 assert.equal(selected[0].id,'c-verified');
 assert.equal(selected[0].businessName,'119th Barber Shop');
});

test('handoff shortcut is absent on other researchers, pending checks, returned research and suppressed numbers',()=>{
 const good={id:'c1',businessName:'Local Auto',status:'Lead',leadAssistStatus:'AUTO_VERIFIED'};
 const cases=[
  {lead:good,own:false,queue:false},
  {lead:{...good,leadAssistStatus:'PROCESSING'},own:true,queue:false},
  {lead:{...good,doNotCall:true},own:true,queue:false},
  {lead:{...good,status:'Bad Number'},own:true,queue:false},
  {lead:{...good,do_not_call:true},own:true,queue:false},
  {lead:good,own:true,queue:true}
 ];
 for(const c of cases){
  const row=leadRow(c.lead,c.own,c.queue);
  assert(!row.buttons.some(b=>b.textContent==='Send for owner review'),JSON.stringify(c));
 }
});

test('handoff workspace preselects verified lead by business name and keeps submission manual',()=>{
 const src=read('public/sbc-lorna-handoff-v1.js');
 assert.equal(src,read('browser_public/sbc-lorna-handoff-v1.js'),'GoDaddy browser mirrors remain exact');
 const nodes={},nav={children:[],appendChild(n){this.children.push(n)}};
 function element(tag){
  return {tag,id:'',hidden:false,attributes:{},listeners:{},
   addEventListener(type,fn){this.listeners[type]=fn},
   setAttribute(name,value){this.attributes[name]=value},
   appendChild(){},focus(){this.focused=true}};
 }
 const form={listeners:{},addEventListener(type,fn){this.listeners[type]=fn},
  elements:{customerId:{value:'',readOnly:false},summary:{value:'',focus(){this.focused=true}}}
 };
 const status={textContent:''},business={textContent:''};
 const root={hidden:true,innerHTML:'',listeners:{},setAttribute(){},
  addEventListener(type,fn){this.listeners[type]=fn}};
 const doc={body:{appendChild(node){nodes[node.id]=node}},
  getElementById(id){return id==='sbc-lorna-handoff-v1'?nodes[id]:
   id==='sbc-handoff-submit'?form:id==='sbc-handoff-status'?status:
   id==='sbc-handoff-selected'?business:({addEventListener(){}})},
  createElement:tag=>tag==='section'?root:element(tag),
  querySelector:()=>nav};
 const win={addEventListener(){}};
 vm.runInNewContext(src,{document:doc,window:win,fetch(){throw Error('PREFILL_MUST_NOT_SEND_NETWORK_REQUEST')},
  String,encodeURIComponent},{filename:'sbc-lorna-handoff-v1.js'});
 assert.equal(typeof win.SBCLornaHandoff?.openForLead,'function');
 assert.equal(win.SBCLornaHandoff.openForLead({id:'c1',businessName:'119th Barber Shop'}),true);
 assert.equal(root.hidden,false);
 assert.equal(form.elements.customerId.value,'c1');
 assert.equal(form.elements.customerId.readOnly,true);
 assert.match(business.textContent,/119th Barber Shop/);
 assert.equal(form.elements.summary.focused,true);
 // The nav opener restores manual fallback; no hidden lock-in to a previous lead.
 nav.children[0].listeners.click();
 assert.equal(form.elements.customerId.readOnly,false);
 assert.equal(form.elements.customerId.value,'');
});

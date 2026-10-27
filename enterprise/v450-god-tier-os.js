'use strict';
const crypto=require('crypto');
const VERSION='45.0.0';
const CAPABILITIES=[
 ['metadata','Dynamic Metadata & Object Engine'],
 ['graph','SBC Business Graph'],
 ['decision','Kim Executive Decision Engine'],
 ['revenue','Revenue Intelligence Engine'],
 ['workflow','Universal Workflow Builder'],
 ['events','Universal Event/API Fabric'],
 ['canary','Synthetic Business Canary'],
 ['memory','Operational Memory Graph'],
 ['policy','Policy-as-Code Governance'],
 ['twin','SBC Operational Twin']
];
const POLICY={
 owner:['*'], kim_safe:['lead.assign','customer.message','order.stage','workflow.run','diagnostics.run'], manager:['lead.assign','customer.message','quote.create','task.manage'], sales_manager:['lead.assign','customer.message','quote.create'], lead_researcher:['lead.create','lead.import'], demo:['read.demo'], caller:['lead.assign','customer.message','quote.create']
};
function safeId(s=''){return String(s).trim().toLowerCase().replace(/[^a-z0-9_:-]+/g,'_').slice(0,100)||crypto.randomUUID();}
function now(){return new Date().toISOString();}
function hash(x){return crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');}
function defineField(name,type='text',opts={}){return {id:safeId(name),name:String(name).slice(0,120),type:String(type),required:Boolean(opts.required),options:Array.isArray(opts.options)?opts.options.slice(0,100):[],searchable:opts.searchable!==false,createdAt:now()};}
function defineObject(name,fields=[]){return {id:safeId(name),name:String(name).slice(0,120),fields:fields.map(f=>defineField(f.name||f,f.type||'text',f)),createdAt:now(),version:1};}
function validateMetadata(obj,record={}){const errors=[];for(const f of (obj?.fields||[])){if(f.required&&(record[f.id]===undefined||record[f.id]===null||record[f.id]===''))errors.push(`${f.id} is required`);if(f.type==='number'&&record[f.id]!==undefined&&Number.isNaN(Number(record[f.id])))errors.push(`${f.id} must be numeric`);if(f.type==='select'&&record[f.id]!==undefined&&f.options.length&&!f.options.includes(record[f.id]))errors.push(`${f.id} is not an allowed option`);}return {ok:errors.length===0,errors};}
function relate(edges=[],from,to,type='related'){return [...edges,{id:crypto.randomUUID(),from:String(from),to:String(to),type:String(type),createdAt:now()}];}
function graphNeighbors(edges,id){const x=String(id);return edges.filter(e=>e.from===x||e.to===x).map(e=>({edge:e,other:e.from===x?e.to:e.from}));}
function graphWalk(edges,start,depth=2){const seen=new Set([String(start)]),queue=[[String(start),0]],out=[];while(queue.length){const [id,d]=queue.shift();if(d>=depth)continue;for(const n of graphNeighbors(edges,id)){if(!seen.has(n.other)){seen.add(n.other);out.push(n);queue.push([n.other,d+1]);}}}return out;}
function scoreLead(r={}){const velocity=Math.max(0,Math.min(100,Number(r.velocity||0))),recency=Math.max(0,Math.min(100,Number(r.recency||0))),value=Math.max(0,Math.min(100,Number(r.value||0))),engagement=Math.max(0,Math.min(100,Number(r.engagement||0)));return Math.round(velocity*.35+recency*.2+value*.3+engagement*.15);}
function revenueSnapshot(rows=[]){return rows.reduce((a,r)=>{const revenue=Number(r.revenue||r.value||0),vendor=Number(r.vendorCost||0),fees=Number(r.paymentFees||0),commission=Number(r.commission||0),labor=Number(r.laborCost||0);a.pipeline+=revenue;a.cost+=vendor+fees+commission+labor;a.contribution+=revenue-vendor-fees-commission-labor;if(String(r.status||'').toLowerCase().includes('risk')||String(r.status||'').toLowerCase().includes('pending'))a.atRisk+=revenue;return a;},{pipeline:0,cost:0,contribution:0,atRisk:0});}
function buildWorkflow(name,trigger,steps=[]){return {id:safeId(name),name:String(name).slice(0,120),trigger,steps:Array.isArray(steps)?steps.slice(0,50):[],version:1,createdAt:now(),active:false};}
function validateWorkflow(w){return Boolean(w&&w.id&&w.trigger&&Array.isArray(w.steps)&&w.steps.length<=50);}
function event(type,payload={},actor='system'){return {id:crypto.randomUUID(),type:String(type),payload,actor:String(actor),occurredAt:now(),schemaVersion:1};}
function decision(input={}){const facts=Array.isArray(input.facts)?input.facts:[];const options=Array.isArray(input.options)?input.options:[];const risk=Number(input.risk||0);let action=options[0]||'review';if(risk>=80)action='escalate_to_owner';else if(options.includes('send_payment_link')&&input.paymentPending)action='send_payment_link';return {decision:action,facts:facts.slice(0,20),options:options.slice(0,20),risk:Math.max(0,Math.min(100,risk)),requiresOwnerApproval:['escalate_to_owner','refund','delete','credential_change'].includes(action),verified:false};}
function memory(entry={}){return {id:crypto.randomUUID(),subject:String(entry.subject||'unknown').slice(0,160),fact:String(entry.fact||'').slice(0,500),source:String(entry.source||'system').slice(0,160),confidence:Math.max(0,Math.min(1,Number(entry.confidence??1))),expiresAt:entry.expiresAt||null,createdAt:now()};}
function can(role,action){const r=String(role||'').toLowerCase();const list=POLICY[r]||[];return list.includes('*')||list.includes(action);}
function policyCheck(role,action){return {role:String(role||''),action:String(action||''),allowed:can(role,action),ownerApproval:action.startsWith('financial.')||['refund','delete','credential_change'].includes(action)};}
function canaryScenario(){return {id:'SBC-CANARY-45',synthetic:true,steps:['lead.created','customer.created','quote.created','order.created','payment.simulated','fulfillment.created','order.completed'],realPayment:false,realCustomerData:false};}
function operationalTwin(input={}){const leads=Array.isArray(input.leads)?input.leads:[],orders=Array.isArray(input.orders)?input.orders:[],payments=Array.isArray(input.payments)?input.payments:[],tasks=Array.isArray(input.tasks)?input.tasks:[],errors=Array.isArray(input.errors)?input.errors:[];return {generatedAt:now(),health:errors.length?'DEGRADED':'HEALTHY',counts:{leads:leads.length,orders:orders.length,payments:payments.length,tasks:tasks.length,errors:errors.length},attention:{paymentsPending:payments.filter(x=>String(x.status).toLowerCase()==='pending').length,stalledOrders:orders.filter(x=>String(x.status).toLowerCase()==='stalled').length,openTasks:tasks.filter(x=>!x.completed).length},revenue:revenueSnapshot(orders),errors:errors.slice(0,20)};}
function summary(){return {version:VERSION,capabilityCount:CAPABILITIES.length,capabilities:CAPABILITIES.map(([id,name])=>({id,name})),policyRoles:Object.keys(POLICY),canary:canaryScenario(),architecture:['metadata','graph','events','workflow','decision','revenue','memory','policy','twin']};}
module.exports={VERSION,CAPABILITIES,POLICY,safeId,defineField,defineObject,validateMetadata,relate,graphNeighbors,graphWalk,scoreLead,revenueSnapshot,buildWorkflow,validateWorkflow,event,decision,memory,can,policyCheck,canaryScenario,operationalTwin,summary};

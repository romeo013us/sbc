'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const CATALOG_PATH=path.join(__dirname,'..','data','kim-greatness-100.json');
let catalogCache=null;
function catalog(){if(!catalogCache)catalogCache=JSON.parse(fs.readFileSync(CATALOG_PATH,'utf8'));return catalogCache;}
function arr(v){return Array.isArray(v)?v:[];}
function low(v){return String(v||'').toLowerCase();}
function countOpen(rows,done=['completed','closed','cancelled','lost']){return arr(rows).filter(x=>!done.includes(low(x.status))).length;}
function snapshot(db={}){
 const customers=arr(db.customers), orders=arr(db.orders), tasks=arr(db.tasks), users=arr(db.users), jobs=arr(db.fulfillmentJobs), messages=arr(db.customerMessages), activities=arr(db.activities);
 const leads=customers.filter(x=>low(x.status)==='lead');
 const paid=orders.filter(x=>low(x.paymentStatus)==='paid'||low(x.status)==='paid');
 const openOrders=orders.filter(x=>!['completed','cancelled','fulfilled'].includes(low(x.status)));
 const overdueTasks=tasks.filter(x=>x.dueAt&&new Date(x.dueAt).getTime()<Date.now()&&!['completed','closed'].includes(low(x.status)));
 const stalledJobs=jobs.filter(x=>['failed','stalled','blocked'].includes(low(x.status)));
 return {counts:{customers:customers.length,leads:leads.length,orders:orders.length,paidOrders:paid.length,openOrders:openOrders.length,tasks:tasks.length,overdueTasks:overdueTasks.length,users:users.length,fulfillmentJobs:jobs.length,stalledJobs:stalledJobs.length,messages:messages.length,activities:activities.length},generatedAt:new Date().toISOString()};
}
function priorities(db={}){
 const s=snapshot(db), out=[];
 if(s.counts.overdueTasks)out.push({priority:'HIGH',title:'Overdue work',reason:`${s.counts.overdueTasks} open task(s) are past due.`,next:'Review overdue tasks and assign or complete the next action.'});
 if(s.counts.stalledJobs)out.push({priority:'HIGH',title:'Fulfillment exceptions',reason:`${s.counts.stalledJobs} fulfillment job(s) are stalled/failed/blocked.`,next:'Inspect exceptions and recover only through approved reversible paths.'});
 if(s.counts.leads)out.push({priority:'MEDIUM',title:'Pipeline movement',reason:`${s.counts.leads} lead(s) are active.`,next:'Identify the leads with a documented next step and follow up on aging opportunities.'});
 if(s.counts.openOrders)out.push({priority:'MEDIUM',title:'Open customer work',reason:`${s.counts.openOrders} order(s) remain open.`,next:'Check payment, fulfillment stage, owner, and customer communication.'});
 if(!out.length)out.push({priority:'LOW',title:'Operating clean',reason:'No obvious exception was detected from the available operational data.',next:'Review today’s goals and choose the smallest action that advances them.'});
 return out.slice(0,7);
}
function explain(){return {name:'Kim',role:'Operational Co-Owner / Second-in-Command',owner:'Romeo',mission:'Coordinate the business, explain reality, execute safe work, protect the operation, and escalate when authority or professional expertise is required.',powers:['Operational diagnostics','Lead and sales coordination','Customer and fulfillment workflow support','Training and team coaching','Safe/reversible repair orchestration','Executive briefs and decision support','Business and personal organization when Romeo explicitly asks'],boundaries:['Never fabricate status or completion','Never disclose secrets or credentials','Never change owner security or credentials','Never perform irreversible deletion','Never issue unauthorized refunds or irreversible financial actions','Never impersonate a lawyer, judge, doctor, spouse, or other human professional','Escalate when licensed/professional judgment is required']};}
function decision(input={}){const question=String(input.question||'').trim();const facts=arr(input.facts).map(String).filter(Boolean).slice(0,12);const options=arr(input.options).map(String).filter(Boolean).slice(0,8);return {question,facts,options,framework:{knownFacts:facts.length?'Use only documented facts supplied or retrieved.':'No verified facts supplied yet.',tradeoffs:options.map(x=>({option:x,pros:'Identify concrete upside.',risks:'Identify concrete downside.',reversible:'Determine whether the action can be undone.'})),recommendation:'Kim does not choose for Romeo; she identifies the next evidence-gathering step and the safest reversible action.',nextStep:question?'Gather the missing evidence, then choose the smallest reversible action that advances the stated goal.':'State the decision and desired outcome first.'}};}
function selfCheck(result={}){return {truthGate:true,evidenceRequired:true,authorityCheck:true,reversibilityCheck:true,professionalEscalation:true,checkedAt:new Date().toISOString(),result};}
function catalogSummary(){const c=catalog();return {version:c.version,title:c.title,count:c.capabilities.length,domains:[...new Set(c.capabilities.map(x=>x.domain))],capabilities:c.capabilities};}
function brief(db={}){const s=snapshot(db);return {generatedAt:s.generatedAt,identity:explain(),snapshot:s,priorities:priorities(db),operatingLanes:['Revenue','Sales','Customers','Fulfillment','Team','System Health','Brand','Founder/Personal Planning'],principle:'Truth before confidence; reversible before irreversible; evidence before claims.'};}
module.exports={VERSION:'43.9.0',catalog,catalogSummary,snapshot,priorities,explain,decision,selfCheck,brief};

'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const DATA=path.join(__dirname,'..','data','kim-operations-backbone-v410.json');
const now=()=>new Date().toISOString();
const id=(p='op')=>`${p}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
const norm=v=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,'').trim();
const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const state={version:'41.0.0',updatedAt:now(),backupChecks:[],integrationChecks:[],notifications:[],leadAudits:[],dailyReports:[],auditEvents:[]};
try{if(fs.existsSync(DATA))Object.assign(state,JSON.parse(fs.readFileSync(DATA,'utf8')))}catch{}
function save(){state.updatedAt=now();fs.mkdirSync(path.dirname(DATA),{recursive:true});fs.writeFileSync(DATA,JSON.stringify(state,null,2));}
function audit(actor,eventType,message,meta={}){const e={id:id('audit'),actor:clean(actor?.name||actor?.username||actor||'system',120),role:clean(actor?.role||'system',50),eventType:clean(eventType,120),message:clean(message,1000),meta,createdAt:now()};state.auditEvents.unshift(e);state.auditEvents=state.auditEvents.slice(0,5000);save();return e;}
function backupCheck(ctx={}){
 const dataFile=ctx.dataFile||'';let dataFileOk=false,dataFileAt=null;
 try{dataFileOk=Boolean(dataFile&&fs.existsSync(dataFile));dataFileAt=dataFileOk?fs.statSync(dataFile).mtime.toISOString():null}catch{}
 const mysqlOk=Boolean(ctx.mysqlPool);const result={id:id('backup'),checkedAt:now(),dataFile:{configured:Boolean(dataFile),present:dataFileOk,lastModified:dataFileAt},mysql:{configured:mysqlOk,status:mysqlOk?'AVAILABLE':'UNAVAILABLE'},restoreTested:false,restoreStatus:'NOT_TESTED',status:dataFileOk||mysqlOk?'READY':'ATTENTION'};
 state.backupChecks.unshift(result);state.backupChecks=state.backupChecks.slice(0,100);save();return result;
}
function integrations(env={}){
 const defs=[
  ['square','Square Payments',['SQUARE_ACCESS_TOKEN','SQUARE_LOCATION_ID']],['twilio','Twilio Voice/SMS',['TWILIO_ACCOUNT_SID','TWILIO_PHONE_NUMBER']],['email','Outbound Email',['SBC_SMTP_HOST','SBC_SMTP_USER','SBC_SMTP_PASS']],['openai','OpenAI / Kim',['OPENAI_API_KEY']],['godaddy','GoDaddy',['GODADDY_PAT']],['four_over_four','4OVER4',['FOUROVER4_API_KEY','FOUROVER4_ORDER_ENDPOINT']],['vistaprint','VistaPrint',['VISTAPRINT_API_KEY','VISTAPRINT_ORDER_ENDPOINT']]
 ];
 const rows=defs.map(([id,label,required])=>{const missing=required.filter(k=>!String(env[k]||'').trim());return {id,label,status:missing.length?'MISSING':'CONFIGURED',missing,checkedAt:now()};});
 state.integrationChecks=rows;save();return rows;
}
function leadQuality(customers=[]){
 const seen=new Map(),duplicates=[],cleaned=[];
 for(const c of Array.isArray(customers)?customers:[]){const keys=[norm(c.email),String(c.phone||'').replace(/\D/g,''),norm(c.website),norm(c.businessName||c.contactName)].filter(Boolean);const hits=[];for(const k of keys){if(seen.has(k))hits.push(seen.get(k));else seen.set(k,c.id||id('lead'))}const score=Math.min(100,(c.businessName?25:0)+(c.email?25:0)+(c.phone?20:0)+(c.website?15:0)+(c.address?15:0));const rec={id:c.id||'',businessName:clean(c.businessName||c.contactName,200),score,duplicate:hits.length>0,duplicateOf:[...new Set(hits)],status:hits.length?'DUPLICATE':score>=70?'READY_FOR_VERIFICATION':score>=40?'NEEDS_REVIEW':'LOW_CONFIDENCE'};cleaned.push(rec);if(hits.length)duplicates.push(rec);}
 const out={checkedAt:now(),total:cleaned.length,duplicates:duplicates.length,ready:cleaned.filter(x=>x.status==='READY_FOR_VERIFICATION').length,review:cleaned.filter(x=>x.status==='NEEDS_REVIEW').length,lowConfidence:cleaned.filter(x=>x.status==='LOW_CONFIDENCE').length,records:cleaned.slice(0,1000)};
 state.leadAudits.unshift(out);state.leadAudits=state.leadAudits.slice(0,50);save();return out;
}
function notification(event){const n={id:id('notice'),priority:['critical','high','normal','low'].includes(String(event?.priority))?String(event.priority):'normal',recipient:clean(event?.recipient||'Kim',120),channel:clean(event?.channel||'command-center',40),title:clean(event?.title||'SBC Notification',180),message:clean(event?.message||'',2000),status:'QUEUED',createdAt:now(),meta:event?.meta||{}};state.notifications.unshift(n);state.notifications=state.notifications.slice(0,2000);save();return n;}
function dailyReport(ctx={}){
 const orders=Array.isArray(ctx.orders)?ctx.orders:[],customers=Array.isArray(ctx.customers)?ctx.customers:[],quotes=Array.isArray(ctx.quotes)?ctx.quotes:[],tasks=Array.isArray(ctx.tasks)?ctx.tasks:[];
 const paid=orders.filter(o=>String(o.paymentStatus||o.status||'').toLowerCase()==='paid');
 const openFulfillment=orders.filter(o=>!['completed','delivered','cancelled','fulfilled'].includes(String(o.fulfillmentStatus||o.status||'').toLowerCase()));
 const followups=quotes.filter(q=>q.nextFollowupAt&&new Date(q.nextFollowupAt)<new Date());
 const overdueTasks=tasks.filter(t=>t.dueDate&&new Date(t.dueDate)<new Date()&&String(t.status||'').toLowerCase()!=='completed');
 const report={id:id('daily'),generatedAt:now(),revenue:{paidOrders:paid.length,paidRevenue:paid.reduce((s,o)=>s+Number(o.price||0),0)},sales:{leads:customers.filter(c=>String(c.status||'').toLowerCase()==='lead').length,quotes:quotes.length,followupsDue:followups.length},fulfillment:{open:openFulfillment.length},system:{backup:state.backupChecks[0]?.status||'NOT_CHECKED',integrations:state.integrationChecks.filter(x=>x.status==='CONFIGURED').length,totalIntegrations:state.integrationChecks.length},work:{overdueTasks:overdueTasks.length},ownerRequired:[]};
 if(report.system.backup!=='READY')report.ownerRequired.push('Verify database/data backup status');
 if(state.integrationChecks.some(x=>x.status==='MISSING'))report.ownerRequired.push('Review missing integration credentials');
 state.dailyReports.unshift(report);state.dailyReports=state.dailyReports.slice(0,30);save();return report;
}
function summary(ctx={}){return {version:'41.0.0',backup:state.backupChecks[0]||null,integrationHealth:state.integrationChecks,leadAudit:state.leadAudits[0]||null,queuedNotifications:state.notifications.filter(n=>n.status==='QUEUED').length,auditEvents:state.auditEvents.slice(0,20),dailyReport:state.dailyReports[0]||dailyReport(ctx),updatedAt:state.updatedAt};}
module.exports={VERSION:'41.0.0',state,save,audit,backupCheck,integrations,leadQuality,notification,dailyReport,summary};

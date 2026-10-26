'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6662_LEAD_OPERATIONS_TENANT_SCOPE';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' count='+n);return s.replace(a,b);}
function modifyRoute(s,method,route,fn){
 const startLabel="app."+method+"('"+route+"'";
 const start=s.indexOf(startLabel);
 if(start<0||s.indexOf(startLabel,start+1)!==-1)throw Error(MARKER+': missing/duplicate route '+route);
 let end=s.indexOf('\napp.',start+1);
 if(end<0)throw Error(MARKER+': missing next route after '+route);
 const old=s.slice(start,end),modified=fn(old);
 return s.slice(0,start)+modified+s.slice(end);
}
function patchServer(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate');
 // A background maintenance cycle may handle the whole service, but a person
 // running a tenant-scoped batch must never select another tenant's queued jobs.
 s=once(s,'async function processLeadAssistQueue(limit=5){',
  'async function processLeadAssistQueue(limit=5,scopedTenantId=null){','optional scoped lead queue');
 s=once(s,
  "const work=q.filter(x=>x.status==='QUEUED').sort(",
  "const work=q.filter(x=>x.status==='QUEUED'&&(scopedTenantId===null||(db.customers||[]).some(c=>String(c.id)===String(x.customerId)&&Number(c.tenantId)===scopedTenantId))).sort(",
  'manual lead queue cannot select another tenant');
 s=once(s,
  "pending:q.filter(x=>x.status==='QUEUED').length",
  "pending:q.filter(x=>x.status==='QUEUED'&&(scopedTenantId===null||(db.customers||[]).some(c=>String(c.id)===String(x.customerId)&&Number(c.tenantId)===scopedTenantId))).length",
  'manual queue cannot disclose other tenant pending counts');
 s=once(s,
  "app.get('/api/lead-assist/summary',auth,",
  "// "+MARKER+": bind sales/research actions to the authenticated selected tenant.\n"+
  "function SBC_V6662_LEAD_TENANT(req,res,next){try{req.sbcV6662TenantId=requireRequestTenant(req);next()}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'})}}\n"+
  "app.get('/api/lead-assist/summary',auth,SBC_V6662_LEAD_TENANT,",
  'tenant middleware');
 // Repeat middleware on the mutation/read routes.
 for(const [verb,route] of [
  ['post','/api/lead-assist/run'],
  ['get','/api/lead-assist/:customerId'],
  ['post','/api/lead-assist/:customerId/review'],
  ['post','/api/lead-intelligence/enrich/:customerId'],
  ['post','/api/lead-intelligence/enrich-batch'],
  ['post','/api/lead-intelligence/demo-brief/:customerId'],
  ['get','/api/lead-intelligence/:customerId']
 ]){
  const a="app."+verb+"('"+route+"',auth,";
  s=once(s,a,"app."+verb+"('"+route+"',auth,SBC_V6662_LEAD_TENANT,",'middleware '+route);
 }
 s=modifyRoute(s,'get','/api/lead-assist/summary',r=>once(r,
  'const rows=db.customers||[];const q=leadAssistQueue();',
  'const rows=(db.customers||[]).filter(c=>Number(c.tenantId)===req.sbcV6662TenantId);const ownIds=new Set(rows.map(c=>String(c.id)));const q=leadAssistQueue().filter(j=>ownIds.has(String(j.customerId)));',
  'summary counts'));
 s=modifyRoute(s,'post','/api/lead-assist/run',r=>{
  r=once(r,
   "const rows=(db.customers||[]).filter(c=>!['Customer','Lost','DNC'].includes",
   "const rows=(db.customers||[]).filter(c=>Number(c.tenantId)===req.sbcV6662TenantId).filter(c=>!['Customer','Lost','DNC'].includes",
   'select only tenant leads');
  return once(r,'const result=await processLeadAssistQueue(max);',
   'const result=await processLeadAssistQueue(max,req.sbcV6662TenantId);','run queue only tenant');
 });
 const match="(db.customers||[]).find(x=>String(x.id)===String(req.params.customerId))";
 const tenantMatch="(db.customers||[]).find(x=>String(x.id)===String(req.params.customerId)&&Number(x.tenantId)===req.sbcV6662TenantId)";
 for(const [verb,route] of [
  ['get','/api/lead-assist/:customerId'],
  ['post','/api/lead-assist/:customerId/review'],
  ['post','/api/lead-intelligence/enrich/:customerId'],
  ['post','/api/lead-intelligence/demo-brief/:customerId']
 ]){
  s=modifyRoute(s,verb,route,r=>once(r,match,tenantMatch,'customer ID tenant '+route));
 }
 s=modifyRoute(s,'post','/api/lead-intelligence/enrich-batch',r=>once(r,
  "let rows=(db.customers||[]).filter(c=>!['Customer','Lost','DNC'].includes",
  "let rows=(db.customers||[]).filter(c=>Number(c.tenantId)===req.sbcV6662TenantId).filter(c=>!['Customer','Lost','DNC'].includes",
  'tenant-limited batch research'));
 s=modifyRoute(s,'get','/api/lead-intelligence/:customerId',r=>once(r,
  'const m=megaData();',
  "const c=(db.customers||[]).find(c=>String(c.id)===String(req.params.customerId)&&Number(c.tenantId)===req.sbcV6662TenantId);if(!c)return res.status(404).json({error:'No live intelligence record found.'});const m=megaData();",
  'intelligence response customer tenant'));
 // These two NextOps routes already gate role/tenant; filter their selected objects too.
 s=modifyRoute(s,'get','/api/next-operations/dial-queue',r=>once(r,
  "const customers=(db.customers||[]).filter(c=>!['Customer','Lost'].includes(c.status));",
  "const customers=(db.customers||[]).filter(c=>Number(c.tenantId)===NEXTOPS.tenantContext(req)&&!['Customer','Lost'].includes(c.status));",
  'dial queue tenant isolation'));
 s=modifyRoute(s,'post','/api/next-operations/workflows/:id/step',r=>once(r,
  "const st=nextOpsState(),run=st.workflowRuns.find(x=>x.id===req.params.id);",
  "const st=nextOpsState(),tenantId=NEXTOPS.tenantContext(req),run=st.workflowRuns.find(x=>x.id===req.params.id&&Number(x.tenantId)===tenantId);",
  'workflow mutation tenant isolation'));
 new vm.Script(s,{filename:'server.js'});
 return s;
}
function apply(root){const p=path.join(root,'server.js');if(!fs.existsSync(p))throw Error(MARKER+': no compiled server');const out=patchServer(fs.readFileSync(p,'utf8'));fs.writeFileSync(p,out);return {marker:MARKER,files:['server.js'],noProductionWrites:true};}
module.exports={MARKER,apply,patchServer};

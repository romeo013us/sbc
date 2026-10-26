'use strict';
// V6649: owner approvals and autonomous controls must not acknowledge an action
// until its canonical MySQL commit succeeds. No provider calls or schema changes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6649_DURABLE_OWNER_ACTIONS';
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error(MARKER+': '+label+' count '+n);return s.replace(a,b);}
function replaceLine(s,prefix,fn){const lines=s.split('\n'),idx=lines.findIndex(l=>l.startsWith(prefix));if(idx<0||lines.filter(l=>l.startsWith(prefix)).length!==1)throw Error(MARKER+': absent/duplicate '+prefix);lines[idx]=fn(lines[idx]);return lines.join('\n')}
function writerPrelude(){return [
'// '+MARKER+': no false 201/200 on an uncommitted operation.',
'function SBC_V6649_REQUIRE_WRITER(){',
"  if(SBC_RUNTIME_READ_ONLY||!mysqlPool||!sbcWriterLeaseReady||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||sbcShutdownStarted)throw Object.assign(new Error('SBC_F4_PERSISTENCE_NOT_READY'),{code:'SBC_F4_PERSISTENCE_NOT_READY'});",
'}',
"function SBC_V6649_ERROR_STATUS(e){const c=String(e?.code||e?.message||'');return c==='SBC_F4_PERSISTENCE_NOT_READY'?423:c==='TENANT_CONTEXT_REQUIRED'?403:/MYSQL_RELATIONAL_COMMIT_FAILED|MYSQL_RECOVERY/.test(c)?503:400;}",
"function SBC_V6649_SAFE_ERROR(e){const c=String(e?.code||e?.message||'');return /MYSQL_RELATIONAL_COMMIT_FAILED|MYSQL_RECOVERY|SBC_F4_PERSISTENCE_NOT_READY/.test(c)?'The action was not committed. Check production database health and retry only after verification.':String(e?.message||'Action blocked.').slice(0,250);}",
].join('\n')}
const approval=`app.post('/api/fantastic4/approval',auth,ownerOnly,async(req,res)=>{
  let created=null;
  try{
    SBC_V6649_REQUIRE_WRITER();
    const tenantId=requireRequestTenant(req),orderId=String(req.body?.orderId||'').trim();
    if(!orderId)return res.status(400).json({ok:false,error:'ORDER_ID_REQUIRED'});
    const order=(db.orders||[]).find(x=>String(x.id)===orderId&&Number(x.tenantId)===tenantId);
    if(!order)return res.status(404).json({ok:false,error:'ORDER_NOT_FOUND_IN_TENANT'});
    created=F4.approval(db.fantastic4,{...(req.body||{}),orderId,customerId:order.customerId||'',approvedBy:String(req.user?.id||'owner')});
    created.tenantId=tenantId;
    await saveData();
    res.status(201).json({ok:true,approval:created});
  }catch(e){
    if(created){const list=db.fantastic4?.approvals;if(Array.isArray(list)){const i=list.indexOf(created);if(i>=0)list.splice(i,1);}}
    res.status(SBC_V6649_ERROR_STATUS(e)).json({ok:false,error:SBC_V6649_SAFE_ERROR(e)});
  }
});`;
const activate=`app.post('/api/fantastic4/production-activate',auth,ownerOnly,async(req,res)=>{
  let approval=null,previous=null;
  try{
    SBC_V6649_REQUIRE_WRITER();
    const tenantId=requireRequestTenant(req),orderId=String(req.body?.orderId||'').trim();
    if(!orderId)return res.status(400).json({ok:false,error:'ORDER_ID_REQUIRED'});
    const order=(db.orders||[]).find(x=>String(x.id)===orderId&&Number(x.tenantId)===tenantId);
    if(!order)return res.status(404).json({ok:false,error:'ORDER_NOT_FOUND_IN_TENANT'});
    if(!require('./enterprise/v6640-payment-evidence.cjs').confirmedPaid(order))return res.status(409).json({ok:false,error:'PAYMENT_EVIDENCE_REQUIRED'});
    approval=(db.fantastic4.approvals||[]).find(x=>String(x.orderId)===orderId&&Number(x.tenantId)===tenantId&&x.status==='APPROVED');
    if(!approval)return res.status(409).json({ok:false,error:'CUSTOMER_APPROVAL_REQUIRED'});
    previous={productionActivatedAt:approval.productionActivatedAt,status:approval.status,adminFileLock:approval.adminFileLock,note:approval.note};
    approval.productionActivatedAt=new Date().toISOString();approval.status='ACTIVE';approval.adminFileLock=true;
    approval.note='Production activated after verified payment and owner-recorded approval; destructive/admin changes remain owner-controlled.';
    await saveData();
    res.json({ok:true,status:'ACTIVE',adminFileLock:true,orderId});
  }catch(e){
    if(approval&&previous){for(const key of Object.keys(previous)){if(previous[key]===undefined)delete approval[key];else approval[key]=previous[key];}}
    res.status(SBC_V6649_ERROR_STATUS(e)).json({ok:false,error:SBC_V6649_SAFE_ERROR(e)});
  }
});`;
function durableLine(line,label){
 if(!line.includes('(req,res)=>')||!line.includes('try{')||!line.includes('saveData();'))throw Error(MARKER+': unexpected route '+label);
 line=line.replace('(req,res)=>','async(req,res)=>');
 line=line.replace('try{','let sbcPrior=null;try{SBC_V6649_REQUIRE_WRITER();sbcPrior=structuredClone(db.fantastic4);');
 line=line.replace(/(?<!await )saveData();/g,'await saveData();');
 line=line.replace(/catch(e){/g,'catch(e){if(sbcPrior){for(const key of Object.keys(db.fantastic4))delete db.fantastic4[key];Object.assign(db.fantastic4,sbcPrior);}');
 line=line.replace(/res.status(400).json({ok:false,error:e.message})/g,
  'res.status(SBC_V6649_ERROR_STATUS(e)).json({ok:false,error:SBC_V6649_SAFE_ERROR(e)})');
 return line;
}
function patchServer(src){
 if(src.includes(MARKER))throw Error(MARKER+': duplicate');
 src=once(src,"app.get('/api/fantastic4/summary',auth,(req,res)=>res.json({ok:true,...F4.summary(db.fantastic4,process.env)}));",
  writerPrelude()+"
app.get('/api/fantastic4/summary',auth,(req,res)=>res.json({ok:true,...F4.summary(db.fantastic4,process.env)}));",
  'durable writer preflight');
 src=replaceLine(src,"app.post('/api/fantastic4/approval'",()=>approval);
 src=replaceLine(src,"app.post('/api/fantastic4/production-activate'",()=>activate);
 for(const action of [
   'demo-provision','handoff','qa','assets/sync','blueprints',
   'autonomous/mode','autonomous/pause','autonomous/resume','autonomous/toggle','autonomous/event',
   'corporate-evolution/evaluate'
 ]){
  src=replaceLine(src,"app.post('/api/fantastic4/"+action+"'",line=>durableLine(line,action));
 }
 new vm.Script(src,{filename:'server.js'});return src;
}
function apply(root){const file=path.join(root,'server.js');if(!fs.existsSync(file))throw Error(MARKER+': missing server');const after=patchServer(fs.readFileSync(file,'utf8'));fs.writeFileSync(file,after);return {marker:MARKER,files:['server.js'],awaitsMysql:true,ownerApprovalOnly:true,paymentProofRequiredForActivation:true,providerCalls:false,schemaChanges:false};}
module.exports={apply,MARKER,patchServer,once,durableLine};

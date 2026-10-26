'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6641_FULFILLMENT_PAYMENT_EVIDENCE';
function swap(s,old,rep,label){
 const count=s.split(old).length-1;
 if(count!==1)throw Error(MARKER+': '+label+' anchor count='+count);
 return s.replace(old,rep);
}
function apply(root){
 const mod=path.join(root,'enterprise/kim-fulfillment-control-v400.js');
 const server=path.join(root,'server.js');
 if(!fs.existsSync(mod)||!fs.existsSync(server))throw Error(MARKER+': missing compiled target');
 let m=fs.readFileSync(mod,'utf8'),s=fs.readFileSync(server,'utf8');
 if(m.includes(MARKER)||s.includes(MARKER))throw Error(MARKER+': duplicate install');
 m=swap(m,
 "function paid(order){return String(order?.paymentStatus||'').toUpperCase()==='PAID'||['Paid','In Progress','Ready'].includes(String(order?.status||''));}",
 "function paid(order){return require('./v6640-payment-evidence.cjs').confirmedPaid(order);}",
 'legacy workflow-status payment assumption');
 m=swap(m,'checklist:{payment:true,customer:',
  'checklist:{payment:paid(order),customer:','initial payment checklist');
 m=swap(m,
 '  x.customerId=clean(order.customerId||x.customerId,100);',
 [
  "  // SBC_V6641_FULFILLMENT_PAYMENT_EVIDENCE: block imported unpaid orders without deleting history.",
  "  if(!paid(order)){",
  "    x.checklist.payment=false;",
  "    if(x.stage!=='BLOCKED'){",
  "      const from=x.stage;x.stage='BLOCKED';",
  "      x.history.unshift({id:id('fh'),from,to:'BLOCKED',actor:'Payment Evidence Guard',at:now(),meta:{reason:'PAYMENT_EVIDENCE_REQUIRED'}});",
  "      event('PAYMENT_EVIDENCE_HOLD',oid,null,{previousStage:from});",
  "    }",
  "    x.blockedReason='Payment not confirmed';",
  "  }else x.checklist.payment=true;",
  "  x.customerId=clean(order.customerId||x.customerId,100);"
 ].join('\n'), 'protect pre-existing unverified state');
 m=swap(m,'function sync(orders=[]){for(const o of orders){if(paid(o))ensureOrder(o);}',
  'function sync(orders=[]){for(const o of orders){if(paid(o)||state.orders[String(o.id)])ensureOrder(o);}', 'synchronize existing unpaid state');
 s=swap(s,'function v400Orders(){return Array.isArray(db.orders)?db.orders:[];}',
  "const V400_PAYMENT_EVIDENCE=require('./enterprise/v6640-payment-evidence.cjs');\nfunction v400Orders(){return Array.isArray(db.orders)?db.orders:[];}",'server payment classifier import');
 s=swap(s,
 "  const o=v400Orders().find(x=>String(x.id)===String(id)); if(!o)return;\n  const map={PAID:",
 "  const o=v400Orders().find(x=>String(x.id)===String(id)); if(!o)return;\n  if(!V400_PAYMENT_EVIDENCE.confirmedPaid(o))throw Object.assign(new Error('PAYMENT_EVIDENCE_REQUIRED'),{code:'PAYMENT_EVIDENCE_REQUIRED'});\n  const map={PAID:",
 'status update payment gate');
 const old="app.get('/api/fulfillment/provider-center',auth,requireCapability('fulfillment.manage'),";
 const guard=[
  "// SBC_V6641_FULFILLMENT_PAYMENT_EVIDENCE: authorize and verify BEFORE V400 order changes.",
  "app.use('/api/kim400/orders/:id',auth,(req,res,next)=>{",
  "  if(req.method==='GET'||req.method==='HEAD')return next();",
  "  const o=v400Orders().find(x=>String(x.id)===String(req.params.id));",
  "  if(!o)return res.status(404).json({ok:false,error:'Order not found.'});",
  "  if(!V400_PAYMENT_EVIDENCE.confirmedPaid(o))",
  "    return res.status(409).json({ok:false,code:'PAYMENT_EVIDENCE_REQUIRED',error:'Confirmed payment required before fulfillment.'});",
  "  next();",
  "});",old
 ].join('\n');
 s=swap(s,old,guard,'auth and payment preflight middleware');
 new vm.Script(m,{filename:'kim-fulfillment-control-v400.js'});
 new vm.Script(s,{filename:'server.js'});
 fs.writeFileSync(mod,m);fs.writeFileSync(server,s);
 return {marker:MARKER,files:['enterprise/kim-fulfillment-control-v400.js','server.js'],
  changedPayments:false,unverifiedFulfillmentBlocked:true,
  previouslyImportedOrdersPreserved:true,writerLeaseUntouched:true};
}
module.exports={apply,MARKER,swap};

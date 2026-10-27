const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '40.0.0';
const FILE = path.join(__dirname, '..', 'data', 'kim-fulfillment-control-v400.json');
const STAGES = [
  'PAID',
  'INTAKE',
  'ASSET_REQUIRED',
  'PREFLIGHT',
  'PROOF_PENDING',
  'PROOF_APPROVED',
  'PRODUCTION_READY',
  'VENDOR_STAGED',
  'VENDOR_SUBMITTED',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'FULFILLED',
  'BLOCKED'
];
const TERMINAL = new Set(['FULFILLED']);
const TRANSITIONS = {
  PAID:['INTAKE','BLOCKED'], INTAKE:['ASSET_REQUIRED','PREFLIGHT','BLOCKED'],
  ASSET_REQUIRED:['PREFLIGHT','BLOCKED'], PREFLIGHT:['PROOF_PENDING','PRODUCTION_READY','BLOCKED'],
  PROOF_PENDING:['PROOF_APPROVED','BLOCKED'], PROOF_APPROVED:['PRODUCTION_READY','BLOCKED'],
  PRODUCTION_READY:['VENDOR_STAGED','IN_PRODUCTION','BLOCKED'], VENDOR_STAGED:['VENDOR_SUBMITTED','BLOCKED'],
  VENDOR_SUBMITTED:['IN_PRODUCTION','BLOCKED'], IN_PRODUCTION:['SHIPPED','BLOCKED'],
  SHIPPED:['DELIVERED','BLOCKED'], DELIVERED:['FULFILLED'], BLOCKED:['INTAKE','ASSET_REQUIRED','PREFLIGHT','PROOF_PENDING','PROOF_APPROVED','PRODUCTION_READY']
};

function now(){return new Date().toISOString();}
function id(p){return `${p}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;}
function clean(v,n=1000){return String(v??'').trim().slice(0,n);}
function clone(v){return JSON.parse(JSON.stringify(v));}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(v||{})).digest('hex');}
function ensureFile(){fs.mkdirSync(path.dirname(FILE),{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify({version:VERSION,orders:{},events:[],updatedAt:now()},null,2));}
function load(){ensureFile();try{return {...{version:VERSION,orders:{},events:[],updatedAt:now()},...JSON.parse(fs.readFileSync(FILE,'utf8'))};}catch{return {version:VERSION,orders:{},events:[],updatedAt:now()};}}
let state=load();
function save(){state.version=VERSION;state.updatedAt=now();fs.writeFileSync(FILE,JSON.stringify(state,null,2));}
function actorName(actor){return actor?.name||actor?.username||actor?.id||'Kim';}
function event(type,orderId,actor,meta={}){const e={id:id('fev'),type,orderId:String(orderId),actor:actorName(actor),at:now(),meta};state.events.unshift(e);state.events=state.events.slice(0,5000);return e;}

function itemsFromOrder(order){
  const parsed=typeof order?.notes==='string'?(()=>{try{return JSON.parse(order.notes||'{}')}catch{return {}}})():{};
  if(Array.isArray(parsed.items)&&parsed.items.length)return parsed.items.map((x,i)=>({id:String(x.id||`item_${i+1}`),name:clean(x.name||order.product||'SBC Service',200),qty:Number(x.qty||1),unitPrice:Number(x.unitPrice||0)}));
  return [{id:'order',name:clean(order?.product||'SBC Service',200),qty:Number(order?.quantity||1),unitPrice:Number(order?.price||0)}];
}
function paid(order){return require('./v6640-payment-evidence.cjs').confirmedPaid(order);}
function ensureOrder(order){
  const oid=String(order.id);let x=state.orders[oid];
  if(!x){x={id:oid,orderNumber:clean(order.orderNumber||order.id,100),customerId:clean(order.customerId,100),customerName:clean(order.customerName||'',200),stage:paid(order)?'PAID':'BLOCKED',blockedReason:paid(order)?'':'Payment not confirmed',items:itemsFromOrder(order),assets:[],proofs:[],vendor:{provider:'',status:'NOT_STAGED',orderId:'',trackingNumber:''},shipping:{carrier:'',trackingNumber:'',status:'NOT_SHIPPED'},financial:{revenue:Number(order.price||0),cost:0,margin:null},checklist:{payment:paid(order),customer:Boolean(order.customerId||order.customerName),items:true,assets:false,preflight:false,proof:false,approval:false,vendor:false,shipping:false,delivery:false},history:[],createdAt:now(),updatedAt:now()};state.orders[oid]=x;event('ORDER_IMPORTED',oid,null,{stage:x.stage});}
  // SBC_V6641_FULFILLMENT_PAYMENT_EVIDENCE: block imported unpaid orders without deleting history.
  if(!paid(order)){
    x.checklist.payment=false;
    if(x.stage!=='BLOCKED'){
      const from=x.stage;x.stage='BLOCKED';
      x.history.unshift({id:id('fh'),from,to:'BLOCKED',actor:'Payment Evidence Guard',at:now(),meta:{reason:'PAYMENT_EVIDENCE_REQUIRED'}});
      event('PAYMENT_EVIDENCE_HOLD',oid,null,{previousStage:from});
    }
    x.blockedReason='Payment not confirmed';
  }else x.checklist.payment=true;
  x.customerId=clean(order.customerId||x.customerId,100);x.customerName=clean(order.customerName||x.customerName,200);x.items=itemsFromOrder(order);x.financial.revenue=Number(order.price||x.financial.revenue||0);
  return x;
}
function sync(orders=[]){for(const o of orders){if(paid(o)||state.orders[String(o.id)])ensureOrder(o);}save();return Object.values(state.orders).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
function blockers(x){const b=[];if(!x.checklist.payment)b.push('Payment not confirmed');if(!x.checklist.customer)b.push('Customer not linked');if(!x.checklist.items)b.push('Order items missing');if(['PREFLIGHT','PROOF_PENDING','PROOF_APPROVED','PRODUCTION_READY','VENDOR_STAGED','VENDOR_SUBMITTED','IN_PRODUCTION'].includes(x.stage)&&!x.checklist.assets)b.push('Production assets missing');if(['PROOF_PENDING','PROOF_APPROVED'].includes(x.stage)&&!x.checklist.preflight)b.push('Preflight incomplete');if(x.stage==='PRODUCTION_READY'&&!x.checklist.approval&&x.proofs.length>0)b.push('Proof approval missing');return b;}
function recalc(x){x.checklist.assets=x.assets.length>0;x.checklist.preflight=x.assets.length>0&&x.assets.every(a=>a.preflightStatus==='PASS');x.checklist.proof=x.proofs.some(p=>p.status==='APPROVED');x.checklist.approval=x.checklist.proof||x.proofs.length===0;x.checklist.vendor=['VENDOR_STAGED','VENDOR_SUBMITTED','IN_PRODUCTION','SHIPPED','DELIVERED','FULFILLED'].includes(x.stage);x.checklist.shipping=['SHIPPED','DELIVERED','FULFILLED'].includes(x.stage);x.checklist.delivery=['DELIVERED','FULFILLED'].includes(x.stage);x.blockedReason=blockers(x).join('; ');if(x.stage!=='BLOCKED'&&x.blockedReason&&['VENDOR_STAGED','VENDOR_SUBMITTED','IN_PRODUCTION','SHIPPED','DELIVERED'].includes(x.stage))x.stage='BLOCKED';x.updatedAt=now();return x;}
function advance(orderId,next,actor,meta={}){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');if(TERMINAL.has(x.stage))throw Error('Fulfillment order is already complete.');const allowed=TRANSITIONS[x.stage]||[];if(!allowed.includes(next))throw Error(`Invalid fulfillment transition ${x.stage} → ${next}.`);if(next==='VENDOR_SUBMITTED'&&x.vendor.status!=='READY')throw Error('Vendor submission is gated: provider is not verified READY.');if(next==='PRODUCTION_READY'&&x.proofs.length&& !x.checklist.proof)throw Error('Production cannot start until the customer proof is approved.');const from=x.stage;x.stage=next;x.history.unshift({id:id('fh'),from,to:next,actor:actorName(actor),at:now(),meta});recalc(x);event('STAGE_CHANGED',x.id,actor,{from,to:next,...meta});save();return clone(x);}
function addAsset(orderId,input,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');const a={id:id('asset'),name:clean(input.name||'Production Asset',200),uri:clean(input.uri,1000),hash:clean(input.hash||hash(input),128),preflightStatus:input.preflightStatus==='PASS'?'PASS':'PENDING',createdAt:now(),createdBy:actorName(actor)};x.assets.unshift(a);recalc(x);event('ASSET_ATTACHED',x.id,actor,{assetId:a.id});save();return clone(a);}
function addProof(orderId,input,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');const p={id:id('proof'),version:x.proofs.length+1,title:clean(input.title||'Customer Proof',200),uri:clean(input.uri,1000),status:'PENDING',createdAt:now(),createdBy:actorName(actor)};x.proofs.unshift(p);recalc(x);event('PROOF_CREATED',x.id,actor,{proofId:p.id});save();return clone(p);}
function approveProof(orderId,proofId,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');const p=x.proofs.find(z=>z.id===String(proofId));if(!p)throw Error('Proof not found.');p.status='APPROVED';p.approvedAt=now();p.approvedBy=actorName(actor);x.proofs.forEach(z=>{if(z.id!==p.id)z.status='SUPERSEDED';});recalc(x);event('PROOF_APPROVED',x.id,actor,{proofId:p.id});save();return clone(p);}
function preflight(orderId,assetId,passed,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');const a=x.assets.find(z=>z.id===String(assetId));if(!a)throw Error('Asset not found.');a.preflightStatus=passed?'PASS':'BLOCKED';a.preflightAt=now();a.preflightBy=actorName(actor);recalc(x);event('ASSET_PREFLIGHT',x.id,actor,{assetId:a.id,status:a.preflightStatus});save();return clone(a);}
function stageVendor(orderId,provider,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');x.vendor={provider:clean(provider,100),status:'STAGED',orderId:'',trackingNumber:''};recalc(x);event('VENDOR_STAGED',x.id,actor,{provider:x.vendor.provider});save();return clone(x.vendor);}
function markVendorReady(orderId,provider,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');x.vendor={provider:clean(provider,100),status:'READY',orderId:'',trackingNumber:''};recalc(x);event('VENDOR_READY',x.id,actor,{provider:x.vendor.provider});save();return clone(x.vendor);}
function submitVendor(orderId,vendorOrderId,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');if(x.vendor.status!=='READY')throw Error('Vendor is not READY.');if(!x.checklist.assets||!x.checklist.preflight)throw Error('Vendor submission blocked until assets pass preflight.');if(x.proofs.length&&!x.checklist.proof)throw Error('Vendor submission blocked until proof approval.');if(x.stage==='PRODUCTION_READY')advance(orderId,'VENDOR_STAGED',actor,{automatic:true});if(x.stage!=='VENDOR_STAGED')throw Error(`Vendor submission requires VENDOR_STAGED; current stage is ${x.stage}.`);x.vendor.orderId=clean(vendorOrderId||id('vendor'),100);advance(orderId,'VENDOR_SUBMITTED',actor,{provider:x.vendor.provider,vendorOrderId:x.vendor.orderId});x.vendor.status='SUBMITTED';save();return clone(x.vendor);}
function shipping(orderId,input,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');x.shipping={carrier:clean(input.carrier,100),trackingNumber:clean(input.trackingNumber,200),status:'SHIPPED',shippedAt:now()};x.vendor.trackingNumber=x.shipping.trackingNumber;advance(orderId,'SHIPPED',actor,{carrier:x.shipping.carrier,trackingNumber:x.shipping.trackingNumber});return clone(x.shipping);}
function deliver(orderId,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');x.shipping.status='DELIVERED';x.shipping.deliveredAt=now();advance(orderId,'DELIVERED',actor);return clone(x.shipping);}
function notify(orderId,channel,message,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');const n={id:id('notify'),channel:clean(channel||'email',30),message:clean(message||'',4000),status:'QUEUED',createdAt:now(),createdBy:actorName(actor)};x.notifications=Array.isArray(x.notifications)?x.notifications:[];x.notifications.unshift(n);event('CUSTOMER_NOTIFICATION_QUEUED',x.id,actor,{notificationId:n.id,channel:n.channel});save();return clone(n);}
function reconcile(orderId,actualCost,actor){const x=state.orders[String(orderId)];if(!x)throw Error('Fulfillment order not found.');if(!x.checklist.payment)throw Error('PAYMENT_EVIDENCE_REQUIRED');x.financial.cost=Number(actualCost||0);x.financial.margin=Number((x.financial.revenue-x.financial.cost).toFixed(2));event('FINANCIAL_RECONCILED',x.id,actor,{revenue:x.financial.revenue,cost:x.financial.cost,margin:x.financial.margin});save();return clone(x.financial);}
function kimSweep(orders,actor){sync(orders);const actions=[];for(const x of Object.values(state.orders)){
  if(x.stage==='PAID'){advance(x.id,'INTAKE',actor,{automatic:true});actions.push(`${x.orderNumber}: intake opened`);}
  if(x.stage==='INTAKE'&&x.assets.length===0){advance(x.id,'ASSET_REQUIRED',actor,{automatic:true});actions.push(`${x.orderNumber}: waiting for assets`);}
  if(x.stage==='PREFLIGHT'&&x.checklist.preflight){advance(x.id,x.proofs.length?'PROOF_PENDING':'PRODUCTION_READY',actor,{automatic:true});actions.push(`${x.orderNumber}: preflight complete`);}
  if(x.stage==='PROOF_APPROVED'){advance(x.id,'PRODUCTION_READY',actor,{automatic:true});actions.push(`${x.orderNumber}: proof approved`);}
  if(x.stage==='VENDOR_STAGED'&&x.vendor.status==='READY'){actions.push(`${x.orderNumber}: vendor ready; submission remains gated to authorized action`);}
  recalc(x);
}
save();return {ok:true,version:VERSION,actions,summary:summary(orders)};}
function summary(orders=[]){sync(orders);const all=Object.values(state.orders);const counts=Object.fromEntries(STAGES.map(s=>[s,all.filter(x=>x.stage===s).length]));return {version:VERSION,total:all.length,counts,blocked:all.filter(x=>x.stage==='BLOCKED').map(x=>({orderId:x.id,orderNumber:x.orderNumber,reason:x.blockedReason})),readyToProduce:all.filter(x=>x.stage==='PRODUCTION_READY').length,awaitingVendor:all.filter(x=>x.stage==='VENDOR_STAGED').length,inProduction:all.filter(x=>x.stage==='IN_PRODUCTION').length,shipping:all.filter(x=>['SHIPPED','DELIVERED'].includes(x.stage)).length,fulfilled:all.filter(x=>x.stage==='FULFILLED').length,events:state.events.slice(0,100),updatedAt:state.updatedAt};}
function get(orderId,orders=[]){sync(orders);return clone(state.orders[String(orderId)]||null);}
function events(orderId){return state.events.filter(e=>!orderId||String(e.orderId)===String(orderId)).slice(0,200);}
module.exports={VERSION,STAGES,TRANSITIONS,sync,summary,get,events,advance,addAsset,addProof,approveProof,preflight,stageVendor,markVendorReady,submitVendor,shipping,deliver,notify,reconcile,kimSweep,state};

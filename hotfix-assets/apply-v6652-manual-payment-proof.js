'use strict';
// SBC V66.52: prohibit manual payment receipts from manufacturing paid orders.
// Existing records are preserved for read-only reconciliation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const MARKER='SBC_V6652_MANUAL_PAYMENT_PROOF';
function one(s,old,replacement,name){const n=s.split(old).length-1;if(n!==1)throw Error(MARKER+': '+name+' count='+n);return s.replace(old,replacement);}
function range(s,a,b,replace,name){const start=s.indexOf(a),end=s.indexOf(b,start+a.length);if(start<0||end<start||s.indexOf(a,start+1)>=0)throw Error(MARKER+': '+name+' anchors');return s.slice(0,start)+replace+'\n'+s.slice(end)}
function evidence(s){
 s=one(s,'function confirmedPaid(o){',
 `// SBC_V6652_MANUAL_PAYMENT_PROOF: a manually entered reference is not Square capture.
function manualEvidence(o){
 if(!o||typeof o!=='object')return false;
 let parsed={};try{if(typeof o.notes==='string'&&o.notes.trim().startsWith('{'))parsed=JSON.parse(o.notes)}catch(_){}
 return [o,o.parsed||{},parsed].some(x=>x.manualPaymentEvidence===true||x.manualPaymentConfirmation===true);
}
function verifiedSquareAfterManual(o){
 let parsed={};try{if(typeof o?.notes==='string'&&o.notes.trim().startsWith('{'))parsed=JSON.parse(o.notes)}catch(_){}
 const p=o?.parsed&&typeof o.parsed==='object'?o.parsed:{};
 const state=norm(o?.squarePaymentStatus||p.squarePaymentStatus||parsed.squarePaymentStatus);
 const paymentId=String(o?.squarePaymentId||p.squarePaymentId||parsed.squarePaymentId||'').trim();
 return SETTLED.has(state)&&Boolean(paymentId);
}
function confirmedPaid(o){`,'manual proof helpers');
 s=one(s," if(!o||typeof o!=='object')return false;\n const payment=norm(o.paymentStatus);",
 " if(!o||typeof o!=='object')return false;\n if(manualEvidence(o)&&!verifiedSquareAfterManual(o))return false;\n const payment=norm(o.paymentStatus);",'manual exception');
 s=one(s,'module.exports={confirmedPaid,unverifiedFulfillment,snapshot};','module.exports={confirmedPaid,unverifiedFulfillment,snapshot,manualEvidence,verifiedSquareAfterManual};','helper exports');
 return s;
}
const LEGACY=String.raw`app.post('/api/v32-2/payment-reconciliation',auth,ownerOnly,(req,res)=>{
 // SBC_V6652_MANUAL_PAYMENT_PROOF: never mint paid revenue from typed receipts.
 res.setHeader('Cache-Control','no-store');
 return res.status(409).json({ok:false,code:'SBC_PROVIDER_PAYMENT_PROOF_REQUIRED',error:'Owner-entered receipt is not settled-payment proof. Use Verify Payment to confirm the existing Square order. No changes were made.'});
});`;
const MARKPAID=String.raw`app.post('/api/payments/square/owner-mark-paid/:orderId',auth,ownerOnly,(req,res)=>{
 // SBC_V6652_MANUAL_PAYMENT_PROOF: prevent unverified vendor fulfillment.
 let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}
 const order=(db.orders||[]).find(o=>String(o.id)===String(req.params.orderId)&&Number(o.tenantId)===tenantId);
 if(!order)return res.status(404).json({ok:false,code:'ORDER_NOT_FOUND'});
 res.setHeader('Cache-Control','no-store');
 return res.status(409).json({ok:false,code:'SBC_PROVIDER_PAYMENT_PROOF_REQUIRED',error:'Manual Mark Paid is disabled. Verify Square payment before fulfillment. No changes were made.'});
});`;
const READONLY=String.raw`// SBC_V6652_MANUAL_PAYMENT_PROOF: owner read-only, tenant-bound financial discrepancy report.
app.get('/api/owner/revenue-integrity',auth,ownerOnly,(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 let tenantId;try{tenantId=requireRequestTenant(req)}catch(_){return res.status(403).json({ok:false,code:'TENANT_CONTEXT_REQUIRED'});}
 const E=require('./enterprise/v6640-payment-evidence.cjs');
 const orders=(db.orders||[]).filter(o=>Number(o.tenantId)===tenantId);
 const customers=(db.customers||[]).filter(c=>Number(c.tenantId)===tenantId);
 const unresolved=orders.filter(o=>E.manualEvidence(o)&&!E.confirmedPaid(o));
 const needsReview=orders.filter(E.unverifiedFulfillment);
 const paid=orders.filter(E.confirmedPaid);
 const orderIds=new Set(orders.map(o=>String(o.id))),customerIds=new Set(customers.map(c=>String(c.id)));
 const linked=(db.squarePayments||[]).filter(p=>(p.sbcOrderId&&orderIds.has(String(p.sbcOrderId)))||(p.customerId&&customerIds.has(String(p.customerId))));
 res.json({ok:true,version:BUILD_VERSION,at:new Date().toISOString(),source:'TENANT_SCOPED_MEMORY_SNAPSHOT_READ_ONLY',tenantId,
  counts:{customers:customers.length,activeLeads:customers.filter(c=>c.status==='Lead').length,orders:orders.length,
   markedPaid:orders.filter(o=>/^(PAID|COMPLETED)$/i.test(String(o.paymentStatus||''))).length,
   evidenceClassifiedPaid:paid.length,legacyManualUnverified:unresolved.length,unverifiedFulfillment:needsReview.length,
   linkedPaymentRecords:linked.length,ownerSuppliedRecords:linked.filter(p=>p.manualEvidence===true||p.status==='MANUALLY_RECONCILED').length},
  exceptionOrderIds:[...new Set([...unresolved,...needsReview].map(o=>String(o.id)))].slice(0,25),
  limitations:'Not a Square deposit or authoritative MySQL certification. No financial or CRM records were modified.'});
});`;
function server(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate');
 s=range(s,"app.post('/api/v32-2/payment-reconciliation',auth,ownerOnly,async(req,res)=>{","app.post('/api/payments/square/create-link/",LEGACY,'manual reconciliation');
 const start="app.post('/api/payments/square/owner-mark-paid/:orderId',auth,ownerOnly,async(req,res)=>{";
 const i=s.indexOf(start),j=s.indexOf('\n',i);if(i<0||j<0||s.indexOf(start,i+1)>=0)throw Error(MARKER+': mark paid route');
 s=s.slice(0,i)+MARKPAID+s.slice(j);
 s=one(s,"app.post('/api/v32-2/payment-reconciliation',auth,ownerOnly,(req,res)=>{",READONLY+"\napp.post('/api/v32-2/payment-reconciliation',auth,ownerOnly,(req,res)=>{",'report route');
 return s;
}
function client(s){
 if(s.includes(MARKER))throw Error(MARKER+': duplicate browser patch');
 s=one(s,'onclick="openV322Reconcile()">💳 Reconcile Payment','onclick="openV322Reconcile()">💳 Verify Payment','button title');
 s=one(s,"    const paidOrders=orders.filter(o=>['Paid','Completed','Fulfilled'].includes(String(o.status||'')) || String(o.paymentStatus||'').toLowerCase()==='paid');",
 `    // SBC_V6652_MANUAL_PAYMENT_PROOF: paid ≠ fulfilled or owner-entered receipt.
    const paidOrders=orders.filter(o=>{
      let p={};try{p=typeof o.notes==='string'&&o.notes.trim().startsWith('{')?JSON.parse(o.notes):{}}catch(_){}
      if(o.parsed&&typeof o.parsed==='object')p={...p,...o.parsed};
      const manual=o.manualPaymentEvidence===true||o.manualPaymentConfirmation===true||p.manualPaymentEvidence===true||p.manualPaymentConfirmation===true;
      const sq=String(o.squarePaymentStatus||p.squarePaymentStatus||'').toUpperCase();
      const id=String(o.squarePaymentId||p.squarePaymentId||'').trim();
      if(manual&&!(id&&['PAID','COMPLETED'].includes(sq)))return false;
      if(['REFUNDED','CHARGEBACK','VOID','VOIDED'].includes(String(o.paymentStatus||'').toUpperCase()))return false;
      return ['PAID','COMPLETED'].includes(String(o.paymentStatus||'').toUpperCase())||['PAID','COMPLETED'].includes(sq);
    });`,'honest paid order metric');
 s=one(s,'    const revenue=paidOrders.reduce((s,o)=>s+Number(o.price||0),0)+quoteWon.reduce((s,q)=>s+Number(q.total||0),0);',
 '    const revenue=paidOrders.reduce((s,o)=>s+Number(o.price||0),0); // Won quotes are pipeline, not collected revenue.','avoid quote as revenue');
 const a=s.indexOf('  function openV322Reconcile(){'),b=s.indexOf('  function install(){',a);
 if(a<0||b<=a)throw Error(MARKER+': browser function');
 const fn=String.raw`  // SBC_V6652_MANUAL_PAYMENT_PROOF: no synthetic manual settlement.
  function openV322Reconcile(){
    openModal('Verify Square Payment','<form id="v322SquareVerify"><p class="mini">Enter an EXISTING SBC order ID linked to Square. Only provider-confirmed capture can mark an order paid.</p>'+
      '<label>SBC order ID<input name="orderId" maxlength="100" required></label><p id="v322VerifyFeedback" role="status" aria-live="polite"></p>'+
      '<div class="actions"><button class="btn" type="button" onclick="closeModal()">Cancel</button><button class="btn primary" type="submit">Check Square Settlement</button></div></form>');
    const form=document.getElementById('v322SquareVerify');
    form.onsubmit=async event=>{
      event.preventDefault();
      const id=String(form.elements.namedItem('orderId')?.value||'').trim();
      const feedback=document.getElementById('v322VerifyFeedback'),submit=form.querySelector('button[type="submit"]');
      if(!id){feedback.textContent='Enter an order ID.';return;}
      submit.disabled=true;feedback.textContent='Checking Square settlement…';
      try{
        const r=await api('/api/payments/square/refresh/'+encodeURIComponent(id),{method:'POST'});
        feedback.textContent='Verification: '+String(r.status||r.verification||'CHECK_COMPLETE')+'. Review Payments Center for the final state.';
        await load();if(typeof render==='function')render();
      }catch(err){feedback.textContent='Square verification unavailable: '+String(err?.message||'No changes were made.');}
      finally{submit.disabled=false;}
    };
  }
`;
 s=s.slice(0,a)+fn+s.slice(b);return s;
}
function apply(root){
 const pairs=[['server.js',server],['enterprise/v6640-payment-evidence.cjs',evidence],['public/v32-2-upgrade.js',client],['browser_public/v32-2-upgrade.js',client]];
 const after=pairs.map(([rel,fn])=>{const p=path.join(root,rel);if(!fs.existsSync(p))throw Error(MARKER+': missing '+rel);const s=fn(fs.readFileSync(p,'utf8'));new vm.Script(s,{filename:rel});return {p,s,rel};});
 for(const x of after)fs.writeFileSync(x.p,x.s);
 return {marker:MARKER,files:after.map(x=>x.rel),noManualPaidWrites:true,noSchemaChanges:true,noLiveProviderCalls:true};
}
module.exports={MARKER,apply,server,evidence,client};
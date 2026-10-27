/* SBC V32.2 First-Customer Operations Upgrade
 * Additive module: no rebuild of the existing Command Center.
 */
(function(){
  'use strict';
  const V='32.2.1';
  const esc2=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const money2=v=>typeof money==='function'?money(v):`$${Number(v||0).toFixed(2)}`;
  const D=()=>window.state?.data||{};
  const today2=()=>new Date().toISOString().slice(0,10);
  function metrics(){
    const d=D(), customers=d.customers||[], quotes=d.quotes||[], orders=d.orders||[], tasks=d.tasks||[], renewals=d.renewals||[];
    // SBC_V6652_MANUAL_PAYMENT_PROOF: paid ≠ fulfilled or owner-entered receipt.
    const paidOrders=orders.filter(o=>{
      let p={};try{p=typeof o.notes==='string'&&o.notes.trim().startsWith('{')?JSON.parse(o.notes):{}}catch(_){}
      if(o.parsed&&typeof o.parsed==='object')p={...p,...o.parsed};
      const manual=o.manualPaymentEvidence===true||o.manualPaymentConfirmation===true||p.manualPaymentEvidence===true||p.manualPaymentConfirmation===true;
      const sq=String(o.squarePaymentStatus||p.squarePaymentStatus||'').toUpperCase();
      const id=String(o.squarePaymentId||p.squarePaymentId||'').trim();
      if(manual&&!(id&&['PAID','COMPLETED'].includes(sq)))return false;
      if(['REFUNDED','CHARGEBACK','VOID','VOIDED'].includes(String(o.paymentStatus||'').toUpperCase()))return false;
      return ['PAID','COMPLETED'].includes(String(o.paymentStatus||'').toUpperCase())||['PAID','COMPLETED'].includes(sq);
    });
    const quoteWon=quotes.filter(q=>['Won','Paid'].includes(String(q.status||'')));
    const revenue=paidOrders.reduce((s,o)=>s+Number(o.price||0),0); // Won quotes are pipeline, not collected revenue.
    const cost=orders.reduce((s,o)=>s+Number(o.cost||0),0);
    const overdueTasks=tasks.filter(t=>t.status!=='Completed'&&t.dueAt&&new Date(t.dueAt)<new Date()).length;
    const waiting=tasks.filter(t=>t.status!=='Completed'&&/customer|client/i.test(`${t.title||''} ${t.notes||''}`)).length;
    const activeFulfillment=orders.filter(o=>['Paid','In Progress','Ready','Fulfillment','Ready for Fulfillment'].includes(String(o.status||''))||o.fulfillmentStatus==='Ready for Fulfillment').length;
    const stale=customers.filter(c=>c.status!=='Customer'&&c.status!=='Lost'&&c.followUp&&c.followUp<today2()).length;
    const renew=renewals.filter(r=>r.status!=='Paid'&&r.dueDate&&r.dueDate<=new Date(Date.now()+30*864e5).toISOString().slice(0,10)).length;
    const unmatched=(d.squarePayments||[]).filter(p=>!p.sbcOrderId&&['COMPLETED','PAID','CAPTURED'].includes(String(p.status||'').toUpperCase())).length;
    return {customers:customers.length,paidOrders:paidOrders.length,revenue,cost,margin:revenue-cost,overdueTasks,waiting,activeFulfillment,stale,renew,unmatched};
  }
  function exceptions(){
    const d=D(), out=[];
    (d.orders||[]).forEach(o=>{if((String(o.paymentStatus||'').toLowerCase()==='paid'||['Paid','Completed'].includes(o.status))&&!o.fulfillmentStatus)out.push({level:'high',title:'Paid order missing fulfillment status',detail:`${o.customerName||'Customer'} · ${o.product||'Order'} · ${money2(o.price)}`});});
    (d.squarePayments||[]).filter(p=>!p.sbcOrderId&&['COMPLETED','PAID','CAPTURED'].includes(String(p.status||'').toUpperCase())).slice(0,10).forEach(p=>out.push({level:'high',title:'Unmatched payment',detail:`${p.customerName||'Unlinked customer'} · ${money2(p.amount||p.amountMoney?.amount/100)} · ${p.reference||p.receiptNumber||p.squarePaymentId||'No reference'}`}));
    (d.tasks||[]).filter(t=>t.status!=='Completed'&&t.dueAt&&new Date(t.dueAt)<new Date()).slice(0,10).forEach(t=>out.push({level:'medium',title:'Overdue task',detail:t.title||'Untitled task'}));
    (d.customers||[]).filter(c=>c.status!=='Customer'&&c.status!=='Lost'&&c.followUp&&c.followUp<today2()).slice(0,10).forEach(c=>out.push({level:'medium',title:'Follow-up overdue',detail:c.businessName||c.contactName||c.id}));
    return out.slice(0,20);
  }
  function opsPage(){
    const m=metrics(), ex=exceptions(), d=D();
    const customers=(d.customers||[]).filter(c=>c.status==='Customer').slice(0,8);
    const templates=[
      {name:'Business Visibility · $99',items:['Google Business Profile setup/cleanup','Up to 2 social profiles','100 business cards','Business email setup guidance']},
      {name:'SBC Business Starter · $199',items:['Customer onboarding','Approved package deliverables','Payment/order linkage','Fulfillment checklist','Customer approval']},
      {name:'SBC Business Essentials · $349',items:['Customer onboarding','Approved package deliverables','Payment/order linkage','Fulfillment checklist','Customer approval','Final handoff']},
      {name:'SBC Complete Launch · $699',items:['Website/domain workflow','Business email','Managed hosting','Security/SSL','Business cards','Customer approval','Final handoff']}
    ];
    return `<div class="v322-shell">
      <div class="hero"><div><div class="eyebrow" style="color:#f7a842">V32.2 · FIRST-CUSTOMER OPERATIONS UPGRADE</div><h2>Run SBC from the money all the way to delivery.</h2><p>Payment → Order → Fulfillment → Approval → Handoff. Exceptions are surfaced instead of hidden.</p></div><div class="hero-actions"><button class="btn primary" onclick="openV322Reconcile()">💳 Verify Payment</button><button class="btn ghost" onclick="window.sbcAskKim?.('Review the SBC Operations 360 panel and identify the highest-priority exception.')">🤖 Ask Kim</button></div></div>
      <div class="grid stats"><div class="stat"><div class="label">RECORDED REVENUE</div><div class="value">${money2(m.revenue)}</div><div class="sub">Paid orders + won/paid quotes</div></div><div class="stat"><div class="label">PAID ORDERS</div><div class="value">${m.paidOrders}</div><div class="sub">Recorded in SBC</div></div><div class="stat"><div class="label">ACTIVE FULFILLMENT</div><div class="value">${m.activeFulfillment}</div><div class="sub">Orders needing delivery work</div></div><div class="stat"><div class="label">NET RECORDED MARGIN</div><div class="value">${money2(m.margin)}</div><div class="sub">Known order cost only</div></div></div>
      <div class="grid three section"><div class="stat"><div class="label">🚨 EXCEPTIONS</div><div class="value">${ex.length}</div><div class="sub">${m.unmatched} unmatched payments</div></div><div class="stat"><div class="label">⏰ OVERDUE WORK</div><div class="value">${m.overdueTasks+m.stale}</div><div class="sub">Tasks + customer follow-ups</div></div><div class="stat"><div class="label">🔁 RENEWALS SOON</div><div class="value">${m.renew}</div><div class="sub">Next 30 days</div></div></div>
      <div class="grid two section"><div class="card"><div class="card-head"><h2>🚨 Operations Exception Center</h2><span class="badge ${ex.length?'orange':'green'}">${ex.length?'ACTION NEEDED':'HEALTHY'}</span></div><div class="card-body">${ex.map(x=>`<div class="list-card v322-exception"><div><strong>${x.level==='high'?'🔴':'🟠'} ${esc2(x.title)}</strong><div class="meta">${esc2(x.detail)}</div></div></div>`).join('')||'<div class="empty">No current exceptions detected.</div>'}</div></div>
      <div class="card"><div class="card-head"><h2>👤 Customer 360</h2><span class="badge blue">LIVE CRM</span></div><div class="card-body"><p class="mini">Open a customer with everything SBC currently knows: contact, orders, quotes, payments, tasks, communications and activity.</p><div class="form-grid"><label>Select customer<select id="v322CustomerSelect"><option value="">Choose a customer…</option>${(d.customers||[]).map(c=>`<option value="${esc2(c.id)}">${esc2(c.businessName||c.contactName||c.id)}</option>`).join('')}</select></label></div><div class="actions"><button class="btn primary" onclick="openV322Customer360()">Open Customer 360</button></div></div></div></div>
      <div class="card section"><div class="card-head"><div><h2>📦 Package Fulfillment Templates</h2><div class="mini">Every sale gets a repeatable checklist instead of relying on memory.</div></div><span class="badge blue">STANDARDIZED</span></div><div class="card-body"><div class="grid two">${templates.map(t=>`<div class="v322-template"><strong>${esc2(t.name)}</strong><ul>${t.items.map(i=>`<li>${esc2(i)}</li>`).join('')}</ul></div>`).join('')}</div></div></div>
      <div class="grid two section"><div class="card"><div class="card-head"><h2>🎯 Sales-to-Cash Pipeline</h2></div><div class="card-body"><div class="v322-pipeline">${['Lead','Contacted','Qualified','Quoted','Won / Paid','Fulfillment','Completed'].map((s,i)=>`<div><span>${i+1}</span><strong>${s}</strong></div>`).join('')}</div><p class="mini">The operating rule is simple: a payment creates a real order; a paid order creates fulfillment; fulfillment closes only after delivery/approval.</p></div></div><div class="card"><div class="card-head"><h2>🤖 Kim AI Control</h2><span class="badge blue">READ-ONLY STATUS</span></div><div class="card-body"><div class="grid three"><div><div class="label">STANDARD</div><strong>Routine</strong></div><div><div class="label">PROFESSIONAL</div><strong>Deep work</strong></div><div><div class="label">MASTER</div><strong>Complex repair</strong></div></div><div class="install-tip" style="margin-top:14px"><strong>Billing protection:</strong> Kim never purchases credits or changes billing. A real balance is shown only when the provider exposes verified billing data.</div><button class="btn small" onclick="checkSbcAI()">Check AI Connection</button></div></div></div>
      <div class="card section"><div class="card-head"><h2>👥 Recent Customers</h2><span class="badge green">CUSTOMER 360 READY</span></div><div class="card-body">${customers.map(c=>`<div class="list-card"><div><strong>${esc2(c.businessName||c.contactName)}</strong><div class="meta">${esc2(c.contactName||'')} · ${esc2(c.phone||'')} · ${esc2(c.email||'')}</div></div><button class="btn small" onclick="openV322Customer360('${esc2(c.id)}')">Open 360</button></div>`).join('')||'<div class="empty">No customer records yet.</div>'}</div></div>
    </div>`;
  }
  async function openV322Customer360(id){
    const rawId=id||document.getElementById('v322CustomerSelect')?.value;if(!rawId)return toast('Choose a customer first.');
    const cid=String(rawId), d=D();let c=(d.customers||[]).find(x=>String(x.id??x.customer_id??x.customerId??'')===cid);if(!c)return toast('Customer record not found in the current read-only workspace. Refresh and try again.');
    const pick=(obj,...keys)=>{for(const k of keys){const v=obj?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;}return '';};
    // Read-only enrichment from the relational CRM source. Recovery-projection rows may not exist in sbc_customers; those continue to render from the local read model. This path never writes or restores records.
    let relational=null;try{const rr=await api('/api/v566/crm/customer-360-relational/'+encodeURIComponent(cid),{timeoutMs:8000});if(rr?.ok&&rr?.data?.customer)relational=rr.data;}catch(e){console.debug('[SBC CUSTOMER 360] relational enrichment unavailable; using authorized read model:',e?.message||e)}
    if(relational?.customer){const original=c,rc=relational.customer;c={...original,...rc};for(const [target,aliases] of Object.entries({businessName:['business_name','businessName','company_name','companyName','name'],contactName:['contact_name','contactName','owner_name'],phone:['phone','phone_number','primary_phone'],email:['email','email_address','primary_email'],website:['website','website_url','domain'],status:['status','lifecycle_status']})){if(!pick(original,target)&&pick(rc,...aliases))c[target]=pick(rc,...aliases);}}
    const remoteOrders=Array.isArray(relational?.orders)?relational.orders:[],remoteQuotes=Array.isArray(relational?.quotes)?relational.quotes:[],remoteActivities=Array.isArray(relational?.activities)?relational.activities:[];
    const linked=x=>String(pick(x,'customerId','customer_id','sbcCustomerId','sbc_customer_id'))===cid;
    const metaFor=x=>{let m=x?.meta??x?.meta_json??{};if(typeof m==='string'){try{m=JSON.parse(m)}catch{m={}}}return m&&typeof m==='object'?m:{}};
    const qs=[...(d.quotes||[]).filter(linked),...remoteQuotes.filter(x=>!(d.quotes||[]).some(y=>String(y.id)===String(x.id)))], os=[...(d.orders||[]).filter(linked),...remoteOrders.filter(x=>!(d.orders||[]).some(y=>String(y.id)===String(x.id)))], acts=[...(d.activities||d.activityLog||[]).filter(x=>String(pick(metaFor(x),'customerId','customer_id'))===cid||linked(x)),...remoteActivities.filter(x=>!((d.activities||d.activityLog||[]).some(y=>String(y.id)===String(x.id))))], tasks=(d.tasks||[]).filter(linked), msgs=(d.customerMessages||d.customer_messages||[]).filter(linked), pays=(d.squarePayments||d.square_payments||[]).filter(x=>linked(x)||String(pick(x,'customerId','customer_id','sbcCustomerId','sbc_customer_id'))===cid);
    const business=pick(c,'businessName','business_name','company_name','companyName','name')||pick(c,'contactName','contact_name')||cid;
    const contact=pick(c,'contactName','contact_name','owner','owner_name','decisionMaker','decision_maker');
    const phone=pick(c,'phone','phone_number','primary_phone','mobile','mobile_number','telephone'), email=pick(c,'email','email_address','primary_email'), website=pick(c,'website','website_url','primary_website','domain');
    const status=pick(c,'status','lifecycle_status','customer_status')||'Lead', followUp=pick(c,'followUp','follow_up','nextFollowUp','next_follow_up','follow_up_at'), assigned=pick(c,'assignedTo','assigned_to','ownerId','owner_id','assigned_user'), notes=pick(c,'notes','note','notes_text','description');
    const locked=Boolean(d.recoveryRequired||d.readOnly||d.mysqlRecoveryRequired);
    const orderRows=os.map(o=>`<div class="list-card"><div><strong>${esc2(pick(o,'product','product_name','order_name','name')||'Order')}</strong><div class="meta">${esc2(pick(o,'status','order_status'))} · ${money2(pick(o,'price','total','amount')||0)}</div></div><span class="badge ${String(pick(o,'paymentStatus','payment_status')||pick(o,'status','order_status')).toLowerCase()==='paid'?'green':'orange'}">${esc2(pick(o,'paymentStatus','payment_status')||pick(o,'status','order_status')||'Status unavailable')}</span></div>`).join('');
    const paymentRows=pays.map(p=>`<div class="list-card"><div><strong>Payment evidence</strong><div class="meta">${money2(pick(p,'amount')||Number(p?.amountMoney?.amount||p?.amount_money?.amount||0)/100)} · ${esc2(pick(p,'reference','receiptNumber','receipt_number','squarePaymentId','square_payment_id')||'Reference unavailable')}</div></div><span class="badge blue">${esc2(pick(p,'status','payment_status')||'Recorded')}</span></div>`).join('');
    const activityRows=acts.slice(0,10).map(a=>`<div class="activity-row"><div class="activity-icon">${typeof activityIcon==='function'?activityIcon(pick(a,'type','activity_type')):'•'}</div><div><strong>${esc2(pick(a,'message','description')||'Activity')}</strong><small>${typeof dt==='function'?dt(pick(a,'createdAt','created_at')):esc2(pick(a,'createdAt','created_at'))}</small></div></div>`).join('');
    const taskRows=tasks.slice(0,10).map(t=>`<div class="list-card"><div><strong>${esc2(pick(t,'title','task_title')||'Task')}</strong><div class="meta">${esc2(pick(t,'status','task_status')||'Open')} ${pick(t,'dueAt','due_at')?'· due '+esc2(pick(t,'dueAt','due_at')):''}</div></div></div>`).join('');
    openModal(`Customer 360 — ${esc2(business)}`,`${locked?'<div class="install-tip" role="status"><strong>RECOVERY LOCK ACTIVE — READ ONLY.</strong> Customer details are displayed for inspection. Changes remain disabled until authoritative MySQL recovery is verified.</div>':''}<div class="v322-360"><div class="grid two"><div class="detail-box"><strong>Contact & Business</strong><div><b>Owner:</b> ${esc2(contact||'—')}</div><div><b>Phone:</b> ${esc2(phone||'—')}</div><div><b>Email:</b> ${esc2(email||'—')}</div><div><b>Status:</b> ${esc2(status)}</div><div><b>Website:</b> ${esc2(website||'—')}</div></div><div class="detail-box"><strong>Next Action</strong><div><b>Follow-up:</b> ${esc2(followUp||'Not scheduled')}</div><div><b>Assigned:</b> ${esc2(assigned||'Unassigned')}</div><div><b>Notes:</b> ${esc2(notes||'—')}</div></div></div><div class="grid three"><div class="detail-box"><strong>Orders</strong><div class="value">${os.length}</div></div><div class="detail-box"><strong>Quotes</strong><div class="value">${qs.length}</div></div><div class="detail-box"><strong>Messages</strong><div class="value">${msgs.length}</div></div></div><div class="card section"><div class="card-head"><h2>Orders & Payments</h2></div><div class="card-body">${orderRows||'<div class="empty">No orders recorded for this customer.</div>'}${paymentRows}</div></div><div class="card section"><div class="card-head"><h2>Activity & Tasks</h2></div><div class="card-body">${taskRows}${activityRows||(!taskRows?'<div class="empty">No activity yet.</div>':'')}</div></div><div class="actions">${locked?'<button class="btn" disabled title="Editing is disabled during recovery">Edit Customer — Locked</button>':`<button class="btn primary" onclick="editCustomer('${esc2(cid)}')">Edit Customer</button>`}<button class="btn" onclick="closeModal()">Close</button></div></div>`);
  }
  // SBC_V6652_MANUAL_PAYMENT_PROOF: no synthetic manual settlement.
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
  function install(){
    if(document.getElementById('v322Nav'))return;
    const nav=document.querySelector('.sidebar nav');if(nav){const b=document.createElement('button');b.id='v322Nav';b.className='nav-item owner-only';b.dataset.view='ops360';b.innerHTML='<span>🚀</span> Operations 360';nav.insertBefore(b,nav.querySelector('[data-view="dashboard"]')||null);b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();state.view='ops360';document.querySelector('#viewEyebrow').textContent='OPERATIONS';document.querySelector('#viewTitle').textContent='Operations 360';document.querySelector('#content').innerHTML=opsPage();document.querySelectorAll('.nav-item[data-view]').forEach(x=>x.classList.toggle('active',x===b));},{capture:true});}
    // If the user manually changes state/view through existing controls, provide a small direct renderer hook.
    window.renderV322Ops=()=>{if(state.view==='ops360'){document.querySelector('#content').innerHTML=opsPage();document.querySelector('#viewEyebrow').textContent='OPERATIONS';document.querySelector('#viewTitle').textContent='Operations 360';}};
    // Add Customer 360 buttons to the existing CRM/customer table without replacing its renderer.
    const decorate=()=>{document.querySelectorAll('#customerRows tr').forEach(tr=>{if(tr.dataset.v322==='1')return;const btn=tr.querySelector('button[onclick*="editCustomer"]');if(!btn)return;const m=String(btn.getAttribute('onclick')||'').match(/editCustomer\('([^']+)'/);if(!m)return;const td=tr.lastElementChild;if(!td)return;const x=document.createElement('button');x.className='btn small';x.textContent='360';x.title='Open Customer 360';x.onclick=()=>openV322Customer360(m[1]);td.appendChild(x);tr.dataset.v322='1';});};
    new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});setTimeout(decorate,300);
    // Package template shortcut for the existing dashboard.
    if(window.dashboard9){const original=window.dashboard9;window.dashboard9=function(){let html=original.apply(this,arguments);html=String(html);const m=metrics();const banner=`<div class="card section v322-dashboard-strip"><div class="card-head"><div><h2>🚀 V32.2 Operations Health</h2><div class="mini">First-customer operating controls are active.</div></div><span class="badge ${exceptions().length?'orange':'green'}">${exceptions().length?exceptions().length+' EXCEPTIONS':'HEALTHY'}</span></div><div class="grid four"><div><div class="label">PAID ORDERS</div><strong>${m.paidOrders}</strong></div><div><div class="label">FULFILLMENT</div><strong>${m.activeFulfillment}</strong></div><div><div class="label">UNMATCHED PAYMENTS</div><strong>${m.unmatched}</strong></div><div><div class="label">OVERDUE WORK</div><strong>${m.overdueTasks+m.stale}</strong></div></div><div class="actions"><button class="btn small primary" onclick="document.getElementById('v322Nav')?.click()">Open Operations 360</button></div></div>`;return html+banner;};}
    console.log(`[SBC V${V}] First-customer operations upgrade loaded`);
  }
  window.openV322Customer360=openV322Customer360;window.openV322Reconcile=openV322Reconcile;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

// V64.2.25 — canonical Ask Kim bridge for Operations 360.
// Avoids fragile inline references when legacy Kim controllers load in different orders.
window.sbcAskKim=window.sbcAskKim||function(prompt){
  const p=String(prompt||'Review the current SBC Operations 360 state and identify the highest-priority next action.');
  if(typeof window.openSbcAI==='function'){
    const opened=window.openSbcAI(p);
    if(typeof window.askSbcAI==='function' && opened!==false){setTimeout(()=>window.askSbcAI(p),0);}
    return true;
  }
  if(typeof window.askSbcAI==='function'){window.askSbcAI(p);return true;}
  window.alert('Kim is still loading. Please try Ask Kim again in a moment.');
  return false;
};

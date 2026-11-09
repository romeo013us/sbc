/* SBC V66.129 — Owner Checkout Lab; isolated zero-charge cart and fulfillment. */
(function(){
 'use strict';
 var products=[],orders=[],requestId='',busy=false;
 var $=id=>document.getElementById(id);
 var esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 var currency=n=>(Number(n||0)/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
 function newRequestId(){
   if(window.crypto&&typeof window.crypto.randomUUID==='function')return window.crypto.randomUUID().replace(/-/g,'');
   if(window.crypto&&typeof window.crypto.getRandomValues==='function'){var a=new Uint8Array(16);window.crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('');}
   throw Error('Secure request identity unavailable; checkout is blocked.');
 }
 var post=(url,body)=>window.api(url,{method:'POST',body:JSON.stringify(body),timeoutMs:20000});
 var get=url=>window.api(url,{timeoutMs:20000});
 function message(v,bad){var a=$('sbc-qa-message');if(a){a.textContent=String(v);a.style.color=bad?'#e87f7f':''}}
 function product(){
  var id=$('sbc-qa-product')?.value;return products.find(x=>x.id===id)||null;
 }
 function update(){
  var p=product(),percent=Math.max(0,Math.min(100,Number($('sbc-qa-discount')?.value||0)));
  var cents=p?.listPriceCents||0,save=Math.round(cents*percent/100),total=cents-save;
  if($('sbc-qa-price'))$('sbc-qa-price').textContent=currency(cents);
  if($('sbc-qa-discount-value'))$('sbc-qa-discount-value').textContent=percent+'% ('+currency(save)+')';
  if($('sbc-qa-total'))$('sbc-qa-total').textContent=currency(total);
  var submit=$('sbc-qa-submit');if(submit)submit.disabled=busy||!p||total!==0;
  message(total===0&&p?'$0 QA is ready: no payment provider, real customer, subscription or vendor order will be contacted.':
    'This is the $0 test lab. Set the discount to 100% to submit. Real discounted sales use the normal quote/payment checkout.',false);
 }
 function renderOrders(){
  var box=$('sbc-qa-orders');if(!box)return;
  box.innerHTML=orders.map(o=>{
   var canAdvance=o.stage==='PLACED'||o.stage==='READY_FOR_MANUAL_REVIEW',
     stage=o.stage==='PLACED'?'READY_FOR_MANUAL_REVIEW':o.stage==='READY_FOR_MANUAL_REVIEW'?'COMPLETED':'',
     label=stage==='READY_FOR_MANUAL_REVIEW'?'Mark ready for manual review':'Mark test fulfillment completed';
   return '<article style="border:1px solid var(--border,#6b7280);padding:12px;border-radius:10px;margin:10px 0">'+
    '<strong>'+esc(o.product)+'</strong> · <span>List '+esc(currency(o.listPriceCents))+' → QA '+esc(currency(o.totalCents))+'</span>'+
    '<p style="margin:8px 0"><strong>Stage:</strong> '+esc(o.stage.replaceAll('_',' '))+
    (o.recurringPlanTest?'<br><small>Office Box: simulated workflow only; no live subscription activation</small>':
     '<br><small>No print vendor order or shipment was placed</small>')+
    '<br><small>Order '+esc(o.id)+'</small></p>'+
    (canAdvance?'<button type="button" class="btn small" data-sbc-qa-id="'+esc(o.id)+'" data-sbc-qa-stage="'+esc(stage)+'">'+esc(label)+'</button>':
      '<span style="font-weight:600">QA workflow completed · no charge</span>')+'</article>';
  }).join('')||'<p>No internal test checkouts have been created yet.</p>';
  box.querySelectorAll('[data-sbc-qa-id]').forEach(b=>b.addEventListener('click',()=>advance(b.dataset.sbcQaId,b.dataset.sbcQaStage)));
 }
 async function refresh(){
  var result=await get('/api/owner/checkout-lab/orders');
  if(result?.ok!==true)throw Error('Test ledger unavailable. No order was created.');
  orders=Array.isArray(result.records)?result.records:[];
  renderOrders();
 }
 async function submit(e){
  e.preventDefault();if(busy)return;
  var p=product();
  if(!p||Number($('sbc-qa-discount')?.value)!==100){message('Select a product and use a 100% test discount.',true);return}
  var before=currency(p.listPriceCents);
  if(!window.confirm('Create an INTERNAL $0 QA checkout for '+p.name+' (normally '+before+')? No card charge, Office Box subscription or vendor order will occur.'))return;
  busy=true;update();message('Saving the isolated QA order…');
  try{
   var out=await post('/api/owner/checkout-lab/order',{productId:p.id,discountPercent:100,
     requestId:requestId,confirm:'CREATE_ZERO_DOLLAR_QA'});
   if(!out?.ok||!out.record)throw Error('Could not verify the QA order. Do not repeat automatically.');
   requestId=newRequestId();
   await refresh();
   message('Saved '+out.record.id+' at $0.00. Proceed through the manual test fulfillment stages.');
  }catch(err){message('No confirmed checkout: '+String(err?.message||'Unavailable')+
   ' · Keep this page open and check the test orders before trying again.',true);
   try{await refresh()}catch(_){}
  }finally{busy=false;update()}
 }
 async function advance(id,stage){
  if(busy)return;
  var finalStep=stage==='COMPLETED';
  if(!window.confirm(finalStep?'Mark INTERNAL QA fulfillment completed? This does NOT print, ship, provision an Office Box tenant, or collect money.':
    'Advance this internal test order to manual review? No external vendor action will occur.'))return;
  busy=true;message('Recording QA stage…');
  try{
   var body={stage:stage};if(finalStep)body.confirm='MARK_TEST_FULFILLMENT_COMPLETE';
   var out=await post('/api/owner/checkout-lab/order/'+encodeURIComponent(id)+'/advance',body);
   if(!out?.ok)throw Error('Stage update not verified');
   await refresh();message('QA stage saved: '+stage.replaceAll('_',' ')+'. No external actions were taken.');
  }catch(err){message('Unable to verify stage: '+String(err?.message||'Unavailable')+
   '. Check the order before retrying.',true);try{await refresh()}catch(_){}}
  finally{busy=false;update()}
 }
 window.sbcOpenOwnerCheckoutLab=async function(){
  if(String((window.state||typeof state!=='undefined'&&state)?.me?.role||'')!=='owner')return;
  if(typeof window.api!=='function'||typeof window.openModal!=='function')return;
  try{requestId=newRequestId()}catch(e){window.alert(e.message);return}
  window.openModal('Owner Checkout Lab · $0 Internal Test',
   '<p>Choose a real SBC catalog item, apply a 100% <strong>test-only</strong> discount, and walk the order through manual fulfillment. No Square link is necessary. This isolated QA ledger is not real revenue or a recurring subscription.</p>'+
   '<form id="sbc-qa-cart-form"><div class="form-grid"><label>Service or package<select id="sbc-qa-product" required></select></label>'+
   '<label>Discount percentage<input id="sbc-qa-discount" type="number" min="0" max="100" step="1" value="100" required></label></div>'+
   '<div style="padding:10px;margin:12px 0;border:1px solid var(--border,#6b7280);border-radius:10px">'+
   '<div>Catalog price: <strong id="sbc-qa-price">—</strong></div><div>Test discount: <strong id="sbc-qa-discount-value">—</strong></div>'+
   '<div>Checkout total: <strong id="sbc-qa-total">$0.00</strong></div></div>'+
   '<p id="sbc-qa-message" role="status"></p>'+
   '<button id="sbc-qa-submit" type="submit" class="btn primary" disabled>Submit $0 Test Order</button></form>'+
   '<h3 style="margin-top:20px">My test orders and manual fulfillment</h3><div id="sbc-qa-orders">Loading…</div>');
  var form=$('sbc-qa-cart-form');form?.addEventListener('submit',submit);
  $('sbc-qa-product')?.addEventListener('change',update);
  $('sbc-qa-discount')?.addEventListener('input',update);
  try{
   var [catalog,previous]=await Promise.all([get('/api/owner/checkout-lab/catalog'),get('/api/owner/checkout-lab/orders')]);
   if(!catalog?.ok||!previous?.ok)throw Error('Catalog or audit ledger not available. Please verify Published deployment.');
   products=Array.isArray(catalog.catalog)?catalog.catalog:[];
   if($('sbc-qa-product'))$('sbc-qa-product').innerHTML=products.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+
    ' · '+esc(currency(p.listPriceCents))+(p.recurring?' /mo':'')+'</option>').join('');
   orders=Array.isArray(previous.records)?previous.records:[];renderOrders();update();
  }catch(err){message(String(err?.message||'QA service unavailable'),true);
   var box=$('sbc-qa-orders');if(box)box.textContent='Unable to read authoritative QA ledger; no orders counted.'}
 };
})();

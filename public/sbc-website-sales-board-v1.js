/* SBC Website Sales Pipeline — a read-only, verification-backed sales control. */
(function(){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const owner=()=>typeof state!=='undefined'&&state?.me?.role==='owner';
 const money=cents=>'$'+(Number(cents||0)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 let snapshot=null,activeStage='ALL',loading=false;
 const stages={
  WEBSITE_PUBLISHED:'Published',PAID_IN_FULFILLMENT:'Paid · In Fulfillment',
  PAID_NEEDS_FULFILLMENT:'Paid · Needs Fulfillment',APPOINTMENT_BOOKED:'Walkthrough Booked',
  READY_TO_CALL:'Ready to Call',REVIEW_WEBSITE:'Review Website',
  NEEDS_WEBSITE:'Build Website',SUPPRESSED:'Suppressed'
 };
 function panel(result){
  snapshot=result;
  const m=result.metrics||{};
  const stats=[['Leads in scope',m.totalLeads],['Websites built',m.websitesBuilt],['Owner approved',m.approvedWebsites],
   ['Walkthroughs booked',m.bookedMeetings],['Verified website buyers',m.websiteBuyers],['Captured website sales',money(m.capturedWebsiteRevenueCents)]];
  const card=([label,value])=>'<div style="padding:16px;border:1px solid #dce4e8;border-radius:12px;background:#f7fafb;min-width:160px"><span style="display:block;text-transform:uppercase;font-size:10px;letter-spacing:.08em;color:#64748b;font-weight:700">'+esc(label)+'</span>'+
    '<strong style="display:block;margin-top:10px;font-size:24px;letter-spacing:-.03em">'+esc(value)+'</strong></div>';
  const filters='<button type="button" class="btn '+(activeStage==='ALL'?'primary':'')+'" data-sbc-sales-filter="ALL">All ('+esc(result.totalRows)+')</button>'+
    (result.stages||[]).map(x=>'<button type="button" class="btn '+(activeStage===x.key?'primary':'')+'" data-sbc-sales-filter="'+esc(x.key)+'">'+esc(x.label)+' ('+esc(x.count)+')</button>').join('');
  const rows=(result.rows||[]).filter(x=>activeStage==='ALL'||x.stage===activeStage).map(x=>{
   const action=x.stage==='SUPPRESSED'?'No outreach':
    '<button type="button" class="btn" data-sbc-sales-open="'+esc(x.customerId)+'" data-sbc-sales-site="'+(x.websiteId?'1':'0')+'">'+(x.websiteId?'Open Website':'Build Website')+'</button>';
   return '<tr><td style="padding:12px;border-bottom:1px solid #e2e8f0"><strong>'+esc(x.businessName)+'</strong><div style="font-size:12px;color:#64748b">'+esc(x.industry||'Industry not verified')+'</div></td>'+
    '<td style="padding:12px;border-bottom:1px solid #e2e8f0">'+esc(stages[x.stage]||x.stage)+'</td>'+
    '<td style="padding:12px;border-bottom:1px solid #e2e8f0">'+esc(x.offerTier==='starter'?'$199 one-page':x.offerTier==='essentials'?'$349 four-page':'—')+'</td>'+
    '<td style="padding:12px;border-bottom:1px solid #e2e8f0">'+esc(x.appointmentAt?new Date(x.appointmentAt).toLocaleString():'—')+'</td>'+
    '<td style="padding:12px;border-bottom:1px solid #e2e8f0">'+esc(x.paidOrders?money(x.paidRevenueCents):'—')+'</td>'+
    '<td style="padding:12px;border-bottom:1px solid #e2e8f0"><div style="font-size:12px;color:#475569;margin-bottom:6px">'+esc(x.nextAction)+'</div>'+action+'</td></tr>';
  }).join('');
  return '<div style="max-width:1260px"><div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">'+
   '<div><p style="font-size:10px;font-weight:800;letter-spacing:.15em;color:#0f766e;margin:0">SUCCESSFUL BY CHOICE · REVENUE OPERATIONS</p><h3 style="margin:6px 0">SBC Website Sales Pipeline</h3><p style="color:#526072">Real sites, verified appointments, payment-backed sales and assigned fulfillment—without a new CRM subscription.</p></div>'+
   '<button type="button" class="btn" id="sbcSalesReload">Refresh Pipeline</button></div>'+
   '<div style="display:flex;flex-wrap:wrap;gap:11px;margin:20px 0">'+stats.map(card).join('')+'</div>'+
   '<p style="font-size:12px;line-height:1.6;color:#64748b">Shows '+esc(result.returnedRows)+' of '+esc(result.totalRows)+' matching tenant CRM records. Excludes '+esc(m.unverifiedOrUnattributedOrdersExcluded||0)+' unverified or unrelated order entries from revenue. Revenue is provider-capture-backed, not a projection. No calls or messages are sent by this panel.</p>'+
   '<div style="display:flex;gap:7px;flex-wrap:wrap;margin:20px 0">'+filters+'</div>'+
   '<div style="overflow-x:auto;max-height:480px"><table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px"><thead><tr style="background:#e7f0f3"><th style="padding:11px">Business</th><th style="padding:11px">Stage</th><th style="padding:11px">Site Package</th><th style="padding:11px">Meeting</th><th style="padding:11px">Captured Sales</th><th style="padding:11px">Next Action</th></tr></thead>'+
   '<tbody>'+rows+'</tbody></table></div>'+
   '<p style="margin-top:18px;font-size:12px;color:#64748b">Workflow: Research → Build actual website → Owner approve → Call → Book walkthrough → Verified Square payment → Assign fulfillment → Publish.</p>'+
   '</div>';
 }
 function wire(){
  document.getElementById('sbcSalesReload')?.addEventListener('click',open);
  document.querySelectorAll('[data-sbc-sales-filter]').forEach(button=>button.addEventListener('click',()=>{
   activeStage=button.dataset.sbcSalesFilter||'ALL';
   if(typeof openModal==='function'&&snapshot){openModal('SBC Website Sales Pipeline',panel(snapshot));wire();}
  }));
  document.querySelectorAll('[data-sbc-sales-open]').forEach(button=>button.addEventListener('click',()=>{
   const id=button.dataset.sbcSalesOpen;
   if(!id||!window.SBC_WEBSITE_PRODUCTION)return;
   if(button.dataset.sbcSalesSite==='1'&&typeof window.SBC_WEBSITE_PRODUCTION.openExisting==='function')window.SBC_WEBSITE_PRODUCTION.openExisting(id);
   else if(typeof window.SBC_WEBSITE_PRODUCTION.build==='function')window.SBC_WEBSITE_PRODUCTION.build(id);
  }));
 }
 async function open(){
  if(!owner()||loading)return;
  loading=true;
  if(typeof openModal==='function')openModal('SBC Website Sales Pipeline','<div style="padding:22px">Loading verified website sales and appointment records…</div>');
  try{
   if(typeof api!=='function')throw Error('Command Center API is unavailable.');
   const r=await api('/api/website-production/sales-board?limit=200');
   if(!r?.ok)throw Error(r?.code||'Could not load sales pipeline.');
   if(typeof openModal==='function'){openModal('SBC Website Sales Pipeline',panel(r));wire();}
  }catch(e){if(typeof openModal==='function')openModal('SBC Website Sales Pipeline','<p role="alert">Sales Pipeline unavailable: '+esc(e.message||'Unknown error')+'</p>');}
  finally{loading=false}
 }
 function install(){
  if(document.getElementById('sbc-website-sales-pipeline-topbar'))return true;
  const marker=document.getElementById('sbcBuildVersion');if(!marker)return false;
  const button=document.createElement('button');
  button.type='button';button.id='sbc-website-sales-pipeline-topbar';button.textContent='Website Sales Pipeline';
  button.className='btn';button.hidden=!owner();
  button.style.cssText='background:#0a7f64;color:white;border:1px solid #0b6954;font-weight:800';
  button.addEventListener('click',open);
  marker.insertAdjacentElement('afterend',button);
  return true;
 }
 let polls=0;
 const timer=setInterval(()=>{install();const button=document.getElementById('sbc-website-sales-pipeline-topbar');if(button)button.hidden=!owner();if(++polls>=120)clearInterval(timer);},1000);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
 window.SBC_WEBSITE_SALES_BOARD=Object.freeze({open});
})();

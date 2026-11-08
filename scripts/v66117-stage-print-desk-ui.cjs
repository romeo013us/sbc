'use strict';
/* SBC V66.117 UI: stage inside the two existing Command Center UI bundles.
 * No standalone dashboard. Use DOM textContent for all customer data.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const BT=String.fromCharCode(96),D=String.fromCharCode(36),MARK='SBC_V66117_PRINT_DESK_UI';
function once(s,a,b,label){const n=s.split(a).length-1;assert.equal(n,1,label+' anchor count '+n);return s.replace(a,b)}
function patch(s){
 if(s.includes(MARK))return s;
 const functionCode=[
  '/* '+MARK+': read existing paid print jobs, no vendor purchase. */',
  'async function sbcPrintDeskRefresh(){',
  " const root=document.getElementById('sbcPrintDeskMount');if(!root||state.me?.role!=='owner')return;",
  " const clear=()=>{while(root.firstChild)root.removeChild(root.firstChild)};",
  " const el=(tag,text,klass)=>{const n=document.createElement(tag);n.textContent=String(text??'');if(klass)n.className=klass;return n};",
  ' try{',
  "  const d=await api('/api/owner/print-desk',{timeoutMs:12000});",
  "  if(!root.isConnected)return;",
  '  clear();',
  "  const head=el('div','', 'card-head'),meta=el('div','');",
  "  meta.append(el('h2','Print Fulfillment Desk'),el('p','Verified paid print jobs, artwork review and real supplier receipts.','mini'));",
  "  const refresh=el('button','Refresh','btn small');refresh.type='button';refresh.onclick=sbcPrintDeskRefresh;",
  "  head.append(meta,el('span',Number(d.needsOwnerAttention||0)+' require review','badge orange'),refresh);root.append(head);",
  "  const note=el('p','No printer API or AI credits required. The sale amount may include website services; print profit is not asserted without verified allocated costs.','mini');note.style.padding='0 18px';root.append(note);",
  "  const wrap=el('div','', 'table-wrap'),table=el('table','', 'table'),thead=document.createElement('thead'),hdr=document.createElement('tr');",
  "  for(const h of ['Customer / product','Supplier','Status','Next action','Supplier order'])hdr.append(el('th',h));",
  "  thead.append(hdr);table.append(thead);const tbody=document.createElement('tbody');",
  "  const rows=Array.isArray(d.rows)?d.rows.slice(0,60):[];",
  "  for(const job of rows){const tr=document.createElement('tr');",
  "   for(const item of [String(job.customerName||'')+' — '+String(job.product||''),job.provider,job.status,job.nextAction,job.vendorOrderNumber||'Not confirmed'])tr.append(el('td',item));",
  "   tbody.append(tr);}",
  "  if(!rows.length){const tr=document.createElement('tr'),cell=el('td','No verified print jobs are awaiting review.');cell.colSpan=5;tr.append(cell);tbody.append(tr);}",
  "  table.append(tbody);wrap.append(table);root.append(wrap);",
  " }catch(error){clear();root.append(el('p','Print Fulfillment Desk could not load: '+String(error?.message||'Unknown response'),'mini'));}",
  '}',
  ''
 ].join('\n');
 s=once(s,
   'function orders(){const list=state.data.orders;return '+BT+'<div class="card">',
   functionCode+'function orders(){const list=state.data.orders;return '+BT+D+'{state.me?.role==="owner"?\'<div class="card section" id="sbcPrintDeskMount"><div class="card-body">Loading print fulfillment…</div></div>\':""}<div class="card">',
   'Existing print-orders mount');
 s=once(s,'<th>Price</th><th>Profit</th><th>Created</th>',
   '<th>Price</th><th>Margin estimate</th><th>Created</th>','print margin header');
 s=once(s,D+'{money(o.price-o.cost)}',
  D+'{Number(o.cost)>0?money(Number(o.price)-Number(o.cost))+" est.":"Cost not verified"}',
  'avoid false zero-cost profit');
 s=once(s,'<div class="label">PRINT PROFIT</div><div class="value">'+D+'{money(profit)}</div><div class="sub">Recorded order margin</div>',
   '<div class="label">PRINT PROFIT</div><div class="value">Not verified</div><div class="sub">Requires actual supplier cost and paid-order attribution</div>',
   'do not report unverified aggregate print profit');
 s=once(s,"bindView();if(state.view==='v325control'",
   "bindView();if(state.view==='orders'&&state.me?.role==='owner')sbcPrintDeskRefresh();if(state.view==='v325control'",
   'refresh when order view opens');
 return s;
}
function verify(s){
 assert(s.includes(MARK),'missing UI build marker');
 assert(s.includes("api('/api/owner/print-desk'"),'must query scoped owner endpoint');
 assert(s.includes('Cost not verified'),'unknown supplier costs must be honest');
 assert(s.includes('<div class="value">Not verified</div>'),'aggregated profit must not be invented');
 assert(!s.includes(D+'{money(o.price-o.cost)}'),'unsafe order row profit remains');
 assert(s.includes("state.me?.role==='owner'"),'must be owner-only UI');
 return true;
}
if(require.main===module){
 const root=path.resolve(__dirname,'..');
 for(const name of ['public/app.js','browser_public/app.js']){
  const file=path.join(root,name),source=fs.readFileSync(file,'utf8');
  if(process.argv.includes('--apply')){
   if(process.env.SBC_V66117_ISOLATED_STAGE!=='YES')throw Error('SBC_V66117_REFUSE_NON_DISPOSABLE_STAGE');
   const revised=patch(source);verify(revised);assert.equal(patch(revised),revised,'patch must be idempotent');
   if(revised!==source)fs.writeFileSync(file,revised);
  }else if(process.argv.includes('--verify-staged'))verify(source);
  else verify(patch(source));
 }
 console.log('[SBC V66.117] Print Orders UI '+(process.argv.includes('--apply')?'STAGED':'PASS')+': owner triage, no phantom vendor orders or profit');
}
module.exports={patch,verify,MARK};

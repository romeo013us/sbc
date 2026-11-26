/* SBC Account Portfolios — owner workflows, no extra CRM or subscriptions. */
(function(){
'use strict';
if(window.SBC_ACCOUNT_PORTFOLIOS&&window.SBC_ACCOUNT_PORTFOLIOS!==window.__SBC_ACCOUNT_PORTFOLIOS_LAZY__)return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function owner(){return window.state?.me?.role==='owner'}
const root='/api/v6606/crm/account-portfolios';
async function request(endpoint,options){
 const r=await fetch(root+endpoint,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},...options});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j.ok!==true)throw Error(j.code||'SBC did not verify the portfolio change.');
 return j;
}
function status(msg){
 const x=document.getElementById('sbcPortfolioStatus');
 if(x)x.textContent=String(msg);
}
async function refreshSummary(){
 const host=document.getElementById('sbcPortfolioSummary');
 if(!host)return;
 try{
  const result=await request('/summary');
  const rows=result.managers||[];
  host.innerHTML='<h4>Live CRM portfolio snapshot · '+Number(result.total||0)+' accounts</h4>'+
   '<p><strong>'+Number(result.unassigned||0)+' unassigned</strong> · Assigned customers stay with their manager after their first purchase.</p>'+
   '<div class="table-wrap"><table class="table"><thead><tr><th>Account manager</th><th>Assigned</th><th>Customers</th><th>Prospects</th><th>Overdue</th></tr></thead><tbody>'+
   rows.map(r=>'<tr><td>'+esc(r.name||r.id)+'</td><td>'+Number(r.accounts||0)+'</td><td>'+Number(r.customers||0)+'</td><td>'+Number(r.prospects||0)+'</td><td>'+Number(r.overdue||0)+'</td></tr>').join('')+
   '</tbody></table></div>';
 }catch(e){host.textContent='Portfolio report unavailable: '+String(e.message||e);}
}
function open(accountId){
 if(!owner())return;
 const db=window.state?.data||{},people=(db.users||[]).filter(u=>u.active!==false&&u.role==='account_manager');
 const account=(db.customers||[]).find(c=>String(c.id)===String(accountId))||null;
 const id=account?String(account.id):'',prior=String(account?.assignedTo||account?.assigned_to||'');
 const options=people.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name||p.username||p.id)+'</option>').join('');
 const html='<section id="sbcPortfolioDialog" style="max-width:950px;padding:12px 4px">'+
  '<h2>SBC Account Manager Portfolios</h2>'+
  '<p>Account Manager first: all new assignments go to active Account Managers. Historical caller assignments remain intact until an owner-authorized transfer. No prior CRM history is removed.</p>'+
  '<div id="sbcPortfolioSummary" role="status">Loading authoritative portfolio counts…</div>'+

  '<section aria-label="Account Manager launch audit" style="border:1px solid #aebdcc;border-radius:12px;padding:16px;margin:16px 0;background:transparent;color:inherit">'+
   '<h3>Account Manager Launch Readiness · V6</h3>'+
   '<p>Compare assigned CRM accounts with independent Account/Social ownership. This read-only check never creates, transfers, or exposes a customer account.</p>'+
   '<button id="sbcManagerReadinessRun" type="button" class="btn">Run Account Manager Readiness Audit</button>'+
   '<p id="sbcManagerReadinessStatus" role="status" aria-live="polite">Not yet checked. Social permissions remain separately controlled.</p>'+
   '<div id="sbcManagerReadinessResults"></div>'+
  '</section>'+

  '<form id="sbcPortfolioBatch" style="padding:15px;border:1px solid #d7e1ea;border-radius:12px;margin:18px 0">'+
   '<h3>Assign a batch of business accounts</h3>'+
   '<label>Account manager<select name="managerId" required>'+options+'</select></label>'+
   '<label>Number of unassigned accounts<input type="number" name="amount" min="1" max="100" value="25" required></label>'+
   '<p class="mini">Includes prospects and existing customers without an assigned manager. Suppressed and lost accounts remain excluded. No contacts, charges or website actions are initiated.</p>'+
   '<button class="btn primary" type="submit">Assign & Keep Account Ownership</button></form>'+
  (id?'<form id="sbcPortfolioTransfer" style="padding:15px;border:1px solid #d7e1ea;border-radius:12px">'+
   '<h3>Transfer the current business account</h3>'+
   '<p><strong>'+esc(account.businessName||account.contactName||id)+'</strong> · Current manager: '+esc(people.find(u=>String(u.id)===prior)?.name||prior||'Unassigned')+'</p>'+
   (prior?'<label>New account manager<select name="managerId" required>'+options+'</select></label>'+
    '<label>Reason for reassignment<textarea name="reason" minlength="12" maxlength="500" rows="3" placeholder="Document the transition and any customer handoff" required></textarea></label>'+
    '<button class="btn" type="submit">Transfer Account & Preserve History</button>':'<p class="mini">This account is not assigned. Use batch assignment for unassigned accounts.</p>')+
   '</form>':'')+
  (id?'<form id="sbcPortfolioFollowUp" style="padding:15px;border:1px solid #d7e1ea;border-radius:12px;margin:18px 0">'+
   '<h3>Next relationship review</h3>'+
   '<p>Record a service check-in or renewal review for the existing account. This saves a CRM date, not an automatic call, text or email.</p>'+
   '<label>Next follow-up<input name="dueDate" type="date" required value="'+esc(String(account.followUp||account.followUpAt||'').slice(0,10))+'"></label>'+
   '<label>Reason / agreed next step<textarea name="purpose" rows="3" minlength="12" maxlength="500" required placeholder="Example: Check website launch and discuss ongoing maintenance"></textarea></label>'+
   '<button class="btn primary" type="submit">Save Account Follow-up</button></form>':'')+
  '<p id="sbcPortfolioStatus" role="status" aria-live="polite" style="margin-top:16px">Ready. No portfolio changes have been made.</p></section>';
 if(typeof window.openModal!=='function')return;
 window.openModal('Account Manager Portfolios',html);
 const batch=document.getElementById('sbcPortfolioBatch');
 batch?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!owner())return;
  const b=batch.querySelector('button[type=submit]');b.disabled=true;status('Assigning only currently unowned CRM accounts…');
  try{
   const data=new FormData(batch),managerId=String(data.get('managerId')||''),amount=Number(data.get('amount'));
   if(!Number.isInteger(amount)||amount<1||amount>100)throw Error('Choose 1–100 accounts.');
   const result=await request('/assign-batch',{method:'POST',body:JSON.stringify({managerId,amount})});
   status('Verified: '+result.assigned+' accounts assigned to '+result.managerName+'. Customer relationships and notes remain intact.');
   await refreshSummary();
  }catch(e){status('Assignment not completed: '+String(e.message||e))}
  finally{b.disabled=false}
 });
 const transfer=document.getElementById('sbcPortfolioTransfer');
 if(transfer&&prior)transfer.addEventListener('submit',async event=>{
  event.preventDefault();if(!owner())return;
  const b=transfer.querySelector('button[type=submit]');b.disabled=true;status('Saving an audited account transfer…');
  try{
   const data=new FormData(transfer),managerId=String(data.get('managerId')||''),reason=String(data.get('reason')||'').trim();
   if(reason.length<12)throw Error('Explain why the account is being transferred.');
   if(managerId===prior)throw Error('Choose a different account manager.');
   const result=await request('/'+encodeURIComponent(id)+'/transfer',{
    method:'POST',body:JSON.stringify({managerId,expectedManagerId:prior,reason})});
   account.assignedTo=result.managerId;
   status('Verified durable transfer. Account '+id+' now belongs to '+result.managerId+'. History and scheduled services were not erased.');
   await refreshSummary();
  }catch(e){status('Transfer not completed: '+String(e.message||e)+'. Refresh the account before retrying.')}
  finally{b.disabled=false}
 });
 const followup=document.getElementById('sbcPortfolioFollowUp');
 followup?.addEventListener('submit',async event=>{
  event.preventDefault();if(!owner())return;
  const b=followup.querySelector('button[type=submit]');b.disabled=true;status('Saving the next account review…');
  try{
   const data=new FormData(followup),dueDate=String(data.get('dueDate')||''),purpose=String(data.get('purpose')||'').trim();
   if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||purpose.length<12)throw Error('Provide a valid date and specific reason.');
   const result=await request('/'+encodeURIComponent(id)+'/follow-up',{method:'POST',body:JSON.stringify({dueDate,purpose})});
   if(result.durable!==true)throw Error('Follow-up confirmation missing.');
   account.followUp=result.followUp;account.followUpAt=result.followUp;
   status('Saved next account review for '+result.followUp+'. No message or phone call was sent.');
   await refreshSummary();
  }catch(e){status('Follow-up not saved: '+String(e.message||e))}
  finally{b.disabled=false}
 });

 const auditButton=document.getElementById('sbcManagerReadinessRun');
 auditButton?.addEventListener('click',async()=>{
  if(!owner())return;
  const message=document.getElementById('sbcManagerReadinessStatus');
  const target=document.getElementById('sbcManagerReadinessResults');
  auditButton.disabled=true;message.textContent='Reading CRM and Account/Social ownership without changing anything…';
  target.replaceChildren();
  try{
   const result=await request('/launch-readiness');
   if(!result.audit||result.readOnly!==true||result.writes!==0)throw Error('READINESS_RECEIPT_NOT_VERIFIED');
   const data=result.audit;
   message.textContent='Ownership audit: '+String(data.status)+' · '+String(data.observedAt)+
    '. Does not authorize social access or certify production readiness.';
   const h=document.createElement('p');h.textContent=
    'CRM accounts: '+Number(data.crm.total||0)+' · Active manager-owned: '+Number(data.crm.activeAccountManagerAssigned||0)+
    ' · Unassigned: '+Number(data.crm.unassigned||0)+' · Legacy caller-owned: '+Number(data.crm.legacyCallerAssigned||0)+
    ' · Invalid assignees: '+Number(data.crm.invalidAssignee||0)+
    ' · Social ownership records: '+Number(data.social.total||0);
   target.appendChild(h);
   const items=document.createElement('ul');
   for(const issue of data.issues||[]){
    const row=document.createElement('li');
    row.textContent=String(issue.code||'REVIEW')+' · '+Number(issue.count||0)+': '+
     String(issue.description||'Requires owner review');
    items.appendChild(row);
   }
   if(!items.children.length){
    const item=document.createElement('li');
    item.textContent='No mismatches found in the returned data. This does not verify live employee authorization.';
    items.appendChild(item);
   }
   target.appendChild(items);
   const footer=document.createElement('p');footer.textContent=String(data.recommendation||'Review workforce permissions manually.');
   target.appendChild(footer);
  }catch(error){
   message.textContent='Audit unavailable or incomplete: '+String(error.message||error)+
    '. No readiness approval issued; check the database and staff roles.';
  }finally{auditButton.disabled=false}
 });
 refreshSummary();
}
window.SBC_ACCOUNT_PORTFOLIOS=Object.freeze({open});
delete window.__SBC_ACCOUNT_PORTFOLIOS_LAZY__;
})();

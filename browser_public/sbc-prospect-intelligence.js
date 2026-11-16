/* SBC Prospect Intelligence v1 — evidence first, zero paid AI/automatic outreach. */
(function(root){
 'use strict';
 const $=id=>root.document.getElementById(id);
 const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tidy=(x,n=120)=>String(x??'').trim().slice(0,n);
 function prioritize(customer={},audit={}){
  const evidence=[],missingEvidence=[];
  let score=0;
  if(tidy(customer.businessName)){score+=15;evidence.push('Business identity recorded')}else missingEvidence.push('Business identity');
  if(tidy(customer.industry)){score+=10;evidence.push('Industry recorded')}else missingEvidence.push('Industry');
  if(tidy(customer.website)){score+=15;evidence.push('Public website recorded')}else missingEvidence.push('Public website');
  if(/^(verified|sales ready)$/i.test(String(customer.verificationStatus||'').replace(/[-_]/g,' '))){score+=10;evidence.push('Lead marked verified in CRM')}
  else missingEvidence.push('Lead verification');
  if(audit?.status==='measured'){
   const metrics=audit.scores||{};
   if(Number.isFinite(metrics.seo)&&metrics.seo<90){score+=20;evidence.push('SEO audit score under 90/100')}
   else if(metrics.seo==null)missingEvidence.push('SEO audit score');
   if(Number.isFinite(metrics.performance)&&metrics.performance<75){score+=20;evidence.push('Mobile performance under 75/100')}
   else if(metrics.performance==null)missingEvidence.push('Mobile performance score');
   if(Number.isFinite(metrics.accessibility)&&metrics.accessibility<90){score+=10;evidence.push('Accessibility audit score under 90/100')}
   else if(metrics.accessibility==null)missingEvidence.push('Accessibility audit score');
  }else missingEvidence.push('Independent website audit');
  return {score:Math.max(0,Math.min(100,score)),label:score>=65?'Review soon':score>=35?'Research opportunity':'Verify before prioritizing',
   evidence,missingEvidence,kind:'research_priority_not_conversion_probability',
   limitation:'A rule-based lead-research priority, not a probability of purchase or an assessment of a person.'};
 }
 function reportedOpportunities(audit){
  if(audit?.status!=='measured')return [];
  return (Array.isArray(audit.findings)?audit.findings:[])
   .filter(x=>x.result==='opportunity').map(x=>tidy(x.label,70)).slice(0,5);
 }
 function buildOutreach(customer={},audit=null,competitors=[]){
  const business=tidy(customer.businessName,100)||'your business';
  const findings=reportedOpportunities(audit);
  const verified=audit?.status==='measured'&&typeof audit.website==='string';
  const opening=verified&&findings.length?
   'A publicly available Google Lighthouse website scan highlighted an opportunity involving '+findings[0].toLowerCase()+'.':
   'If you are considering improvements to your online presence, I can prepare a brief review of your current website and customer experience.';
  return [
   'Subject: A practical online-presence idea for '+business,
   '',
   'Hi,',
   '',
   'I work with Successful By Choice (SBC), helping small businesses improve their websites and online visibility.',
   opening,
   ...(verified&&findings.length?['Source: '+audit.website+' · Google PageSpeed Insights (Lighthouse lab). The finding is an initial automated observation, not a confirmed business outcome.']:[]),
   'Would you be open to a quick conversation about what would actually help your business?',
   '',
   'Successful By Choice — Because Why Not?',
   '',
   'OWNER REVIEW REQUIRED. Confirm the business identity, contact permissions, and audit findings before sending. This tool does not send messages.'
  ].join('\n');
 }
 function expansionIdeas(customer={},audit={}){
  const ideas=[
   'Confirm whether the business already has an ongoing website maintenance plan before offering Website Care.',
   'Review whether the current business website needs updated service descriptions, calls to action or conversion tracking.',
   'Ask whether the business wants a Google Business Profile review; do not assume the listing is missing.'
  ];
  const issues=reportedOpportunities(audit);
  if(issues.length)ideas.unshift('Discuss a scoped website improvement offer for the measured '+issues[0].toLowerCase()+' issue.');
  if(customer?.customer===true)ideas.push('Verify existing purchases and current subscriptions before discussing another SBC service.');
  return ideas;
 }
 function buildStrategy(customer={},audit=null,competitors=[],ideas=[]){
  const business=tidy(customer.businessName,140)||'Business name not verified';
  const website=tidy(customer.website,220)||'Not verified';
  const now=new Date().toISOString().slice(0,10);
  const scoreCard=audit?.status==='measured'?Object.entries(audit.scores||{}).map(([key,value])=>key+': '+(value==null?'Unverified':value+'/100')).join('; '):'Not verified — no PageSpeed measurement available.';
  const audited=audit?.status==='measured'?
    'Source: Google PageSpeed Insights (Lighthouse lab); measured '+audit.measuredAt+'; website '+audit.website+'\nAudit opportunities: '+(reportedOpportunities(audit).join(', ')||'None identified in the selected checks.'):
    'Website measurements: Not verified.';
  const comparisons=(Array.isArray(competitors)?competitors:[]).filter(x=>x&&x.status==='measured')
   .map(x=>x.website+' | SEO '+(x.scores?.seo??'unverified')+'/100 | Performance '+(x.scores?.performance??'unverified')+'/100');
  return [
   'SBC DIGITAL OPPORTUNITY REVIEW',
   'Prepared: '+now,
   'Business: '+business,
   'Industry (owner-supplied): '+(tidy(customer.industry,100)||'Not verified'),
   'Website: '+website,
   '',
   '1. SITE MEASUREMENT',
   scoreCard,
   audited,
   '',
   '2. VERIFIED COMPETITOR-WEBSITE COMPARISON',
   ...(comparisons.length?comparisons:['Not verified: no competitor sites were independently measured.']),
   'Competitor revenue, sales, Google position and market share are NOT inferred from website scores.',
   '',
   '3. PROPOSED DISCUSSION POINTS — NOT CONFIRMED DEFICIENCIES',
   ...(ideas.length?ideas.map((x,i)=>(i+1)+'. '+x):['1. Confirm priorities with the business owner.']),
   '',
   '4. NEXT STEPS',
   'Verify business identity, service requirements and the accuracy of individual audit observations.',
   'Agree on a written scope, price, and owner approval before ordering or publishing anything.',
   'Not verified: Google Business Profile condition, local search rank, paid traffic, conversion rates, customer satisfaction or business revenue.',
   '',
   'Successful By Choice — Because Why Not?',
   'This is an owner-reviewed preliminary analysis, not an independent certification or a promise of search ranking.'
  ].join('\n');
 }
 if(typeof module==='object'&&module.exports)module.exports={prioritize,buildOutreach,buildStrategy,expansionIdeas};
 if(!root?.document)return;
 if(root.SBCProspectIntelligence)return;
 let mounting=false;
 function css(){
  if(root.document.querySelector('[data-sbc-prospect-css]'))return;
  const link=root.document.createElement('link');link.rel='stylesheet';link.href='/sbc-prospect-intelligence.css?v=1';
  link.dataset.sbcProspectCss='true';root.document.head.appendChild(link);
 }
 function customers(){
  try{
   const globalState=typeof state!=='undefined'?state:root.state;
   return Array.isArray(globalState?.data?.customers)?globalState.data.customers.filter(x=>x&&!x._recoveryProjection&&!x.sbcTest).slice(0,1000):[];
  }catch{return []}
 }
 function download(name,text){
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=root.document.createElement('a');a.href=url;a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 async function clipboard(value){
  try{await root.navigator.clipboard.writeText(value);return true}catch{return false}
 }
 async function audit(site){
  const target=tidy(site,450);
  if(!target)return {status:'unavailable',reason:'WEBSITE_NOT_PROVIDED',scores:null,findings:[]};
  try{
   const req=await root.fetch('/api/owner/prospect-intelligence/audit?website='+encodeURIComponent(target),
    {credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(25000),cache:'no-store'});
   if(!req.ok){
    const j=await req.json().catch(()=>({}));
    return {status:'unavailable',reason:j.code||('HTTP_'+req.status),website:target,scores:null,findings:[]};
   }
   return await req.json();
  }catch{return {status:'unavailable',reason:'AUDIT_UNAVAILABLE',website:target,scores:null,findings:[]}}
 }
 function resultCell(audit,key){
  return audit?.status==='measured'&&Number.isFinite(audit.scores?.[key])?String(audit.scores[key])+'/100':'Not verified';
 }
 function comparisonTable(items){
  if(!items.length)return '<p>No verified comparisons yet.</p>';
  return '<div class="spi-table-scroll"><table><thead><tr><th>Public website</th><th>Mobile performance</th><th>SEO</th><th>Accessibility</th></tr></thead><tbody>'+
   items.map(x=>'<tr><td>'+safe(x.website||'Not supplied')+'</td><td>'+safe(resultCell(x,'performance'))+'</td><td>'+safe(resultCell(x,'seo'))+'</td><td>'+safe(resultCell(x,'accessibility'))+'</td></tr>').join('')+'</tbody></table></div>';
 }
 async function ensureHandoff(){
  if(root.SBCProspectHandoffV2)return root.SBCProspectHandoffV2;
  if(!root.__SBC_HANDOFF_V2_LOAD__){
   root.__SBC_HANDOFF_V2_LOAD__=new Promise((resolve,reject)=>{
    const script=root.document.createElement('script');
    script.src='/sbc-prospect-handoff-v2.js?v=2';
    script.onload=resolve;script.onerror=()=>reject(Error('Research handoff module unavailable'));
    root.document.body.appendChild(script);
   }).catch(error=>{root.__SBC_HANDOFF_V2_LOAD__=null;throw error});
  }
  await root.__SBC_HANDOFF_V2_LOAD__;
  if(!root.SBCProspectHandoffV2)throw Error('Research handoff module failed to initialize');
  return root.SBCProspectHandoffV2;
 }
 function jsonDownload(packet){
  const blob=new Blob([JSON.stringify(packet,null,2)],{type:'application/json;charset=utf-8'});
  const href=URL.createObjectURL(blob),element=root.document.createElement('a');
  element.href=href;element.download='SBC-Prospect-Research-Handoff-V2.json';element.click();
  root.setTimeout(()=>URL.revokeObjectURL(href),3000);
 }
 function mount(host){
  if(mounting||!host||host.querySelector('[data-sbc-prospect-intelligence]'))return;
  mounting=true;css();
  const el=root.document.createElement('section');el.dataset.sbcProspectIntelligence='true';el.className='spi';
  el.innerHTML='<div class="spi-heading"><div><p class="spi-kicker">SBC PROSPECT INTELLIGENCE · OWNER LAB</p><h3>Turn public website findings into sales opportunities</h3><p>One evidence-led workflow. No subscription, AI API fee, automated contacts or CRM writes.</p></div></div>'+
  '<label for="spi-customer">Choose a current CRM business (optional)</label><select id="spi-customer"><option value="">Enter a prospect manually</option></select>'+
  '<div class="spi-fields"><label>Business name<input id="spi-name" maxlength="140" placeholder="Verified business name"></label><label>Industry<input id="spi-industry" maxlength="100" placeholder="Verified business type"></label><label>Public website (HTTPS)<input id="spi-website" maxlength="450" placeholder="https://business.com/"></label>'+
  '<label>Competitor website 1 (optional)<input id="spi-competitor-1" maxlength="450" placeholder="https://competitor.com/"></label><label>Competitor website 2 (optional)<input id="spi-competitor-2" maxlength="450" placeholder="https://competitor2.com/"></label></div>'+
  '<div class="spi-controls"><button type="button" id="spi-run">Run public website analysis</button><span id="spi-status" role="status" aria-live="polite">Enter a public website to begin. Maximum 12 PageSpeed checks per owner per hour.</span></div>'+
  '<p class="spi-note">Audits come from Google PageSpeed Insights (Lighthouse lab) when available. A score is not a Google ranking, customer conversion rate, or predicted sale. Competitors are supplied by you and not automatically identified. Missing data stays unverified.</p>'+
  '<section class="spi-card"><h4>Owner Research Library</h4><p>Retrieve owner-approved public research previously saved through the published writer. No customer data or staff access is added.</p><button type="button" id="spi-library-refresh">Load saved research</button><p id="spi-library-status" role="status">The library is owner-only. A real restart-persistence test remains necessary after GoDaddy returns.</p><div id="spi-library-list"></div></section>'+ 
  '<div id="spi-results"></div>';
  host.appendChild(el);
  async function loadLibrary(){
   const area=$('spi-library-list'),status=$('spi-library-status');
   area.replaceChildren();status.textContent='Reading owner-approved research records…';
   try{
    const response=await root.fetch('/api/owner/prospect-intelligence/packets',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
    const json=await response.json();
    if(!response.ok||json.ok!==true||!Array.isArray(json.records))throw Error(json.code||'LIBRARY_UNAVAILABLE');
    if(!json.records.length){status.textContent='No saved packets in this owner account.';return}
    status.textContent=json.records.length+' owner-reviewed public research packets retrieved. Each download requires review before sharing.';
    for(const item of json.records){
     const row=root.document.createElement('div');row.className='spi-library-row';
     const label=root.document.createElement('strong');label.textContent=String(item.packet?.business?.businessName||'Unverified business')+' · '+String(item.createdAt||'');
     const button=root.document.createElement('button');button.type='button';button.textContent='Download approved JSON';button.addEventListener('click',()=>jsonDownload(item.packet));
     row.append(label,button);area.appendChild(row);
    }
   }catch(error){status.textContent='Owner Research Library not confirmed: '+String(error?.message||'Unavailable');}
  }
  $('spi-library-refresh').addEventListener('click',loadLibrary);
  const list=customers(),pick=$('spi-customer');
  for(const [index,c] of list.entries()){
   const option=root.document.createElement('option');option.value=String(index);
   option.textContent=tidy(c.businessName||c.contactName||'Unnamed business',85);
   pick.appendChild(option);
  }
  let activeCustomer={};
  pick.addEventListener('change',()=>{
   const selected=pick.value!==''?list[Number(pick.value)]:null;
   activeCustomer=selected||{};
   $('spi-name').value=tidy(selected?.businessName||'',140);
   $('spi-industry').value=tidy(selected?.industry||'',100);
   $('spi-website').value=tidy(selected?.website||'',450);
   $('spi-results').replaceChildren();
   $('spi-status').textContent='Business loaded for owner review. Run a new public website analysis.';
  });
  $('spi-run').addEventListener('click',async()=>{
   if($('spi-run').disabled)return;
   const business={businessName:$('spi-name').value,industry:$('spi-industry').value,website:$('spi-website').value,
    verificationStatus:activeCustomer.verificationStatus||'',customer:/customer/i.test(String(activeCustomer.status||''))};
   if(!business.website.trim()){$('spi-status').textContent='A public HTTPS website is required for an automated audit. No request was sent.';return}
   $('spi-run').disabled=true;$('spi-status').textContent='Checking public website evidence. No CRM data or customer contact is transmitted.';
   $('spi-results').replaceChildren();
   try{
    const urls=[business.website,$('spi-competitor-1').value,$('spi-competitor-2').value].filter(x=>x.trim());
    const reports=await Promise.all(urls.map(audit));
    const main=reports[0],competitors=reports.slice(1),priority=prioritize(business,main),
     ideas=expansionIdeas(business,main),email=buildOutreach(business,main,competitors),
     report=buildStrategy(business,main,competitors,ideas);
    const measured=reports.filter(x=>x.status==='measured').length;
    $('spi-status').textContent=measured+' of '+reports.length+' requested sites measured. Unavailable data is not estimated.';
    const output=$('spi-results');
    output.innerHTML='<section class="spi-card"><h4>Evidence-led lead priority</h4><p><strong>'+priority.score+'/100 · '+safe(priority.label)+'</strong> — research priority, NOT a probability of a sale.</p>'+
      '<p><strong>Observed:</strong> '+safe(priority.evidence.join('; ')||'No confirming evidence yet')+'</p><p><strong>Research gaps:</strong> '+safe(priority.missingEvidence.join('; ')||'None flagged')+'</p></section>'+
      '<section class="spi-card"><h4>Public mobile site audit</h4>'+comparisonTable(reports)+'<p>Items to review: '+safe(reportedOpportunities(main).join(', ')||'No verified opportunities identified.')+'</p></section>'+
      '<section class="spi-card"><h4>Existing-customer expansion suggestions</h4><ul>'+ideas.map(x=>'<li>'+safe(x)+'</li>').join('')+'</ul></section>'+
      '<section class="spi-card"><h4>Personalized draft outreach · manual approval only</h4><textarea id="spi-email" rows="12" readonly></textarea><button type="button" id="spi-copy-email">Copy email draft</button></section>'+
      '<section class="spi-card"><h4>Customer-ready digital opportunity report · owner review required</h4><textarea id="spi-report" rows="16" readonly></textarea><button type="button" id="spi-download-report">Download TXT report</button></section>'+
      '<section class="spi-card" aria-label="Owner-approved workforce research handoff"><h4>Share this research with the workforce</h4><p>Check the business identity and each observation before distributing. Export includes public research only—no CRM contacts, orders or client identifiers.</p><label><input type="checkbox" id="spi-handoff-review"> I reviewed the evidence, business identity, and timestamps and approve creating a research handoff file.</label><button type="button" id="spi-export-handoff" disabled>Export owner-reviewed research handoff JSON</button> <button type="button" id="spi-save-research" disabled>Save to owner Research Library</button><p id="spi-handoff-status" role="status">Importing a file in a staff workspace does not verify owner identity or authorize contact; verify the source out of band.</p></section>';
    $('spi-email').value=email;$('spi-report').value=report;
    $('spi-copy-email').addEventListener('click',async()=>{$('spi-status').textContent=await clipboard(email)?'Email draft copied. Nothing was sent.':'Copy unavailable. Select the text manually.'});
    $('spi-download-report').addEventListener('click',()=>download('SBC-Digital-Opportunity-Review.txt',report));

    $('spi-handoff-review').addEventListener('change',e=>{$('spi-export-handoff').disabled=!e.target.checked;$('spi-save-research').disabled=!e.target.checked});
    let savedResearchId='',pendingResearchPacket=null;
    $('spi-save-research').addEventListener('click',async()=>{
     const note=$('spi-handoff-status'),button=$('spi-save-research');
     if(!$('spi-handoff-review').checked){note.textContent='Owner review required before saving.';return}
     button.disabled=true;
     try{
      const packet=pendingResearchPacket||(await ensureHandoff()).createPacket({ownerApproved:true,business,audit:main,competitors,preparedAt:Date.now()});
      pendingResearchPacket=packet;
      if(!savedResearchId){
       if(!root.crypto?.randomUUID)throw Error('Secure browser session is required');
       savedResearchId='sbc-handoff-'+root.crypto.randomUUID().replace(/-/g,'');
      }
      const response=await root.fetch('/api/owner/prospect-intelligence/packets',{
       method:'POST',credentials:'same-origin',cache:'no-store',
       headers:{Accept:'application/json','Content-Type':'application/json'},
       body:JSON.stringify({requestId:savedResearchId,packet}),signal:AbortSignal.timeout(25000)
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||result.ok!==true||(!result.durable&&!result.duplicate))throw Error(result.code||'RESEARCH_SAVE_UNVERIFIED');
      note.textContent='Owner-reviewed public research saved. No CRM or employee assignment was modified.';
      await loadLibrary();
     }catch(error){note.textContent='Research save not confirmed: '+String(error?.message||'Unavailable')+'. Check Research Library before retrying.'}
     finally{button.disabled=!$('spi-handoff-review').checked}
    });
    $('spi-export-handoff').addEventListener('click',async()=>{
      const note=$('spi-handoff-status'),button=$('spi-export-handoff');
      if(!$('spi-handoff-review').checked){note.textContent='Owner review required before export.';return}
      button.disabled=true;
      try{
        const packet=(await ensureHandoff()).createPacket({ownerApproved:true,business,audit:main,competitors,preparedAt:Date.now()});
        jsonDownload(packet);
        note.textContent='Owner-marked public research exported. Share the file only through an approved internal channel.';
      }catch(error){note.textContent='Research handoff export failed: '+String(error?.message||'Unknown error')}
      finally{button.disabled=!$('spi-handoff-review').checked}
    });

   }catch{$('spi-status').textContent='Research results could not be assembled. No false score was issued.'}
   finally{$('spi-run').disabled=false}
  });
  mounting=false;
 }
 root.SBCProspectIntelligence=Object.freeze({mount,prioritize,buildOutreach,buildStrategy,expansionIdeas});
})(typeof window==='undefined'?globalThis:window);

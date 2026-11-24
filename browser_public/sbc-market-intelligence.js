(function () {
  'use strict';

  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  const count = new Intl.NumberFormat('en-US');
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });
  const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const date = value => day.format(new Date(`${value}T00:00:00Z`));
  const period = range => `${date(range.startDate)} – ${date(range.endDate)}`;
  const isOwner = () => window.state?.me?.role === 'owner';
  const ownerKey = () => `${window.state?.me?.id}:${window.state?.me?.tenantId}`;

  function card(label, current, previous, format = count.format) {
    return `<div class="mi-metric"><dt>${escape(label)}</dt><dd>${current == null ? '—' : format(current)}</dd>
      <dd class="mi-comparison">Prior period ${previous == null ? '—' : format(previous)}</dd></div>`;
  }

  function website(site) {
    const heading = '<h3 id="mi-site-title">Website inquiries and checkout</h3>';
    if (site.status !== 'available') {
      const message = site.status === 'volume_limit' ? 'This date range exceeds the report limit. Try 30 days.' :
        site.status === 'out_of_scope' ? 'Switch to the sbcmia.com owner account to view this report.' : 'CRM and checkout evidence is temporarily unavailable.';
      return `<section class="mi-panel" aria-labelledby="mi-site-title">${heading}<p>${message}</p></section>`;
    }
    const { current, previous, periods, conflictingRequestIds, conflictingPaymentIds } = site;
    return `<section class="mi-panel" aria-labelledby="mi-site-title">${heading}
      <p class="mi-period">${period(periods.current)} · UTC<br>Compared with ${period(periods.previous)}</p>
      <dl class="mi-metrics">
        ${card('New website inquiries', current.crmInquiries, previous.crmInquiries)}
        ${card('Signed checkout starts', current.signedCheckouts, previous.signedCheckouts)}
        ${card('Paid signed checkouts', current.paidCheckouts, previous.paidCheckouts)}
        ${card('Recorded Square captures', current.capturedCents, previous.capturedCents, cents => money.format(cents / 100))}
      </dl>
      <p class="mi-footnote">Inquiries count new CRM records labeled sbcmia.com. Checkout results follow each period’s signed starts through the latest recorded Square status. Direct Square links and QA orders fall outside this report.</p>
      ${conflictingRequestIds || conflictingPaymentIds ? `<p class="mi-alert">Reconciliation needed for ${count.format(conflictingRequestIds)} duplicate checkout and ${count.format(conflictingPaymentIds)} duplicate payment references.</p>` : ''}
    </section>`;
  }

  function searchPanel(search) {
    const heading = '<h3 id="mi-search-title">Google Search visibility</h3>';
    if (search.status === 'connected') {
      const { current, previous, periods } = search;
      const ctr = row => row?.impressions ? row.clicks / row.impressions : null;
      return `<section class="mi-panel" aria-labelledby="mi-search-title">${heading}
        <p class="mi-period">${period(periods.current)} · Pacific time<br>Compared with ${period(periods.previous)}</p>
        <dl class="mi-metrics">
          ${card('Search impressions', current?.impressions, previous?.impressions)}
          ${card('Search clicks', current?.clicks, previous?.clicks)}
          ${card('Click-through rate', ctr(current), ctr(previous), percent.format)}
        </dl>
        <p class="mi-footnote">Finalized Search Console data fetched ${new Date(search.checkedAt).toLocaleString()}.</p>
        ${current === null ? '<p class="mi-footnote">Google returned no metrics for the current period.</p>' : ''}
      </section>`;
    }
    const messages = {
      not_configured: 'Connect a read-only account to see search impressions, clicks, and click-through rate.',
      access_denied: 'Google refused access to sbcmia.com. Verify the property and grant the service account access.',
      credential_invalid: 'Google Search Console needs a valid service account JSON key.',
      out_of_scope: 'Search Console access is limited to the sbcmia.com account.',
      unavailable: 'Search Console is temporarily unavailable. Try refreshing in a minute.'
    };
    const connection = ['not_configured', 'access_denied', 'credential_invalid'].includes(search.status) ?
      `<details class="mi-connect"><summary>Connect Search Console</summary>
        <p>Verify <strong>https://sbcmia.com/</strong>, enable the Search Console API in Google Cloud, and grant your service account read access to the property. Its JSON key goes into the encrypted Provider Credential Vault.</p>
        <p><a href="https://support.google.com/webmasters/answer/9008080" target="_blank" rel="noopener noreferrer">Google’s ownership verification instructions</a></p>
        <form data-mi-connect>
          <label for="sbc-market-gsc-file">Service account JSON key</label>
          <input type="file" id="sbc-market-gsc-file" accept=".json,application/json" required>
          <button type="submit" class="secondary">Save encrypted key</button>
        </form><p role="status" data-mi-connect-status></p>
      </details>` : '';
    return `<section class="mi-panel" aria-labelledby="mi-search-title">${heading}<p>${messages[search.status] || messages.unavailable}</p>${connection}</section>`;
  }

  function marketPanel(market) {
    const competitors = market.competitors.map(item => {
      const url = new URL(item.source);
      const source = url.protocol === 'https:' && !url.username && !url.password ?
        `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${escape(url.hostname.replace(/^www\./, ''))}</a>` : '';
      return `<article class="mi-competitor"><p class="mi-market">${escape(item.market)}</p>
        <h4>${escape(item.name)}</h4><p>${escape(item.observation)}</p>
        <p><strong>SBC opportunity</strong> ${escape(item.action)}</p>${source}</article>`;
    });
    return `<section class="mi-panel" aria-labelledby="mi-market-title"><h3 id="mi-market-title">Competitor watchlist</h3>
      <p class="mi-period">Public offers observed ${date(market.observedOn)}${market.reviewDue ? ' · Refresh research before acting' : ''}</p>
      <div class="mi-watchlist">${competitors.join('')}</div></section>`;
  }



  const researchIndustries=Object.freeze({auto:'Auto repair, collision repair, tire and wheel shops, and window tinting',beauty:'Barbershops, beauty salons and hair salons',food:'Independent restaurants and food service',retail:'Independent local retail stores',services:'Independent home and professional service businesses'});
  function buildResearchBrief(data,states,industry,target){
    if(data?.status!=='available'||data.coverage!==51||!Array.isArray(data.rows)||data.rows.length!==51||!Array.isArray(states)||states.length<1||states.length>5||new Set(states).size!==states.length||!Object.hasOwn(researchIndustries,industry)||![16,20].includes(target))throw Error('Select 1–5 different markets, one industry and an approved daily target.');
    const valid=new Map(data.rows.map(r=>[r.state,r]));
    if(valid.size!==51||states.some(state=>!/^[A-Z]{2}$/.test(state)||!valid.has(state))||!/^\d{4}-\d{2}$/.test(data.periodStart)||!/^\d{4}-\d{2}$/.test(data.periodEnd))throw Error('Research evidence unavailable.');
    const base=Math.floor(target/states.length),extra=target%states.length;
    const markets=states.map((state,i)=>({state,target:base+(i<extra?1:0)}));
    const brief=[
      'SBC — NATIONAL RESEARCH BRIEF (DRAFT; not assigned)',
      target+' research candidates · '+researchIndustries[industry],
      'Census business-application research signal: '+data.periodStart+' to '+data.periodEnd+' (not confirmed website buyers).',
      ...markets.map(m=>m.state+': '+m.target+' candidates'),
      'Research independently verified business records, prioritizing a documented website gap. Record business name, decision maker (if verified), primary business phone, business email, street/city/state/ZIP, Google Business Profile URL and separate GBP address, industry, website status, research source and evidence URLs.',
      'Record address mismatches, residential and service-area flags. Check existing CRM for duplicates and suppression before submitting; do not overwrite existing records.',
      'Do not infer language from a name, location, ethnicity or photo. Record preferred language only if directly confirmed; otherwise unknown.',
      'Flag missing or contradictory evidence for owner review. Keep verified contact data separate from consent or sales readiness. Do not call or message prospects as part of this research brief.',
      'Owner reviews and assigns through the existing research workflow. No task or CRM record has been created by this draft.'
    ].join('\n');
    return {total:target,markets,brief};
  }
  function researchControls(data){
    const options=data.rows.map(r=>'<option value="'+escape(r.state)+'">'+escape(r.state)+' — '+count.format(r.applications)+' applications</option>').join('');
    const industries=Object.entries(researchIndustries).map(([key,label])=>'<option value="'+key+'">'+escape(label)+'</option>').join('');
    return '<details class="mi-connect"><summary>Create daily research brief</summary><p>Choose up to five states. Targets are research candidates, not guaranteed qualified leads. Review the draft before assigning it.</p>'+
      '<form data-mi-research-form><label>Markets (select 1–5)<select data-mi-research-states multiple required size="5">'+options+'</select></label>'+
      '<label>Industry<select data-mi-research-industry>'+industries+'</select></label><label>Daily research target<select data-mi-research-target><option value="16">16 · Standard</option><option value="20">20 · Stretch</option></select></label>'+
      '<button type="submit" class="secondary">Generate reviewable brief</button></form><label>Draft for owner review<textarea data-mi-research-brief readonly rows="12" style="width:100%"></textarea></label><div data-mi-assignment hidden><label>Assign researcher<select data-mi-assignee required></select></label><label>Due date and time (your local time)<input data-mi-due type="datetime-local" required></label><label><input type="checkbox" data-mi-approve> I approve this research assignment.</label><button type="button" class="secondary" data-mi-assign disabled>Assign reviewed brief</button><p data-mi-assignment-status role="status"></p></div><p data-mi-research-status role="status">No assignment has been made.</p></details>';
  }

  function nationalPanel(data) {
    const title='<h3 id="mi-national-title">National Market Intelligence</h3>';
    if(data?.status!=='available'||!Array.isArray(data.rows)||data.coverage!==51)
      return '<section class="mi-panel" aria-labelledby="mi-national-title">'+title+'<p>Current Census research data is unavailable. Retry later; no market ranking is inferred.</p></section>';
    const rows=data.rows.slice(0,51).map((r,i)=>'<tr><th scope="row">'+(i+1)+'. '+escape(r.state)+'</th><td>'+count.format(r.applications)+'</td><td>'+count.format(r.priorApplications)+'</td><td>'+ (r.yearOverYearPct==null?'—':escape(r.yearOverYearPct)+'%')+'</td></tr>').join('');
    return '<section class="mi-panel" aria-labelledby="mi-national-title">'+title+
      '<p class="mi-period">'+escape(data.periodStart)+' to '+escape(data.periodEnd)+' · compared with '+escape(data.comparisonStart)+' to '+escape(data.comparisonEnd)+' · 50 states and DC</p>'+
      '<p>Ranked by recent business application volume, not purchase probability. Select markets for manual research of website gaps and verified business contacts.</p>'+
      '<div style="overflow-x:auto"><table class="table"><thead><tr><th>State</th><th>Applications</th><th>Prior year</th><th>Change</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      researchControls(data)+'<p class="mi-footnote">'+escape(data.limitation)+'</p><p><a href="https://www.census.gov/econ/bfs/data.html" target="_blank" rel="noopener noreferrer">U.S. Census Bureau — Business Formation Statistics</a></p></section>';
  }


  function geographyPanel(report){
    const heading='<h3 id="mi-geography-title">Geographic revenue intelligence</h3>';
    if(report?.status!=='available'||!Array.isArray(report.rows)||!report.totals){
      const message=report?.status==='volume_limit'?'The report exceeds its safe data limit. No partial totals are presented.':'CRM or payment records are unavailable; no totals can be confirmed.';
      return '<section class="mi-panel" aria-labelledby="mi-geography-title">'+heading+'<p>'+escape(message)+'</p></section>';
    }
    const rows=report.rows.map(r=>'<tr><th scope="row">'+escape(r.state==='unknown'?'Unknown location':r.state)+'</th><td>'+count.format(r.newCrmRecords)+'</td><td>'+count.format(r.paidOrders)+'</td><td>'+money.format(r.capturedCents/100)+'</td></tr>').join('');
    const t=report.totals;
    return '<section class="mi-panel" aria-labelledby="mi-geography-title">'+heading+'<p class="mi-period">'+escape(report.period.startDate)+' to '+escape(report.period.endDate)+' · complete UTC days</p>'+
      '<dl class="mi-metrics">'+card('New CRM records',t.newCrmRecords,null)+card('Orders with recorded capture',t.paidOrders,null)+card('Recorded captures',t.capturedCents,null,c=>money.format(c/100))+'</dl>'+
      '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Recorded state</th><th>New CRM records</th><th>Paid orders</th><th>Recorded captures</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
      (report.conflictingPaymentIds?'<p class="mi-alert">'+count.format(report.conflictingPaymentIds)+' conflicting payment references excluded from captured totals; reconcile before acting.</p>':'')+
      '<p class="mi-footnote">'+escape(report.methodology)+'</p></section>';
  }

  function mount(content) {
    if (!isOwner() || content.querySelector('[data-sbc-market-intelligence]')) return;
    const account = ownerKey();
    content.innerHTML = `<section data-sbc-market-intelligence aria-label="Market Intelligence">
      <header class="mi-header"><div><h2>Market Intelligence</h2><p>Track how customers find SBC, where checkout records convert, and which public offers are worth studying.</p></div>
      <div class="mi-controls"><label for="sbc-market-window">Report window</label><select id="sbc-market-window"><option value="30">30 days</option><option value="90">90 days</option></select><button type="button" class="secondary" data-mi-refresh>Refresh</button><button type="button" class="secondary" data-mi-prospect>✦ Prospect Intelligence</button><button type="button" class="secondary" data-mi-national>National Market Research</button><button type="button" class="secondary" data-mi-geography>Geographic Revenue</button></div></header>
      <p class="mi-status" data-mi-status role="status"></p><div data-mi-results></div><div data-mi-national-results aria-live="polite"></div><div data-mi-geography-results aria-live="polite"></div></section>`;
    const root = content.firstElementChild;
    const refresh = root.querySelector('[data-mi-refresh]');
    const windowSelect = root.querySelector('select');
    const status = root.querySelector('[data-mi-status]');
    const results = root.querySelector('[data-mi-results]');
    const active = () => root.isConnected && isOwner() && ownerKey() === account;
    let request = 0;

    async function load() {
      const sequence = ++request;
      refresh.disabled = true;
      results.setAttribute('aria-busy', 'true');
      results.replaceChildren();
      status.textContent = 'Loading market intelligence…';
      try {
        const response = await fetch(`/api/owner/market-intelligence?days=${windowSelect.value}`, {
          credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000)
        });
        if (response.status === 401 || response.status === 403) throw Error('Sign in as the owner to view this report.');
        if (!response.ok) throw Error('Market Intelligence is temporarily unavailable. Refresh to try again.');
        const report = await response.json();
        if (!active() || sequence !== request) return;
        const actions = report.actions.length ? `<section class="mi-panel mi-actions" aria-labelledby="mi-actions-title"><h3 id="mi-actions-title">Recommended actions</h3>
          <ul>${report.actions.map(action => `<li>${escape(action)}</li>`).join('')}</ul></section>` : '';
        results.innerHTML = `<div class="mi-columns">${website(report.site)}${searchPanel(report.search)}</div>${actions}${marketPanel(report.market)}`;
        status.textContent = `Report refreshed ${new Date(report.generatedAt).toLocaleString()}.`;
      } catch (error) {
        if (active() && sequence === request) status.textContent = error instanceof Error && /^(Sign in|Market Intelligence)/.test(error.message) ?
          error.message : 'Market Intelligence is temporarily unavailable. Refresh to try again.';
      } finally {
        if (active() && sequence === request) {
          refresh.disabled = false;
          results.removeAttribute('aria-busy');
        }
      }
    }

    // On demand only: no third-party calls until the owner requests a public audit.
    root.querySelector('[data-mi-prospect]').addEventListener('click',async()=>{
      const button=root.querySelector('[data-mi-prospect]');
      button.disabled=true;
      try{
        if(!window.SBCProspectIntelligence){
          if(!window.__SBC_PROSPECT_UI_LOAD__){
            window.__SBC_PROSPECT_UI_LOAD__=new Promise((resolve,reject)=>{
              const script=document.createElement('script');script.src='/sbc-prospect-intelligence.js?v=3-offline';
              script.onload=resolve;script.onerror=()=>reject(Error('Prospect Intelligence UI asset unavailable'));
              document.body.appendChild(script);
            }).catch(e=>{window.__SBC_PROSPECT_UI_LOAD__=null;throw e});
          }
          await window.__SBC_PROSPECT_UI_LOAD__;
        }
        if(!active())return;
        window.SBCProspectIntelligence.mount(root);
        root.querySelector('[data-sbc-prospect-intelligence]')?.scrollIntoView({block:'start',behavior:'smooth'});
      }catch{if(active())status.textContent='Prospect Intelligence could not be loaded. Please refresh and try again.'}
      finally{if(button.isConnected)button.disabled=false}
    });

    root.querySelector('[data-mi-national]').addEventListener('click',async()=>{
      const button=root.querySelector('[data-mi-national]'),panel=root.querySelector('[data-mi-national-results]');
      button.disabled=true;panel.setAttribute('aria-busy','true');panel.textContent='Loading official Census research data…';
      try{
        const response=await fetch('/api/owner/market-intelligence/national',{credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
        if(!response.ok)throw Error('Unavailable');
        const data=await response.json();
        if(active()){
          panel.innerHTML=nationalPanel(data);
          const form=panel.querySelector('[data-mi-research-form]'),assignment=panel.querySelector('[data-mi-assignment]');
          let draft=null,pending=null,locked=false;
          if(form&&assignment){
            const out=panel.querySelector('[data-mi-research-brief]'),status=panel.querySelector('[data-mi-research-status]'),staff=panel.querySelector('[data-mi-assignee]'),due=panel.querySelector('[data-mi-due]'),approve=panel.querySelector('[data-mi-approve]'),assign=panel.querySelector('[data-mi-assign]'),feedback=panel.querySelector('[data-mi-assignment-status]');
            const sync=()=>{assign.disabled=locked||!draft||!approve.checked||!staff.value||!due.value||staff.disabled;};
            const reset=()=>{if(locked||pending)return;draft=null;assignment.hidden=true;out.value='';approve.checked=false;sync();};
            form.addEventListener('change',reset);
            for(const el of [staff,due,approve])el.addEventListener('change',()=>{if(!pending)sync();});
            form.addEventListener('submit',async event=>{
              event.preventDefault();
              if(!active()||locked||pending)return;
              reset();
              try{
                const states=Array.from(panel.querySelector('[data-mi-research-states]').selectedOptions,o=>o.value);
                const industry=panel.querySelector('[data-mi-research-industry]').value,target=Number(panel.querySelector('[data-mi-research-target]').value);
                const result=buildResearchBrief(data,states,industry,target);
                draft={states,industry,target,periodStart:data.periodStart,periodEnd:data.periodEnd};
                out.value=result.brief;assignment.hidden=false;staff.disabled=true;staff.replaceChildren();feedback.textContent='Loading active researchers…';status.textContent='Review the brief before approving. No assignment has been made.';
                const snapshot=draft;
                const response=await fetch('/api/owner/national-research/assignees',{credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(12000)});
                const payload=await response.json();
                if(!active()||draft!==snapshot)return;
                if(!response.ok||payload.ok!==true||!Array.isArray(payload.assignees))throw Error('Researcher list unavailable.');
                const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select an active researcher';staff.append(placeholder);
                for(const user of payload.assignees){const option=document.createElement('option');option.value=String(user.id);option.textContent=String(user.name);staff.append(option);}
                staff.disabled=payload.readOnly===true||!payload.assignees.length;
                feedback.textContent=payload.readOnly?'Published writer required to assign.':payload.assignees.length?'Choose a researcher and due date, then approve.':'No active researchers available.';
                sync();
              }catch(error){if(active()){status.textContent=error.message;staff.disabled=true;sync();}}
            });
            assign.addEventListener('click',async()=>{
              if(!active()||locked||!draft||!approve.checked)return;
              if(!pending){
                const date=new Date(due.value);
                if(!Number.isFinite(date.getTime())||date<=new Date()){feedback.textContent='Choose a future due date.';return;}
                if(!globalThis.crypto?.randomUUID){feedback.textContent='Secure request identity unavailable.';return;}
                pending={...draft,assignedTo:staff.value,dueAt:date.toISOString(),requestId:'nr_'+crypto.randomUUID().replace(/-/g,''),approved:true};
              }
              locked=true;assign.disabled=true;staff.disabled=true;due.disabled=true;approve.disabled=true;button.disabled=true;for(const control of form.elements)control.disabled=true;
              feedback.textContent='Saving approved assignment…';
              try{
                const response=await fetch('/api/owner/national-research/assignments',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(pending),signal:AbortSignal.timeout(18000)});
                const receipt=await response.json();
                if(!response.ok||receipt.ok!==true||!receipt.task?.id)throw Error(receipt.error||'Assignment not confirmed.');
                if(!active())return;
                feedback.textContent='Assignment saved · reference '+receipt.task.id+'. The researcher can view it in Today’s Tasks.';
                status.textContent='Owner-approved assignment saved.';assign.textContent='Assignment saved';pending=null;draft=null;button.disabled=false;
              }catch(error){if(active()){feedback.textContent='Assignment not confirmed. Retry the same request before changing the plan. '+error.message;assign.textContent='Retry same assignment';assign.disabled=false;}}
              finally{locked=false;}
            });
          }
        }
      }catch{if(active())panel.innerHTML=nationalPanel({status:'unavailable'});}
      finally{if(active()){button.disabled=false;panel.removeAttribute('aria-busy');}}
    });

    const geoButton=root.querySelector('[data-mi-geography]'),geoPanel=root.querySelector('[data-mi-geography-results]');
    let geoSequence=0;
    async function loadGeography(){
      const seq=++geoSequence,days=windowSelect.value;
      geoButton.disabled=true;geoPanel.setAttribute('aria-busy','true');geoPanel.textContent='Loading geographic CRM and payment evidence…';
      try{
        const response=await fetch('/api/owner/market-intelligence/geography?days='+encodeURIComponent(days),{credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
        if(!response.ok)throw Error('Unavailable');
        const report=await response.json();
        if(active()&&seq===geoSequence)geoPanel.innerHTML=geographyPanel(report);
      }catch{if(active()&&seq===geoSequence)geoPanel.innerHTML=geographyPanel({status:'unavailable'});}
      finally{if(active()&&seq===geoSequence){geoButton.disabled=false;geoPanel.removeAttribute('aria-busy');}}
    }
    geoButton.addEventListener('click',loadGeography);
    windowSelect.addEventListener('change',()=>{if(geoPanel.textContent)void loadGeography();});
    refresh.addEventListener('click', load);
    windowSelect.addEventListener('change', load);
    root.addEventListener('submit', async event => {
      if (!event.target.matches('[data-mi-connect]') || !active()) return;
      event.preventDefault();
      event.stopPropagation();
      const form = event.target;
      const feedback = root.querySelector('[data-mi-connect-status]');
      const button = form.querySelector('button');
      const file = form.querySelector('input').files[0];
      if (!file || !file.size || file.size > 20000) {
        feedback.textContent = 'Choose a Google service account JSON key under 20 KB.';
        return;
      }
      button.disabled = true;
      try {
        const value = await file.text();
        if (!active()) return;
        const response = await fetch('/api/architecture/vault', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ name: 'SBC_GOOGLE_SEARCH_CONSOLE_SERVICE_ACCOUNT', value }),
          signal: AbortSignal.timeout(15000)
        });
        const receipt = await response.json();
        if (!response.ok || receipt.persisted !== true || receipt.encrypted !== true) {
          feedback.textContent = response.status === 400 ? 'The file could not be validated as a Google service account JSON key.' :
            'The key save could not be confirmed. Use the Published owner workspace and try again.';
          return;
        }
        if (active()) await load();
      } catch {
        feedback.textContent = 'The key save could not be confirmed. Refresh to check the connection.';
      } finally {
        form.reset();
        button.disabled = false;
      }
    });
    void load();
  }

  window.SBCMarketIntelligence = { mount };
})();

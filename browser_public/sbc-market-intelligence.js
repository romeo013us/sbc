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

  function radarPanel(report) {
    const items=Array.isArray(report?.sources)?report.sources:[];
    if(!items.length)return '<section class="mi-panel"><h3>Global Opportunity Radar</h3><p>Sources unavailable. No opportunity counts confirmed.</p></section>';
    const labels={license_records:'license records',active_license_records:'active license records',recent_start_records:'reported business-start records',event_permit_records:'upcoming permit records'};
    const states={'Chicago, Illinois, US':'IL','Detroit, Michigan, US':'MI','Miami-Dade County, Florida, US':'FL','New York City, New York, US':'NY'};
    const allowedSources=['https://www.gov.uk/bank-holidays','https://data.cityofchicago.org/Community-Economic-Development/Business-Licenses/r5kz-chrr','https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/bseed_active_business_licenses/FeatureServer/0','https://gisweb.miamidade.gov/arcgis/rest/services/BusinessTracker/MapServer/0','https://data.cityofnewyork.us/City-Government/NYC-Permitted-Event-Information/tvpp-9vvx'];
    const coverage=items.filter(x=>x.status==='available').length+' of '+(Number.isSafeInteger(report.coverage?.configured)&&report.coverage.configured>=items.length?report.coverage.configured:items.length)+' sources available';
    const rows=items.map(item=>{
      let details='Unavailable — no signal confirmed.';
      if(item.status==='available'&&Object.hasOwn(labels,item.kind)&&Number.isSafeInteger(item.count)&&item.count>=0)details=count.format(item.count)+' '+labels[item.kind];
      if(item.status==='available'&&item.kind==='calendar_events'&&Array.isArray(item.events))details=item.events.length?'<ul>'+item.events.map(e=>'<li>'+escape(e.date)+' · '+escape(e.region)+' · '+escape(e.title)+'</li>').join('')+'</ul>':'No calendar events returned in this window.';
      const source=typeof item.source==='string'&&allowedSources.includes(item.source)?'<a href="'+escape(item.source)+'" target="_blank" rel="noopener noreferrer">Official source</a>':'';
      const state=Object.hasOwn(states,item.market)?states[item.market]:null;
      const action=state&&item.status==='available'?'<button type="button" class="secondary" data-mi-radar-research="'+state+'">Open state research plan</button>':'';
      const windowText=item.startDate?escape(item.startDate)+(item.endDateExclusive?' to '+escape(item.endDateExclusive)+' (exclusive)':''):'Current source snapshot';
      return '<article class="mi-competitor"><h4>'+escape(item.market)+'</h4><p>'+windowText+'</p><div>'+details+'</div><p class="mi-footnote">'+escape(item.limitation)+'</p>'+source+(item.checkedAt?'<p class="mi-footnote">Retrieved '+escape(item.checkedAt)+'</p>':'')+action+'</article>';
    }).join('');
    return '<section class="mi-panel" aria-labelledby="mi-radar-title"><h3 id="mi-radar-title">Global Opportunity Radar</h3><p>'+escape(coverage)+'</p><p>Public research and campaign-planning signals. Coverage is limited to the listed sources; signals are not ranked against each other or treated as verified leads.</p><button type="button" class="secondary" data-mi-radar-research="">Open national research assignments</button><div class="mi-watchlist">'+rows+'</div></section>';
  }

  function briefingPanel(report){
    const rankings=Array.isArray(report?.rankings)?report.rankings:[];
    const markets=Array.isArray(report?.research?.markets)?report.research.markets:[];
    const campaigns=Array.isArray(report?.campaigns)?report.campaigns:[];
    const exceptions=Array.isArray(report?.exceptions)?report.exceptions:[];
    const labels={NATIONAL_EVIDENCE_UNAVAILABLE:'National Census evidence unavailable',CRM_EVIDENCE_UNAVAILABLE:'Tenant CRM evidence unavailable',RADAR_UNAVAILABLE:'Public market sources unavailable',SOURCE_UNAVAILABLE:'Public source unavailable'};
    const rows=rankings.map(r=>'<tr><th scope="row">'+escape(r.state)+'</th><td>'+count.format(r.applications)+'</td><td>'+(r.crmEvidence?count.format(r.crmEvidence.newCrmRecords):'Not available')+'</td><td>'+(r.crmEvidence?money.format(r.crmEvidence.capturedCents/100):'Not available')+'</td></tr>').join('');
    const states=markets.map(x=>x.state).filter(x=>/^[A-Z]{2}$/.test(x));
    const research=markets.length?'<div class="mi-competitor"><h4>'+escape(report.research.target)+' research candidates</h4><p>'+markets.map(x=>escape(x.state)+': '+escape(x.target)).join(' · ')+'</p><p>Owner review required. This is a suggested allocation, not verified leads or a saved assignment.</p><button type="button" class="secondary" data-mi-briefing-research="'+escape(states.join(','))+'">Review suggested research plan</button></div>':'<p>No current national research plan can be confirmed.</p>';
    return '<section class="mi-panel" aria-labelledby="mi-briefing-title"><h3 id="mi-briefing-title">Automatic opportunity briefing</h3><p class="mi-period">'+escape(report?.generatedAt||'Refresh to retrieve current evidence')+'</p><p>Owner review required before assignments or campaigns. No automatic writes, publication or customer contact.</p>'+
      (rankings.length?'<h4>Top US states by comparable business-application volume</h4><p class="mi-footnote">Census '+escape(report?.rankingPeriod?.start||'')+' to '+escape(report?.rankingPeriod?.end||'')+'; CRM evidence uses a separate 30-day window. These are research signals, not sales probabilities.</p><div style="overflow-x:auto"><table class="table"><thead><tr><th>State</th><th>Applications</th><th>Recorded CRM intake</th><th>Recorded captures</th></tr></thead><tbody>'+rows+'</tbody></table></div>':'<p>National ranking unavailable.</p>')+
      '<h4>Suggested research allocation</h4>'+research+'<h4>Calendar campaign preparation</h4>'+
      (campaigns.length?'<ul>'+campaigns.map(x=>'<li>'+escape(x.eventDate)+' · '+escape(x.market)+' · '+escape(x.title)+' — review-only draft</li>').join('')+'</ul>':'<p>No verified calendar suggestions returned in the next 30 days.</p>')+
      (exceptions.length?'<h4>Evidence exceptions</h4><ul>'+exceptions.map(x=>'<li>'+escape(labels[x.code]||'Evidence unavailable')+' — '+escape(x.market)+'</li>').join('')+'</ul>':'')+
      (report?.status==='unavailable'?'<p class="mi-alert">Evidence unavailable; no unverified ranking or draft is substituted.</p>':'')+'</section>';
  }

  function mount(content) {
    if (!isOwner() || content.querySelector('[data-sbc-market-intelligence]')) return;
    const account = ownerKey();
    content.innerHTML = `<section data-sbc-market-intelligence aria-label="Market Intelligence">
      <header class="mi-header"><div><h2>Market Intelligence</h2><p>Track how customers find SBC, where checkout records convert, and which public offers are worth studying.</p></div>
      <div class="mi-controls"><label for="sbc-market-window">Report window</label><select id="sbc-market-window"><option value="30">30 days</option><option value="90">90 days</option></select><button type="button" class="secondary" data-mi-refresh>Refresh</button><button type="button" class="secondary" data-mi-prospect>✦ Prospect Intelligence</button><button type="button" class="secondary" data-mi-national>National Market Research</button><button type="button" class="secondary" data-mi-geography>Geographic Revenue</button><button type="button" class="secondary" data-mi-radar>Global Opportunity Radar</button></div></header>
      <p class="mi-status" data-mi-status role="status"></p><div data-mi-briefing-results aria-live="polite"></div><div data-mi-results></div><div data-mi-national-results aria-live="polite"></div><div data-mi-geography-results aria-live="polite"></div><div data-mi-radar-results aria-live="polite"></div></section>`;
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

    let radarResearchStates=[];
    root.querySelector('[data-mi-national]').addEventListener('click',async()=>{
      const button=root.querySelector('[data-mi-national]'),panel=root.querySelector('[data-mi-national-results]');
      button.disabled=true;panel.setAttribute('aria-busy','true');panel.textContent='Loading official Census research data…';
      try{
        const response=await fetch('/api/owner/market-intelligence/national',{credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
        if(!response.ok)throw Error('Unavailable');
        const data=await response.json();
        if(active()){
          panel.innerHTML=nationalPanel(data);
          const requestedStates=radarResearchStates;radarResearchStates=[];
          if(requestedStates.length){const select=panel.querySelector('[data-mi-research-states]');if(select){for(const option of select.options)option.selected=requestedStates.includes(option.value);const details=select.closest('details');if(details)details.open=true;}}
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

    const radarButton=root.querySelector('[data-mi-radar]'),radarResults=root.querySelector('[data-mi-radar-results]');
    radarButton.addEventListener('click',async()=>{
      if(!active())return;
      radarButton.disabled=true;radarResults.setAttribute('aria-busy','true');radarResults.textContent='Loading official market signals…';
      try{
        const response=await fetch('/api/owner/market-intelligence/radar',{credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(16000)});
        if(!response.ok)throw Error('Unavailable');
        const data=await response.json();
        if(active())radarResults.innerHTML=radarPanel(data);
      }catch{if(active())radarResults.innerHTML=radarPanel({status:'unavailable'});}
      finally{if(active()){radarButton.disabled=false;radarResults.removeAttribute('aria-busy');}}
    });
    radarResults.addEventListener('click',event=>{
      const action=event.target.closest('[data-mi-radar-research]');
      if(!action||!active())return;
      const target=root.querySelector('[data-mi-national]');
      if(target.disabled)return;
      radarResearchStates=['IL','MI','FL','NY'].includes(action.dataset.miRadarResearch)?[action.dataset.miRadarResearch]:[];
      target.click();
      root.querySelector('[data-mi-national-results]').scrollIntoView({block:'start'});
    });
    const briefingResults=root.querySelector('[data-mi-briefing-results]');
    let briefingBusy=false,briefingTimer=null;
    async function loadBriefing(){
      if(!active()||briefingBusy)return;
      briefingBusy=true;briefingResults.setAttribute('aria-busy','true');
      if(!briefingResults.textContent)briefingResults.textContent='Preparing your opportunity briefing…';
      try{
        const response=await fetch('/api/owner/market-intelligence/briefing',{credentials:'same-origin',headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});
        if(!response.ok)throw Error('Unavailable');
        const report=await response.json();
        if(active())briefingResults.innerHTML=briefingPanel(report);
      }catch{if(active())briefingResults.innerHTML=briefingPanel({status:'unavailable'});}
      finally{briefingBusy=false;if(active())briefingResults.removeAttribute('aria-busy');}
    }
    // Refresh only while this owner view remains mounted and visible. No
    // persistent scheduler, provider writes or task mutations are implied.
    function scheduleBriefing(){
      if(briefingTimer!==null)clearTimeout(briefingTimer);
      if(!active())return;
      briefingTimer=setTimeout(async()=>{briefingTimer=null;if(!active())return;if(!document.hidden)await loadBriefing();scheduleBriefing();},300000);
    }
    briefingResults.addEventListener('click',event=>{
      const action=event.target.closest('[data-mi-briefing-research]');
      if(!active()||!action)return;
      const target=root.querySelector('[data-mi-national]');
      if(target.disabled)return;
      const states=String(action.dataset.miBriefingResearch||'').split(',').filter(x=>/^[A-Z]{2}$/.test(x)).slice(0,3);
      if(!states.length)return;
      radarResearchStates=[...new Set(states)];target.click();
      root.querySelector('[data-mi-national-results]').scrollIntoView({block:'start'});
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
    refresh.addEventListener('click',()=>{void loadBriefing();});
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
    void loadBriefing();
    scheduleBriefing();
  }

  window.SBCMarketIntelligence = { mount };
})();

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

  function mount(content) {
    if (!isOwner() || content.querySelector('[data-sbc-market-intelligence]')) return;
    const account = ownerKey();
    content.innerHTML = `<section data-sbc-market-intelligence aria-label="Market Intelligence">
      <header class="mi-header"><div><h2>Market Intelligence</h2><p>Track how customers find SBC, where checkout records convert, and which public offers are worth studying.</p></div>
      <div class="mi-controls"><label for="sbc-market-window">Report window</label><select id="sbc-market-window"><option value="30">30 days</option><option value="90">90 days</option></select><button type="button" class="secondary" data-mi-refresh>Refresh</button></div></header>
      <p class="mi-status" data-mi-status role="status"></p><div data-mi-results></div></section>`;
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

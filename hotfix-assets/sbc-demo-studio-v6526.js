/* SBC OS V65.1.26 — Demo Studio: preview, design variations, and consent-gated delivery. */
(function () {
  'use strict';
  const MARKER = 'SBC_V6526_DEMO_STUDIO';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const currentRole = () => (typeof state !== 'undefined' && state.me && state.me.role) || '';
  const getCustomer = id => (typeof state !== 'undefined' && state.data && Array.isArray(state.data.customers) ? state.data.customers : []).find(c => String(c.id) === String(id));
  const absoluteUrl = value => { const raw = String(value || '').trim(); if (!raw) return ''; try { return new URL(raw, window.location.origin).href; } catch { return ''; } };
  const apiCall = async (url, options) => { if (typeof api !== 'function') throw new Error('SBC API client is unavailable. Refresh the Command Center.'); return api(url, options); };
  const showToast = message => { if (typeof toast === 'function') toast(message); else console.info(`[${MARKER}] ${message}`); };
  let current = null;
  let sending = false;

  function renderStudio(demo, customer, message) {
    current = { demo, customer };
    const url = absoluteUrl(demo.url || `/demo/${encodeURIComponent(demo.slug || '')}`);
    const isOwner = currentRole() === 'owner';
    const canEmail = isOwner && Boolean(customer.email) && Boolean(url);
    const canSms = isOwner && Boolean(customer.phone) && Boolean(url) && (customer.smsConsent === true || customer.consentToSms === true) && customer.smsOptOut !== true && customer.doNotContact !== true && customer.doNotCall !== true;
    const status = message || 'Preview ready. Review the page before you send it.';
    const html = `
      <div class="v6526-studio">
        <div class="v6526-studio-top"><div><div class="v6526-kicker">SBC DEMO STUDIO · V65.1.26</div><h3>${esc(customer.businessName || customer.contactName || 'Customer website')}</h3><p>Review the actual customer-facing page, switch design direction, then send the preview link.</p></div><span class="v6526-ready"><i></i> ${esc(demo.status || 'Preview ready')}</span></div>
        <div class="v6526-studio-toolbar"><div class="v6526-device-tabs"><button type="button" class="active" data-v6526-device="desktop">Desktop</button><button type="button" data-v6526-device="mobile">Mobile</button></div><label class="v6526-style-select">Design direction <select id="v6526DesignStyle"><option value="generative">Premium hybrid</option><option value="editorial">Editorial / luxury</option><option value="tactile">Modern / tactile</option><option value="minimal">Minimal / clean</option><option value="professional">Professional / authority</option></select></label><button type="button" class="btn" id="v6526Regenerate">Generate variation</button></div>
        <div class="v6526-preview-shell"><div class="v6526-browser"><span></span><span></span><span></span><small>${esc(new URL(url).host + new URL(url).pathname)}</small><button type="button" id="v6526Refresh" title="Refresh preview">↻</button></div><iframe id="v6526PreviewFrame" title="Customer website demo preview" src="${esc(url)}" loading="eager" referrerpolicy="no-referrer"></iframe></div>
        <div class="v6526-link-row"><div><span class="v6526-kicker">SHAREABLE DEMO LINK</span><input id="v6526DemoUrl" readonly value="${esc(url)}" aria-label="Demo URL"></div><button type="button" class="btn" id="v6526CopyLink">Copy link</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open full page ↗</a></div>
        <div class="v6526-delivery"><div><div class="v6526-kicker">DELIVERY CENTER</div><h4>Send the preview professionally</h4><p id="v6526DeliveryStatus" role="status">${esc(status)}</p></div><div class="v6526-delivery-actions"><button type="button" class="btn primary" id="v6526EmailDemo" ${canEmail ? '' : 'disabled'}>Email demo</button><button type="button" class="btn" id="v6526SmsDemo" ${canSms ? '' : 'disabled'}>Text demo</button></div></div>
        ${!isOwner ? '<p class="v6526-note">Sending is owner-authorized in the current SBC communications API. Copy the link or ask the owner to send it.</p>' : ''}
        ${isOwner && customer.phone && !canSms ? '<p class="v6526-note">SMS is unavailable until the customer has explicit SMS consent recorded and is not opted out or suppressed. The server also enforces this gate.</p>' : ''}
        <p class="v6526-note">A demo is a concept preview, not a published production website. Confirm business details and image rights before launch. No payment, order, or fulfillment state is changed by this studio.</p>
      </div>`;
    if (typeof openModal !== 'function') throw new Error('SBC modal host is unavailable.');
    openModal('SBC Demo Studio', html);
    wireStudio();
  }

  function setStatus(message, error) {
    const el = document.getElementById('v6526DeliveryStatus');
    if (el) { el.textContent = message; el.classList.toggle('is-error', Boolean(error)); }
  }

  function wireStudio() {
    const frame = document.getElementById('v6526PreviewFrame');
    const shell = document.querySelector('.v6526-preview-shell');
    document.querySelectorAll('[data-v6526-device]').forEach(button => button.addEventListener('click', () => {
      document.querySelectorAll('[data-v6526-device]').forEach(b => b.classList.toggle('active', b === button));
      if (shell) shell.classList.toggle('is-mobile', button.dataset.v6526Device === 'mobile');
    }));
    document.getElementById('v6526Refresh')?.addEventListener('click', () => { if (frame) frame.src = frame.src; });
    document.getElementById('v6526CopyLink')?.addEventListener('click', async () => {
      const url = document.getElementById('v6526DemoUrl')?.value || '';
      try { await navigator.clipboard.writeText(url); setStatus('Demo link copied.'); }
      catch { const input = document.getElementById('v6526DemoUrl'); if (input) { input.focus(); input.select(); setStatus('Select and copy the highlighted demo link.'); } }
    });
    document.getElementById('v6526Regenerate')?.addEventListener('click', async () => {
      if (!current || sending) return;
      const style = document.getElementById('v6526DesignStyle')?.value || 'generative';
      const button = document.getElementById('v6526Regenerate'); button.disabled = true; button.textContent = 'Generating…';
      setStatus('Building the alternate design. The current link will be retained.');
      try {
        const result = await apiCall('/api/website-demos', { method: 'POST', body: JSON.stringify({ customerId: current.customer.id, fast: true, designStyle: style }) });
        if (!result?.demo) throw new Error('The server did not return a demo.');
        renderStudio(result.demo, current.customer, `Variation generated (${style}). Review it before sending.`);
      } catch (error) { setStatus(error.message || 'Could not generate this variation.', true); }
      finally { const next = document.getElementById('v6526Regenerate'); if (next) { next.disabled = false; next.textContent = 'Generate variation'; } }
    });
    document.getElementById('v6526EmailDemo')?.addEventListener('click', sendEmailDemo);
    document.getElementById('v6526SmsDemo')?.addEventListener('click', sendSmsDemo);
  }

  async function sendEmailDemo() {
    if (!current || sending) return;
    const { demo, customer } = current;
    const url = absoluteUrl(demo.url || `/demo/${encodeURIComponent(demo.slug || '')}`);
    if (currentRole() !== 'owner') return setStatus('Only the owner role can send through the current communications API.', true);
    if (!customer.email || !url) return setStatus('A valid customer email and absolute demo URL are required.', true);
    const already = document.getElementById('v6526EmailDemo');
    const subject = `Your custom website concept for ${customer.businessName || customer.contactName || 'your business'}`;
    const body = `Hi ${customer.contactName || 'there'},\n\nI put together a website concept for ${customer.businessName || 'your business'} so you can see a direction tailored to your business.\n\nView your demo: ${url}\n\nThis is a preview concept; the final site can be refined with your approved content, photos, services, and brand details.\n\nIf you'd like, reply and we can review the next steps together.\n\nSuccessful By Choice\nBecause Why Not?`;
    if (typeof confirm === 'function' && !confirm(`Send this website demo to ${customer.email}?\n\n${url}`)) return;
    sending = true; if (already) { already.disabled = true; already.textContent = 'Sending…'; }
    setStatus('Sending email through the configured SBC provider…');
    try {
      const result = await apiCall('/api/communications/email', { method: 'POST', body: JSON.stringify({ customerId: customer.id, subject, body }) });
      if (!result?.ok) throw new Error(result?.error || 'The mail provider did not confirm success.');
      setStatus(`Email accepted by the configured provider for ${result.to || customer.email}. Message ID: ${result.messageId || 'recorded'}.`);
      if (already) { already.textContent = 'Email sent'; already.disabled = true; }
    } catch (error) { setStatus(error.message || 'Email send failed.', true); if (already) { already.textContent = 'Retry email'; already.disabled = false; } }
    finally { sending = false; }
  }

  async function sendSmsDemo() {
    if (!current || sending) return;
    const { demo, customer } = current;
    const url = absoluteUrl(demo.url || `/demo/${encodeURIComponent(demo.slug || '')}`);
    if (currentRole() !== 'owner') return setStatus('Only the owner role can send through the current communications API.', true);
    if (!customer.phone || (customer.smsConsent !== true && customer.consentToSms !== true) || customer.smsOptOut === true || customer.doNotContact === true || customer.doNotCall === true) return setStatus('SMS is blocked until explicit consent is recorded and suppression/opt-out flags are clear.', true);
    if (!url) return setStatus('A valid absolute demo URL is required.', true);
    const body = `Hi ${customer.contactName || 'there'} — Successful By Choice created a website concept for ${customer.businessName || 'your business'}. Preview it here: ${url}. This is a concept preview; reply if you would like to review it.`;
    if (typeof confirm === 'function' && !confirm(`Send this demo by SMS to ${customer.phone}? Confirm the recipient requested or consented to this message.\n\n${url}`)) return;
    sending = true; const button = document.getElementById('v6526SmsDemo'); if (button) { button.disabled = true; button.textContent = 'Sending…'; }
    setStatus('Checking server-side SMS consent and sending through SBC/Twilio…');
    try {
      const result = await apiCall('/api/communications/sms', { method: 'POST', body: JSON.stringify({ customerId: customer.id, body }) });
      if (!result?.ok && !result?.sid) throw new Error(result?.error || 'The SMS provider did not confirm success.');
      setStatus(`SMS accepted by the configured provider for ${result.to || customer.phone}. SID: ${result.sid || 'recorded'}.`);
      if (button) { button.textContent = 'Text sent'; button.disabled = true; }
    } catch (error) { setStatus(error.message || 'SMS send failed.', true); if (button) { button.textContent = 'Retry text'; button.disabled = false; } }
    finally { sending = false; }
  }

  window.generateWebsiteDemo = async function (customerId) {
    const customer = getCustomer(customerId);
    if (!customer) { showToast('Customer record not found. Refresh Customer 360 and try again.'); return; }
    if (typeof state !== 'undefined' && state.data && (state.data.recoveryRequired || state.data.readOnly || state.data.mysqlRecoveryRequired)) { showToast('Demo generation is disabled while SBC is in recovery/read-only mode.'); return; }
    try {
      openModal('SBC Demo Studio', '<div class="v6526-studio-loading"><div class="v6526-spinner"></div><h3>Building the website concept…</h3><p>Preparing the industry-specific layout and preview link.</p></div>');
      const result = await apiCall('/api/website-demos', { method: 'POST', body: JSON.stringify({ customerId: customer.id, fast: true }) });
      if (!result?.demo) throw new Error('The server did not return a demo.');
      renderStudio(result.demo, customer);
      if (typeof window.reload11 === 'function') window.reload11().catch(() => {});
    } catch (error) {
      if (typeof openModal === 'function') openModal('SBC Demo Studio — Could not generate', `<div class="v6526-studio-error"><h3>Demo generation failed</h3><p>${esc(error.message || 'The demo could not be generated.')}</p><p>No email or SMS was sent.</p><button class="btn" onclick="closeModal()">Close</button></div>`);
    }
  };
  window.SBC_DEMO_STUDIO_V6526 = { marker: MARKER, open: window.generateWebsiteDemo };
})();

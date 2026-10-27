/* SBC V65.1.23 — isolated Lead Workspace; browser-side staging only. */
(function () {
  'use strict';
  if (window.__SBC_LEAD_WORKSPACE_V6519__) return;
  window.__SBC_LEAD_WORKSPACE_V6519__ = true;
  const state = { offset: 0, limit: 50, rows: [], staged: [], loading: false };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byId = id => document.getElementById(id);
  function mount() {
    if (byId('sbc-lead-workspace-launcher')) return;
    const button = document.createElement('button');
    button.id = 'sbc-lead-workspace-launcher';
    button.type = 'button';
    button.textContent = 'Lead Workspace';
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', open);
    document.body.appendChild(button);
    const modal = document.createElement('div');
    modal.id = 'sbc-lead-workspace';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'slw-title');
    modal.innerHTML = `
      <section class="slw-panel">
        <header class="slw-header"><div><h2 id="slw-title">SBC Lead Workspace</h2><div class="slw-subtitle">Rebuilt read-only CRM view · recovery-safe manual staging</div></div><button type="button" class="slw-close" id="slw-close">Close</button></header>
        <div class="slw-notice"><strong>Recovery protection active:</strong> existing records stay intact. Saving a new lead uses the guarded CRM endpoint; if recovery is locked, the lead stays in browser-session staging and can be exported. No recovery lock is bypassed.</div>
        <div class="slw-body">
          <section class="slw-card"><h3>Existing CRM records</h3>
            <div class="slw-tools"><input id="slw-search" type="search" placeholder="Filter this page by business, contact, email, phone" aria-label="Filter current page"><button id="slw-refresh" class="slw-btn" type="button">Refresh</button></div>
            <div class="slw-table-wrap"><table><thead><tr><th>Business</th><th>Contact</th><th>Email / Phone</th><th>Status</th></tr></thead><tbody id="slw-rows"><tr><td colspan="4" class="slw-empty">Open workspace to load records.</td></tr></tbody></table></div>
            <div class="slw-tools" style="margin-top:10px"><button id="slw-prev" class="slw-btn" type="button">Previous</button><span id="slw-page" class="slw-status">Page 1</span><button id="slw-next" class="slw-btn" type="button">Next</button></div>
            <div id="slw-list-status" class="slw-status" aria-live="polite"></div>
          </section>
          <section class="slw-card"><h3>Manual lead entry — guarded save / staging fallback</h3>
            <form id="slw-form" class="slw-form">
              <label class="slw-wide">Business name *<input name="businessName" required maxlength="180"></label>
              <label>Contact name<input name="contactName" maxlength="140"></label>
              <label>Industry<input name="industry" maxlength="100"></label>
              <label>Email<input name="email" type="email" maxlength="180"></label>
              <label>Phone<input name="phone" type="tel" maxlength="60"></label>
              <label class="slw-wide">Website<input name="website" type="url" maxlength="240" placeholder="https://"></label>
              <label class="slw-wide">Address<input name="address" maxlength="240"></label>
              <label class="slw-wide">Source / notes<input name="source" maxlength="240" placeholder="How was this lead sourced?"></label>
              <div class="slw-wide slw-actions"><button class="slw-btn slw-btn-primary" type="submit">Save Lead / Stage if Locked</button><button class="slw-btn" id="slw-export" type="button">Export Staged CSV</button><button class="slw-btn" id="slw-clear" type="button">Clear Staging</button></div>
            </form>
            <div id="slw-staged-status" class="slw-status" aria-live="polite">0 staged records. New leads save only when the server recovery guard permits writes.</div>
            <ol id="slw-staged-list" class="slw-staged-list"></ol>
          </section>
        </div>
      </section>`;
    document.body.appendChild(modal);
    byId('slw-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('is-open')) close(); });
    byId('slw-refresh').addEventListener('click', () => loadRows(true));
    byId('slw-prev').addEventListener('click', () => { state.offset = Math.max(0, state.offset - state.limit); loadRows(); });
    byId('slw-next').addEventListener('click', () => { if (state.rows.length === state.limit) { state.offset += state.limit; loadRows(); } });
    byId('slw-search').addEventListener('input', renderRows);
    byId('slw-form').addEventListener('submit', saveOrStageLead);
    byId('slw-export').addEventListener('click', exportCsv);
    byId('slw-clear').addEventListener('click', () => { state.staged = []; renderStaged(); });
  }
  function open() { const m = byId('sbc-lead-workspace'); if (!m) return; m.classList.add('is-open'); loadRows(true); byId('slw-search').focus(); }
  function close() { const m = byId('sbc-lead-workspace'); if (m) m.classList.remove('is-open'); }
  async function loadRows(reset) {
    if (state.loading) return;
    if (reset) state.offset = 0;
    state.loading = true;
    byId('slw-list-status').textContent = 'Loading read-only CRM records…';
    byId('slw-rows').innerHTML = '<tr><td colspan="4" class="slw-empty">Loading…</td></tr>';
    try {
      const r = await fetch(`/api/v6519/crm/leads?limit=${state.limit}&offset=${state.offset}`, { credentials: 'include', headers: { Accept: 'application/json' }, cache: 'no-store' });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.ok) throw new Error(body.error || `Request failed (${r.status})`);
      state.rows = Array.isArray(body.data) ? body.data : [];
      renderRows();
      byId('slw-page').textContent = `Page ${Math.floor(state.offset / state.limit) + 1} · ${state.rows.length} records`;
      byId('slw-prev').disabled = state.offset === 0;
      byId('slw-next').disabled = !body.hasMore;
      byId('slw-list-status').textContent = `Read-only mode · ${state.rows.length} records returned · database unchanged`;
    } catch (e) {
      state.rows = [];
      byId('slw-rows').innerHTML = `<tr><td colspan="4" class="slw-empty">${esc(e.message)}</td></tr>`;
      byId('slw-list-status').textContent = 'Unable to load existing records. No data was changed.';
    } finally { state.loading = false; }
  }
  function renderRows() {
    const q = String(byId('slw-search')?.value || '').trim().toLowerCase();
    const rows = state.rows.filter(r => [r.business_name, r.contact_name, r.email, r.phone, r.status].some(v => String(v || '').toLowerCase().includes(q)));
    byId('slw-rows').innerHTML = rows.length ? rows.map(r => `<tr><td><strong>${esc(r.business_name || 'Unnamed business')}</strong><div class="slw-muted">ID ${esc(r.id)}</div></td><td>${esc(r.contact_name || '—')}</td><td>${esc(r.email || '—')}<div class="slw-muted">${esc(r.phone || '—')}</div></td><td>${esc(r.status || 'Unspecified')}<button class="slw-btn" type="button" data-sbc-lead-edit-id="${esc(r.id)}">Edit</button></td></tr>`).join('') : '<tr><td colspan="4" class="slw-empty">No matching records on this page.</td></tr>';
  }
  async function saveOrStageLead(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    data.businessName = String(data.businessName || '').trim();
    if (!data.businessName) return;
    const duplicate = state.staged.some(x => x.businessName.toLowerCase() === data.businessName.toLowerCase() && String(x.phone||'') === String(data.phone||''));
    if (duplicate) { byId('slw-staged-status').textContent = 'Possible duplicate: same business name and phone already staged.'; return; }
    if (submit) submit.disabled = true;
    byId('slw-staged-status').textContent = 'Checking recovery gate and attempting a tenant-scoped CRM save…';
    try {
      const response = await fetch('/api/v65110/crm/leads', {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok && result.durable === true) {
        form.reset();
        byId('slw-staged-status').textContent = `Saved and verified in MySQL: ${result.id}.`;
        await loadRows(true);
        return;
      }
      if (response.status === 409 || result.code === 'DUPLICATE_LEAD') {
        byId('slw-staged-status').textContent = 'Possible existing lead detected. No duplicate was created; review the existing CRM records.';
        return;
      }
      data.stagedAt = new Date().toISOString();
      data.stageReason = result.code || `HTTP_${response.status}`;
      state.staged.push(data);
      form.reset();
      renderStaged();
      byId('slw-staged-status').textContent = response.status === 423 || result.code === 'MYSQL_RECOVERY_REQUIRED'
        ? 'Recovery lock is active. Lead retained in browser staging only; export it for safekeeping. No database change was made.'
        : `CRM save was not confirmed (${result.code || response.status}). Lead retained in browser staging only; export it before leaving this page.`;
    } catch (error) {
      data.stagedAt = new Date().toISOString();
      data.stageReason = 'NETWORK_OR_SESSION_ERROR';
      state.staged.push(data);
      form.reset();
      renderStaged();
      byId('slw-staged-status').textContent = 'Could not confirm a CRM save. Lead retained in browser staging only; export it before leaving this page.';
    } finally { if (submit) submit.disabled = false; }
  }
  function renderStaged() {
    byId('slw-staged-status').textContent = `${state.staged.length} staged record(s). Session-only fallback; export before closing this page.`;
    byId('slw-staged-list').innerHTML = state.staged.map(x => `<li>${esc(x.businessName)}${x.phone ? ` — ${esc(x.phone)}` : ''}</li>`).join('');
  }
  function exportCsv() {
    if (!state.staged.length) { byId('slw-staged-status').textContent = 'Nothing to export yet.'; return; }
    const fields = ['businessName','contactName','email','phone','website','industry','address','source','stagedAt'];
    const quote = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [fields.map(quote).join(','), ...state.staged.map(row => fields.map(k => quote(row[k])).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `SBC-lead-staging-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    byId('slw-staged-status').textContent = `Exported ${state.staged.length} staged record(s). The database remains unchanged.`;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();

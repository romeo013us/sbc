(function () {
  'use strict';
  // SBC_V6529_OPEN_READINESS: communicate Preview read-only status and disable actions.
  const ID = 'sbcV56240GrowthHardening';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(url, options = {}) {
    if (typeof window.api === 'function') return window.api(url, {...options, timeoutMs: options.timeoutMs || 20000});
    const response = await fetch(url, {credentials:'include', headers:{'Content-Type':'application/json','Accept':'application/json'}, ...options});
    const raw = await response.text(); let data = null; try { data = JSON.parse(raw); } catch {}
    if (!response.ok) throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
    if (!data) throw new Error(/<html|<!doctype/i.test(raw) ? 'The server returned a sign-in page. Sign in again and refresh.' : 'Growth endpoint returned invalid JSON.');
    return data;
  }
  async function load() {
    const root = document.getElementById(ID); if (!root) return;
    try {
      const data = await api('/api/v56240/growth/status');
      const locked = Boolean(data.recoveryRequired);
      const readOnlyPreview = Boolean(data.readOnly) && !locked;
      root.innerHTML = `<div class="head"><div><h3>Kim · Autonomous Growth Hardening</h3><div class="sub">20 operational upgrades around the Destination Autopilot · SBC OS V65.1.31.</div></div><button type="button" class="primary" id="v56240Run" ${locked || readOnlyPreview ? 'disabled title="Read-only runtime"' : ''}>${locked ? 'Recovery Lock Active' : readOnlyPreview ? 'Preview Is Read-Only' : 'Run Growth Cycle'}</button></div>${locked ? '<div class="install-tip"><strong>RECOVERY LOCK ACTIVE.</strong> Growth staging, schema creation, queue writes, and background cycles are suspended. No growth data will be written until authoritative MySQL recovery is verified.</div>' : readOnlyPreview ? '<div class="install-tip"><strong>READ-ONLY PREVIEW.</strong> Existing growth data may be viewed, but this runtime cannot create tables, save settings, or run growth cycles. Use the Published writer runtime for approved changes.</div>' : ''}<div class="grid"><div class="kpi"><span>GBP gaps</span><strong>${data.gapSweep?.count == null ? 'Unavailable' : Number(data.gapSweep.count)}</strong></div><div class="kpi"><span>Usage alerts</span><strong>${data.usageAlerts?.alerts == null ? 'Unavailable' : data.usageAlerts.alerts.length}</strong></div><div class="kpi"><span>Recovery tasks</span><strong>${data.dunning?.recoveryTasks == null ? 'Unavailable' : Number(data.dunning.recoveryTasks)}</strong></div><div class="kpi"><span>Tracked costs</span><strong>${data.profit?.trackedCosts == null ? 'Not queried during recovery' : '$' + Number(data.profit.trackedCosts).toFixed(2)}</strong></div></div><div id="v56240RunMessage" class="sub" role="status"></div>`;
      const button = document.getElementById('v56240Run');
      button?.addEventListener('click', async event => {
        const b = event.currentTarget, status = document.getElementById('v56240RunMessage');
        if (data.recoveryRequired || data.readOnly) { if (status) status.textContent = data.recoveryRequired ? 'Recovery lock active. No growth cycle was started.' : 'Preview is read-only. No growth cycle was started.'; return; }
        b.disabled = true; b.textContent = 'Running…';
        try { const result = await api('/api/v56240/growth/run', {method:'POST', body:JSON.stringify({})}); if (status) status.textContent = result?.message || 'Growth cycle completed. Review its returned status.'; await load(); }
        catch (error) { if (status) status.textContent = error?.message || String(error); b.disabled = false; b.textContent = 'Run Growth Cycle'; }
      });
    } catch (error) {
      root.innerHTML = `<div class="head"><div><h3>Kim · Autonomous Growth Hardening</h3><div class="sub">Growth status is temporarily unavailable.</div></div><button type="button" id="v56240Retry">Retry</button></div><div class="install-tip" role="status">${esc(error?.message || error)}</div>`;
      document.getElementById('v56240Retry')?.addEventListener('click', load);
    }
  }
  function mount() { if (document.getElementById(ID)) return; const content = document.getElementById('content'); if (!content) return; const el = document.createElement('section'); el.id = ID; el.className = 'sbc-v56240-hardening'; content.appendChild(el); load(); }
  window.sbcV56240GrowthRefresh = load;
  window.addEventListener('DOMContentLoaded', mount);
  const observer = new MutationObserver(mount); observer.observe(document.documentElement, {childList:true, subtree:true});
})();

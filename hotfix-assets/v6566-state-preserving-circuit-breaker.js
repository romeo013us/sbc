(function () {
  'use strict';
  const MARKER = 'SBC_V6566_STATE_PRESERVING_CIRCUIT_BREAKER';
  if (window.__SBC_V6566_CIRCUIT_BREAKER__) return;
  window.__SBC_V6566_CIRCUIT_BREAKER__ = true;
  const CORE = ['/api/me', '/api/agent-os/status'];
  const threshold = 2;
  const recoveryMs = 30000;
  let consecutiveFailures = 0;
  let openedAt = 0;
  let lastProbe = 0;
  let overlay = null;
  let previousFetch = window.fetch.bind(window);

  function coreRequest(input) {
    let raw = typeof input === 'string' ? input : (input && input.url) || '';
    try { raw = new URL(raw, window.location.href).pathname; } catch (_) {}
    return CORE.some(path => raw === path || raw.startsWith(path + '?'));
  }
  function showStandby() {
    if (!document.body || overlay) return;
    overlay = document.getElementById('sbc-v6566-standby');
    if (overlay) return;
    overlay = document.createElement('section');
    overlay.id = 'sbc-v6566-standby';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.cssText = 'position:fixed;inset:16px 16px auto auto;z-index:2147483000;max-width:440px;padding:16px 18px;background:#101820;color:#f4f7fb;border:1px solid #38bdf8;border-left:4px solid #f59e0b;border-radius:12px;box-shadow:0 16px 48px #0008;font:14px/1.5 system-ui,sans-serif';
    const title = document.createElement('strong');
    title.textContent = 'SBC STANDBY_GUARDED';
    title.style.cssText = 'display:block;color:#7dd3fc;font-size:15px;margin-bottom:6px';
    const detail = document.createElement('p');
    detail.textContent = 'Core session services are temporarily unavailable. Your current screen is preserved. Background API refreshes are paused; no records or business actions were changed.';
    detail.style.margin = '0';
    const status = document.createElement('p');
    status.id = 'sbc-v6566-standby-detail';
    status.textContent = 'Retrying a read-only health check in 30 seconds.';
    status.style.cssText = 'margin:8px 0 0;color:#cbd5e1;font-size:12px';
    overlay.append(title, detail, status);
    document.body.appendChild(overlay);
  }
  function closeStandby() {
    const node = document.getElementById('sbc-v6566-standby');
    if (node && node.parentNode) node.parentNode.removeChild(node);
    overlay = null;
    consecutiveFailures = 0;
    openedAt = 0;
  }
  window.fetch = async function (input, init) {
    const isCore = coreRequest(input);
    const now = Date.now();
    if (openedAt && isCore) {
      if (now - lastProbe < recoveryMs) {
        return new Response(JSON.stringify({ok:false,degraded:true,code:'SBC_STANDBY_GUARDED',readOnly:true}), {status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
      }
      lastProbe = now;
    }
    let response;
    try { response = await previousFetch(input, init); }
    catch (error) {
      if (isCore) {
        consecutiveFailures++;
        if (consecutiveFailures >= threshold) { openedAt = Date.now(); showStandby(); }
      }
      throw error;
    }
    if (isCore && response.status === 503) {
      consecutiveFailures++;
      if (consecutiveFailures >= threshold) { openedAt = Date.now(); showStandby(); }
    } else if (isCore && response.ok) {
      consecutiveFailures = 0;
      if (openedAt) closeStandby();
    } else if (isCore) {
      consecutiveFailures = 0;
    }
    return response;
  };
  window.addEventListener('online', function () {
    if (openedAt) lastProbe = 0;
  });
})();
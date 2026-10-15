(() => {
  'use strict';
  const KEY = 'sbc.askKim.panel.position.v6544';
  const STYLE_ID = 'sbc-ask-kim-drag-style-v6544';
  const HANDLE_ID = 'sbc-ask-kim-drag-handle-v6544';
  const isVisible = el => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  };
  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${HANDLE_ID}{display:flex;align-items:center;gap:9px;min-height:30px;padding:7px 10px;box-sizing:border-box;
        color:#eaf2ff;background:linear-gradient(110deg,rgba(17,28,50,.98),rgba(26,43,72,.96));
        border:1px solid rgba(255,255,255,.16);border-radius:10px 10px 0 0;cursor:grab;user-select:none;
        touch-action:none;font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;
        box-shadow:0 4px 16px rgba(0,0,0,.18);position:relative;z-index:2147483000}
      #${HANDLE_ID}:active{cursor:grabbing}
      #${HANDLE_ID} .sbc-kim-drag-grip{font-size:16px;line-height:1;color:#f28a19}
      #${HANDLE_ID} .sbc-kim-drag-hint{margin-left:auto;font-size:9px;font-weight:600;letter-spacing:.04em;color:#b8c6dc}
      .sbc-kim-draggable-panel{box-sizing:border-box}
      @media(max-width:600px){.sbc-kim-draggable-panel{max-width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important}}
    `;
    document.head.appendChild(style);
  }
  function loadPosition() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  }
  function savePosition(left, top) {
    try { localStorage.setItem(KEY, JSON.stringify({ left, top })); } catch {}
  }
  function findPanel() {
    const candidates = Array.from(document.querySelectorAll('body *')).filter(el => {
      if (!isVisible(el)) return false;
      const text = (el.innerText || el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (!text || !(text.includes('ask kim') || /^kim(\s|$)/.test(text))) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 260 && r.height >= 180 && r.width < window.innerWidth * 0.98 && r.height < window.innerHeight * 0.98;
    });
    const ranked = [];
    for (const el of candidates) {
      let node = el;
      for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
        if (node === document.body || node === document.documentElement) break;
        const r = node.getBoundingClientRect();
        const s = getComputedStyle(node);
        if (r.width < 260 || r.height < 180 || r.width > window.innerWidth * .99 || r.height > window.innerHeight * .99) continue;
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        if (s.position === 'fixed' || s.position === 'absolute' || /kim|chat|assistant|copilot/i.test(String(node.className || '') + ' ' + String(node.id || ''))) {
          const area = r.width * r.height;
          ranked.push({ node, area, depth, fixed: s.position === 'fixed' ? 1 : 0 });
          break;
        }
      }
    }
    ranked.sort((a, b) => (b.fixed - a.fixed) || (a.area - b.area) || (a.depth - b.depth));
    return ranked[0]?.node || null;
  }
  function attach(panel) {
    if (!panel || panel.dataset.sbcKimDragReady === '1' || panel.querySelector('#' + HANDLE_ID)) return;
    installStyle();
    panel.dataset.sbcKimDragReady = '1';
    panel.classList.add('sbc-kim-draggable-panel');
    panel.style.setProperty('z-index', '2147482999', 'important');
    panel.style.setProperty('max-width', 'calc(100vw - 16px)', 'important');
    panel.style.setProperty('max-height', 'calc(100dvh - 16px)', 'important');
    panel.style.setProperty('overflow', 'auto', 'important');

    const handle = document.createElement('div');
    handle.id = HANDLE_ID;
    handle.setAttribute('role', 'button');
    handle.setAttribute('tabindex', '0');
    handle.setAttribute('aria-label', 'Drag to move Ask Kim');
    handle.innerHTML = '<span class="sbc-kim-drag-grip" aria-hidden="true">⠿</span><span>ASK KIM</span><span class="sbc-kim-drag-hint">DRAG TO MOVE</span>';
    panel.insertBefore(handle, panel.firstChild);

    const saved = loadPosition();
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      panel.style.setProperty('position', 'fixed', 'important');
      panel.style.setProperty('left', Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, saved.left)) + 'px', 'important');
      panel.style.setProperty('top', Math.max(8, Math.min(window.innerHeight - 80, saved.top)) + 'px', 'important');
      panel.style.setProperty('right', 'auto', 'important');
      panel.style.setProperty('bottom', 'auto', 'important');
      panel.style.setProperty('transform', 'none', 'important');
    }

    let drag = null;
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      const rect = panel.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
      panel.style.setProperty('position', 'fixed', 'important');
      panel.style.setProperty('left', rect.left + 'px', 'important');
      panel.style.setProperty('top', rect.top + 'px', 'important');
      panel.style.setProperty('right', 'auto', 'important');
      panel.style.setProperty('bottom', 'auto', 'important');
      panel.style.setProperty('transform', 'none', 'important');
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
      if (!drag) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      const maxLeft = Math.max(8, window.innerWidth - panel.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - Math.min(panel.offsetHeight, window.innerHeight) - 8);
      const left = Math.max(8, Math.min(maxLeft, drag.left + dx));
      const top = Math.max(8, Math.min(maxTop, drag.top + dy));
      panel.style.setProperty('left', left + 'px', 'important');
      panel.style.setProperty('top', top + 'px', 'important');
      if (drag.moved) savePosition(left, top);
    });
    const endDrag = () => { drag = null; };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('keydown', event => {
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const r = panel.getBoundingClientRect();
      const step = event.shiftKey ? 30 : 10;
      const left = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, r.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0)));
      const top = Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, r.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0)));
      panel.style.setProperty('position', 'fixed', 'important');
      panel.style.setProperty('left', left + 'px', 'important');
      panel.style.setProperty('top', top + 'px', 'important');
      panel.style.setProperty('right', 'auto', 'important');
      panel.style.setProperty('bottom', 'auto', 'important');
      panel.style.setProperty('transform', 'none', 'important');
      savePosition(left, top);
    });
  }
  function scan() {
    const panel = findPanel();
    if (panel) attach(panel);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once: true });
  else scan();
  const observer = new MutationObserver(() => scan());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', () => {
    const panel = document.querySelector('.sbc-kim-draggable-panel');
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, r.left));
    const top = Math.max(8, Math.min(window.innerHeight - panel.offsetHeight - 8, r.top));
    panel.style.setProperty('left', left + 'px', 'important');
    panel.style.setProperty('top', top + 'px', 'important');
    savePosition(left, top);
  });
})();
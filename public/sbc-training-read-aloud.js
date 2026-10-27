/*
 * SBC Training Read Aloud — V55.12.4
 * Isolated, client-only enhancement for the canonical Training Lesson view.
 * No API calls, no database writes, no router hooks, no Training-state mutations.
 */
(() => {
  'use strict';

  const ROOT_SELECTOR = '.academy9-lessonview';
  const TOOLBAR_CLASS = 'sbc-training-read-aloud';
  const state = {
    utterance: null,
    speaking: false,
    paused: false,
    boundRoot: null
  };

  const supported = () =>
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function';

  const stop = () => {
    if (!supported()) return;
    try { window.speechSynthesis.cancel(); } catch (_) {}
    state.utterance = null;
    state.speaking = false;
    state.paused = false;
    updateControls();
  };

  const getLessonText = (root) => {
    const copy = root.cloneNode(true);
    copy.querySelectorAll(`.${TOOLBAR_CLASS}, .actions, button, textarea, input`).forEach(el => el.remove());

    const parts = [];
    copy.querySelectorAll('h2,h3,h4,p,li,pre,strong,.mini').forEach(el => {
      const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
    });

    return [...new Set(parts)].join('. ').replace(/\. \./g, '.').trim();
  };

  const updateControls = () => {
    const toolbar = document.querySelector(`.${TOOLBAR_CLASS}`);
    if (!toolbar) return;

    const play = toolbar.querySelector('[data-sbc-ral-play]');
    const pause = toolbar.querySelector('[data-sbc-ral-pause]');
    const stopButton = toolbar.querySelector('[data-sbc-ral-stop]');
    const status = toolbar.querySelector('[data-sbc-ral-status]');

    if (play) {
      play.textContent = state.paused ? '▶ Resume' : '▶ Play';
      play.disabled = state.speaking && !state.paused;
    }
    if (pause) pause.disabled = !state.speaking || state.paused;
    if (stopButton) stopButton.disabled = !state.speaking && !state.paused;
    if (status) {
      status.textContent = state.paused ? 'Paused' : state.speaking ? 'Reading aloud…' : supported() ? 'Voice ready' : 'Voice unavailable';
    }
  };

  const play = (root) => {
    if (!supported()) {
      updateControls();
      return;
    }

    if (state.paused && state.speaking) {
      try { window.speechSynthesis.resume(); } catch (_) {}
      state.paused = false;
      updateControls();
      return;
    }

    stop();

    const text = getLessonText(root);
    if (!text) return;

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const preferred = window.speechSynthesis.getVoices?.() || [];
    const english = preferred.find(v => /^en(-|_)/i.test(v.lang));
    if (english) utterance.voice = english;

    utterance.onstart = () => {
      state.utterance = utterance;
      state.speaking = true;
      state.paused = false;
      updateControls();
    };
    utterance.onend = () => {
      if (state.utterance !== utterance) return;
      state.utterance = null;
      state.speaking = false;
      state.paused = false;
      updateControls();
    };
    utterance.onerror = () => {
      if (state.utterance !== utterance) return;
      state.utterance = null;
      state.speaking = false;
      state.paused = false;
      updateControls();
    };

    state.utterance = utterance;
    state.speaking = true;
    state.paused = false;
    try {
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      state.utterance = null;
      state.speaking = false;
      state.paused = false;
    }
    updateControls();
  };

  const pause = () => {
    if (!supported() || !state.speaking) return;
    try { window.speechSynthesis.pause(); } catch (_) {}
    state.paused = true;
    updateControls();
  };

  const install = (root) => {
    if (!root || root.querySelector(`.${TOOLBAR_CLASS}`)) return;

    const toolbar = document.createElement('div');
    toolbar.className = TOOLBAR_CLASS;
    toolbar.setAttribute('role', 'region');
    toolbar.setAttribute('aria-label', 'Training lesson read aloud controls');
    toolbar.innerHTML = `
      <div class="sbc-training-read-aloud-copy">
        <strong>🔊 Read Aloud</strong>
        <span data-sbc-ral-status>${supported() ? 'Voice ready' : 'Voice unavailable in this browser'}</span>
      </div>
      <div class="sbc-training-read-aloud-actions">
        <button type="button" class="btn primary" data-sbc-ral-play ${supported() ? '' : 'disabled'}>▶ Play</button>
        <button type="button" class="btn" data-sbc-ral-pause disabled>⏸ Pause</button>
        <button type="button" class="btn" data-sbc-ral-stop disabled>⏹ Stop</button>
      </div>`;

    const actions = root.querySelector('.actions');
    if (actions?.parentNode) actions.parentNode.insertBefore(toolbar, actions.nextSibling);
    else root.prepend(toolbar);

    toolbar.querySelector('[data-sbc-ral-play]')?.addEventListener('click', () => play(root));
    toolbar.querySelector('[data-sbc-ral-pause]')?.addEventListener('click', pause);
    toolbar.querySelector('[data-sbc-ral-stop]')?.addEventListener('click', stop);

    state.boundRoot = root;
    updateControls();
  };

  const scan = () => {
    const root = document.querySelector(ROOT_SELECTOR);
    if (root) {
      if (state.boundRoot && state.boundRoot !== root) stop();
      install(root);
    } else if (state.boundRoot) {
      stop();
      state.boundRoot = null;
    }
  };

  const init = () => {
    scan();
    const content = document.getElementById('content') || document.body;
    new MutationObserver(scan).observe(content, { childList: true, subtree: true });
    window.addEventListener('beforeunload', stop, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.speaking && !state.paused && supported()) {
        try { window.speechSynthesis.pause(); } catch (_) {}
        state.paused = true;
        updateControls();
      }
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

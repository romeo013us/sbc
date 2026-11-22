# Academy 360 V66.167 — real-screen-video readiness

This extends V66.166 without changing the role gate, certification rubric, payroll, eight-hour training budget, customer records or Square systems.

**Added:** a verified same-origin English/Spanish video player with optional WebVTT captions (falls back to the existing illustrated narration unless a video file actually exists); a local-first, microphone-capable browser screen recorder with lesson-specific shot lists for all 12 modules, WebM downloads, human-review-required VTT draft export, and a link from the Owner review desk. Both browser_public and public roots are updated together. No media is marked watched/completed as a substitute for scored tests.

**Real footage not included.** Sign into the real account_manager **test login** in a separate private browser window, open `/sbc-am-academy-recorder.html`, show the true Account Manager workstation with **only fictional test records**, record and narrate 60–90-second EN and ES videos, review and export. Remove or mask passwords, actual leads, customer names, phone numbers, payments and other secrets. Verify captions and timings. Upload reviewed `am-01-en.webm` + `am-01-en.vtt` (and other module/lang pairs) to `public/academy-media/academy360/` as part of an approved complete release. No recording or deployment occurs automatically.

**Validation:** `node --test test/sbc-academy360-media.test.cjs`, `npm run test:academy360`, `npm run test:academy360:ui`, release artifact checks. Hosted Preview acceptance must verify videos/captions EN+ES, 375px layout, live gate, owner revocation, two-shift limit, restart and backup restoration. The recorded media assets and hosted acceptance remain outstanding. Never call this production-certified on source tests alone.

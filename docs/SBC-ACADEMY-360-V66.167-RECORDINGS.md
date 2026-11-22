# Academy 360 V66.171 — bilingual multimedia release and hosted acceptance

Status: **source media generated and verified**, not automatically GoDaddy Preview/Published certified.

## What's included on a-sbc-master

- Twelve Account Manager lessons, 24 EN/ES **synthetic-data interface-demonstration videos** with 24 separate narrated audio tracks, 96 interface screenshots and 24 VTT caption files. Media is mirrored in `public/academy-media/academy360/` and `browser_public/academy-media/academy360/`.
- `AUTO_GENERATED_MANIFEST.json`: `version: 66.171`, `narrationEngine: Piper offline neural EN-US lessac-medium, ES-MX ald-medium`, 24 lessons, 168 media files, `syntheticOnly: true`, `authenticatedEmployeeRecording: false`. All published videos are **automated, fictional-data demonstrations**; do **not** describe them as continuous recordings of a logged-in employee or real customers.
- Learner player: switch Video, Audio, Photos; play/pause, seek, speed, captions when valid, fullscreen, zoomed screenshots and illustrated reading fallback. The selected browser speech voice can also be previewed and changed for the illustrated scenes; that does not change the prerecorded MP4 soundtrack.
- Learner roadmap explains the order: watch/review → structured work sample (server-scored 90%+ without critical errors) → written roleplay submission (owner review, **not** auto-scored) → three-question knowledge check (server-scored, requires all correct at the 90% minimum) → next lesson; actual course completion also requires recorded server evidence.
- Training budget: 480 paid minutes, two shifts as the standard allowance with owner-governed exceptions. Owner preview cannot submit an employee's scores; Account Managers must have their own actual `account_manager` login, active official training clock and non-recovery writer access.
- Command Center → Training & Academy 360 (owner) links to the Owner Review Desk and learner preview. Dedicated Account Manager workstation sidebar → My Training · Academy 360. Legacy caller account/workstation remains separate; no automatic elevation or clearance bypass. Owner certification, bilingual observed capstone and revocation remain independent.

## Evidence

- [Automatic bilingual neural media workflow, passed](https://github.com/romeo013us/sbc/actions/runs/45083253554).
- [Academy training UI and backend tests, passed](https://github.com/romeo013us/sbc/actions/runs/45083253451).
- [Revenue/reliability audit, passed](https://github.com/romeo013us/sbc/actions/runs/45083253458).
- Source is not deployment proof. The media-generating bot commit was `baf3fbce92a271ca4d58becafca3cb50828995d4`; run a fresh staged-archive build from that commit or newer before any GoDaddy upload. Check archive identity `academyRelease: 66.171`, SHA-matched media, and candidate receipts.

## Release acceptance — no live production mutations during preparation

1. Produce an immutable, reproducible candidate GoDaddy ZIP after the neural-media commit. Verify the ZIP file inventory and digest, complete media presence and app entrypoint. Never combine two older packages.
2. Update **GoDaddy Preview only** from the verified commit, compare the actual hosted Git identity and asset manifest with the candidate, and confirm the correct `Content-Type` for MP4, WebM, VTT and WebP. Require proper 404 rather than HTML fallback for missing assets.
3. Use the authorized **test account_manager login**, not the `caller` role or owner's perspective, in a private browser session. Inspect all 12 lessons, EN/ES audio intelligibility, captions and scrubbing in Chrome/Edge plus representative Android/iOS widths. Verify step guide and official score blockers.
4. **Do not perform training score writes against a Preview instance sharing Published MySQL.** For scored quiz/work-sample submissions, capstone, owner certification/revocation, timekeeping and persistence restore, use a separately isolated staging DB and authorized writer lease; otherwise perform read-only checks and preserve the single-writer policy.
5. Owner approves the bilingual training quality, certified-employee controls and rollback. Then—and only then—Publish to Live and verify the live receipt and media in an authenticated Account Manager session.

Tracked by [issue #438](https://github.com/romeo013us/sbc/issues/438). Source CI green is **not** the same as hosted certification or production deployment.

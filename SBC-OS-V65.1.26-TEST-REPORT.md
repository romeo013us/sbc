# SBC OS V65.1.26 — Build & Test Report

**Release:** Premium Demo Studio  
**Build status:** PASS locally  
**GoDaddy deployment status:** Not deployed by this build  
**Live email/SMS status:** Not tested by this build

## Features covered
- Demo Studio replaces the basic generated-demo result modal.
- Desktop and mobile viewport preview.
- Copy demo URL and open full preview.
- Generate design variations using the existing `/api/website-demos` endpoint; selected design direction is persisted and prioritized by the renderer.
- SBC concept-preview ribbon added to generated website HTML.
- Email demo via existing owner-authorized communications endpoint.
- SMS demo requires consent flags in the UI and remains subject to the server's existing consent/suppression gate.
- Existing payment, order, fulfillment, tenant-isolation, recovery and single-writer controls are preserved.

## Tests run
1. Root release `npm run test:all` — PASS.
2. `node bootstrap.js --verify` — PASS; verified the patched source archive and V65.1.26 release identity.
3. Independently extracted source and applied all five hotfix layers — PASS.
4. Full patched source `npm run test:all` — PASS, exit code 0.
5. Preview DDL regression — PASS for pool queries and leased MySQL connections; DDL is rejected before execution in read-only mode.
6. SQL classification regression — PASS for read-only SELECT CTEs, data-changing UPDATE/DELETE CTEs, and DDL detection.
7. Owner tenant and recovery-gate regressions — PASS; the generated owner gets explicit tenant scope, and email/SMS/demo-generation routes are patched to fail closed during recovery/read-only operation.
8. Renderer smoke test — PASS; editorial, tactile, minimal, and professional directions generated four distinct HTML outputs.
9. JavaScript syntax checks — PASS for patched `server.js`, site design engine, and release patchers.
10. ZIP integrity check — PASS after final packaging (`unzip -t`; no compressed-data errors).

## Not proven locally
- No live GoDaddy Published or Preview browser session was used.
- No real email or SMS was sent.
- No Square checkout, payment, order, or fulfillment action was triggered.
- No live MySQL data was modified and no SQL was imported.

## Deployment notes
Upload the release ZIP using GoDaddy's application deployment flow. Do not import the ZIP or any SQL through phpMyAdmin. Preserve Published `SBC_RUNTIME_ROLE=writer` and Preview `SBC_RUNTIME_ROLE=readonly`. After deployment, confirm V65.1.26 in the UI and startup logs, then test preview generation with a safe test/demo customer before attempting customer delivery.

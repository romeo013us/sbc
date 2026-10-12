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
4. Full patched source `npm run test:all` — PASS, exit code 0; legacy release-identity assertions were aligned to the active release version, and the recovery/session regression now asserts the current fail-closed behavior rather than an obsolete function comment.
5. JavaScript syntax checks: `server.js`, Demo Studio module, `public/app.js`, `public/v32-2-upgrade.js` — PASS.
6. Independent website renderer test: complete HTML, personalized headline, escaped business name, services/contact sections — PASS.
7. ZIP integrity check — PASS (`unzip -t`; no compressed-data errors).

## Not proven locally
- No live GoDaddy Published or Preview browser session was used.
- No real email or SMS was sent.
- No Square checkout, payment, order, or fulfillment action was triggered.
- No live MySQL data was modified and no SQL was imported.

## Deployment notes
Upload the release ZIP using GoDaddy's application deployment flow. Do not import the ZIP or any SQL through phpMyAdmin. Preserve Published `SBC_RUNTIME_ROLE=writer` and Preview `SBC_RUNTIME_ROLE=readonly`. After deployment, confirm V65.1.26 in the UI and startup logs, then test preview generation with a safe test/demo customer before attempting customer delivery.

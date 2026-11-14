# SBC Website Studio V4 — GoDaddy deployment & acceptance gate

**Release branch:** `a-sbc-master` (not `main`). **Status:** source-only candidate; NOT a Published approval.

## 1. Before changing Preview
1. Read the GoDaddy app ID `tyvrqnjz57`, Source branch, selected Preview/Published variant, latest Published Git commit and health. Screenshot/save the metadata, runtime error logs and release receipt so the preceding working version is recoverable.
2. Verify current GoDaddy Published site is healthy. A green `/healthz` cannot prove checkout, tenant isolation, or accurate billing.
3. Confirm **recoverable MySQL backup**: owner-verified encrypted dump/snapshot, timestamp, correct production database, retention and test restoration **into a separate disposable database**. Do not restore into production. GoDaddy's platform docs explicitly say Preview and Published share one database.
4. Determine migration/startup policy before preview update: if the new release could execute DDL, migrations, scheduled jobs or tenant-wide writes automatically, first isolate those operations or do not deploy.
5. Confirm a source rollback path and Git SHA. Rolling back files alone will not roll back mutated DB state.
6. OpenAI provider organization cap `$25/month` is owner-confirmed **enforced**; check app-side runtime `aiSpend.dailyCapUsd<=0.75`, `monthlyCapUsd<=25` and `providerHardCapConfirmed` in a read-only status route. An earlier Published status still displayed `$50/day`; do not approve while that persists.

## 2. Safe Preview checks
- Use the existing GoDaddy Preview app variant and review **read-only** health, logs, revision receipts and the expected app source SHA (the GitHub packaging commit is not necessarily the compiled source SHA).
- Review existing non-mutating site samples. Before/after widget only renders when both business-provided photos are distinct, from a supported HTTPS image CDN, with owner rights + same-real-project attestation and descriptive alternative text.
- Brand Kit colors must be approved six-digit hex values, each maintaining >=4.5:1 contrast against white text; invalid colors must be rejected by Studio.
- Inspect responsive desktop (>=1280px), tablet (~820px), mobile (~390px), keyboard range slider, focus outlines, no horizontal scroll, no broken images, no console errors, and no remote script/AI call.
- **DO NOT** use the production-connected Preview for visual-editor PATCH, revision restore, checkout, recurring billing, lead import, SMS, real emails or migrations. These write to the shared MySQL database. Use isolated local/disposable staging data for that acceptance suite.

## 3. Separate isolated integration checks
- Owner-only visual PATCH/restore has correct tenant isolation, optimistic version control and no cross-account or Published-site mutation.
- Comparison media URL allowlist and rights attestation must remain enforced on GET preview, versioned SAVE and RESTORE. Revoking rights must remove the comparison from the output.
- Test arbitrary CSS/HTML injection attempts, malformed/oversized image URLs, and inaccessible images. No invented review, credential, pricing or real-work claims.
- If actual customer photos come from Cloudinary, verify the owner has rights/consent and link stability for each specific project. A valid URL is not proof of rights.
- Quote estimates, uploads, customer login, and any OpenAI-enabled copy still have independent readiness gates; do not claim V4 completes those.

## 4. Publish gate
**Publish only after:** (a) verified tested DB restore, (b) Preview source identity matches approved `a-sbc-master` release receipt, (c) build/tenant/UI regressions pass, (d) app-side spend cap is correct, (e) browser QA reviewed, (f) explicit owner approval of promotion. Record the new Published Git commit and run smoke tests without charging or messaging a customer.

**Abort/rollback if:** missing backup, source identity mismatch, database write/DDL risk, wrong spend limit, broken tenant controls, malformed project claims, failed visual QA, or post-deploy HTTP error.

## 5. Remaining V4 deliverables
The first code increment provides approved palette overrides and actual-project comparison in private Studio. The requested full-page copy editing, logo upload/extraction, verified price-book estimator, protected lead forms, client editor role, 50 fully vetted photos and AI polish need separate tests and integration. Do not grade the entire suite 9.5 until they are verified.

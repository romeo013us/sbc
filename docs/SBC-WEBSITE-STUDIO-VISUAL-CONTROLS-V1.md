# SBC Website Studio — Visual Controls v1 (development only)

## What this adds
- In the owner-only Website Production modal, a **Visual Studio** form now controls the art-directed private website hero headline, description, and spacing density (original, airy, compact).
- Optional image URL accepted only from tightly validated direct `images.unsplash.com` or `images.pexels.com` HTTPS photo URLs, with required alt text and owner-confirmed usage rights. It does **not** obtain, upload, license, or verify photo rights. Browser fetching a remote image contacts the image provider.
- Changes are durable, versioned, audited with editor ID/timestamp and saved on the tenant-scoped website record. Optimistic concurrency and the existing single writer queue prevent stale overwrite.
- Saving a design refreshes the authenticated private art-directed preview without changing a publicly approved site. Existing Classic editor, Account 360, owner authorizations and fulfillment rules remain unchanged.
- All preview copy and photo URLs are sanitized/escaped. Browser preview remains sandboxed, non-indexable and cannot submit forms or make CRM purchases.

## API
`GET /api/website-production/sites/:id/studio/visual` returns owner-only visual settings and revision.
`PATCH /api/website-production/sites/:id/studio/visual` accepts
`{expectedVersion,visual:{headline,subheadline,density,photoUrl,photoAlt,rightsConfirmed}}`
for Draft/Pending only. Requires authenticated owner, correct tenant and writable published process. Owner approval of business facts is **separate**.

## Verification
Focused Node tests include security, media source control, owner/tenant gating, stale edits, writer lock, preview safety, and synchronized frontend files. The local isolated website suite passed 37 tests. Full Command Center tests need dependencies and GitHub CI, and desktop/mobile browser visual QA is still required.

## Not yet built
- True drag-and-drop component layout editor, photo uploads, in-product image catalog/license evidence, rich content/page editor, approved copy workflow, real CRM inquiry endpoint, working appointment booking, or rollback-capable domain publisher.
- No automatic launch, public approval, Lighthouse 95+, or honest 9.5/10 certification can be claimed from the focused tests.
- Existing staged build receipts apply to the previous release, not this development change.

## Release gate
Keep PR #369 in draft until all latest commit workflows pass, staging browser tests at 1440 and 390 px pass, visual media and licensing workflow is audited, and owner approves deployment. Do not overwrite the live Command Center with this source ZIP directly.
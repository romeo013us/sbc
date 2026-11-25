# SBC Creative Engine — offline candidate V1

This module stages branded PNG candidates only. It never publishes, modifies MySQL, launches timers, or changes the externally owned SBC channel guard. Existing social automations retain 10 AM and 10 PM Eastern.

## Local review
Node 22, free librsvg CLI (rsvg-convert; override with SBC_SVG_RENDERER), ImageMagick CLI (convert; override with SBC_IMAGE_RENDERER), and DejaVu Sans fonts are required. No paid API, image stock, or new production npm dependency. Do not install on GoDaddy or enable a new publisher without hosted acceptance.

```sh
node --test test/sbc-social-asset-engine.test.cjs
node scripts/sbc-social-assets.cjs generate /private/sbc-artwork YYYY-MM-DD
node scripts/sbc-social-assets.cjs inventory /private/sbc-artwork
node scripts/sbc-social-assets.cjs approve /private/sbc-artwork REVIEWED_SHA256
```

Use a private operator-owned directory outside the checkout. The manifest and content-addressed PNGs survive process restarts; use a single filesystem writer. A stale lock requires operator review, never automatic unsafe unlock. The approval command is a local review marker, not an authenticated Command Center approval. An authorized owner must review the actual artwork. A CI artifact is a draft review inventory, not approved or posted content.

The 14 slots span seven local dates at 10:00 and 22:00 with DST handling. Exact SHA-256 and 64-bit dHash are checked against supplied history and generated candidates. A shortage fails closed. The renderer embeds the repository logo. Retry policy handles explicitly confirmed rejection; ambiguous sends require reconciliation, never blind retries.

## Remaining integration / production gates
- Verify actual rendered images, contrast, logo and six-service variety; validate renderer availability on target hosting.
- Connect authenticated owner approval and durable MySQL inventory/slot ledger; import real historical provider artwork fingerprints; replenish only missing future slots and decrement only on confirmed use. Local manifest is not the production ledger.
- Existing externally authorized publisher consumes approved artwork, validates hash, and atomically claims tenant/channel/date/slot; attach real media. Keep SBC self-publish guard.
- Require verified provider readback that binds channel, post, scheduled slot and artwork; persist receipts; distinguish confirmed rejections from uncertain outcomes. Integrate backoff and owner alert at fewer than six usable approved creatives.
- Browser Marketing Hub inventory and receipt readback; actual four-channel authorized acceptance. No live publishing from tests, no fake post IDs, no new spend.

## Durable inventory and portable import candidate

The manual SQL migration `migrations/20261125_001_sbc_creative_inventory.sql` adds a tenant-scoped inventory and publisher slot claim ledger. The existing owner Marketing Hub receipt registration mounts `/api/marketing/creative-inventory`; GET is read-only and approval/import require the existing writer gate. Artwork is stored in MySQL as content-addressed PNG bytes. No rendering executable is needed in the hosted runtime.

Export the authenticated inventory GET response as a private JSON plan. On an approved offline runner with Node 22, librsvg, ImageMagick and local fonts, generate exactly the missing future slots:
```sh
node scripts/sbc-sign-creative-refill.cjs /private/plan.json /private/ed25519-key.pem /private/refill.json
```
The signing key must remain outside the repository and deployment artifact. Configure the matching public key in the approved runtime as SBC_CREATIVE_SIGNING_PUBLIC_KEY. An authenticated corporate owner may submit the signed JSON to POST /api/marketing/creative-inventory/import on the writer. Imports validate tenant, expiry, signature, canonical slots, PNG header dimensions and exact SHA-256; dHash metadata is attested by the trusted offline renderer and must not be treated as independent provider artwork readback. Imported assets remain DRAFT until actual review. No keys were provisioned or configured by this change.

The existing external publisher must be connected through an explicitly authenticated system-actor bridge before using the transactional claim method. Claims are not sends, and a claim cannot be retried blindly. The existing marketing slot receipt table remains authoritative; matching verified post IDs do not prove the exact artwork unless independent media evidence is available. The receiptStatus function distinguishes these cases. The retry helper is policy only until publisher integration is verified.

No automatic migration, no scheduled workflow, no paid service, no production writes, no GoDaddy mutation, and no external provider sends are part of this candidate. Hosted authentication, real MySQL migration/rollback, external publisher handoff, actual scheduled replenishment and four-channel provider evidence remain release gates.

# SBC Creative Engine — offline candidate V1

This module stages branded PNG candidates only. It never publishes, modifies MySQL, launches timers, or changes the externally owned SBC channel guard. Existing social automations retain 10 AM and 10 PM Eastern.

## Local review
Node 22, free ImageMagick CLI (convert; set SBC_IMAGE_RENDERER to a compatible executable), and DejaVu Sans fonts are required. No paid API, image stock, or new production npm dependency. Do not install on GoDaddy or enable a new publisher without hosted acceptance.

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

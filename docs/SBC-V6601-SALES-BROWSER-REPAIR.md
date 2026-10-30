# SBC V66.0.1 — Focused Sales and Browser Repair

Starting point: deployed GoDaddy rollback branch `a-sbc-rollback-oct27`, commit `b1ce7d0`.

## Verified production evidence (October 29, 2026)
- Preview logs are `role_env=readonly`. Preview must not write orders.
- Published logs include a successful writer lease acquisition.
- Published quote attempts reported `ECONOMIC_COST_DATA_REQUIRED:SBC CHECKOUT TEST — $0.01`.
- Missing supplier cost is **not** a reason to disable margin checks or fabricate cost.
- Earlier browser requests showed HTTP 401 (auth) and 503 (quote service). Those are separate conditions.

## Changes in this patch
1. Quote Save preserves entered data on rejection, prevents accidental duplicate POST while pending, and makes economic configuration vs authentication failures actionable.
2. Saving succeeded but refreshing fails is explicitly reported as **saved**, so staff do not submit a second charge/quote.
3. Light-only CSS contrast overlay, loaded after canonical stylesheet. Dark theme, animation, layout geometry and payment logic are untouched.
4. Optional repair link: append `?sbcRepair=1` to the Published SBC URL in the affected Chrome profile. It asks permission and clears **only** named SBC static caches and the same-origin `/sw.js` registration. It does not clear history, localStorage, cookies or IndexedDB.

## Why checkout remains a gated configuration item
The checkout economic contract requires tenant-specific `sbc_product_catalog` records with a real vendor cost, active SKU, and 30% minimum contribution margin. It fails closed on missing costs. A `$0.01` demonstration SKU cannot prove real payment routing, and should not be activated by inserting made-up costs. Confirm the actual product SKU and its authenticated vendor price in the catalog, then re-test with a valid product, actual cost, and approved Square environment. A quote failure cannot be declared fixed without a successful authorized write and webhook-to-paid confirmation.

## Release checklist
- Run `node scripts/v6601-ui-revenue-resilience.test.cjs` on the full checkout source tree.
- Rebuild the flat package and fresh release identity/receipt; do not overwrite the pinned prebuilt package with stale checksums.
- Test Incognito and regular Chrome, light and dark, authenticated owner vs demo vs read-only Preview.
- Try a legitimate quote with configured SKU cost, ensure only one quote is saved, and verify Square test settlement before marking an order PAID.
- Do not merge or deploy until CI integrity and writer/recovery checks pass. Keep production data and writer leases untouched.

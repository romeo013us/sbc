# Super SBC Growth OS V1 — marketing-to-revenue integration

Date: 2026-11-18. Status: source-only contract; NOT a production deployment or proof of end-to-end integration.

## Operating goal
Attract qualified visitors -> website inquiry -> existing CRM lead/account -> account manager follow-up -> scoped quote -> real Square payment -> verified fulfillment -> retention/referrals.

Extend existing Command Center Growth OS enterprise/sbc-growth-os-v650.js, Marketing Hub public/sbc-v6567-marketing-hub.js, revenue-marketing routes, and authoritative CRM; do not create a duplicate CRM, second marketing UI, or independent posting scheduler. Office Box remains a separate customer-facing solution.

## Verified ChatGPT/Windsor.ai connections
Facebook Page ID 1473280249199334, name Successful By Choice; LinkedIn Company ID 146995513 Successful By Choice LLC; GBP locations/3970405300470441047 Successful By Choice; GA4 property 564422194 SBC website; Search Console sc-domain:sbcmia.com and sc-domain:sbcwebsites.com. Old Facebook ID 156807434186301 is excluded. Disabled Instagram has no posting. These plugin credentials are NOT installed in GoDaddy Command Center: separate audited authorization and integration would be necessary to bring data into the app.

## Five active ChatGPT automations
- Daily 8 AM ET Facebook educational post.
- Daily 7 PM ET Facebook separate educational / service post.
- Tuesday/Friday 10 AM ET independent GBP and LinkedIn posts.
- Monday 9 AM ET Super SBC Weekly Growth Scorecard (GA4 + GSC + GBP + Facebook + LinkedIn).
- Friday 8 AM ET AI agent engineering research brief.

All posting uses verified account IDs, non-duplicative topics, zero paid ads, strictly public SBC details, and approved artwork only. No public references to private Command Center, internal workstations, Fantastic 4, private customer data, or fabricated business outcomes.

## Additive tested contract
enterprise/sbc-super-growth-contract.cjs provides canonical HTTPS UTM links tagged with campaign super_sbc_growth, exact channel allowlists, old account rejection, and read-only honest funnel snapshot normalization. scripts/super-sbc-growth-contract.test.cjs contains five Node 22 unit tests; all five passed in an isolated local working copy. The module does not communicate with providers, upload posts, store customer records, or change any currently running system. Full repository test:all, CI, GoDaddy release gates, and production runtime acceptance have NOT been performed for this change.

## First data baseline (not complete attribution)
Windsor.ai snapshot read November 18, 2026: GA4 sbcmia.com (Nov 1–18) active users 25, sessions 41, page views 83, reported conversions 0. Search Console sbcmia.com (Nov 1–17) impressions 15/clicks 0; sbcwebsites.com impressions 0/clicks 0. SBC GBP website clicks 0/call clicks 0; very new Facebook snapshot impressions 17, engagements 0; initial LinkedIn analytics zero. Data can lag. Zero GA4 conversions is not proof of no customer inquiries; no verified CRM/Square sales data was fetched here.

## Priorities before calling Super SBC integrated
P0: Validate customer-facing SBCMIA.com contact and quote form, mobile CTA, deliverability, anti-spam, and a real successful submit event. Configure consent-aware GA4 key event and preserve original UTM tags into CRM (never pass contact PII to analytics). Check pricing and policy parity with production catalogue.

P1: Extend existing owner-only Marketing Hub into ONE dashboard for verified publication receipts, post schedule, provider/data-source freshness, GA4 and GSC traffic, attributed inquiries, accounts, manager assignments, quotes, actual captured Square payments, fulfillment and renewals. Use tenant-scoped auth, one writer, audit trails, idempotent sync, no browser-local fallback masquerading as shared server data. Verify external connector credentials and scopes explicitly; do not assume ChatGPT plugins equal backend service access.

P2: Weekly decision loop: identify which offer/vertical/post creates real qualified inquiries and profitable orders, shift content to winners, follow up existing inbound quotes, and ask real customers for referrals. Paid ads only after owner authorization and verified contribution economics and order-to-delivery proof.

Release gate: Github code merged on a-sbc-master is not live. Require production build receipt, independent tests, authenticated live health, a form-to-CRM-to-quote-to-Square transaction trace, fulfillment and owner acceptance before assigning a 9.5+ production grade.

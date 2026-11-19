# Super SBC — Inbound Lead-to-Sale Acceptance (2026-11-18 ET)

**Status:** Source-level implementation and CI tests. No GoDaddy website replacement, production DB mutation, public test inquiry, payment, ad purchase, or automatic customer outreach in this change.

## Implemented in a-sbc-master

1. Existing `index.php` business-card brief input IDs now include correct HTML `name` attributes, so `FormData(form)` transmits business, name, phone, email, quantity, colors, style, details and notes rather than only the hidden form type. Added a reply email field.
2. Sign-request form captures optional callback phone and email. Both PHP handlers require **at least one** callback method and reject incomplete submissions before CRM and mail attempts. Existing signed HMAC website-to-CRM bridge, honeypot, server-side duplicate policy and CRM acknowledgment checks are retained.
3. Both forms disable their send button while sending to reduce double clicks, use accessible live notices, and provide accurate failure feedback.
4. Customer-facing contact address is `info@sbcmia.com` (no `j@sbcmia.com` left in the `index.php` source).
5. `sbcSuperSbcAttribution($_GET)` accepts **only** canonical `super_sbc_growth` `facebook/organic_social`, `linkedin/organic_social`, and `google/organic_gbp`; unsafe content labels become `general`. Names, email, phone, arbitrary referrer URLs and untrusted campaigns cannot be introduced into that attribution.
6. The website sends a safe structured `marketingAttribution` field in the HMAC-signed body **and** serializes canonical UTM tags into the existing `sourcePage` property using `sbcSuperSbcSourcePage`. The compiled Command Center handler already persists `sourcePage` with new web leads and on duplicate customer inquiry records/activity. This enables provenance **without modifying the compiled server or its release identity**; structured `marketingAttribution` is currently ignored by the server.
7. Browser `dataLayer` event `sbc_lead_accepted` fires only after `result.ok === true && result.crmLead === true` for card/sign form. No PII in event payload. **It is not automatically a GA4 conversion** until GTM/GA4 configuration is verified on the actually published website.
8. `enterprise/sbc-super-growth-contract.cjs` includes pure allowlisted inbound attribution validation and first/last-touch preservation helpers for future CRM normalization. They are not wired to the live web-lead handler yet and have no database side effects.

## Automated evidence

- GitHub PHP syntax and HMAC/CRM guard/portal/form/attribution tests: [SBCMIA PHP contract](https://github.com/romeo013us/sbc/actions/workflows/sbcmia-php-bridge-contract.yml). Latest verified green run: [44454321704](https://github.com/romeo013us/sbc/actions/runs/44454321704).
- Independent Node 22 Marketing Hub, organic campaign contract and inbound first/last touch tests: [44454007412](https://github.com/romeo013us/sbc/actions/runs/44454007412).
- Read-only Fantastic 4 public health checks **intermittently** return 403 for SBC public website and reseller cart; some runs pass. Keep this as an open environmental/WAF or access issue and reproduce with the GoDaddy logs; never bypass authorization or weaken WAF on inference alone.

## Still required for 9.5/10 production acceptance

- [ ] Inspect the **currently deployed** `sbcmia.com` files before release. The visible public site has `contact.php` and `packages.php` links not found in this GitHub repository. Do **not** overwrite the current public design with this legacy `index.php` without first reconciling the site source and brand/layout.
- [ ] Confirm website and hosted GoDaddy publish paths, build receipts, integrity manifest and rollback method.
- [ ] Perform one explicitly authorized owner-controlled inquiry from the actual live site; inspect inbox delivery and **one authoritative tenant-scoped CRM lead/inquiry record** and activity with its canonical attributed `sourcePage`, without inventing sales metrics.
- [ ] Confirm duplicate contact inquiries append a new timeline entry and do not overwrite verified contact details or original campaign. Record first/last touch server-side through existing safe CRM lifecycle if needed.
- [ ] Configure and validate GTM/GA4 rule for `sbc_lead_accepted` -> `generate_lead` only after successful receipt; ensure consent/privacy requirements and no PII.
- [ ] Verify account-manager assignment/next-action, accurate package quote, Square payment capture, fulfillment and delivery. Test payments must remain QA, not revenue.
- [ ] Check responsive mobile and desktop layouts, keyboard, contrast, motion preferences and actual performance. Existing Marketing Hub accessibility and publishing safety are protected by GitHub tests.
- [ ] Recheck intermittent 403 public and reseller cart; distinguish bot/WAF controls from real customer errors.

**Reporting rule:** A website visitor is not a qualified lead. A form send is not a recorded CRM lead without server evidence. A lead is not a sale. A Square capture is not net profit until actual costs are reconciled.

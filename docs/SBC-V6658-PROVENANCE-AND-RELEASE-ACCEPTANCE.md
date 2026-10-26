# SBC V66.58 — Financial provenance / vendor dispatch release gate

**Certification:** NO_GO. Build/SaaS/Company still require independent >=95 per subsystem, as defined by the strict V66.55 scorer.

## P0 risks discovered in the actual V66.57 compiled runtime

- A legacy non-Square order with only `paymentStatus:'Paid'` could still pass the V66.57 shared fulfillment guard and initiate vendor work.
- Autonomous reconciliation selected such status-only orders and could ask Kim/GodKim to advance them.
- Two revenue dashboards counted paid text labels as collected value; a refunded stored Square status could be overridden by a stale non-Square paid label.
- Invalid and nonfinite order amounts could contaminate reporting.

## V66.58 changes and intentional limitations

1. Require SBC-recorded Square settlement evidence for outbound vendor fulfillment. Status-only, cash, manual and historical non-Square receipts are held for owner reconciliation instead of automatic vendor execution. No existing order, record, payment or tenant is modified.
2. Align the autonomous revenue reconciliation queue with that exact provider-evidence requirement.
3. Make both executive revenue snapshot engines count only SBC-recorded Square settlement metadata for paid-order value; exclude synthetic system-test orders, stale refunds, status-only orders and invalid monetary amounts.
4. Rename the broadcast card from **PAID REVENUE** to **SQUARE-BACKED ORDER VALUE***. This is evidence captured by SBC, **NOT** independent confirmation of a Square payment or a bank deposit.
5. Report historical status-only order counts separately without deleting or rewriting any legacy record.
6. Ensure refundable/reversed stored Square state takes precedence over an older `Paid` label.
7. Regression-test the actual compiled application, the existing V6651 vendor guard, and the exact ZIP artifact.

**Conservative operational consequence:** Previously marked Paid non-Square orders cannot be fulfilled automatically until a future independently verified provider/payment flow is added and separately tested. This is intentional: manual exceptions must never silently create vendor liabilities.

## Full-package download contract

After a main-branch release passes the isolated build, retrieve the FULL ZIP from the official GitHub Actions **Build GoDaddy Full ZIP** artifact (or from the published main reconstruction candidate). Keep the source-matching commit receipt and SHA-256. Use both a normal ChatGPT attachment and an independently downloadable GitHub Actions artifact. Archive contents, the nested prebuilt runtime, pinned browser SDK and ZIP CRC must all be checked.

## Open 9.5 requirements

Authenticated live GoDaddy Preview and Published stability, current independent MySQL backup and isolated restore, real Square verified provider capture / HMAC webhook / ledger match, consent-based Twilio mobile call and durable CRM logging, all P0/P1 control clicks, authoritative lead and order counts, actual paying customers, recorded margins and renewals.

Never import leads, change secrets, trigger real payments, disable recovery guard, or deploy Published as a synthetic test.

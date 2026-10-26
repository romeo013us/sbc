# SBC V66.55 — Strict Three-Track 95/100 Acceptance Protocol

**Certification status: NO_GO until independently reviewed evidence is available.**
A clean ZIP or green CI run does not prove GoDaddy production stability, commercial SaaS maturity, business profitability, or top-1% global ranking.

## Release contract
- Build, SaaS, and Company are independently graded out of 100.
- **Every subsystem must independently achieve >=95/100**, and the weighted score of each track must be >=95/100.
- Missing or stale proof is UNMEASURED, not zero and never a passing grade.
- A critical subsystem below 95 always blocks overall certification, even if average exceeds 95.
- An uploaded evidence pack is only ELIGIBLE_FOR_INDEPENDENT_REVIEW. References/hashes are not verified with external providers by this offline utility.
- **Office Box work stays deferred** until final reviewed certification. Office Box requires a separate sell/lease security, tenant, billing, recovery and product acceptance process.

## Engineering Build (100 points)
| Subsystem | Weight | Independent live evidence |
|---|---:|---|
| Reproducible deploy and rollback | 15 | Exact checked SHA, signed artifact/receipt, green CI, GoDaddy commit match, rollback rehearsal |
| Published reliability & performance | 15 | p95 real-user latency and error-rate logs; uptime and freeze tests |
| Authenticated control inventory | 15 | Every P0/P1 button, modal, navigation target and error state checked on mobile and desktop |
| Security tenant & writer boundaries | 20 | RBAC, cross-tenant rejection, lease concurrency and signed webhook negative tests |
| Backup & isolated restore | 20 | Dated independent backup, disposable restore and record-integrity audit |
| Incident response & observability | 15 | Real alert test, recovery exercise, audit logs and rollback instructions |

## Commercial SaaS (100 points)
| Subsystem | Weight | Independent live evidence |
|---|---:|---|
| Tenant CRM and lead operations | 20 | Authenticated create-save-readback, second session, tenant denial and lead outcome history |
| Square checkout/settlement | 20 | Owner-authorized payment, signed webhook, provider capture, exact SBC ledger reconciliation |
| Paid-only fulfillment and owner holds | 15 | Real governed order handoff; unpaid/refunded/cross-tenant dispatch blocked |
| Twilio consent, voice and CRM logging | 10 | Consent records, iPhone test call, valid callback and durable CRM call log |
| Mobile UX and accessibility | 15 | WCAG checks and audited absence of dead clicks/redirects |
| Durability and tenant-safe recovery | 10 | Backup restore with correct tenant isolation |
| Onboarding, billing and support | 10 | Customer lifecycle, escalation, cancellation and billing policy walkthrough |

## Operating Company (100 points)
| Subsystem | Weight | Independent live evidence |
|---|---:|---|
| Verified prospect pipeline | 15 | Verified qualified leads, duplicate removal, contactability, status definitions |
| Outbound conversion | 20 | Logged contact attempts, appointments, offers and actual closes by cohort |
| Settled revenue and accounting | 25 | Square settlements match accounting after fees; no quote value claimed as cash |
| Profitability and cash visibility | 15 | GoDaddy costs, Square fees, marketing spend, operating expense and margin/runway |
| Customer fulfillment and quality | 15 | Paying customers, on-time delivery, customer sign-off and support resolution |
| Renewal/retention | 10 | Real renewal rate, repeat business and collected recurring revenue |

## Evidence contract
The executable utility is at scripts/sbc-v6655-strict-95-evidence.cjs.
A submitted JSON must include an exact 40-hex commit; for EACH subsystem include verified=true, same commit, ISO observedAt, numeric score between 0 and 100, and HTTPS reference+SHA256 artifacts for every required evidence kind.
A current, source-bound artifact reference is not a provider receipt. A person must independently check its contents and financial accuracy.

Run: node scripts/sbc-v6655-strict-95-evidence.cjs --evidence private-evidence.json --require-95

CLI result NO_GO indicates inadequate evidence. Even ELIGIBLE_FOR_INDEPENDENT_REVIEW is **not final certification**. Live payment/provider access must never be simulated merely to inflate the grade.

## Next rollout order
1. Verify source-matched GoDaddy Preview boots and all mandatory catalogs are present. Published must remain intact until Preview passes.
2. Complete independent production MySQL backup and isolated restore; reconcile authoritatively against reported customers/leads/orders.
3. With explicit owner consent, test one controlled Square purchase, signed webhook, idempotency, confirmed capture and accounted cash.
4. Test real CRM create/edit/readback, cross-tenant denial, quotes, follow-ups, owner holds and paid-only fulfillment.
5. Authenticated desktop+iPhone click audit for critical actions, modals, errors, redirects and polling/freeze stability.
6. Twilio call/log, email/SMS notifications and consent, supported by provider response evidence.
7. Demonstrate actual company cash, gross margins, closed sales, delivered orders, support quality and renewals.
8. Owner review of evidence across all tracks; only then consider Office Box as separate licensable product.

## October 26, 2026 known state
V66.53 startup catalogs are packaged and were tested in an isolated environment. V66.52 manual-paid restrictions were ported into PR #160 and merged onto the V66.53 baseline. These are real engineering controls, not proof of a live GoDaddy or Square purchase. Live production and company evidence remain outstanding.

No lead import, database reset, webhook call, payment charge, secret alteration or GoDaddy deploy is authorized by this scoring utility.

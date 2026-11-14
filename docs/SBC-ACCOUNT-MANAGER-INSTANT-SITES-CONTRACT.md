# SBC Account Manager OS + Instant Sites — Delivery Contract

**Product:** Successful By Choice · Account 360 + native Website Production
**Owner objective:** a persistent account relationship, followed by instant private website production, verified fulfillment, domain publishing and recurring managed service. This is a design and acceptance contract, **not a claim of live readiness**.

## What is present in this PR
- Account 360 relationship plan: status, assigned manager, follow-up, existing quotes/open support requests where loaded, next recommended action and unverified facts.
- Same least-privilege plan in the employee workspace that is currently authenticated as role \`caller\`. **This is a display/relationship workflow enhancement, not an authorization-role migration.**
- Instant Sites uses the existing POST \`/api/website-demos\` with CRM customer ID, \`fast:true\`, and the existing one-page/four-page packages. Added evidence-aware design brief; did not add domain publishing.
- Private concept, owner approval and consent restrictions remain.

## Real product workflow (target)
1. **Research & intake:** Lorna or intake verifies the entity, sources and contact channel. Unverified claims are marked for customer confirmation; no fake photos/reviews.
2. **Account ownership:** Owner assigns an account manager with limited, audited access to only assigned tenant accounts. Account manager tracks requests, conversations, follow-up dates, service renewals and handoffs; no autonomous outreach.
3. **Instant Sites:** Generate a private, functional, responsive site from CRM data in seconds where possible. Offer at least three **meaningfully different** layouts per industry, usable editing and content-version history. Avoid automatic paid AI prompts. Generate without publication.
4. **Client approval:** Verify business name, services, claims, photos/media license, contacts, hours, forms, privacy and owner acceptance. Record approved website revision.
5. **Quote → payment → fulfillment:** Exact package and supplier economics; Square-authoritative payment evidence or approved owner QA. Production workorder and assigned tasks must be durable, tenant-scoped and idempotent.
6. **Publish:** With explicit owner and domain-holder authorization, deploy the exact approved static site to SBC-compatible hosting. Verify file checksums, DNS ownership, TLS certificate, accessibility, forms, page speed and noindex removal only for genuinely live sites. Attach deploy receipt, rollback revision and live URL to the account. Never assume a GoDaddy Websites + Marketing editor can import raw HTML; handle that fulfillment path separately.
7. **Managed account care:** Website edits, uptime, SSL/domain renewal, Google Business Profile updates with permission, SEO, analytics, appointment/forms, email marketing and service support become visible, auditable customer tickets. Retention/upsell is based on actual service need, not guessed demand.

## Role contract
- Owner: full authorized company controls, verified CRM revisions, approved public publishing, payment/discount oversight.
- Account manager (future distinct server role): read and update only assigned account interactions and service requests, propose a website, request approvals, coordinate workorders, follow up subject to channel permissions.
- Researcher: restricted research evidence and return-for-correction workflow; no cross-tenant customer management.
- Sales caller (existing server role): staff projection, training-gated calling and call reports. This PR **does not** give caller owner privileges or pretend that renaming the workstation equals a complete new role.

## Release blockers / required tests
- Do not promote an unverified server or stale ZIP; run V66 reproducible artifact, checkout and tenant tests.
- Confirm the \`sbc_customers.address\` column exists on the authoritative MySQL writer after a verified backup. Do not auto-run DDL at operational startup.
- Server-side authorization must enforce assignment and tenant on every request, even if a browser sends a different customer ID. Test foreign tenant, unassigned employee, expired employee, recovery/read-only mode and forged status/payment.
- Keep DNC/opt-out/consent and WhatsApp/SMS A2P requirements intact.
- Prove that customer note, quote, request, workorder, domain, DNS and hosting actions are durable before displaying success.
- Require real preview/browser tests for desktop and mobile, real form endpoint, completed live order, verification and rollback before 9.5/10+ certification.

## Initial acceptance metrics
- Draft generation latency p95 (measured, not promised); zero required paid AI calls for baseline templates.
- Complete/editable sites across industry layouts; no stale customer data mixed between accounts.
- Follow-ups completed per assigned manager, service request response time, quote-to-paid conversion, verified launches, recurring care renewals, refund/chargeback rate and gross margin.
- Record each metric from verified production events; never treat generated site count as revenue or a CRM \`Customer\` label as payment proof.

## Spend and architecture
Native deterministic site generation and shared SBC components first. Optional AI assistance is budget-capped, owner-visible and strictly opt-in; no new per-customer platform subscription by default. Domain/SSL, live forms, CDN hosting, support and email integrations require verified costs and official provider APIs/permissions. Avoid cloning GoDaddy proprietary code or promising incompatible Website + Marketing imports.

**Current feature-branch scope:** Account 360 relationship briefs, Lorna address-research notice, owner portfolio counts/assignment via the existing API, deterministic industry design variants, and a versioned **owner-only draft editor** for headlines, body copy, services, palette and section visibility. The editing API is restricted to authenticated, tenant-scoped, writable drafts; it rejects stale versions and refuses approved-site changes. These features are not a live launch. Full drag/drop layout editing, asset uploads, user-facing domain publishing, real inquiry delivery, scheduled customer care/renewal automation, audited owner reassignment and a distinct dedicated account-manager authorization role are **not implemented by this PR**. Production release requires passed CI plus staged browser/database acceptance.

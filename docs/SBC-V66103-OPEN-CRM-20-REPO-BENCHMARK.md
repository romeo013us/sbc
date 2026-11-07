# SBC V66.103 — Twenty public CRM / business-OS repository benchmark
Reviewed: 2026-11-06 (America/New_York) · SBC source: `romeo013us/sbc`, `a-sbc-master` at `1aaf8553b96b64b0a3f8f2aea19da5a4eef161a1`.

## Scope and limits
Twenty **accessible public GitHub repositories** were reviewed at repository and README level, not audited line by line or installed. This is a **representative feature benchmark**, not a definitive popularity ranking, a vendor security certification, or evidence that SBC is missing a named feature. Source availability, a README claim, and a running feature are different things. Some products are ERP, support, or workforce platforms rather than sales-first CRMs. Do not copy code or assets across incompatible licenses.

## Twenty public builds sampled

| # | Public repository | Comparative product emphasis |
|---|---|---|
| 1 | [Twenty](https://github.com/twentyhq/twenty) | Extensible objects, saved views, workflows, email/calendar sync, permissions |
| 2 | [Odoo Community](https://github.com/odoo/odoo) | Integrated sales, accounting, website, invoice and business apps |
| 3 | [ERPNext](https://github.com/frappe/erpnext) | Full transaction flow: CRM, quoting, projects, invoices and ERP |
| 4 | [Chatwoot](https://github.com/chatwoot/chatwoot) | Omnichannel shared customer inbox, automation, support |
| 5 | [Monica](https://github.com/monicahq/monica) | Relationship history, personal notes and reminders (personal CRM) |
| 6 | [Krayin CRM](https://github.com/krayin/laravel-crm) | Lead pipelines, quotations, email and searchable records |
| 7 | [Mautic](https://github.com/mautic/mautic) | Segmented marketing campaigns, events and marketing automation |
| 8 | [CRMEB](https://github.com/crmeb/CRMEB) | Commerce and customer operations |
| 9 | [IDURAR](https://github.com/idurar/idurar-erp-crm) | CRM with accounting, invoices and business records |
| 10 | [Ever Gauzy](https://github.com/ever-co/ever-gauzy) | Work management, workforce/time and business operations |
| 11 | [Dolibarr](https://github.com/Dolibarr/dolibarr) | Modular proposals, invoicing, stock and ERP/CRM |
| 12 | [SuiteCRM](https://github.com/SuiteCRM/SuiteCRM) | Traditional configurable sales/marketing CRM |
| 13 | [Frappe CRM](https://github.com/frappe/crm) | Lead/deal activity view, kanban, notes, calls and integration |
| 14 | [Fat Free CRM](https://github.com/fatfreecrm/fat_free_crm) | Accounts, contacts, leads, opportunities and tasks |
| 15 | [EspoCRM](https://github.com/espocrm/espocrm) | Configurable sales records, relationships and automation ecosystem |
| 16 | [Corteza](https://github.com/cortezaproject/corteza) | Low-code data model, workflow and CRM applications |
| 17 | [CiviCRM](https://github.com/civicrm/civicrm-core) | Nonprofit contacts, constituent records, engagements |
| 18 | [Axelor](https://github.com/axelor/axelor-open-platform) | ERP/business process platform and model-based applications |
| 19 | [OroCRM](https://github.com/oroinc/crm-application) | B2B-oriented customer and business relationship management |
| 20 | [Apache OFBiz](https://github.com/apache/ofbiz) | Broad business OS / ERP operations and order processes |

These are sampled **projects**, not claims that each feature is present in its free edition or that SBC needs every module. Details should be checked against each project's licensing and release docs before adopting a design.

## SBC gap analysis — evidence first

| Capability | Evidence in current SBC tree | What to improve next |
|---|---|---|
| Employee-scoped sales and researcher roles | `enterprise/sales-caller-workspace-v6697.cjs`, `scripts/v66101-caller-least-privilege.test.cjs`; Lorna workspace test | Keep; do not merge owner/employee shells |
| Call handling, logs, manual dialer | `public/sales-caller.js`, `public/sbc-manual-dialer-v6696.js`; user has confirmed live calls work | Keep; avoid destabilizing a working provider integration |
| Callback accountability | Before V66.103 `priorityCalls()` selected first 25 matching reports without due-time ranking, without one-row-per-lead dedupe and without a latest-outcome suppression | **V66.103 implemented**: overdue-first, unscheduled follow-up flag, latest-report closure, assigned/callable-only, no automated calls |
| Customer 360 / deal timeline | Owner CRM and call reports exist; exact activity parity is unverified | Test real end-to-end audit trail for one assigned lead |
| Email + calendar two-way sync | Communications/calendar features exist, but two-way Google/M365 sync parity was not established by this review | Research separately; requires OAuth/provider permissions, conflict policy, retention/privacy and dedicated test |
| Custom objects, custom fields and reusable saved views | Office Box is customizable; Command Center data-model parity with Twenty is unverified | Do not graft a second generic CRM schema without customer use-case |
| Omnichannel customer support / cases | Client communications exist; inbox-wide SLA/assignment parity to Chatwoot not established | Inspect support workflows after live sales launch; add only if needed |
| Transaction-linked forecast and accurate collected revenue | Square payment-evidence contracts, owner economic protections and revenue controls exist | Prove real paid→fulfillment reconciliation and distinguish QA payments; do not count labels as collected revenue |
| Release reproducibility, tenant isolation, recovery | GoDaddy staged workflow, SHA inventory, tenant and payment tests exist | CI GREEN + exact deployed SHA + safe restore drill + live employee/demo acceptance |
| Security and governance | Existing role restrictions, writer lease, signed callbacks and recovery guards | Preserve; never disable financial or tenant controls to improve cosmetic scores |

## Why this precise change was chosen
Frappe CRM emphasizes one-page actions and activities, while Twenty explicitly supports detecting stale opportunities through workflows. SBC already has call reports and assigned leads, but its employee attention queue previously treated old callbacks as equal to current ones and could surface closed activity. V66.103 strengthens daily execution at low operational risk. All ranking is **read-only**, derived from the already tenant-scoped employee API. The browser cannot introduce contacts, issue a call, edit customer records, or turn a call into revenue simply by showing an item.

### V66.103 acceptance
- [x] Helper has no network, database or dialing operations
- [x] UI and HTML served from both `public/` and `browser_public/` remain mirrored
- [x] Server-side tenant/role selection remains unchanged
- [x] Overdue first, then missing confirmed time, then upcoming; older callbacks superseded by newer reports
- [x] DNC / refusal / unassigned contacts do not become action queue rows
- [x] Release workflow runs regression on repository source **and** inside staged archive (subject to CI result)
- [ ] GitHub staged release workflow GREEN and downloadable archive identity verified
- [ ] Production Preview / Published operator acceptance completed

## Evidence required for an honest 9.5/10 across build, SaaS and company
1. **Build:** Entire mandatory release CI GREEN, no known blocker, exact staged ZIP provenance, reproducible integrity receipts, rollback artifact available.
2. **SaaS:** Owner, sales, Lorna and demo routes pass real account smoke tests, tenant data remains isolated, health/backup/restore proven, reliable recovery and errors.
3. **Company:** Assignment→real customer contact→quote→approved cost/margin→Square verified payment→correct order→fulfillment→customer follow-up proven, with no duplicate charges or false revenue and consent/suppression policy observed.
4. **Operational quality:** No dead controls, desktop/mobile usable, accessibility checks and recoverable error states. Follow-ups and contacts not silently dropped.

**Do not claim certified 9.5 from a README, synthetic tests, a successful deploy, or unverified feature counts.** Do not auto-merge/deploy this candidate based on the benchmark alone.

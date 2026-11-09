# SBC Smart Dialing — A1 Architecture, Source Audit, and Release Gates
Date: 2026-11-09 | Target branch: `a-sbc-master` | PR #301 | Mode: human-initiated only

## Executive decision
Do not replace the existing caller desk, phone recovery engine, call logs, tenant authority, or release-integrity mechanism. Extend them. Smart Dialing is **NOT production-certified** until all acceptance gates below pass. The system must not auto-place calls, auto-text prospects, auto-record calls, or bypass opt-outs. Default OpenAI API spend: **$0**.

## Actual repository components inspected
- `public/sales-caller.js`, `public/sales-caller.html` and mirrors in `browser_public/`: real employee-facing calling desk, auth, shift checks, Twilio SDK, disposition submission, role-gated calls.
- `enterprise/sales-caller-workspace-v6697.cjs`: assigned lead / caller projection, tenant isolation, owner read-only preview.
- `public/sbc-followup-priority-v66103.js`: existing read-only callback accountability, do not replace with a competing callback queue.
- `enterprise/sbc-phone-recovery-v66137.cjs`: existing zero-AI 15-day bad-number HOLD; targeted review only after due; candidate number requires source and owner approval; no research loop.
- `enterprise/v6619-signed-twilio-webhook.js`: signed callback guard, but a verified signature is separate from verified call completion.
- `enterprise/CallingStateMachine.js`: existing state transition graph.
- `server.js` (pinned/reproducible release): `/api/v9/call-report` already stores reports, sets Do Not Call suppression, and applies bad-number hold; `/api/voice/log` writes pre-call and post-call evidence. Source is pinned; edit only through audited release generation.
- `scripts/v6697-stage-sales-workspace.cjs` and `scripts/v6697-sales-workspace.test.cjs`: stage-only server gates and tenant isolation regression.
- `docs/SBC-V6689-MONDAY-PHONE-SALES-ACCEPTANCE.md`: real Twilio/caller/audit verification requirements.

### Gap that mattered
Before this PR, the caller projection mainly used a valid phone and a suppression flag. Saved outcomes such as `No Answer`, deferred callbacks and historical bad-number holds did not automatically affect the top of that specific employee's assigned-lead list. The report form also did not offer `Bad Number` despite the backend already supporting that outcome. The PR adds a read-only report-derived queue projection, moves noncallable leads behind eligible leads, and advances selection after a successful report write.

## State and authority contract
| Observation / action | Authoritative evidence | Desired queue result | Safety guard |
| --- | --- | --- | --- |
| Twilio initiated/ringing/in-progress/completed | Provider signed status callback and linked Call SID | Provider status only | Never infer decision-maker conversation |
| User presses call | Existing authorized, durable `/api/voice/log` session | Keep selected until result | Block if log not durable or suppression active |
| No Answer / Voicemail | Saved call report, timestamp, actor | Delay; show next eligible | 1, 2, 4, 15-day staged projection; after five unanswered reports -> owner review |
| Follow-up requested | Saved report plus explicit time | Hide until due, then prioritize | Missing time -> manual review, never invent |
| Bad Number | Saved `Bad Number` report + `SBC_PHONE_RECOVERY.flag` | Hold 15 days; owner-reviewed phone correction | Do NOT delete lead or immediately recycle to researcher |
| Do Not Call | Server-side `doNotContact`, `salesSuppressed`, `status='Do Not Call'` | Permanent suppression until authorized policy review | No outreach while suppressed |
| Interested / Appointment | Caller report + actual next action | Move out of unsolicited queue | No automatic payment/claim of closed sale |
| Provider failed | Signed provider callback | Mark technical failure, not a prospect rejection | Never mark number bad from a single carrier failure |

**Important limitation:** The projection currently uses legacy user-scoped reports that may not contain `tenantId`. For such records, only reports made by the authenticated caller are accepted. A future owner-approved migration must make suppression and phone states canonical across staff, with a tenant-scoped audit ledger and unique idempotency keys.

## Compliance requirements for launch
- Check the **called party's verified timezone** before call authorization, not browser/device timezone. Fail closed on unknown timezone in automated queue eligibility; permit only verified, appropriately scoped human review.
- Use a configurable legal policy per jurisdiction and call type. Florida Statutes 2026 §501.616(6)(a) limits covered commercial solicitation before 8 a.m. / after 8 p.m. local time and §501.616(6)(b) restricts more than 3 calls on the same subject in 24 hours. Keep a stricter internal policy if justified. https://www.flsenate.gov/Laws/Statutes/2026/501.616
- The FTC TSR has important B2B exceptions, but do not assume a cellphone, owner, or mixed personal number is exempt from every federal or state requirement. https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule
- DNC/suppression must be enforced server-side immediately, including on all duplicate numbers across tenant-scoped leads. No blind auto-dial, bulk SMS, recorded sales messages or voicemail drops.
- Any AI voice, automated dialing, outbound texting and recordings require a separate legal and consent acceptance gate. This PR authorizes none.

## External engineering benchmarks
- **Salesloft:** Separates disposition (what occurred) from sentiment (sales response), useful for SBC call reports and truthful KPIs. https://clari.my.site.com/customer/s/article/Manage-Dispositions-and-Sentiments
- **Salesloft cadence:** Consistent multi-step, human-assigned touchpoints rather than random repeat calls. https://help.salesloft.com/s/article/Salesloft-Cadence
- **Twilio Voice:** Provider status callbacks `initiated`, `ringing`, `answered`, `completed` can support separate connection metrics. https://www.twilio.com/docs/usage/webhooks/voice-webhooks
- **Twilio webhook security:** Validate X-Twilio-Signature using official SDK and handle idempotent retries. https://www.twilio.com/docs/usage/webhooks/webhooks-security
- **ZoomInfo timing:** Use 10–11 a.m. and 4–5 p.m. Tuesday–Thursday only as initial experimental hypotheses, not as guaranteed industry-specific windows. https://pipeline.zoominfo.com/sales/cold-call-timing

## Acceptance gates (must all pass)
1. Node 22 unit and worker projection tests green, including existing owner preview, role, tenancy and asset parity tests.
2. All broad release CI jobs green. Current voice-log regression `503 !== 201` and failing staged-ZIP checks must be diagnosed before merge; do not disable tests to force green.
3. Server-side DNC, phone hold, and due-time enforcement exercised against all real dial routes (including manual dial and other caller reassignments), not just the browser button.
4. Verified company-wide suppression and append-only, tenant-scoped, idempotent call disposition ledger; concurrency and outage rollbacks tested.
5. MySQL writer lease and recovery-clear confirmed. No writes from Preview, role impersonation or unsigned provider events.
6. Real owner-controlled Twilio test: permission, ringing, two-way audio, caller ID, Call SID, signed callback, durable call log and one report, no duplicate CRM mutation.
7. Shift/role/owner-preview regression, desktop/mobile responsive UI, English/Spanish labels, keyboard and screen-reader test.
8. Lorna phone-recovery: no immediate research ping-pong; on 15-day review search once for a sourced alternate; owner approval required before contact.
9. Report quality metrics distinguish dial attempts, provider answers, human conversations, decision-maker conversations, appointments, quotes, actual Square-proven revenue.
10. Rollback of deployment restores prior service while retaining durable CRM and audit data. Stage one employee, then broaden only with acceptance evidence.

## GitHub cleanup policy
Open issues #263 (historical CRM recovery) and #277 (Fantastic 4 acceptance) remain real production blockers; do not close without proof. PR #294 modifies pinned `server.js` and previously failed release CI. PR #296 has a merge conflict. PRs #298, #300, #304 change fulfillment/SMS/payment-related flows and require separate acceptance. PR #301 remains draft until this calling engine is proved. Closing or merging them without satisfying their issue-specific tests is not completion.

## Spend policy
Use deterministic Node.js + MySQL for queue, rules, suppression, cadence, audit and reporting. No OpenAI on each call, every lead refresh or Twilio event. Optional one-time sales-prep summaries may use a monthly owner-configured cap. No automatic expensive fallback.

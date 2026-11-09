# SBC Revenue First — November 9, 2026
**Status:** proposed owner-controlled operations; new daily-brief endpoint is read-only and does not contact prospects, purchase ads, or charge customers.

## Objective
Convert verified SBC CRM leads into genuine paying customers with no new SaaS or headcount. Protect cash flow while the separate Fulfillment 2.0 work is validated.

## Monthly financial ceiling
- Existing payroll, products, and other costs: about **$500** (owner's estimate, not an audited P&L).
- OpenAI API: **maximum $25/month**, not a spending target.
- Marketing: **maximum $75/month**, not a spending target.
- Incremental total ceiling: **$100/month**; total illustrative monthly outlay about **$600**.
- Default new spend today: **$0**. No automatic paid ads, OpenAI use, or vendor purchases. Any optional $35 sample printing, $15 Twilio refill, or $20 ad experiment must be separately justified and approved.
- Starter $199 estimated product/fulfillment cost about $150, leaving $49 before payment fees, overhead and variable labor. This estimate is **not** evidence that every package has that margin. 13 x $49 = $637 gross contribution (before other costs), so the goal is profit, not only order count.

## Existing systems reused
- CRM and lead verification; existing caller workspace and Twilio dialing.
- Owner-only Revenue Sprint route; new GET /api/v56133/revenue-sprint/today read-only projection.
- Existing Square payment evidence classifier; synthetic QA orders excluded from the new view.
- Existing payment, Quote and fulfillment rails remain unchanged.

## Owner-controlled weekday process (goals, not automated calls)
1. Review the new owner daily brief or existing CRM (until deployment).
2. Review up to 20 verified, callable leads; verify business, local hours, permission and suppression/DNC requirements separately before each contact.
3. Make human-initiated calls; record actual attempt, conversation, need, and precise follow-up. Avoid autodialing, prerecorded/AI voice calling, bulk SMS, or scraped contact outreach without appropriate compliance checks and consent.
4. Aim to send 2 accurate, relevant proposals a day, but never promise a website or price before checking existing service need, actual vendor cost, and scope.
5. Follow up on quotes and open customer questions by the promised date. Use customer-requested payment links.
6. Each afternoon reconcile Square-evidenced **non-QA** payments and actual fulfillment costs. Missing cost is **unknown**, not zero or profit.
7. On Friday review real conversations/quotes/sales, cost and net contribution. Improve the highest-converting offer, and stop low-performing activities.

## Paid marketing gate
Do not activate paid ads until there is positive evidence from at least three real customer transactions, a validated margin-positive offer, and a tested payment-to-delivery journey for that offer. The gate is a recommendation; do not imply code enforces it. When reached, start one small reversible local test, not a new marketing subscription. Track source, qualified conversations, actual purchases, and profit.

## Cash flow rules
- Revenue is counted only when payment has recorded Square capture evidence, and known QA/test orders are excluded. This is still SBC-recorded evidence and requires reconciliation with Square/bank before financial certification.
- Never use quotes, website traffic or imported leads as a substitute for paid customers.
- Actual contribution = independently evidenced payment - verified fulfillment/product cost - payment fees - directly attributed variable expenses. If data is missing, mark contribution UNKNOWN.
- Daily outreach records and orders are tenant-scoped and read-only in the new report.

## Technical verification before live launch
- CI on Node.js 22: scripts/revenue-first-daily-brief.test.cjs.
- Owner-only route permissions and tenant scoping; never expose lead phone numbers publicly.
- Check caller workspace permissions, Twilio webhook/voice token and one owner-consented test call before broader use. No automated outreach is activated here.
- Deploy only through existing GoDaddy packaged release process and check published URL identity. Source merge alone is not proof of production release.

## Separate fulfillment project
Fulfillment V2 service blueprints, MySQL child-step ledger and rollout flags are under draft PR #298. They still require schema rollout, verified catalog mapping, protected completion APIs and end-to-end simulated/live tests. The revenue brief does not bypass those gates.

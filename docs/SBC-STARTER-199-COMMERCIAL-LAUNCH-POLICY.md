# SBC $199 Business Starter — Owner-Approved Commercial and Fulfillment Policy
Effective decision recorded: October 30, 2026. Operational specification only; not a production deployment or a website change.

## Customer-facing first-year offer
- One-time introductory package price: **$199**, payable to Successful By Choice LLC through the verified SBC checkout.
- Includes registration of one eligible standard domain for **12 months**, one eligible GoDaddy Websites + Marketing hosting/builder subscription for **12 months**, and initial setup of **one simple mobile-friendly, one-page business website** using customer-supplied, authorized content.
- Includes **100 standard business cards**, with one initial design/proof and **one consolidated correction round** before the print order is submitted. Shipping terms and any extra costs must be disclosed before payment; premium stock, special finishes, rush shipping, and extra quantities are extra.
- Basic website scope: business name/logo, contact information, hours, introduction/services, contact/call-to-action, and standard layout. Includes one consolidated correction round before launch. Additional pages, custom code, ecommerce, appointment integrations, copywriting, logo creation, ongoing site edits and other advanced features are separately quoted.
- Do not promise SEO ranking, indefinite free revisions, unlimited maintenance, or perpetual hosting. Confirm the actual purchased GoDaddy tier supports all promised features before fulfillment.

## Customer-specific account, ownership and access
1. Capture verified customer name, company, email, approved domain spelling, domain registrant/contact information and consent to purchase on their behalf.
2. Create or use a distinct GoDaddy reseller customer account for each customer; never put all unrelated customer assets in an unsegmented shared account.
3. Register the domain with the correct customer registrant details and keep the customer-facing domain and Websites + Marketing site in the same GoDaddy account as required for direct connection.
4. Use GoDaddy reseller customer/delegate management where access is authorized; do not share passwords. Record customer account ID, domain, service order IDs, expiry dates, renewal terms and associated SBC CRM tenant/customer/order identifiers.
5. Give the customer their relevant account access and clarify their ability to retain/transfer eligible domain assets and any website-platform portability limitations. Never represent proprietary website builder content as automatically portable.

## Renewal policy — owner to verify vendor renewal quote before publishing
- Recommended **second-year renewal: $179/year**, for the existing eligible domain + website hosting/builder subscription, **without cards, new website design, or included redesign**. Final customer price MUST be confirmed against true second-year provider renewal charges, fees, taxes, and available margin before displaying it on sbcmia.com or collecting a renewal.
- Send renewal reminders at 60 and 30 days before the service expires, plus a final reminder at 7 days; disclose product, full annual price, taxes/fees, deadline and cancellation method.
- Obtain clear authorization for any recurring/automatic charge. Never silently enroll customers in auto-pay. If not renewed, give timely notice of potential loss of domain/site availability.
- Additional cards, custom edits, email hosting and website management are separate optional products.
- Preserve lawful customer access and eligibility for transfer; domain transfers can have GoDaddy/ICANN restrictions and do not necessarily transfer attached hosting.

## Owner economic review — critical
- Customer sale price $199; domain + builder estimated $108; cards and fulfillment estimated $42; current nominal gross contribution **$49 = 24.62%** before processing, labor, tax, and any separately proven reseller commission.
- The currently documented V66 checkout governor enforces a **30% minimum margin** for applicable checkouts. If recognized cost is $150, compliant price is at least **$214.29**; at a $199 price, recognized cost must not exceed **$139.30**.
- Never treat the asserted 40% reseller payment as *additional* profit until the specific transaction's commission eligibility and accounting are verified against an actual payout. Avoid double-counting markups already embedded in supplier charges.
- Do not bypass global stop, margin floor, owner approval, tenant price/cost isolation, payment-evidence or writer/recovery gates merely to force a checkout. Resolve product economics lawfully with supplier discounts, revised offer, validated accounting, or a separately reviewed and authorized pricing-policy exception implemented with audit trail.
- Keep reseller wholesale and customer retail payments clearly distinguished in the ledger.

## Fulfillment operating procedure
1. Customer submits the package order at sbcmia.com, reads scope and renewal disclosure, and authorizes a payment.
2. SBC verifies **real settled payment** via Square evidence (not merely a manually selected CRM `Paid` status).
3. SBC records the sale under the correct CRM tenant/customer; obtains domain and site details and an approved card proof.
4. Buy the approved domain and 12-month builder product in the customer-associated reseller account, verify service activation and domain ownership data; store vendor invoice/order IDs.
5. Build the one-page website using the agreed content. Send one proof; perform the permitted correction round; publish after approval.
6. Order 100 approved cards via VistaPrint Pro or 4over4; record supplier order, tracking and delivery.
7. Send a delivery receipt, customer access handoff, start and expiry dates, and renewal/cancellation instructions.
8. Track renewal reminders and optional upgrades in SBC Command Center. Do not send payment reminders or mark a transaction paid based only on a generated Square link.

## Launch gate (no 9.5 claim until evidence)
- Public $199 checkout and product wording explicitly show first-year term, included scope, exclusions, and accurate verified second-year renewal price.
- Customer profile/account separation and correct registrant control demonstrated on a safe, consented test.
- Vendor economics/margin and tenant scoping verified with actual provider costs.
- GoDaddy Published writer/recovery roles verified, signed Square test payment -> webhook -> CRM Paid -> order -> fulfillment tested with authorization; no duplicate charge.
- Live front-end checks: Chrome normal and incognito, light/dark, phone, owner login, Lorna's restricted login, demo account.
- Prospect and customer CSVs must not be accessible through public web assets and repository exposure must be remediated; no customer/lead data distributed in ZIP artifacts.
- Protect existing records, secrets, rollback branch and integrity receipt. Use a separately tested immutable release. Do not merge candidate PR #224 to Published on the strength of CI alone.

## Current deployment facts
At review time the deployed GoDaddy source branch was `a-sbc-rollback-oct27` at `cce256c`. Candidate PR #224 is staged and explicitly not production-approved. This document does not modify the live WordPress storefront, GoDaddy environment, or any customer account.

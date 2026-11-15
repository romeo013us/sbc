# SBC Website Value Sales Guide — safe draft

## Three reasons any business may benefit from a website

- **Get found:** a clear destination when a prospective customer searches or hears about the business. No promise of Google ranking.
- **Build trust:** verified services, accurate contact details and a professional presentation. Never fabricate reviews or credentials.
- **Make contact easy:** clear phone/contact actions, verified quote or appointment functions when enabled.

**20-second response:** "A website helps customers find you, builds confidence, and makes it easier to contact you. Which of those would help your business most?"

**Facebook objection:** "Keep Facebook. A website complements it with a dedicated place to show services, contact details and next steps."

## Commercial idea: $199 setup + optional $79/month care (NOT YET ACTIVE)

This PR changes **sales guidance only**; no catalog item, Square subscription, invoice, checkout price, recurring payment, customer record, phone calls, or hosting entitlement is changed. Starter has previously bundled one year of domain and website service. Before marketing care, approve a written scope specifying included hosting/domain, support time and edit limits, monitoring/backups actually available, renewal date, owner/customer rights, cancellation terms and first-month charge. Do not present the proposed $79/month as an available product until approved.

## User interfaces

- Command Center / Website Production: owner website pitch includes all three reasons, an objection response and proposed care policy.
- Employee Sales Caller: five additional original bilingual talk tracks in the existing Sales Scripts screen, with safe DNC rules preserved.
- Account Manager OS: new bilingual **Why a Website?** reference tab; no assignment or language queue changes.

## Evidence and QA

Dedicated source-only test: `node --test scripts/sbc-website-value-selling.test.cjs`. Legacy script count contract updated to 38 bilingual talk tracks. No customer or network access.

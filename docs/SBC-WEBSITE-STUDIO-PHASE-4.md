# SBC Website Studio — Phase 4: Art-directed composition & completion definition

## What was broken
The previous private Studio renderer repeated a generic split hero, decorative circle and service cards across virtually every industry. A palette and heading change cannot make those sites unique.

## What is now implemented (opt-in Website Studio)
- `art-directed-compiler.cjs` is called from `website-studio/index.cjs` instead of the legacy flat card composer. It retains the original validated JSON AST and approved-profile contracts.
- Different semantic markup **and** CSS compositions for (1) tint/automotive performance bay, (2) beauty editorial atlas, (3) dining menu story, (4) trades/project brief, (5) professional consultation desk, and (6) flexible local market.
- Three stable art-direction variants per category. The same business keeps its visual identity across refreshes; a new brand need not look exactly the same.
- Dynamic content is HTML-escaped; only approved profile services, contacts and optional approved reviews can render. Unverified research signals cannot enter the compiler.
- CRM-backed owner review suggestions populate the existing Website Studio panel where available. All suggested details require explicit owner confirmation before generation, and source-derived services are never silently promoted from unverified research.
- Pure static files remain `index.html`, `styles.css`, `site.js`, `design-tokens.json`, `layout-ast.json` with no React bundle or recurring AI API.
- Preview concepts remain private, indexed `noindex`, protected by owner permissions, tenant isolation, and the existing static QA preflight.
- `completion-gate.cjs` documents auditable launch evidence. It never labels a generated preview a production-complete site.

## Exact user workflow today
1. Open an existing customer website from Account 360 / Website Production.
2. Scroll to **Website Studio · Verified Business Profile**.
3. Review any CRM-prefilled identity, industry, contact details and confirmed services; correct or complete fields.
4. Explicitly approve facts. This is an owner-only, versioned, durable action.
5. Click **View new Website Studio concept**. The new art-directed private preview appears. The legacy builder remains available.
6. Final publication is still a separately approved fulfillment workflow.

## What “100% completed website” requires
A generated website is **not** complete just because all pages render. Real customer delivery needs:
- Customer-approved copy, accurate identity and services.
- Approved photos/media rights and real business logo.
- Operational inquiry and booking endpoints, spam/consent/privacy safeguards and delivery receipts.
- Customer-authorized hosting/domain setup and verified HTTPS.
- Real desktop/mobile browser review, accessibility and Lighthouse measurements, SEO/schema/sitemap checks.
- Final client sign-off, paid fulfillment evidence, backup and rollback.
- An authenticated, audited owner-authorized deployment that verifies those receipts.

The new completion-gate is intentionally **fail closed** even if receipts are present. The publishing transaction that would unlock release is not implemented here.

## Known blockers and what is not claimed
- This upgrade is currently on a draft PR; not live or merged.
- Existing default `/api/website-demos` generation still uses the older factory. The art-directed output is available through **Website Studio**, not yet as the universal default.
- The local browser Chromium navigation attempt timed out; static HTML, CSS and JS passed focused tests but true headless visual QA is not complete.
- No automatic verified image sourcing, instant public customer-site publishing, operational lead capture, drag/drop layout editor, or 9.5+/95+ verified site score.
- Representative 20-category tests prove safe generation, not visual originality or completed fulfillment for every possible customer.
- Launch requires staging DB/writer test, full GitHub CI, browser capture, customer-approved assets, a real form delivery check and a controlled rollout.

## Focused tests
`node --test scripts/sbc-website-blueprint.test.cjs scripts/sbc-website-studio-owner.test.cjs scripts/sbc-website-studio-static-qa.test.cjs scripts/sbc-art-directed-composer.test.cjs`

At authoring, 21 focused local tests pass with Node.js 22. GitHub CI status must be rechecked against the latest commit.

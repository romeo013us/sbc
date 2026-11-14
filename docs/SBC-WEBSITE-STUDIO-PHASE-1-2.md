# SBC Website Studio — Phases 1 and 2 (additive patch for PR #367)

This archive contains ONLY the new, additive website-studio modules and tests. It is **not a complete Command Center repository download**. Do not overwrite an entire Command Center directory with this patch. Install under the **same relative paths** in the PR #367 working tree.

## What is working

- Strict, bounded `verified_profile` and `research_signals` contracts; JSON Schemas and matching runtime validation.
- Source URL, confidence score, evidence status, and cautious website-presence classifications.
- Deterministic creative design tokens (7 industry verticals × 3 stable design variants).
- JSON section AST; verified services only; explicitly approved reviews only.
- Pure static compiler (`index.html`, `styles.css`, `site.js`, design token/AST JSON).
- Responsive mobile navigation and interactive service *request summary* that does NOT transmit visitor data.
- Escaping of business-controlled strings; static previews are always `noindex`.
- No new runtime dependencies, AI API calls, published domains, outbound requests, CRM mutations, or database migrations.

## Trusted invocation (Node.js 22)

```js
const {createPrivateConcept} = require('./enterprise/website-studio/index.cjs');
const {bundle,designTokens,layoutAst,research} = createPrivateConcept({
  verified_profile: verifiedProfileFromAuthorizedTenantScopedOwnerApprovedCRM,
  research_signals: sourceBackedSignalsForReview, // NEVER read by architect/renderer
  researchCompleted: true,
  quoteEstimatorEnabled: true
});
// Bundle files are UTF-8 strings, not uploaded or published.
// Write them only into an authorized, tenant-isolated private preview directory.
```

**No `verified_profile` should come from a caller-supplied request body.** The user interface must record owner approvals with server-enforced role, tenant and audit checks. This patch does not implement that backend/UI approval process; do not call the output fact-verified without it.

For approved prospect data already in the SBC factory, map `verifiedBusinessDetails` into the new approved profile **only after** an authorized server read checks `status==='Approved'`, `verified===true`, and records provenance/approver. Do not copy customer research fields into approved services.

### Test

```bash
node --test scripts/sbc-website-blueprint.test.cjs
```

### Missing before production

These are intentionally NOT present: live SERP / Places lookups, approval/denial UI, arbitrary page drag/drop editor, real CRM quote webhook, real price calculator, photo licensing/asset storage, browser QA and self-repair, domain publishing, DNS/SSL management, and verified public Lighthouse/9.5 score. The static compiler is opt-in and **does not replace the existing `sbc-prospect-site-factory.cjs`** or its routes. Live deployment must still require proof of customer approval, payment, permitted hosting/SSL and real form validation. A server-controlled publication step would strip `noindex` only after its release gate passes.

### What to do next

1. Review PR #367's existing tenant/owner authorization before connecting the trusted profile adapter.
2. Wire a new owner-only private-preview endpoint to this compiler; leave the legacy endpoints untouched.
3. Implement evidence review and audited approval UI; then a real webhook with consent, anti-spam, rate limits and durable CRM receipt.
4. Run original Command Center regression suite and real desktop/mobile browser tests, then staging; leave production unchanged until passing.

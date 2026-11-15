# SBC Hybrid AI Studio V5 — integration candidate (NOT production-approved)

Base: Website Studio V4 `d37e3a7c843a755828f4d5ae3903da9049e856ed` packaged runtime.

## Implemented

- SBC's deterministic website engine remains primary; AI affects **private visual design** and produces **review-only copy suggestions**.
- Only brand-new owner-created SBC website demos automatically request budgeted AI; existing records do **not** silently rebuild.
- Existing websites have an owner-only **Upgrade This Website With AI** control.
- An Approved website receives a **private proposal only**; published HTML, customer information, approval, pricing and forms do not change.
- A Draft or Pending website receives saved, versioned responsive design selections (`vibe`, `heroStyle`, `serviceLayout`, `density`). Suggested headline/subheadline are never published automatically.
- 40 USD monthly cap for provider-wide **metered** AI routes, 1.25 USD daily gate default, and a separate website-studio budget ledger with fixed 1 cent reservation per bounded request. **Other legacy OpenAI consumers may not be metered**: provider-side hard spend controls are still required. The global AI runtime gate continues to refuse key access unless `SBC_OPENAI_HARD_CAP_CONFIRMED=YES` (do not set without provider confirmation).
- `SBC_STUDIO_AI_ENABLED=true` opts the new site workflow into paid model calls; `OPENAI_API_KEY` required on the server only.
- Existing `SBC_DEMO_AI_ENABLED` paid calls are bypassed when `SBC_STUDIO_AI_ENABLED=true`, preventing two paid website-design requests.
- No image generation, checkout, domain publishing, client forms or public customer data changes in this V5 increment.

## Deployment status

**Not an uploadable GoDaddy release**: application `server.js` has changed, so the V4 `SBC-FLAT-RELEASE-IDENTITY.json` and `SBC-DEPLOY-RECEIPT.json` no longer match. Do not upload this patch as a release or bypass hash gates. Merge only after code review and CI, then produce a NEW, matching, independently tested release ZIP via the repository's V66 release workflow. Back up the shared MySQL database off-host before any staging action.

## Provider and secret requirements

1. Set/confirm a genuine **OpenAI provider-level monthly maximum** in the account; only then set `SBC_OPENAI_HARD_CAP_CONFIRMED=YES` on GoDaddy. The OS strips its OpenAI key when this is not confirmed.
2. Set `SBC_AI_MONTHLY_SPEND_CAP_USD=40` (or smaller), `SBC_AI_DAILY_SPEND_CAP_USD=1.25` (or smaller). Existing smaller environment values will continue to win.
3. Set `OPENAI_API_KEY` server-side and `SBC_STUDIO_AI_ENABLED=true` **on Preview first**. Never embed keys in JavaScript or this ZIP.
4. Test a newly created site, an existing draft, an Approved site, tenant isolation, cap exhaustion, data warnings, preview rendering, and rollback before deploying to Published.
5. Image generation is deliberately disabled until asset storage, licensing review, provider price accounting and rollback are implemented and tested.

## Developer verification

Run: `node --test scripts/sbc-website-hybrid-ai.test.cjs scripts/sbc-website-studio-owner.test.cjs scripts/sbc-website-studio-workspace.test.cjs scripts/v66-owner-openai-budget.test.cjs`

`npm run test:lead-accounts` additionally requires installing project dependencies (`express` etc.); this local offline workspace does not include them.

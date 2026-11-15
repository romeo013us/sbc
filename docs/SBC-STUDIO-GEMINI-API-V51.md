# SBC Website Studio V5.1 — Google Gemini provider (experimental)

This integrates the **Gemini API** with SBC's existing deterministic Website Studio. It does **not** invoke or copy the Google AI Studio Build Mode application builder.

## Included

- Owner-only **Choose AI design engine** dropdown: OpenAI or Google Gemini.
- Manual Google Gemini private proposals for existing websites. Approved/public website assets, customer facts, payments and publication remain untouched.
- Newly created SBC websites can use Gemini automatically **only** when explicitly configured as the default provider. Existing customer records are not bulk rebuilt.
- Strict JSON schema for four whitelisted design controls and unapproved headline/subheadline/rationale suggestions; generated HTML, scripts or executable code are never accepted.
- Minimal provider brief includes only scrubbed business name, industry, site tier and generic design instructions. No phone, email, source research or unverified services.
- Shared **$40 Website Studio** monthly reservation ledger, $0.01 held per request, conservative Gemini usage pricing, and ambiguous-error holds. This is an internal Studio allowance, **not a provider-wide or account-wide guaranteed ceiling**.
- No paid calls are made in the test suite or until the server-side Gemini API key and switches are configured.

## GoDaddy Preview configuration — *after a verified off-host MySQL backup*

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and configure only the **server-side** GoDaddy Preview secret `GEMINI_API_KEY` (or `GOOGLE_API_KEY`). Never put keys into a public JS file, repo, or chat.
2. In your Google billing/project controls, establish and verify a suitable spending limit or safe budget restrictions. Only after verification, set `SBC_GEMINI_HARD_CAP_CONFIRMED=YES`.
3. In Preview set `SBC_STUDIO_AI_ENABLED=true` and `SBC_STUDIO_GEMINI_ENABLED=true`.
4. To make **new SBC-created sites** automatically request Gemini design enhancements, set `SBC_STUDIO_AI_PROVIDER=gemini`. Otherwise OpenAI remains the default for new sites, while Gemini is a manual choice for existing sites.
5. Model defaults to `gemini-3.8-flash` (creative quality). Optional lower-cost allowlisted model: `SBC_STUDIO_GEMINI_MODEL=gemini-3.5-flash-lite`. Unknown model names are rejected.
6. In Website Studio select **Google Gemini**, press **Upgrade This Website With AI**, and inspect the private proposal and monthly ledger. Test one synthetic new website and one approved synthetic site; confirm the approved site is unchanged.

## Cost basis

The ledger deliberately uses the *higher* published 2027 Gemini 3.8 Flash token rates of $1.50 input and $7.50 output per million tokens even during Google's Nov–Dec 2026 promotion. Gemini 3.5 Flash-Lite uses $0.30/$2.50. Outputs are conservative estimates, not reconciled invoices, and include thinking tokens when reported. See https://ai.google.dev/gemini-api/docs/pricing.

## Tests and release gate

`node --test scripts/sbc-website-gemini-provider.test.cjs scripts/sbc-website-hybrid-ai.test.cjs`

`node --test scripts/sbc-website-*.test.cjs scripts/v66-owner-openai-budget.test.cjs`

**DO NOT deploy to Published** without GitHub CI, fresh artifact hashes, production off-host MySQL recovery verification, live GoDaddy Preview acceptance, provider billing confirmation, and independent visual testing. Gemini creative direction is not yet full Build Mode code generation, image generation, commerce or public website publishing.

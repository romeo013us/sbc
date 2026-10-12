# SBC OS V65.1.26 — Premium Demo Studio

## What changed
- Replaces the basic “Demo generated” confirmation with a responsive Demo Studio launched by the existing Customer 360 **Generate Instant Demo** action.
- Shows the generated customer-facing site inside the Command Center, with desktop/mobile preview modes, refresh, copyable absolute URL, and open-full-page action.
- Adds alternate design-direction generation (premium hybrid, editorial/luxury, tactile, minimal, professional). The selected direction is explicitly persisted on the demo object so an earlier AI plan does not silently override it.
- Adds a polished SBC “Custom website concept” ribbon to generated demo pages while preserving the existing industry-aware site generator and checkout flow.
- Adds email delivery through the existing SBC communications API, with owner authorization and a confirmation prompt.
- Adds SMS delivery through the existing SBC communications API; the UI requires explicit recorded consent and clear suppression flags, and the server remains the final enforcement point.
- Displays delivery results and provider IDs where returned; concurrent duplicate sends are blocked while the active studio request is in progress.
- Keeps the existing V65.1.25 Customer 360 action workspace and Lead Workspace launcher repositioning.

## Safety boundaries
- No database schema changes or SQL imports.
- No new GoDaddy environment variables; no Redis, wildcard DNS, or Nginx configuration requirement.
- No changes to payments, orders, fulfillment, owner veto, tenant isolation, recovery guards, or single-writer Preview/Published policy.
- SMS remains blocked unless the server's eligibility and suppression checks pass.
- The generated site is clearly labeled as a concept preview. It is not a claim that a production website has been published.

## Deployment verification still required
Local regression and renderer tests pass. A live GoDaddy deployment, browser walkthrough on the hosted instance, and actual provider delivery test were not performed during this build. Do not call the release live until Published logs and a controlled customer-safe demo test confirm it.


## Review fixes added before deployment
- The generated owner identity receives an explicit tenant before strict tenant authorization is enforced.
- Preview's MySQL query wrapper blocks schema-changing SQL before a connection is acquired, including DDL attempted by GET/status handlers.
- Read-query timeouts now classify SELECT CTEs as reads without treating data-changing CTEs as read-only.
- Customer 360 and Demo Studio recognize nested `recovery.required`; the server independently blocks email, SMS, and demo generation while recovery is unevaluated/required or the runtime is read-only.
- Editorial, tactile, minimal, and professional directions now change generated website CSS/layout rather than only metadata.
- Regression tests cover these fixes. GoDaddy runtime behavior still requires deployment verification; production recovery protections remain enabled.

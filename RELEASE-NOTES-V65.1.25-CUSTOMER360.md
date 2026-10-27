# SBC OS V65.1.25 — Customer 360 action workspace

## UI changes
- Customer 360 is the primary CRM customer click-through instead of the legacy two-action modal.
- Adds SBC business calling, email composer, SMS composer, quote/cart builder, fast-checkout quote selection, appointment, and activity actions when supported by the existing app.
- Checkout links can be sent only from an existing quote with a valid HTTPS payment URL and after an explicit consent confirmation.
- Paid/won/completed quotes cannot be sent for a second charge.
- Recovery/read-only mode disables outreach, quote/cart, checkout, demo and refund actions.
- Keeps existing demo/refund actions, with refund still owner-governed.
- Moves the Lead Workspace launcher from the lower-left sidebar/sign-out area to the lower-right corner on desktop and mobile.

## Test limits
- This patch changes UI routing and presentation only; it does not change payment state, recovery gates, or database data.
- Local static and regression checks do not prove GoDaddy deployment or live Square checkout.

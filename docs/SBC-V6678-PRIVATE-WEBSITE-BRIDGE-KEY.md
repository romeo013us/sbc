# SBC V66.78 — Website bridge on private persistent key storage

## Why

GoDaddy Node.js application secrets are at capacity. The V66.60 website bridge requires `SBC_WEBSITE_BRIDGE_KEY` to authenticate signed calls from sbcmia.com into the Command Center. If it is missing, the bridge rejects requests. **Do not disable HMAC verification or trust the browser Host header.**

This change adds a **second, explicitly private key source** for the Command Center: a server-side credential file in SBC's already-persistent `data/` directory. It does not add a secret to GitHub, JavaScript shipped to browsers, MySQL, or application logs.

## Supported configuration (after this change reaches Published)

1. Preferred: existing GoDaddy Published secret `SBC_WEBSITE_BRIDGE_KEY` (takes precedence).
2. Alternative when secret slots are full: `<published-app-root>/data/sbc-website-bridge.key`. This is a **regular private file**, NOT a symbolic link. It must have Unix permissions **0600** and contain exactly **64 hexadecimal characters** (32 random bytes), optionally followed by a final newline. The persistent-data symlink directory itself is expected in SBC's existing GoDaddy packaging.
3. SBC website PHP: store **the exact same key** outside `public_html` in `../sbc-website-bridge.key`, according to existing V66.60 website documentation, with permissions 0600.

The key must be generated with a cryptographically secure random-number generator. Example, on a trusted local system, to generate **a new key once**: `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"`. Do not paste the generated value into this chat, GitHub, tickets, screenshots, URLs, or logs. Use a secure private channel when provisioning both hosting environments.

Do **not** place the key in `public/`, `browser_public/`, `public_html/`, a repo file, or any uploaded ZIP. If the GoDaddy interface cannot create an appropriately protected file in the persistent directory, **do not try to work around file permissions**; instead, first free a Secrets slot by migrating an independently verified non-secret setting.

## Behavior and safety

- An existing nonempty `SBC_WEBSITE_BRIDGE_KEY` continues to win; behavior is unchanged for working deployments.
- Only if the environment variable is unset/empty does the validator attempt the private `data/` file.
- Missing files, world/group-readable files, symlinks, nonregular files, unreadable files, malformed keys and short keys fail closed with `SITE_BRIDGE_NOT_CONFIGURED`.
- Request authentication still requires the exact signed body, HMAC, nonce, timestamp, allowlisted hostname, allowed POST route and replay defense.
- The change neither generates nor persists keys automatically. It does not change users, business data, Square, Twilio, recovery/writer guardrails, or Lorna/demo isolation.

## Release and acceptance (do not deploy until verified)

1. Review and merge after PR CI passes. A new **source-matched prebuilt runtime** must be generated, validated and promoted; simply adding the module file to GitHub does not modify a published GoDaddy app.
2. Verify the packaged `enterprise/v6660-website-bridge.cjs` contains the new private-file resolver. Match compiled release identity and artifact receipt before updating Published.
3. Confirm Published's persistent `data/` path is writable and **not publicly served**, and place the credential with 0600 permissions through an authorized hosting administration path. No user self-service admin token entry is introduced.
4. Verify the website PHP uses the *same key* from outside `public_html`. No website account registration/login test should be attempted until both sides are configured.
5. In a designated staging tenant only: confirm valid signed website calls succeed, while tampered signatures, stale timestamps, wrong tenants, replay, and missing keys fail. Do not create synthetic records in the authoritative production CRM.
6. Then validate owner login, Lorna permissions, buyer demo isolation, Square checkout safety, website lead delivery, and recoverability. Complete independent live verification before any 9.5/10 production rating.

## What still requires owner action

Actual key provisioning on the Node and PHP hosting environments, and deployment approval, require GoDaddy control-panel access. No system access, credentials, or live PHP filesystem writes were performed by this change. The GoDaddy PAT/domain API is a separate integration and is **not** enabled by this website bridge fix.

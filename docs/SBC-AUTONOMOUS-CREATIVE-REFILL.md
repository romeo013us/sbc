# SBC autonomous creative refill — activation runbook

This source candidate adds an optional 06:00 America/New_York refill workflow. Its machine identity can only obtain missing-slot fingerprints and submit signed DRAFT artwork. No owner password/session, publishing rights, receipt claims, approval rights, or provider credentials are granted.

## Provisioning (owner-controlled, after integrated CI)
1. Apply the manual nonce migration and the existing creative inventory migration on an authorized writer after backup. Do not run either on Preview.
2. Generate a unique 32-byte HMAC key using a local cryptographic random generator and an independent Ed25519 signing keypair. Keep private material in secret stores; never commit it. Use a different key for every runtime.
3. On the intended writer host configure SBC_CREATIVE_IMPORTER_SECRET (canonical base64 32 bytes) and SBC_CREATIVE_SIGNING_PUBLIC_KEY (Ed25519 public PEM). Leave the GitHub workflow disabled until the host is verified.
4. Configure the GitHub repository secrets SBC_HOST_BASE_URL (HTTPS origin only), SBC_CREATIVE_IMPORTER_SECRET, SBC_CREATIVE_ED25519_PRIVATE_KEY. Set repository variable SBC_CREATIVE_REFILL_ENABLED to YES only after acceptance. Never expose the signing key on the web host.
5. Run the manual workflow once; inspect staged drafts and approve the exact artwork using the existing owner UI. Verify actual published-writer readiness. The scheduled workflow uses both 10:00 and 11:00 UTC with an Eastern-time guard, avoiding DST drift. GitHub scheduling is best-effort and late runs outside the 06:00 hour do not send requests; investigate failures rather than claiming precise delivery.
6. Low stock produces a workflow warning and unsuccessful check so the owner can enable GitHub Actions failure notifications. This is not proof of an independently delivered notification; keep the existing owner escalation automation until delivery is verified.

## Security and operation
- Signed requests cover method, exact route, timestamp, nonce and JSON body hash; constant-time comparison and five-minute timestamp window.
- MySQL unique nonce constraint prevents replay across instances; failures reject requests rather than permit writes.
- No automatic approvals. The 14-slot buffer is a target; drafts do not count as approved.
- A timeout does not establish import failure; rerun a fresh plan, never blindly retry a signed request.
- External publisher, provider receipt reconciliation, per-channel live acceptance and automatic owner notification delivery remain separate integration gates.
- No credentials were provisioned, no production migration executed, and no live publishing was initiated by this PR. GitHub runner availability and quotas must be checked before activation; no extra spending is authorized.

# SBC OS V64.3.3 — 21-Day Unattended Operations

Four operational profiles hardened as one governed runtime:
1. Hardened shard isolation with per-shard concurrency caps and failure quarantine.
2. Durable operation idempotency ledger with ambiguous-provider HOLD_FOR_RECONCILIATION.
3. Consent-aware outbound suppression with configurable daily and trailing-24h budgets.
4. Dependency-isolated emergency gate so one provider can be frozen without freezing unrelated protected routes.

MySQL worker pools default to four connections per worker process (environment-configurable, capped at eight) to avoid shared-host overcommit. No new secrets are required.

This release does not authorize autonomous refunds, money movement, destructive database operations, credential/security changes, or CRM restoration.

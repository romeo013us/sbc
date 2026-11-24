# SBC call archive V1 — staged foundation (#441)

The existing 1,000-call rolling snapshot stays authoritative until rollout is proven. This change adds an indexed MySQL archive and immutable revision records, **not an activated production call archive**.

- Stable tenant + log identity, optional unique session fingerprint, source timestamps and explicit status/outcome. Provider CallSid is a stored correlation value, not proof of connection. No audio recording.
- Every distinct saved revision is retained; exact replays do not duplicate it. An older snapshot cannot replace a newer current view. Search is scoped by authenticated actor and tenant; caller scope cannot be overridden by request filters.
- Staging verification uses 10,000 completely fictional attempts and a connection restart. No production records are copied into CI or GitHub.
- Before enabling writes: approve retention and erasure policy (including existing contractual/legal holds, access/export permissions and backup expiry); run reviewed additive schema migration on staging; wire archive writes into the existing authoritative workspace transaction before the rolling snapshot trims history, including historical outcome corrections. Existing legacy rows that lack valid ownership or identity must be reconciled, never silently reassigned. Backfill must preserve real records only.
- Before switching history reads: prove count and revision reconciliation, stable session recovery after eviction, actual writer lease and role restrictions, archive backup and restore, bounded query performance, GoDaddy Preview and Published acceptance. The rolling cap remains untouched until then.
- Production activation, approved retention window, and erasure/export operational procedure remain outstanding. No automatic purge is introduced. Do not call this unlimited or permanent retention.

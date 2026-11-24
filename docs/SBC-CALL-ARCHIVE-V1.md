# SBC call archive V1 — staged foundation (#441)

The existing 1,000-call rolling snapshot stays authoritative until rollout is proven. This change adds an indexed MySQL archive and immutable revision records, **not an activated production call archive**.

- Stable tenant + log identity, optional unique session fingerprint, source timestamps and explicit status/outcome. Provider CallSid is a stored correlation value, not proof of connection. No audio recording.
- Every distinct saved revision is retained; exact replays do not duplicate it. An older snapshot cannot replace a newer current view. Search is scoped by authenticated actor and tenant; caller scope cannot be overridden by request filters.
- Staging verification uses 10,000 completely fictional attempts and a connection restart. No production records are copied into CI or GitHub.
- Before enabling writes: approve retention and erasure policy (including existing contractual/legal holds, access/export permissions and backup expiry); run reviewed additive schema migration on staging; wire archive writes into the existing authoritative workspace transaction before the rolling snapshot trims history, including historical outcome corrections. Existing legacy rows that lack valid ownership or identity must be reconciled, never silently reassigned. Backfill must preserve real records only.
- Before switching history reads: prove count and revision reconciliation, stable session recovery after eviction, actual writer lease and role restrictions, archive backup and restore, bounded query performance, GoDaddy Preview and Published acceptance. The rolling cap remains untouched until then.
- Production activation, approved retention window, and erasure/export operational procedure remain outstanding. No automatic purge is introduced. Do not call this unlimited or permanent retention.

## Atomic capture integration (next release candidate)

The canonical writer now passes its exact serialized next workspace payload to the archive helper within the existing MySQL transaction and writer lease, immediately before saving the workspace row. The helper locks and captures the previous committed workspace as well, including a real row that would otherwise be evicted by the rolling cap. Both revisions and workspace changes roll back together on failure. No separate DDL or commit in the capture path.

Capture is **off by default**. Enable only after staging schema verification, legacy ownership reconciliation, approved retention/erasure/export policy and a successful real backup drill. Requires all of `SBC_CALL_ARCHIVE_CAPTURE=YES`, `SBC_CALL_ARCHIVE_RETENTION_APPROVED=YES`, and a nonempty `SBC_CALL_ARCHIVE_RETENTION_POLICY_REF` referencing the reviewed policy. Never set these merely to pass a gate. Invalid legacy records must be reconciled rather than silently dropped; a capture failure rejects the surrounding write. The existing read API and rolling cap stay unchanged. Historical-session recovery and archive-backed search cutover are separate remaining changes. This two-batch implementation has bounded input but must be benchmarked on the real workload before enablement.

The isolated MySQL regression now exercises 1,001 distinct records across two successive 1,000-record workspace snapshots, verifies atomic rollback and commit, and checks repeated capture does not duplicate revisions. Tests pending until CI completes.

## Scoped session recovery primitive

`findSession(conn, scope, input)` uses the authenticated tenant and actor plus the exact session/customer/manual-dial identity. It returns the latest archived payload or null; mismatched stored identity fails closed. Owners cannot use this replay helper to access another actor's session. The general history list is a separate authorization surface. This helper is read-only; live autosave/correction routing and search cutover still need integration, writer coordination and hosted acceptance. No production switches or schema changes are included.

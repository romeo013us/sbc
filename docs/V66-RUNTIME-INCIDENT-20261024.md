# SBC V66 runtime incident — October 24, 2026

## Verified from GoDaddy log
- Preview port 20010 was explicitly read-only; skipped workers and DDL are intentional there.
- Published port 20011 acquired an exclusive writer lease and loaded relational MySQL.
- Published order count changed from 175 to 251 between 18:32 and 19:26 local. This is a snapshot count difference, **not evidence that 76 purchases happened**. Reconcile IDs, created_at, tenant_id, origins and idempotency keys through read-only queries before doing any updates.
- Tenant-dependent background operations repeatedly failed with TENANT_CONTEXT_REQUIRED. Keep the guard intact; identify the originating job and supply validated tenant identity before dispatch.
- The V65.1.44 baseline-gated startup patch can implicitly enable schema work when ENABLE_DDL is absent. Review and tighten this opt-in behavior in a separate validated change.
- Some requests were aborted or had unreadable streams; correlate with paths and request IDs before attributing cause.

## Must-pass release gates
1. Obtain a restorable backup and verified customer/order baseline; no blind deletes, imports, or reseeding.
2. Confirm no duplicate order IDs, tenant leaks, or automation-generated false orders in the order delta.
3. Instrument tenantless worker rejections with sanitized job identity; repair the scheduler, not the authorization guard.
4. Verify exclusive writer lease remains held under transient MySQL connection loss; recover safely without automatically clearing recovery locks.
5. Verify schema migration opt-in, live readiness separate from listener liveness, and authenticated CRM flows.
6. Run Node CI and browser-level functional checks before controlled deployment.

**Decision: HOLD unrestricted production automation.** This documentation creates no changes to the running system.

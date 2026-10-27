# SBC isolated tenant-isolation sandbox

This sandbox runs a deterministic concurrency test for the read-only Customer 360 repository. It has no production credentials, no MySQL connection, no outbound network, a read-only filesystem, a non-root user, and bounded CPU/memory/processes. It validates repository query construction and AsyncLocalStorage context separation; it is **not** a substitute for staging against an isolated database clone.

## Run with Docker Compose

From the repository root:

```bash
docker compose -f infra/sandbox/docker-compose.yml run --build --rm tenant-isolation-tests
```

Expected output includes `"ok":true` and `"concurrentTenantIsolation":"PASS"`.

## Local run (no Docker)

```bash
node scripts/tenant-repository-isolation-test.js
node scripts/enterprise-safety-modules-test.js
node scripts/diff-leads-reconciliation.js /path/to/SBC_Command_Center.sql
```

The reconciliation command is read-only. It does not prove a historical baseline unless the input is a verified pre-incident snapshot. Never use synthetic rows or guessed IDs to restore production data.

## Customer repository contract

- Public methods derive tenant ID only from authenticated `AsyncLocalStorage` context.
- Every customer read has an explicit parameterized `tenant_id = ?` predicate.
- The repository exposes reads only; no inserts, updates, deletes, or recovery bypass.
- Tenant IDs must be positive numeric database IDs, matching SBC's current `tenantIdForUser()` contract.
- If `sbc_customers.tenant_id` is absent, the SQL fails closed. Do not add a default tenant assignment to production without an approved, evidence-based ownership mapping.

## Staging gate

Before any live deployment, clone the schema/data into a separate staging database, verify the tenant column and ownership mappings, run the migration checks, exercise two test tenants, and verify that owner-only refund controls and the recovery lock remain active. Never point this sandbox at production or put production secrets into this container.

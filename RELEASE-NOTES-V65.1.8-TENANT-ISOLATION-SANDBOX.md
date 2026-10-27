# SBC OS V65.1.8 — Tenant Repository Isolation Sandbox

## Included
- Read-only Customer 360 repository with explicit parameterized `tenant_id` predicates.
- Tenant identity is taken from the authenticated AsyncLocalStorage context; public methods accept no caller-supplied tenant override.
- Positive numeric tenant-ID validation aligned with the existing server resolver.
- Concurrent tenant isolation test with cross-tenant fixtures and a mock SQL pool.
- Docker Compose sandbox with no network, read-only filesystem, non-root execution, dropped capabilities, and CPU/memory/process limits.
- Updated release identity and regression test wiring.

## Explicit limits
- The repository is an additive module; existing SQL calls are not automatically routed through it. It does not prove whole-application tenant isolation.
- The Docker sandbox uses a mock pool and does not connect to MySQL. Staging verification against a separate database clone remains mandatory.
- The repository fails closed if `sbc_customers.tenant_id` is missing. It does not assign tenant ownership or alter schema/data.
- The five alleged missing customer records are not restored or treated as verified. Their IDs, email identities, and claimed provenance require a genuine authoritative pre-incident baseline.
- Recovery lock and outbound safety gates remain unchanged and must stay engaged until reconciliation is approved.
- No production deployment, live migration, payment, or customer-data mutation was performed.

## Verification
Run:

```bash
node scripts/tenant-repository-isolation-test.js
node scripts/enterprise-safety-modules-test.js
node scripts/reconciliation-audit-test.js
node scripts/v6428-recovery-isolation-test.js
node scripts/predeploy-open-gate.js
```

Run the isolated container test from the repository root:

```bash
docker compose -f infra/sandbox/docker-compose.yml run --build --rm tenant-isolation-tests
```

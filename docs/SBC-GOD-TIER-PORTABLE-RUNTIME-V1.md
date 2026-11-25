# God Tier portability — acceptance ladder

This PR adds an off-provider, disposable readonly boot test. It does not deploy to a new host or restore production data.

## Single-command isolated rehearsal

On an approved Linux workstation with Node 22, Docker, Python 3 and Bash, obtain the trusted clean-directory canonical candidate ZIP from a successful staged workflow. Independently validate its source SHA and ZIP digest against the corresponding CI report, then obtain the inventory digest bound to the verified ZIP.

```sh
bash scripts/sbc-portable-isolated-boot.sh /private/candidate.zip VERIFIED_SOURCE_SHA VERIFIED_INVENTORY_SHA256
```

This creates a private disposable MySQL 8 database, a SELECT-only account, an internal Docker network, and new persistent-state volumes. It installs public dependencies only at build time. No host port is published. Runtime internet access and production credentials are absent. The harness requires the actual application HTTP health endpoint to show that recovery was evaluated, MySQL recovery is required, and no writer lease was obtained. It additionally checks that the empty schema was not mutated.

An empty database correctly fails recovery; this is not a hydrated CRM or a production-ready deployment. The test must fail if the application falls back to non-MySQL storage or reports unsafe readiness. All containers and test volumes are removed after the rehearsal.

## God Tier gates still required

1. Exact immutable runtime and inventory verification.
2. Isolated Node 22 + MySQL 8 boot with readonly empty-schema safety.
3. Restore a sanitized representative dataset using existing encrypted-backup and strict restore tooling; verify digests and row counts.
4. Hydrated readonly app, authenticated role/workstation checks, real Chrome desktop/mobile acceptance.
5. Explicitly authorized isolated writer test: exclusive lease, migrations, backup/restore, failure injection and restart persistence; mock or sandbox providers only.
6. Measured recovery point and recovery time, a documented rollback, and owner-approved hosting cutover.

Do not bypass minimum CRM counts, recovery checks or writer leases to obtain a green report. No production data, provider calls, new hosting plan, or live cutover is authorized by this test.

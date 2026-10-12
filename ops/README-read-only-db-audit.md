# SBC read-only database audit

## Purpose
Collect aggregate row counts, tenant distributions, webhook/idempotency status counts, and duplicate idempotency-key group counts. It never selects customer-level rows and does not execute DDL/DML.

## Run
Run this from the SBC app runtime where the existing GoDaddy-injected `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` variables are present:

```sh
node ops/read-only-db-audit.js
```

It requires the already-declared `mysql2` dependency. It prints JSON aggregates to stdout and closes its short-lived connection. It does not print credentials. Missing tables are reported as warnings and are not queried. This is a diagnostic script, not an HTTP endpoint.

## Tests
```sh
node --test ops/read-only-db-audit.test.js
```

The tests use a fake connection; they do not connect to or validate the live database.

## Safety
- Do not upload this file through GoDaddy's **Import SQL** interface. That interface drops existing tables before import.
- Preview and Published share the same database.
- Do not use the output alone to restore data, lower the authoritative baseline, or unlock the recovery gate.
- A database account with read-only grants is preferred. The script itself issues only SELECT queries.

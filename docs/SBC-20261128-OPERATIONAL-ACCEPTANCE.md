# November 28 operational acceptance and recovery

Candidate extends the tested V2 compensation repair. Never deploy raw source or disable the writer, recovery or checksum gates.

## Staging sequence
1. Verify exact release SHA and inventory in the GoDaddy app; keep Command Center branch a-sbc-master. Preview is read-only.
2. Take and independently verify a restorable MySQL backup. Use an isolated writable staging database; apply the existing 20261122_001_sbc_sales_command.sql first (four commission tables), then 20261127_001 through 004 (workforce) and 20261128_001 (public market evidence), in order. Check for incompatible existing tables before applying; CREATE IF NOT EXISTS does not repair an incompatible schema. Do not enable startup DDL. Run owner Sales Command schema readiness and verify the actual writer lease. Schema presence alone is not complete acceptance.
3. Check the existing owner Trusted Leads preview, inspect held records and confirm the real research provenance before an authorized batch. Owner acceptance is not independent verification or consent. Reconcile counts after reload; do not force approvals on rejected, suppressed or inconsistent records.
4. Only after the market evidence migration and writer checks, set SBC_MARKET_BACKGROUND_REFRESH=true in the approved writer runtime configuration. Verify history, source coverage and retry state after reboot; keep Preview read-only. Public market evidence is not qualified demand. Do not enable a second marketing scheduler.
5. Run controlled owner and account-manager role tests, Academy training and certification, call save/next and Spanish handoff, Square sandbox recurring activation and idempotent delivery, restoration, and provider post readbacks. Record exact version, timestamps, test results, and trace references without credentials or customer data.
6. Promote only a reviewed, sealed release with current base and successful CI. Hosted acceptance and production approval are separate. Leave outstanding acceptance issues open until their requirements are met.

No production migrations, lead approvals, customer contacts, charges, payroll changes, external publishing or hosted tests are performed by this source repair.

## Live owner report: November 28
Sales Command reported all four commission tables absent; workforce readiness previously stopped before its own check. Trusted Leads reported 820 records, 550 eligible, 0 previously approved, 270 held. These are observed UI counts, not independent verification or post-approval receipts. The owner must run the approval in the actual published writer after reviewing the eligible research. Never force the held records to pass or claim provider verification. After migrations, verify both readiness endpoints, configure the existing Account Manager profile, then review the signed trial and Academy certification. Record actual backup/restore evidence and live acceptance before certification.

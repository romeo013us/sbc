# SBC OS V60.4.0 — STATE KERNEL

V60.4.0 builds the State Kernel directly on top of V60.3 Experience OS.

## Core architecture
- Durable append-only state events with tenant + aggregate sequencing.
- Idempotent event identity and cryptographic event hashes.
- Transactional projection updates: authoritative persistence commits before the in-memory read projection is refreshed.
- Rebuildable Customer/aggregate projections from the durable event stream.
- Command Bus with durable idempotency and explicit authorization state.
- Logical workload cells: CORE, SALES, TELEPHONY, FULFILLMENT, AI.
- Governed Kim lifecycle: OBSERVE → DIAGNOSE → RECOMMEND → APPROVE → EXECUTE → VERIFY → ROLLBACK.

## Safety boundaries
- No autonomous source-code mutation.
- No autonomous financial balance manipulation.
- No browser-side optimistic write is authoritative for financial state.
- Existing owner-only, ledger, Square, Twilio, tenant-isolation, and refund controls remain authoritative.
- No new GoDaddy environment secrets are required.

## Operational APIs
- `/api/state-kernel/health`
- `/api/state-kernel/events`
- `/api/state-kernel/projection/:tenantId/:aggregateId`
- `/api/state-kernel/timeline/:tenantId/:aggregateId`
- `/api/state-kernel/commands`
- `/api/state-kernel/governance`
- `/api/state-kernel/cells/heartbeat`
- `/api/state-kernel/cells/:tenantId`
- `/api/state-kernel/projection/rebuild`

## Migration
`migrations/20261007_010_v604_state_kernel.sql`

## Verification
- State Kernel unit suite: PASS
- Experience OS suite: PASS
- Full syntax sweep: required before deployment
- GoDaddy production runtime: not claimed until deployed and logs are reviewed

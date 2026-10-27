# SBC V60.3.0 — Experience OS

## Purpose
V60.3 adds the customer/workforce experience layer on top of the V60.2 Commercial OS and V60.1 God-Tier integrity foundation.

## Included
- Customer 360 read model combining tenant, health, profile, ledger and timeline state.
- Local-first client read-model cache with server-authoritative snapshots and ETags.
- Metadata/custom-field profile layer without dynamic SQL schema mutation.
- Role-specific work queues for Owner, Sales Manager, Sales Rep, Lead Researcher, Customer Success, Fulfillment and Finance.
- Logical cell registry for tenant/workload isolation and future physical sharding.
- Durable Kim governance trail: OBSERVE → DIAGNOSE → RECOMMEND → APPROVE → EXECUTE → VERIFY → ROLLBACK.
- Additive MySQL migration and authenticated Experience OS APIs.

## Safety boundaries
- No AI-generated source code is written into production automatically.
- No autonomous pricing changes, token-balance mutation, payouts or financial ledger rewrites.
- Financial events remain append-only and idempotent under the Commercial OS.
- Server remains authoritative; local-first behavior is a read/UX optimization, not an alternate source of truth.

## Runtime identity
- BUILD_VERSION: 60.3.0
- Package release: 60.3.0
- Base: V60.2.0 Commercial OS / V60.1 God-Tier integrity controls

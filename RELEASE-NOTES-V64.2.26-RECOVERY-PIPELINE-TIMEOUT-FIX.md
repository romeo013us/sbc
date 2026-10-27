# SBC OS V64.2.26 — Recovery Pipeline Timeout Fix

## Purpose
Keep the production pipeline GET endpoint strictly read-only so recovery-mode stale-epoch persistence cannot block the SBC cockpit.

## Changes
- `/api/v24/production/pipeline` no longer calls `megaSave()` during a GET.
- Pipeline state is copied into a transient in-memory view before paid-order/job stage reconciliation.
- Recovery mode is explicitly reported as `recoverySafe`.
- No CRM/customer/order/revenue records are mutated.
- Existing V64.2.25 recovery lead projection remains read-only and visible through `/api/bootstrap`.

## Safety
The recovery guard remains authoritative. No `sbc_meta` epoch is forced or modified by this release.

# SBC OS V60.1.1 — GoDaddy Boot Fix

## Production blockers fixed

- Release identity gate now accepts package release `60.1.1` and retains `60.1.0` as a supported rollback release.
- Fixed the enterprise MySQL DDL for `sbc_lead_quarantine` by quoting the `row_number` identifier, which is treated as a reserved/function-related identifier by the target MySQL runtime.
- Updated package/runtime release identity to `60.1.1`.

## Validation

- V60.1 God-Tier foundation gate: PASS
- God-Tier scenario suite: PASS
- Security static checks: PASS
- Federation validation: PASS
- Secret audit: PASS
- JavaScript syntax audit: 407 files / 0 failures
- Direct release identity check: PASS

This release still requires real GoDaddy/MySQL runtime verification after deployment.

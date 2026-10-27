# SBC OS V65.0.8 — Startup Fail-Closed Recovery Gate

## Production defects addressed
- API write requests now fail closed until the authoritative MySQL recovery census has completed; requests cannot slip through during the startup window when the recovery flag has not yet been evaluated.
- Expected `MYSQL_RECOVERY_REQUIRED` persistence rejections are logged as controlled recovery outcomes and no longer force the process to exit. Other unhandled rejections retain the existing fatal behavior.
- Kevin runtime status now reports version 64.2.28, matching its existing runtime signature. This is a subsystem version, separate from the SBC release version.
- Preserves the 248-record recovery baseline and all existing financial and recovery controls. No database records are inserted, deleted, restored, or reclassified by this patch.

## Verification
Run `npm run test:v6508-recovery-gate` in the package. This is a local code test; deployment and live database recovery remain separate acceptance steps.

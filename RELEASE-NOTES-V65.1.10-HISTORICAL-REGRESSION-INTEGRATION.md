# SBC OS V65.1.10 — Historical Regression Integration + Lead Workspace Rebuild

## Source comparison
Reviewed local archives V55.8.20, V55.8.22, V55.10.0, V55.10.2, V55.17.9, V55.18.1, V55.18.3, V55.18.5 and the V65.1.8 lead-workspace candidate. ZIP integrity checks passed for the selected archives.

## Changes
- Fixed a route-registration nesting defect in `routes/crm.js`: the V65.1.10 read-only lead endpoints had been registered inside the relational Customer 360 request handler, so they would not exist at application boot until that endpoint was called. They are now registered at module initialization.
- Added a tenant-scoped direct MySQL lead-create endpoint patterned after the V55.18.0 direct-persistence approach. It uses prepared statements, transaction boundaries, duplicate checks, post-insert verification, and an activity record; it does not call the broad snapshot `saveData()` writer.
- The write endpoint has a second explicit recovery check and fails closed if the recovery callback is missing or reports recovery required. The existing global recovery-write middleware remains in front of it.
- Updated release identity and cache-busting for the new workspace assets.
- Added a startup route-registration and recovery-gate regression test.
- Retained V65.1.8 polling backoff and visibility-aware polling fixes.

## Explicitly not done
- No GoDaddy deployment was performed.
- No production MySQL connection was opened by this build process.
- No production database writes, deletes, restores, migrations, or recovery unlocks were performed.
- No old `sbc-render-restore.js` was copied blindly: V65's current renderer already preserves `window.sbcPrimaryRender`, and an unconditional legacy renderer reset could interfere with newer wrapper-based modules. The old renderer fix is retained as a regression reference, not pasted over the modern renderer.
- No old training, timeclock, mission-control or workforce files were blindly copied into V65; those archives were used as regression references because their route, schema and renderer assumptions differ.

## Verification boundary
The route-registration test and focused static tests are local source checks. They do not establish live GoDaddy behavior. Production and Preview share MySQL, so deployment remains gated on an authoritative pre-incident backup, recovery reconciliation, and an approved rollback point. Keep the recovery lock and emergency gate engaged until the missing-record mismatch is resolved.

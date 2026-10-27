# SBC OS V65.0.7 — Recovery Write Gate and Rejection Safety

## Changes
- Adds a central API write gate that returns HTTP 423 while authoritative MySQL recovery is required, before route handlers can mutate in-memory business state.
- Keeps `/api/login` and `/api/logout` available so the owner can access the recovery cockpit and sign out.
- Leaves read-only GET/HEAD status and diagnostic routes available.
- Removes local JSON serialization from `saveData()`'s recovery-rejection path. A recovery read-model projection is not a trusted backup and must not overwrite local state.
- Does not lower the 248-record recovery threshold, promote lead projections, seed leads, or enable background automation.

## Validation
Run `npm run test:v6507-recovery-write-gate`. This is a local package test; it does not verify live GoDaddy deployment or resolve the authoritative database recovery requirement.

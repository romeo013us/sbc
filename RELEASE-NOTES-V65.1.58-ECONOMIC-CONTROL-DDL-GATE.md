# SBC OS V65.1.58 — Economic Control DDL Gate

## Fix
- Prevent recurring Economic Control `ensureTables()` calls from attempting schema-changing SQL in Preview or any non-writer runtime.
- Schema initialization is permitted only when the runtime is the Published writer, DDL is explicitly enabled, recovery has been evaluated and is clear, and the exclusive MySQL writer lease is held.
- Keep the Preview HTTP/API listener available without allowing the Economic Control background cycle to trigger `SBC_PREVIEW_DDL_BLOCKED`.

## Safeguards
- No customer records are seeded, fabricated, or deleted by this patch.
- Recovery protection, tenant isolation, and the exclusive writer lease remain required.
- The patch fails closed if the expected Economic Control function cannot be identified.

## Verification
- Regression tests cover supported `ensureTables` declaration forms and fail when no function is found.
- GitHub Actions must pass the new test and full release build before deployment.

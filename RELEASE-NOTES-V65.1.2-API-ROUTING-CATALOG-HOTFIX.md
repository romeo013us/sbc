# SBC OS V65.1.2 — API Routing, Catalog Null Safety, and Release Identity Hotfix

## Root causes addressed
- The Express SPA catch-all was registered before several API routes added later in `server.js`. Requests such as `/api/v56240/growth/status` could therefore receive `index.html` instead of JSON. The API JSON 404 handler and SPA fallback are now terminal handlers, after the route registrations.
- The bootstrap client assigned `state.data.catalog` directly to `state.catalog`; a null catalog then crashed dashboard/package rendering when code accessed `state.catalog.packages`. Both served and mirrored client entrypoints now normalize catalog packages/services to arrays.
- The visible UI finalizer forced the header to V65.1.0 and the agent panel used 64.3.0 as its failure fallback. Those identities now align with V65.1.2.

## Safety boundaries
- No database rows were inserted, updated, deleted, or restored by this build.
- The MySQL recovery lock and owner-controlled financial restrictions remain unchanged.
- This package does not claim that the authoritative MySQL snapshot has been restored or that production has been deployed.

## Verification
- JavaScript syntax checks are required for all changed JavaScript files.
- Targeted UI/recovery, growth recovery guard, authentication HTML fallback, and V65.1.2 routing/catalog/release regression tests are included.
- Production must be verified after deployment by checking that `/api/v56240/growth/status` returns JSON (not the application HTML), the dashboard renders with a missing catalog safely, and the recovery lock remains active.

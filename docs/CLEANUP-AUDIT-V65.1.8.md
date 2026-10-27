# SBC OS V65.1.8 Distribution Cleanup Audit

## Scope
Audited source: `SBC-OS-V65.1.8-TENANT-ISOLATION-SANDBOX-GODADDY.zip`, the available V65.1.8 package. This report does not claim to describe any other ZIP or local folder.

## Measured source contents
- ZIP entries: 1,271 (files plus directory entries)
- Regular files: 1,029
- Compressed ZIP size: 4,425,178 bytes
- Nested `node_modules`: 0
- Nested ZIP archives: 0
- Repeated `data/evolution/staging/evo_*` bundles: 38
- Files across those bundles: 152
- All 39 bundles have byte-identical content at the same relative paths.

## Removed from this distribution copy
Removed only the 38 repeated UUID-named staging bundles (152 files) present in the source ZIP. Each bundle contains a SQL migration, browser JS, route JS, and a test file. The first three files explicitly label themselves sandbox-only/scaffold and the test file tests only that scaffold. Repository-wide search found no production runtime code loading those UUID-specific filesystem paths; the production evolution engine stages proposals and runs in MySQL tables. The original archive remains unchanged in the workspace.

## Deliberately preserved
- `server.js`, `package.json`, runtime routes, workers, middleware, config, migrations, and `public/` assets.
- `browser_public/` assets: some regression tests and release metadata reference this tree, so duplicates were not removed without full dependency proof.
- `starter-leads/`: runtime startup and lead tools reference these paths. The files include candidate lead data; review privacy and transfer rights before sharing the source package with a buyer.
- Historical release notes, manifests, and tests: some automated checks may depend on them. They are not deleted merely because they are descriptive.
- The MySQL recovery guard and all fail-closed protections.

## Verification limits
- This is a conservative distribution cleanup, not a fix for GoDaddy's platform-owned `CLEANUP_FAILED` import/commit error.
- Full `npm run test:all` passed on the original extracted tree before cleanup. The same suite is rerun on this cleaned tree as part of packaging verification.
- The active customer baseline remains unresolved at 243 versus a guard requirement of at least 248. No customer records were inserted or modified.
- No GoDaddy secrets, live databases, or external provider settings were changed.
- Passing local tests does not constitute live GoDaddy acceptance or prove every SQL route is tenant-scoped.

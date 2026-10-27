# V65.0.2 Recovery / Identity Audit and Patch

## Findings from the supplied archive
- `package.json` and `config/release-identity.js` both declare `65.0.1`; `server.js` derives `BUILD_VERSION` from `RELEASE_VERSION`. This is not a package/config identity mismatch.
- The CRM floor is a hard-coded constant in `server.js`: 248 customers and 238 active leads. Release notes say those figures came from the last verified pre-corruption runtime. The archive does not show a manifest-signature calculation dynamically deriving 248.
- The browser shell still declared V64.3.0 and most assets used `?v=64.3.1`; the client freshness guard also used 64.3.1. The shell and cache version are now aligned to V65.0.2 to prevent old UI assets from appearing current.
- Several old tests were pinned to V64.2.28 or searched for retired strings. Recovery startup and runtime integrity tests have been aligned with the current implementation.
- Five CRM write endpoints changed in-memory state before `saveData()` could reject recovery-mode writes. They now return HTTP 423 before any mutation while `MYSQL_RECOVERY_REQUIRED` is true.

## Safety remains unchanged
- No synthetic leads were added.
- The 248-customer floor was not lowered or bypassed.
- No database restore/import was performed.
- Outbound publishing, outreach, financial mutations, and fulfillment remain disabled in recovery mode; growth content may only be staged.

## Deployment note
This is a source ZIP patch only. It has not been deployed to GoDaddy and has not been tested against the live MySQL database. Run the included local tests before deployment.

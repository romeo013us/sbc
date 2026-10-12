# V65.1.22 pin-fix (only hotfix-assets/apply-v6522-api-stabilization.js and the HOTFIX_PATCH_ID in bootstrap.js changed)

## Problem found in the uploaded 65.1.22
Applying the overlay to the source and running the source suite (`npm run test:all` inside the extracted tree) FAILED:
- the overlay set package/identity to 65.1.22 but left `VERSION`, the identity `patch:21`, the UI label and the
  frontend cache key `?v=65.1.21-recovery-authfix` unchanged, and left several tests pinned to 65.1.21;
- real deployment risk: the patch changes public/v32-9-enterprise.js, but index.html still loaded it with the OLD cache key,
  so browsers could keep serving the cached pre-fix file.

## Fix
The overlay now moves every release marker together: VERSION, identity patch number, public/*.js|html|css (this bumps the cache key),
and the scripts that pin the previous overlay's version. Applying it twice changes nothing.

## Verified (offline)
- `node bootstrap.js --verify` PASS, `npm run test:all` (root) exit 0
- overlay applied to the real source ZIP in the real folder layout, then the FULL source `npm run test:all`: exit 0
- cache key in index.html is now `?v=65.1.22-recovery-authfix`

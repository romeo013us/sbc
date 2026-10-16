# SBC OS V65.1.54 — Stark Cinematic Cockpit

## Scope
Visual-only overlay for the existing SBC Command Center. This is a release patch, not a replacement application.

## UI changes
- Dark graphite/navy canvas with electric-cyan and arc-blue telemetry accents.
- Full-width workspace on large displays and compact responsive spacing.
- Sharper HUD panels, restrained glow, technical micro-labels, and clearer table hierarchy.
- Dark first-use preference while preserving the existing theme toggle.
- Reduced-motion accessibility support.

## Safety and exclusions
- No database/schema changes, lead imports, payment changes, or business workflow rewrites.
- The patch refuses to proceed unless the existing MySQL recovery and runtime writer-lease guard markers are present.
- It does not turn off or unlock the recovery lock.
- GoDaddy deployment and live runtime behavior must be verified separately.

## Verification
Run `node hotfix-assets/v6554-stark-cockpit-test.js`, `node bootstrap.js --verify`, and `npm run test:all` on the full extracted release package before publishing.

# SBC OS V65.1.56 — God-Tier Stark HUD + Twilio Voice SDK 2

## Combined scope
This release combines contrast-safe Stark HUD visuals (dot grid, restrained scanline, angular panel accents, row hover feedback, status pulses, reduced-motion support) and removal of the Import Leads button and bottom Lead Workspace launcher with a browser phone repair.

## Twilio Voice repair
- Replaces the obsolete Voice SDK 1.x CDN URL with a locally served `@twilio/voice-sdk` 2.18.5 browser bundle.
- Pins the SDK package version and copies `dist/twilio.min.js` into the generated runtime public vendor directory.
- Updates outbound call setup to SDK 2's `device.connect({ params: { To } })` API and awaits the returned Call.
- Updates app cache-busting and service-worker cache identity so the old SDK loader is not reused.
- Does not expose credentials or change the server token route, TwiML app configuration, customer records, or call logging endpoint.

## Safety boundaries
- No database/schema changes, lead imports, recovery-lock changes, payment changes, or tenant-isolation changes.
- Existing recovery and runtime writer guard markers are required.
- CI validates source patching and SDK packaging; only an authorized live test call can prove microphone permissions, Twilio token/TwiML configuration, PSTN routing, and two-way audio.

## Verification
Run `npm ci`, `npm run test:v6555-theme-contrast`, `npm run test:v6556-voice-sdk`, and `npm run build`.

# SBC OS V65.1.60 — Live Call Notes and History

## Caller experience
- Adds a Live Call Notes panel directly inside the SBC Business Phone dialer, visible before and during a call.
- Saves a local draft immediately while typing, then debounces autosave to the active call log after the call session starts.
- Adds an explicit Save Notes button, outcome/disposition, next action, follow-up date/time, and a separate detailed Call Report action.
- Shows recent call history for the customer with outcome, timestamps, duration, notes, and next action.

## Persistence and permissions
- Reuses the existing persisted `db.callLogs` / `sbc_workspace` payload; no new database table or schema migration.
- Uses a stable per-call session ID to update one record during note autosave rather than creating a new call record every keystroke.
- Scopes recent history to the authenticated tenant and to the caller's own records, with owner/manager review access.
- Limits note length and validates disposition values server-side.
- Does not modify recovery lock, DDL permissions, writer lease logic, Twilio configuration, or customer master records.

## Verification
- `npm run test:v6560-live-call-notes`
- `npm run build`
- `npm run test:all`
- Automated tests do not replace the live test call needed to prove actual GoDaddy persistence and call connection.

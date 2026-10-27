# SBC OS V65.1.0 — Recovery UI & Button Reliability Hotfix

## Included
- Shared browser API helper detects HTML/login responses instead of throwing `Unexpected token '<'` from JSON parsing.
- Recovery lock errors are surfaced with a useful message.
- Preserved lead-mesh rows are displayed as read-only candidates, never counted as verified Sales Ready CRM leads.
- Lead table disables contact/edit/delete actions for recovery-projection rows and provides a read-only detail view.
- Unattended and 90-day revenue pages display MySQL customer and lead-mesh census counts separately.
- Revenue PLAY / AI preparation and autonomous mutation controls are visibly disabled while recovery is required; read-only refresh and simulation remain available.
- Enterprise CRM sync no longer attempts to promote a read-only projection.
- Full unverified lead-mesh promotion bypass was removed; restoration requires explicit selection of GREEN provenance candidates.
- Recovery-mode login/bootstrap avoids unnecessary profile persistence attempts.
- Removed automatic startup lead-mesh promotion and growth-cycle execution while the recovery lock is active.
- Both growth engines now return read-only status in recovery mode and refuse schema creation, queue writes, or background scheduling.
- The Kim Growth Hardening panel disables its run button under recovery, shows unavailable metrics as unavailable rather than zero, and keeps retry/error feedback visible.

## Safety boundaries
- No database rows were inserted, updated, deleted, or restored during package construction.
- The recovery lock and historical baseline remain unchanged.
- No provider credentials, GoDaddy secrets, financial controls, or refund rules were changed.

## Verification scope
This package requires static UI/route regression checks and JavaScript syntax checks. These checks do not simulate a real authenticated browser session or verify the live GoDaddy deployment.

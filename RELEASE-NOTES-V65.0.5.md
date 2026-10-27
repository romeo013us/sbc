# SBC OS V65.0.5 — Notifications Persistence & Recovery-Aware Master Control

## User-facing fixes
- Added an owner-only **Notifications** navigation item near the top of the primary navigation.
- Added a dedicated **Notifications & Action Queue** view with saved destination status and a read-only recovery-status check.
- Saving email/mobile destinations no longer clears the fields immediately. Entered values remain visible for the current session; after a fresh login, the saved destinations are shown in masked form for privacy.
- Added a recovery status panel showing the live customer/quote/order/renewal counts and the expected baseline.
- Changed the master control label from an ambiguous **SYSTEM OFF** to **RECOVERY LOCK** when authoritative recovery is active.
- Master-control state now queries the owner recovery-status endpoint. If recovery status cannot be verified, routine automation fails closed.

## Safety boundaries
- The 248-customer baseline is unchanged.
- No placeholder leads were added.
- No live database was accessed or modified by these build tests.
- The normal automation switch cannot override an active recovery lock. Once the authoritative MySQL state is restored and verified, the owner can enable routine automation through the existing control.
- Notifications are still gated by provider credentials and a valid destination. Tests use mocked providers; they do not prove real email/SMS delivery.

## Verification
- JavaScript syntax checks passed for modified files.
- V65.0.5 notification UI checks: 7/7 passed.
- Notification provider-mock tests passed.
- Recovery guard, database recovery-order, release integrity, recovery/growth, Lorna batch regression, runtime integrity, and MySQL lifecycle tests passed.

## Deployment state
Built and tested locally. Not deployed to GoDaddy and not verified against the live production instance.

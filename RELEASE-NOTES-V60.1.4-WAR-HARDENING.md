# SBC Business Command Center V60.1.4 — WAR HARDENING

## Purpose
Post-war hardening release based on V60.1.3 package validation.

## Changes
- Removed duplicate `/healthz` route registration; the production runtime-gate health endpoint is now canonical.
- Preserved V60.1.3 MySQL Promise/callback correction.
- Preserved lock-wait handling and change-aware autonomous persistence.
- Corrected God-Tier runtime unit test reporting so intentional failure-detection probes do not masquerade as an unhealthy release SLO.
- Release identity bumped to V60.1.4.

## Validation target
- 407 JavaScript files syntax-clean.
- 47 JSON files parse-clean.
- God-Tier foundation gate PASS.
- God-Tier scenario suite PASS.
- Security static check PASS.
- Federation check PASS.
- Secret audit PASS.
- Exactly one `/healthz` route.

Live GoDaddy runtime, real managed-MySQL fault injection, browser interaction, and provider transaction tests remain environment-level validations and must be confirmed after deployment.

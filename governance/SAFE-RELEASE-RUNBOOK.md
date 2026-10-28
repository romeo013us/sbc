# SBC Working-Production Preservation Runbook
**Status:** Review procedure only — never a command to deploy.  
**Scope:** SBC Command Center `main`, `godaddy-deploy`, GoDaddy Published / Preview, Office Box, website and live MySQL.

## Non-negotiable
- Do **not** upload a new ZIP, change GoDaddy's GitHub source branch, merge a runtime PR, reset a secret, remove a recovery lock, alter the database schema or enable unattended outreach just because CI is green.
- The current **known GitHub deploy-branch baseline** is `sourceCommit=7a5bdb23f107cf272db08e3b385aad88559416d2`. **This is not proof** that GoDaddy Published has this commit. Read the actual Published release identity before deciding anything.
- At writing, GitHub `main=80cadff50e199f0301fc3c8ca5f8b4f6cb80fdf2` and the committed prebuilt receipt still points to `7a5bdb23...`. The GoDaddy flat-ZIP builder must reject this mismatch.
- The existing owner-approved Published writer lease, recovery verification and $10,000 owner hold stay enforced.

## Stage 0: Prove the preserved baseline
1. Read GoDaddy Published release identity (read only), the configured Git branch, startup command, `/readyz` and any runtime errors. Do not send API keys or customer PII to ChatGPT/GitHub.
2. Take a **verified, restorable MySQL backup** and record a checksum and restoration location outside publicly served paths.
3. Preserve the exact last-working GoDaddy artifact and current Published environment variable *names* (not values).
4. Exercise real existing owner / Lorna / demo and public website URLs *without* creating fake customers or provider transactions. Any regression is NO-GO.

## Stage 1: Build offline; no source publication
- GitHub Actions `SBC Offline Reconstruction Evidence Gate` runs in isolated CI. Inspect all jobs, not just the checkmark.
- The artifact `SBC-VERIFIED-PREBUILT-RUNTIME` is **not** permission to deploy or update main.
- Require matching source fingerprint, exact commit, isolated source execution, no unexpected runtime DDL, actual MySQL 8 and browser checks. Any check failed/unknown = NO-GO.
- `SBC GoDaddy Single-Layer ZIP` must similarly pass with the *same* fresh prebuilt receipt and source fingerprint. A stale receipt is a real release blocker; NEVER skip it.

## Stage 2: Two explicit owner promotion approvals
The release governance PR proposes these controls; they are not live until safely reviewed and merged.
1. Manual `workflow_dispatch` on `SBC Offline Reconstruction Evidence Gate` with `publish_verified_prebuilt_to_main=true` is the *only* path allowed to commit the new verified prebuilt archive to GitHub main.
2. After a matching archive is available and all release CI is green, manual `workflow_dispatch` on `SBC GoDaddy Single-Layer ZIP` with `publish_deploy_branch=true` is the *only* path allowed to advance `godaddy-deploy`.
3. **Neither approval is authorization to deploy to GoDaddy Published**. Verify the actual GoDaddy tracked branch before either action; moving `main` may trigger an external GitHub Connect rebuild even without calling a GoDaddy API.
4. Never permit both promotions or a new source merge to run at once; reject builds if `main` changed while testing.

## Stage 3: Published canary
- Publish only after explicit owner go-ahead, confirmed backup, regression suite, no outstanding P0 issues, and documented rollback.
- Verify login, role separation, dashboard stability for at least a real operator session, tenant-specific CRM reads, Square noncharging preflight, and read-only Office Box activation inquiry.
- No unapproved AI phone calls, Twilio SMS campaigns, fake Square charges, mass imports, or fixture records in live tenant.
- Verify customer workspace activation against an owner-authorized **real** paid event only; do not manufacture paid evidence.
- If browser freezes, 403 privacy leaks, lease errors, duplicate order creation, unexpected writes, or recovery state changes occur, stop rollout and restore the preserved artifact.

## Stage 4: Automation enablement (after customer lifecycle is verified)
- Keep the old global `SBC_V6623_SAFE_AUTOMATION_QUARANTINE` in place until tenant-by-tenant rollout.
- Start with **read-only** Kim owner briefs, lead analysis, draft-only follow-ups and verified owner-approved marketing posts.
- Outbound SMS/voice requires a specific consent record, suppression-list check, approved A2P/campaign, quiet hours, owner policy, tenant quota, provider error handling and CRM audit; no bulk blast by default.
- Square settlement -> durable Office Box outbox -> signed activation lookup -> ACTIVE entitlement must first pass replay, duplicate, restart and wrong-tenant tests.
- GoDaddy storefront reconciliation should be read-only with a manual task fallback until the actual provider order API is verified.

**Exit condition:** all required gates have attributable live evidence. The 9.5+ score must not be inferred from CI or feature count.

# Atomic release cutover: operator checklist

This is a staged migration, not an enabled atomic release service. Do not deploy an unsealed master or enable a generic Actions bot bypass.

- Academy media writes a unique create-only candidate ref, never master. A reviewed candidate can be prepared by dispatching the staged-release workflow on release/candidate/*.
- Candidate preparation runs the existing staging gates, validates the assembled tree and pins it. It does not advance master or GoDaddy.
- Until the approved promotion job is implemented, normal master pushes retain the legacy publisher. This is a known transitional gap, not atomic production acceptance.
- Before cutover, implement independent exact-source review and integrated CI checks, a dedicated release actor with a protected environment and least privilege, and restrict master updates to that actor. Disable raw PR merges to the deployment branch. Do not use a blanket owner or github-actions bypass as proof of sealed-only enforcement.
- The final promotion job must invoke promote-sealed-master.sh with the independently verified expected base and tested source; then verify remote master and advance the separate recovery Preview ref. Reject stale base without rebasing a sealed candidate.
- The final hosted verification uses the app-specific origin https://tyvrqnjz57.preview.c24.airoapp.ai, not the generic airoapp.ai domain. Existing GoDaddy branch remains a-sbc-master.

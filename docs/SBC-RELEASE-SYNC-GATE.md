# Command Center deployment synchronization

Keep the existing GoDaddy app tyvrqnjz57 and branch a-sbc-master. A successful source merge is NOT a deployable release. The source commit is an immutable input; the release receipt is written in a later commit and must not claim its own Git SHA.

## Operator gate (before Update Preview)
Check the successful master release workflow, including github-preview-branch, and the exact release ref. In a trusted checkout of that ref:
```sh
node scripts/verify-release-sync.cjs . VERIFIED_SOURCE_SHA
```
Use the source SHA independently confirmed by CI. Do not substitute the receipt-only commit or regenerate hashes on a running host.

## After deployment
```sh
node scripts/verify-release-sync.cjs . VERIFIED_SOURCE_SHA https://tyvrqnjz57.c24.airoapp.ai
```
For Preview use https://tyvrqnjz57.preview.c24.airoapp.ai (may require authenticated access). A mismatch or missing header means identity is not verified. Candidate identity is not operational readiness, a signed provider receipt, or production certification. Keep Preview read-only; verify authenticated roles, actual media playback and sandbox billing separately.

## Remaining atomic promotion boundary
The existing GitHub master publisher seals the tested source in a child commit. There is still a source-merge-to-release window; a direct GoDaddy pull in that interval must be blocked by the operator/verified-ref check. To eliminate the window entirely, promote a sealed source+runtime+inventory tree with a single compare-and-swap of the existing master ref, after integrated CI and review. Do not enable a raw-source automatic deploy or bypass inventory validation. A pre-merge raw checkout cannot truthfully satisfy a digest anchored to an older release. This PR verifies the final promotion, not a new branch protection rule or GoDaddy setting.

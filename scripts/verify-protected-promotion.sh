#!/usr/bin/env bash
# Trusted master checkout only. No write credentials or candidate code execution.
set -euo pipefail
[[ "$EXPECTED_BASE" =~ ^[0-9a-f]{40}$ && "$TESTED_SOURCE" =~ ^[0-9a-f]{40}$ && "$EXPECTED_SEAL" =~ ^[0-9a-f]{40}$ && "$STAGING_RUN" =~ ^[1-9][0-9]*$ && "$REVIEW_PR" =~ ^[1-9][0-9]*$ ]]
test "$(git rev-parse HEAD)" = "$EXPECTED_BASE"
test "$(git ls-remote origin refs/heads/a-sbc-master | cut -f1)" = "$EXPECTED_BASE"
temp=$(mktemp -d)
trap 'git worktree remove --force "$temp/tree" 2>/dev/null || true; rm -rf "$temp"' EXIT
gh api "repos/$GITHUB_REPOSITORY/actions/runs/$STAGING_RUN" > "$temp/run.json"
attempt=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).run_attempt' "$temp/run.json")
[[ "$attempt" =~ ^[1-9][0-9]*$ ]]
gh api "repos/$GITHUB_REPOSITORY/actions/runs/$STAGING_RUN/attempts/$attempt/jobs?per_page=100" > "$temp/jobs.json"
node scripts/verify-staging-evidence.cjs "$TESTED_SOURCE" "$STAGING_RUN" "$temp/run.json" "$temp/jobs.json"
gh api "repos/$GITHUB_REPOSITORY/actions/runs?head_sha=$TESTED_SOURCE&per_page=100" > "$temp/ci.json"
node scripts/verify-promotion-ci.cjs "$EXPECTED_BASE" "$TESTED_SOURCE" "$REVIEW_PR" "$temp/ci.json"
git fetch --no-tags origin "refs/heads/release/verified-godaddy-$TESTED_SOURCE"
sealed=$(git rev-parse FETCH_HEAD)
test "$sealed" = "$EXPECTED_SEAL"
test "$(git show -s --format=%P "$sealed")" = "$TESTED_SOURCE"
git merge-base --is-ancestor "$EXPECTED_BASE" "$TESTED_SOURCE"
git worktree add --detach "$temp/tree" "$sealed"
node scripts/verify-release-sync.cjs "$temp/tree" "$TESTED_SOURCE"
test "$(git ls-remote origin refs/heads/a-sbc-master | cut -f1)" = "$EXPECTED_BASE"
echo "Exact staging, required integrated CI and pinned seal verified: $sealed" >> "$GITHUB_STEP_SUMMARY"

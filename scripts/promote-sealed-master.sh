#!/usr/bin/env bash
# Call only from an authorized promotion job after integrated source CI and review.
set -euo pipefail
base=${1:?Expected current sealed master SHA}
source=${2:?Expected tested source SHA}
[[ "$#" == 2 && "$base" =~ ^[a-f0-9]{40}$ && "$source" =~ ^[a-f0-9]{40}$ && "$base" != "$source" ]] || exit 2
cd "$(git rev-parse --show-toplevel)"
ref=refs/heads/a-sbc-master
candidate=$(git rev-parse HEAD)
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo 'Candidate checkout is dirty' >&2; exit 1; }
[[ "$(git show -s --format=%P "$candidate")" == "$source" ]] || { echo 'Candidate is not a direct sealed child of tested source' >&2; exit 1; }
git merge-base --is-ancestor "$base" "$source" || { echo 'Source does not descend from expected master' >&2; exit 1; }
node scripts/verify-release-sync.cjs . "$source"
git fetch --quiet --no-tags origin "refs/heads/release/verified-godaddy-$source"
pinned=$(git rev-parse FETCH_HEAD)
[[ "$(git show -s --format=%P "$pinned")" == "$source" && "$(git rev-parse "$pinned^{tree}")" == "$(git rev-parse "$candidate^{tree}")" ]] || { echo 'Recovery pin does not match sealed candidate' >&2; exit 1; }
[[ "$(git rev-parse HEAD)" == "$candidate" && -z "$(git status --porcelain --untracked-files=all)" ]] || exit 1
# Explicit lease supplies the atomic remote compare-and-swap. Ancestry above
# prohibits history rewrites even though the lease syntax can allow force.
git push --porcelain --force-with-lease="$ref:$base" origin "$candidate:$ref"

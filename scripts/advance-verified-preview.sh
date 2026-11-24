#!/usr/bin/env bash
# Only a compiled release already accepted by the canonical publisher may advance Preview's source.
set -euo pipefail
source_sha=${1:?Expected the tested source commit}
[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || exit 2
git fetch --quiet --no-tags --depth=2 origin refs/heads/a-sbc-master
release=$(git rev-parse FETCH_HEAD)
if [[ "$(git show -s --format=%P "$release")" != "$source_sha" ]]; then
  echo 'Canonical source has advanced. Leaving the verified Preview ref in place.'
  exit 0
fi
git fetch --quiet --no-tags --depth=2 origin "refs/heads/release/verified-godaddy-$source_sha"
pinned=$(git rev-parse FETCH_HEAD)
[[ "$(git show -s --format=%P "$pinned")" == "$source_sha" &&
   "$(git rev-parse "$pinned^{tree}")" == "$(git rev-parse "$release^{tree}")" ]] || {
  echo 'Canonical and pinned release evidence differ.' >&2; exit 1;
}
# A regular fast-forward push is the only allowed update. A shallow runner may
# need the canonical ancestry before Git can establish the fast-forward locally.
if [[ "$(git rev-parse --is-shallow-repository)" == true ]]; then
  git fetch --quiet --no-tags --unshallow origin refs/heads/a-sbc-master
fi
git push --porcelain origin "$release:refs/heads/deploy/godaddy-verified-preview"

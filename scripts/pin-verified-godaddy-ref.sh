#!/usr/bin/env bash
# Publish a create-only recovery ref for the compiled candidate tested in this job.
set -euo pipefail
source_sha=${1:?Expected the full tested source commit}
[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || exit 2
candidate=$(git rev-parse HEAD)
[[ "$(git show -s --format=%P "$candidate")" == "$source_sha" ]] || {
  echo 'The compiled commit must have the tested source as its only parent.' >&2; exit 1;
}
ref="refs/heads/release/verified-godaddy-$source_sha"
# Empty expected ref is a create-only lease, including when two builds race.
if git push --porcelain --force-with-lease="$ref:" origin "$candidate:$ref"; then
  echo "Verified release ref: $ref ($candidate)"
  exit 0
fi
# A rerun may create a different commit timestamp for the identical compiled tree.
git fetch --quiet --no-tags --depth=2 origin "$ref"
existing=$(git rev-parse FETCH_HEAD)
if [[ "$(git show -s --format=%P "$existing")" != "$source_sha" ||
      "$(git rev-parse "$existing^{tree}")" != "$(git rev-parse "$candidate^{tree}")" ]]; then
  echo "The existing release ref differs from this tested tree. Preserving $ref." >&2
  exit 1
fi
echo "Verified release ref already exists: $ref ($existing)"

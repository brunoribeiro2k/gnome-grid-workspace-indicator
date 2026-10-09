#!/bin/bash
# Prepare a release PR: bump the integer `version` in metadata.json on a
# release/v<N> branch, commit, push, and open a PR to main. Merging that PR is
# what triggers release.yml, which runs the shell-version matrix, tags v<N> and
# drafts the GitHub release, so this script never creates a tag itself.
#
#   make release            (or: scripts/prepare-release.sh)
#
# Refuses to run on a dirty tree, so the release commit is just the bump, and
# anywhere but the tip of origin/main, so the release carries exactly what was
# merged. Reuses an existing PR instead of opening a second one.
set -euo pipefail
cd "$(dirname "$0")/.."

die() { echo "$*" >&2; exit 1; }

# 1. Only bump from a clean tree.
[ -z "$(git status --porcelain)" ] || die "Working tree is not clean. Commit or stash changes first."

# 2. Only release what's on main.
git fetch --quiet origin main
head=$(git rev-parse HEAD)
main_tip=$(git rev-parse origin/main)
if [ "$head" != "$main_tip" ]; then
    where=$(git rev-parse --abbrev-ref HEAD)
    die "Releases are cut from the tip of origin/main, but \"$where\" is at ${head:0:7} and origin/main is at ${main_tip:0:7}.
Run: git checkout main && git pull --ff-only"
fi

# 3. Bump the version (EGO needs a new integer for every upload).
current=$(jq -r .version metadata.json)
[[ "$current" =~ ^[0-9]+$ ]] || die "metadata.json version is not an integer: $current"
next=$((current + 1))
tag="v$next"
branch="release/$tag"
sed -i -E "s/(\"version\": *)$current([,}[:space:]])/\1$next\2/" metadata.json
[ "$(jq -r .version metadata.json)" = "$next" ] || die "Failed to bump the version in metadata.json."

# 4. Commit on the release branch and push.
git checkout -b "$branch"
git commit -q -am "chore(release): $tag"
git push -u origin "$branch"

# 5. Open the PR, or point at the existing one.
title="chore(release): $tag"
pr_url=$(gh pr list --head "$branch" --base main --state open --json url --jq '.[0].url // ""' 2>/dev/null || true)
if [ -n "$pr_url" ]; then
    echo "Release PR already open: $pr_url"
elif pr_url=$(gh pr create --base main --head "$branch" --title "$title" \
        --body "Release $tag. Merging runs the shell-version matrix, tags \`$tag\` and drafts the GitHub release." 2>/dev/null); then
    echo "Opened release PR: $pr_url"
else
    echo "Branch pushed. Open the PR manually:"
    echo "  gh pr create --base main --head $branch --title \"$title\""
fi

echo
echo "Next: merge the PR. The workflow tests every shell-version, tags $tag and drafts the release;"
echo "then upload the zip from the release to https://extensions.gnome.org/upload/."

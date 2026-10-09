#!/bin/bash
# Run the headless GNOME Shell checks against a built bundle in a container.
# Usage: tests/shell/run.sh [gnome version, default 50] [bundle.zip]
# One version per run on purpose: each version builds its own image. Running the whole
# range is left to a future release workflow.
set -uo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
BUNDLE=$(realpath "${2:-$ROOT/dist/gsi@fett2k.com.shell-extension.zip}")
[ -f "$BUNDLE" ] || { echo "bundle not found: $BUNDLE (run 'make bundle')" >&2; exit 2; }

# GNOME Shell version -> base image (Dockerfile flavour is inferred from the image name).
declare -A BASE=([46]=ubuntu:noble [47]=ubuntu:oracular [48]=ubuntu:plucky [49]=ubuntu:questing [50]=ubuntu:resolute [51]=fedora:45)
VERSIONS=("${1:-50}")

STATUS=0
for v in "${VERSIONS[@]}"; do
    base=${BASE[$v]:-}
    [ -n "$base" ] || { echo "unknown GNOME version: $v (known: ${!BASE[*]})" >&2; exit 2; }
    flavour=${base%%:*}
    image=gsi-shell-test:$v
    echo "=== GNOME $v ($base)"
    out="$ROOT/dist/shell-tests/$v"; rm -rf "$out"; mkdir -p "$out"; chmod 777 "$out"
    docker build -f "$HERE/Dockerfile.$flavour" --build-arg BASE="$base" -t "$image" "$HERE" >"$out/build.log" 2>&1 ||
        { tail -20 "$out/build.log"; echo "=== GNOME $v: image build failed"; STATUS=1; continue; }
    docker run --rm --user root -v "$HERE:/tests:ro" -v "$BUNDLE:/bundle.zip:ro" -v "$out:/out" \
        "$image" /tests/entrypoint.sh >"$out/run.log" 2>&1
    rc=$?
    cat "$out/results.txt" 2>/dev/null || tail -20 "$out/run.log"
    [ $rc -eq 0 ] && echo "=== GNOME $v: PASS" || { echo "=== GNOME $v: FAIL (logs in $out)"; STATUS=1; }
done
exit $STATUS

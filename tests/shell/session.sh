#!/bin/bash
# Runs as uid 1000: install the bundle like a user would, then run the checks in a private session bus.
export XDG_RUNTIME_DIR=/tmp/rt OUT=/out
mkdir -p $XDG_RUNTIME_DIR && chmod 700 $XDG_RUNTIME_DIR
gnome-extensions install --force /bundle.zip
exec dbus-run-session -- /tests/checks.sh

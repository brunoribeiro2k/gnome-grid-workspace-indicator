#!/bin/bash
# Container entry (root): provide a system bus and X11 socket dir, then run the test as uid 1000.
set -e
rm -rf /run/systemd/seats   # no logind in the container; makes the shell use its dummy login manager
mkdir -p /run/dbus /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix
dbus-daemon --system --fork
exec runuser -u "$(id -nu 1000)" -- env HOME="$(getent passwd 1000 | cut -d: -f6)" /tests/session.sh

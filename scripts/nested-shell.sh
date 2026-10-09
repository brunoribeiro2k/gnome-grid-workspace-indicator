#!/bin/bash
# Run a bundle in a nested GNOME Shell window without touching your real session:
# a private session bus plus private XDG config/data/cache/state dirs under dist/nested/,
# so the extension install, its settings and enabled-extensions all live in a throwaway
# dconf database. Your ~/.config/dconf and ~/.local/share/gnome-shell are never written.
#
#   make nested                       (or: scripts/nested-shell.sh <bundle.zip>)
#   MUTTER_DEBUG_DUMMY_MODE_SPECS=1920x1080 make nested    # window size
#
# Close the window (or Ctrl+C) to stop. Each run starts from a fresh state.
set -euo pipefail

# Second stage, inside the private session bus.
if [ "${1:-}" = --inside ]; then
    # Activate dconf-service on this bus and make sure it writes to the private database
    # before any setting is touched.
    gdbus call --session --dest ca.desrt.dconf --object-path /ca/desrt/dconf/Writer/user \
        --method org.freedesktop.DBus.Peer.Ping >/dev/null
    pid=$(gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus \
        --method org.freedesktop.DBus.GetConnectionUnixProcessID ca.desrt.dconf | grep -o '[0-9]\+' | tail -1)
    tr '\0' '\n' <"/proc/$pid/environ" | grep -qxF "XDG_CONFIG_HOME=$XDG_CONFIG_HOME" ||
        { echo "dconf-service is not using $XDG_CONFIG_HOME; aborting" >&2; exit 1; }

    gnome-extensions install --force "$BUNDLE"
    gsettings set org.gnome.shell enabled-extensions "['$UUID']"
    gsettings set org.gnome.shell welcome-dialog-last-shown-version '999'
    echo "Nested shell ($FLAG) with $UUID; state in ${XDG_CONFIG_HOME%/config}"
    exec gnome-shell "$FLAG" --wayland
fi

cd "$(dirname "$0")/.."
bundle=$(realpath "${1:-dist/gsi@fett2k.com.shell-extension.zip}")
[ -f "$bundle" ] || { echo "bundle not found: $bundle (run 'make bundle')" >&2; exit 2; }

root=$PWD/dist/nested
rm -rf "$root"
mkdir -p "$root"/{config,data,cache,state}

# Export before dbus-run-session: the bus-activated dconf-service inherits this env, so
# every settings write lands in $root/config/dconf. Exporting it only inside the session
# would leave dconf-service writing to the real database.
export XDG_CONFIG_HOME=$root/config XDG_DATA_HOME=$root/data
export XDG_CACHE_HOME=$root/cache XDG_STATE_HOME=$root/state
export BUNDLE=$bundle UUID
UUID=$(jq -r .uuid metadata.json)

# GNOME 49 renamed --nested to --devkit.
export FLAG=--devkit
gnome-shell --help 2>&1 | grep -q -- --devkit || FLAG=--nested

exec dbus-run-session -- "$PWD/scripts/nested-shell.sh" --inside

#!/bin/bash
# Run a bundle in a nested GNOME Shell window without touching your real session:
# a private session bus plus private XDG config/data/cache/state dirs under dist/nested/,
# so the extension install, its settings and enabled-extensions all live in a throwaway
# dconf database. Your ~/.config/dconf and ~/.local/share/gnome-shell are never written.
#
# Workspace Matrix is enabled alongside, since it's what gives the shell a grid: your
# installed copy if there is one (with your rows/columns), else the EGO release for this
# GNOME version, or WSMATRIX_ZIP=<zip>.
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
    [ -f "$WSM_SRC" ] && gnome-extensions install --force "$WSM_SRC"
    wsm_set() { gsettings --schemadir "$XDG_DATA_HOME/gnome-shell/extensions/$WSM/schemas" set org.gnome.shell.extensions.wsmatrix-settings "$@"; }
    wsm_set num-rows "$WSM_ROWS"
    wsm_set num-columns "$WSM_COLS"
    # Its EGO release may not declare this GNOME yet; load it anyway, as a user would have to.
    major=$(gnome-shell --version | grep -o '[0-9]\+' | head -1)
    jq -e --arg v "$major" '."shell-version" | index($v)' "$XDG_DATA_HOME/gnome-shell/extensions/$WSM/metadata.json" >/dev/null ||
        gsettings set org.gnome.shell disable-extension-version-validation true
    gsettings set org.gnome.shell enabled-extensions "['$WSM', '$UUID']"
    gsettings set org.gnome.shell welcome-dialog-last-shown-version '999'
    echo "Nested shell ($FLAG) with $UUID + Workspace Matrix ${WSM_ROWS}x$WSM_COLS; state in ${XDG_CONFIG_HOME%/config}"
    exec gnome-shell "$FLAG" --wayland
fi

cd "$(dirname "$0")/.."
bundle=$(realpath "${1:-dist/gsi@fett2k.com.shell-extension.zip}")
[ -f "$bundle" ] || { echo "bundle not found: $bundle (run 'make bundle')" >&2; exit 2; }

root=$PWD/dist/nested
rm -rf "$root"
mkdir -p "$root"/{config,data,cache,state}

# Workspace Matrix: read (never written) from your install, else downloaded and cached.
export WSM=wsmatrix@martin.zurowietz.de WSM_ROWS=2 WSM_COLS=2 WSM_SRC=${WSMATRIX_ZIP:-}
installed=${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/$WSM
if [ -z "$WSM_SRC" ] && [ -d "$installed" ]; then
    mkdir -p "$root/data/gnome-shell/extensions" && cp -r "$installed" "$root/data/gnome-shell/extensions/"
    get() { gsettings --schemadir "$installed/schemas" get org.gnome.shell.extensions.wsmatrix-settings "$1" 2>/dev/null; }
    WSM_ROWS=$(get num-rows || echo 2) WSM_COLS=$(get num-columns || echo 2)
elif [ -z "$WSM_SRC" ]; then
    major=$(gnome-shell --version | grep -o '[0-9]\+' | head -1)
    info=$(curl -fsS "https://extensions.gnome.org/extension-info/?uuid=$WSM&shell_version=$major") ||
        { echo "could not look up Workspace Matrix on extensions.gnome.org" >&2; exit 1; }
    WSM_SRC=$PWD/dist/cache/wsmatrix-$(jq -r .version_tag <<<"$info").zip
    [ -f "$WSM_SRC" ] || { mkdir -p "${WSM_SRC%/*}" &&
        curl -fsSL -o "$WSM_SRC.part" "https://extensions.gnome.org$(jq -r .download_url <<<"$info")" &&
        mv "$WSM_SRC.part" "$WSM_SRC"; }
fi

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

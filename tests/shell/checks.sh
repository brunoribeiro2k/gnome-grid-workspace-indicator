#!/bin/bash
# Runs inside a private session bus: starts a headless GNOME Shell, drives it via
# org.gnome.Shell.Eval (needs --unsafe-mode) and records one PASS/FAIL line per check.
# Phase 1 runs the extension on its own; phase 2 restarts the shell with Workspace Matrix
# (the extension this one is designed to pair with) driving the grid. Exits non-zero if
# any check fails.
UUID=gsi@fett2k.com
WSM=wsmatrix@martin.zurowietz.de
E=$HOME/.local/share/gnome-shell/extensions/$UUID
SHELLS=0

start_shell() {
    SHELLS=$((SHELLS + 1))
    gnome-shell --headless --wayland --virtual-monitor 1280x900 --unsafe-mode > $OUT/shell-$SHELLS.log 2>&1 &
    SP=$!
    for _ in $(seq 60); do gdbus introspect --session --dest org.gnome.Shell --object-path /org/gnome/Shell >/dev/null 2>&1 && break; sleep 1; done
    sleep 4
    ev "Main.overview.hide()" >/dev/null; sleep 1
    ev "globalThis.__gsi = { prev: null, snap() {
            const wm = global.workspace_manager, i = Main.panel.statusArea['$UUID'];
            const wsm = Main.extensionManager.lookup('$WSM');
            const base = { mode: Main.sessionMode.currentMode, wsm: wsm ? wsm.state === 1 : false,
                           layout: [wm.layout_rows, wm.layout_columns] };
            if (!i) return { indicator: false, ...base };
            const d = i._getGridDimensions(), lm = i._grid.layout_manager;
            const hl = i._cells.findIndex(c => c.get_style().includes('background-color: ' + i._settings.activeFill));
            let at = [-1, -1];
            for (let r = 0; r < d.nRows; r++)
                for (let c = 0; c < d.nColumns; c++)
                    if (hl >= 0 && lm.get_child_at(c, r) === i._cells[hl]) at = [r, c];
            return { indicator: true, ws: wm.n_workspaces, grid: [d.nRows, d.nColumns], cells: i._cells.length,
                     active: wm.get_active_workspace_index(), hl, at,
                     outlined: i._cells.map((c, k) => /solid/.test(c.get_style()) ? k : -1).filter(k => k >= 0),
                     cellW: i._cells[0].width, ...base };
        },
        // Press a key combination through a virtual keyboard, like a user would.
        keys(...syms) {
            const C = imports.gi.Clutter;
            this.kb ??= C.get_default_backend().get_default_seat().create_virtual_device(C.InputDeviceType.KEYBOARD_DEVICE);
            const t = () => GLib.get_monotonic_time();
            syms.forEach(s => this.kb.notify_keyval(t(), C['KEY_' + s], C.KeyState.PRESSED));
            syms.reverse().forEach(s => this.kb.notify_keyval(t(), C['KEY_' + s], C.KeyState.RELEASED));
        },
        fmt: s => Object.entries(s).map(([k, v]) => k + '=' + (Array.isArray(v) ? '[' + v + ']' : v)).join(' ') }; 'ok'" >/dev/null
}

stop_shell() { kill $SP; wait $SP 2>/dev/null; }

# Evaluate JS in the shell and print the returned string.
ev() { gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "$1" 2>&1 | sed -E "s/^\(true, '\"?//; s/\"?'\)$//"; }

FAILED=0
# check NAME JS_CONDITION — the condition sees `s` (indicator state snapshot, see above) and `prev`.
check() {
    local res
    res=$(ev "(() => { const s = __gsi.snap(), prev = __gsi.prev; __gsi.prev = s; return (($2) ? 'PASS ' : 'FAIL ') + __gsi.fmt(s); })()")
    [[ $res == PASS* || $res == FAIL* ]] || res="FAIL $res"   # e.g. an exception from Eval
    printf '%-30s %s\n' "$1" "$res" | tee -a $OUT/results.txt
    [[ $res == PASS* ]] || FAILED=1
}
note() { printf '%-30s %s\n' "$1" "$2" | tee -a $OUT/results.txt; }
win_open() { ev "GLib.spawn_command_line_async('gjs /tests/win.js')" >/dev/null; sleep 4; }
win_move() { ev "global.display.list_all_windows().find(w => w.title === 'gsitest').change_workspace_by_index($1, false)" >/dev/null; sleep 2; }
win_close() { ev "global.display.list_all_windows().find(w => w.title === 'gsitest').delete(global.get_current_time())" >/dev/null; sleep 3; }
scroll() { ev "Main.panel.statusArea['$UUID']._onScroll(null, { get_scroll_direction: () => imports.gi.Clutter.ScrollDirection.$1 })" >/dev/null; sleep 1; }
lock_unlock() {
    # A real lock needs GDM; the unlock-dialog session mode is what disables extensions on lock.
    ev "Main.sessionMode.pushMode('unlock-dialog')" >/dev/null; sleep 2
    check "${1:+$1 }locked: disabled"   "!s.indicator && s.mode === 'unlock-dialog'"
    ev "Main.sessionMode.popMode('unlock-dialog')" >/dev/null; sleep 3
    check "${1:+$1 }unlocked: restored" "s.indicator && s.mode === 'user' && $2"
}
# Change Workspace Matrix's grid through its settings, as its prefs window would.
wsm_set() { gsettings --schemadir "$HOME/.local/share/gnome-shell/extensions/$WSM/schemas" set org.gnome.shell.extensions.wsmatrix-settings "$@"; }
wsm_grid() { wsm_set num-rows "$1" && wsm_set num-columns "$2" || FAILED=1; sleep 2; }

note "gnome-shell" "$(gnome-shell --version)"

# ---- Phase 1: on its own (GNOME's default 1 x N layout) ----
start_shell
gnome-extensions enable $UUID; sleep 2
check "enabled"                  "s.indicator"
check "default layout: 1 row"    "s.grid[0] === 1 && s.grid[1] === s.ws && s.cells === s.ws"
win_open
check "window opened"            "s.outlined.length === 1 && s.outlined[0] === s.active"
win_move "global.workspace_manager.n_workspaces - 1"
check "window moved"             "s.outlined.length === 1 && s.outlined[0] === s.ws - 1"
scroll DOWN
check "scroll down"              "s.active === prev.active + 1"
scroll UP
check "scroll up"                "s.active === prev.active - 1"
win_close
check "window closed"            "s.outlined.length === 0"
ev "global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 2, 2)" >/dev/null; sleep 1
check "explicit 2x2 grid"        "s.grid[0] === 2 && s.grid[1] === 2 && s.cells === 4"
ev "Main.panel.height = Main.panel.height * 2" >/dev/null; sleep 1
check "panel height change"      "s.cellW > prev.cellW"
ev "Main.panel.statusArea['$UUID']._onWorkspaceChanged(); Main.extensionManager.disableExtension('$UUID')" >/dev/null; sleep 2
check "disable w/ pending rebuild" "!s.indicator"
for _ in 1 2 3; do gnome-extensions enable $UUID; sleep 1; gnome-extensions disable $UUID; sleep 1; done
gnome-extensions enable $UUID; sleep 2
check "enable/disable cycles"    "s.indicator && s.cells === 4"
lock_unlock "" "s.cells === 4"

gnome-extensions prefs $UUID; sleep 5
res=$(ev "(() => { const w = global.display.list_all_windows().find(w => w.title === 'Grid Workspace Indicator'); if (!w) return 'FAIL no window'; const r = w.get_frame_rect(); return (r.width === 640 && r.height === 680 ? 'PASS ' : 'FAIL ') + r.width + 'x' + r.height; })()")
note "prefs window size" "$res"; [[ $res == PASS* ]] || FAILED=1
gdbus call --session --dest org.gnome.Shell.Screenshot --object-path /org/gnome/Shell/Screenshot --method org.gnome.Shell.Screenshot.Screenshot false false $OUT/prefs.png >/dev/null 2>&1
TL=$(dirname "$(find / -name 'Shew-0.typelib' 2>/dev/null | head -1)")
ev "GLib.spawn_command_line_async('env GI_TYPELIB_PATH=$TL LD_LIBRARY_PATH=$TL:$(dirname $TL) gjs -m /tests/prefs-harness.js $E $OUT/harness.txt')" >/dev/null; sleep 8
res=$(cat $OUT/harness.txt 2>/dev/null || echo 'FAIL no harness output')
note "prefs bindings" "$res"; [[ $res == PASS* ]] || FAILED=1
stop_shell

# ---- Phase 2: with Workspace Matrix driving the grid ----
if [ ! -d "$HOME/.local/share/gnome-shell/extensions/$WSM" ]; then
    note "workspace matrix" "FAIL not installed"; FAILED=1
else
    meta=$(tr -d ' \n' < "$HOME/.local/share/gnome-shell/extensions/$WSM/metadata.json")
    wsm_shells=$(grep -o '"shell-version":\[[^]]*\]' <<<"$meta" | grep -o '[0-9]\+' | paste -sd,)
    note "workspace matrix" "version $(grep -o '"version":[0-9]*' <<<"$meta" | grep -o '[0-9]*$'), shell-version $wsm_shells"
    major=$(gnome-shell --version | grep -o '[0-9]\+' | head -1)
    if ! tr , '\n' <<<"$wsm_shells" | grep -qx "$major"; then
        # Its latest EGO release doesn't declare this GNOME yet; load it anyway, like a user would have to.
        gsettings set org.gnome.shell disable-extension-version-validation true
        note "" "not declared for GNOME $major: version validation disabled"
    fi

    # Login with both enabled, Workspace Matrix first (its default grid is 2x2).
    gsettings set org.gnome.shell enabled-extensions "['$WSM', '$UUID']"
    start_shell
    check "wsm: startup 2x2"         "s.wsm && s.indicator && s.ws === 4 && s.grid + '' === '2,2' && s.cells === 4"
    check "wsm: highlight at origin" "s.active === 0 && s.hl === 0 && s.at + '' === '0,0'"
    wsm_grid 3 3
    check "wsm: grow to 3x3"         "s.ws === 9 && s.grid + '' === '3,3' && s.cells === 9"
    wsm_grid 2 4
    check "wsm: reshape to 2x4"      "s.ws === 8 && s.grid + '' === '2,4' && s.cells === 8"
    ev "__gsi.keys('Control_L', 'Alt_L', 'Down')" >/dev/null; sleep 2
    check "wsm: key down a row"      "s.active === 4 && s.hl === 4 && s.at + '' === '1,0'"
    ev "__gsi.keys('Control_L', 'Alt_L', 'Right')" >/dev/null; sleep 2
    check "wsm: key right a column"  "s.active === 5 && s.hl === 5 && s.at + '' === '1,1'"
    scroll UP
    check "wsm: scroll up"           "s.active === 4 && s.hl === 4"
    scroll DOWN
    check "wsm: scroll down"         "s.active === 5 && s.hl === 5"
    win_open
    check "wsm: window outlined"     "s.outlined + '' === '5'"
    win_move 6
    check "wsm: window moved"        "s.outlined + '' === '6'"
    lock_unlock "wsm:" "s.wsm && s.grid + '' === '2,4' && s.cells === 8 && s.outlined + '' === '6'"
    wsm_grid 1 3
    check "wsm: shrink to 1x3"       "s.ws === 3 && s.grid + '' === '1,3' && s.cells === 3"
    wsm_grid 2 4
    gnome-extensions disable $WSM; sleep 3
    check "wsm: disabled under us"   "!s.wsm && s.indicator && s.grid[0] === 1 && s.cells === s.ws"
    gnome-extensions enable $WSM; sleep 3
    check "wsm: re-enabled"          "s.wsm && s.grid + '' === '2,4' && s.cells === 8"
    win_close
    check "wsm: window closed"       "s.outlined.length === 0"
    stop_shell

    # Login again with the opposite order: this extension enables before Workspace Matrix.
    gsettings set org.gnome.shell enabled-extensions "['$UUID', '$WSM']"
    start_shell
    check "wsm: startup, gsi first"  "s.wsm && s.indicator && s.grid + '' === '2,4' && s.cells === 8 && s.hl === s.active"
    lock_unlock "wsm (gsi first):" "s.wsm && s.grid + '' === '2,4' && s.cells === 8"
    stop_shell
fi

# One line per JS error/warning: the message plus its stack frames.
js_errors() { awk '/JS (ERROR|WARNING)/ { if (b) print b; b = $0; next } b && /@/ { b = b " | " $0; next } { if (b) print b; b = "" } END { if (b) print b }' "$@"; }
# Alone (phase 1), any error counts. Alongside Workspace Matrix, only errors whose stack runs
# through this extension do; the rest belong to the other extension or GNOME and are listed.
own=$( { js_errors $OUT/shell-1.log; js_errors $OUT/shell-[2-9].log 2>/dev/null | grep -F "$UUID"; } | grep -c .)
foreign=$(js_errors $OUT/shell-[2-9].log 2>/dev/null | grep -vF "$UUID")
note "shell JS errors" "$([ "$own" -eq 0 ] && echo PASS || echo FAIL) $own"
[ "$own" -eq 0 ] || { FAILED=1; grep -h -E -A5 'JS ERROR|JS WARNING' $OUT/shell-*.log | head -40; }
[ -z "$foreign" ] || note "  not from this extension" "$(grep -c . <<<"$foreign"): $(sed -E 's/^.*JS (ERROR|WARNING): //; s/ \| [^|]*\/([^/|]+\.js:[0-9]+):[0-9]+.*/ (\1)/' <<<"$foreign" | sort -u | paste -sd';')"
exit $FAILED

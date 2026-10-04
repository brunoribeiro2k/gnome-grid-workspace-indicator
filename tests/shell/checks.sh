#!/bin/bash
# Runs inside a private session bus: starts a headless GNOME Shell, drives it via
# org.gnome.Shell.Eval (needs --unsafe-mode) and records one PASS/FAIL line per check.
# Exits non-zero if any check fails.
UUID=gsi@fett2k.com
E=$HOME/.local/share/gnome-shell/extensions/$UUID
gnome-shell --headless --wayland --virtual-monitor 1280x900 --unsafe-mode > $OUT/shell.log 2>&1 &
SP=$!
for _ in $(seq 60); do gdbus introspect --session --dest org.gnome.Shell --object-path /org/gnome/Shell >/dev/null 2>&1 && break; sleep 1; done
sleep 4

# Evaluate JS in the shell and print the returned string.
ev() { gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "$1" 2>&1 | sed -E "s/^\(true, '\"?//; s/\"?'\)$//"; }

FAILED=0
# check NAME JS_CONDITION — the condition sees `s` (indicator state snapshot, see below) and `prev`.
check() {
    local res
    res=$(ev "(() => { const s = __gsi.snap(), prev = __gsi.prev; __gsi.prev = s; return (($2) ? 'PASS ' : 'FAIL ') + __gsi.fmt(s); })()")
    [[ $res == PASS* || $res == FAIL* ]] || res="FAIL $res"   # e.g. an exception from Eval
    printf '%-30s %s\n' "$1" "$res" | tee -a $OUT/results.txt
    [[ $res == PASS* ]] || FAILED=1
}
note() { printf '%-30s %s\n' "$1" "$2" | tee -a $OUT/results.txt; }

note "gnome-shell" "$(gnome-shell --version)"
gnome-extensions enable $UUID; sleep 2
ev "Main.overview.hide()" >/dev/null; sleep 1
ev "globalThis.__gsi = { prev: null, snap() {
        const wm = global.workspace_manager, i = Main.panel.statusArea['$UUID'];
        if (!i) return { indicator: false, mode: Main.sessionMode.currentMode };
        const d = i._getGridDimensions();
        return { indicator: true, ws: wm.n_workspaces, grid: [d.nRows, d.nColumns], cells: i._cells.length,
                 active: wm.get_active_workspace_index(),
                 outlined: i._cells.map((c, k) => /solid/.test(c.get_style()) ? k : -1).filter(k => k >= 0),
                 cellW: i._cells[0].width, mode: Main.sessionMode.currentMode };
    },
    fmt: s => Object.entries(s).map(([k, v]) => k + '=' + (Array.isArray(v) ? '[' + v + ']' : v)).join(' ') }; 'ok'" >/dev/null

check "enabled"                  "s.indicator"
check "default layout: 1 row"    "s.grid[0] === 1 && s.grid[1] === s.ws && s.cells === s.ws"
ev "GLib.spawn_command_line_async('gjs /tests/win.js')" >/dev/null; sleep 4
check "window opened"            "s.outlined.length === 1 && s.outlined[0] === s.active"
ev "global.display.list_all_windows().find(w => w.title === 'gsitest').change_workspace_by_index(global.workspace_manager.n_workspaces - 1, false)" >/dev/null; sleep 2
check "window moved"             "s.outlined.length === 1 && s.outlined[0] === s.ws - 1"
ev "Main.panel.statusArea['$UUID']._onScroll(null, { get_scroll_direction: () => imports.gi.Clutter.ScrollDirection.DOWN })" >/dev/null; sleep 1
check "scroll down"              "s.active === prev.active + 1"
ev "Main.panel.statusArea['$UUID']._onScroll(null, { get_scroll_direction: () => imports.gi.Clutter.ScrollDirection.UP })" >/dev/null; sleep 1
check "scroll up"                "s.active === prev.active - 1"
ev "global.display.list_all_windows().find(w => w.title === 'gsitest').delete(global.get_current_time())" >/dev/null; sleep 3
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
# A real lock needs GDM; the unlock-dialog session mode is what disables extensions on lock.
ev "Main.sessionMode.pushMode('unlock-dialog')" >/dev/null; sleep 2
check "locked: disabled"         "!s.indicator && s.mode === 'unlock-dialog'"
ev "Main.sessionMode.popMode('unlock-dialog')" >/dev/null; sleep 3
check "unlocked: restored"       "s.indicator && s.cells === 4 && s.mode === 'user'"

gnome-extensions prefs $UUID; sleep 5
res=$(ev "(() => { const w = global.display.list_all_windows().find(w => w.title === 'Grid Workspace Indicator'); if (!w) return 'FAIL no window'; const r = w.get_frame_rect(); return (r.width === 640 && r.height === 680 ? 'PASS ' : 'FAIL ') + r.width + 'x' + r.height; })()")
note "prefs window size" "$res"; [[ $res == PASS* ]] || FAILED=1
gdbus call --session --dest org.gnome.Shell.Screenshot --object-path /org/gnome/Shell/Screenshot --method org.gnome.Shell.Screenshot.Screenshot false false $OUT/prefs.png >/dev/null 2>&1
TL=$(dirname "$(find / -name 'Shew-0.typelib' 2>/dev/null | head -1)")
ev "GLib.spawn_command_line_async('env GI_TYPELIB_PATH=$TL LD_LIBRARY_PATH=$TL:$(dirname $TL) gjs -m /tests/prefs-harness.js $E $OUT/harness.txt')" >/dev/null; sleep 8
res=$(cat $OUT/harness.txt 2>/dev/null || echo 'FAIL no harness output')
note "prefs bindings" "$res"; [[ $res == PASS* ]] || FAILED=1

kill $SP; wait $SP 2>/dev/null
errors=$(grep -cE 'JS ERROR|JS WARNING' $OUT/shell.log)
note "shell JS errors" "$([ "$errors" -eq 0 ] && echo PASS || echo FAIL) $errors"
[ "$errors" -eq 0 ] || { FAILED=1; grep -E -A5 'JS ERROR|JS WARNING' $OUT/shell.log | head -40; }
exit $FAILED

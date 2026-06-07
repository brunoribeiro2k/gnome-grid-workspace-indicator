# CLAUDE.md

Guidance for working in this repository.

## What this is

**Grid Workspace Indicator** (UUID `gsi@fett2k.com`) is a GNOME Shell extension that
draws a small 2D grid in the top panel mirroring a **grid-based** workspace layout. It
highlights the active workspace and outlines workspaces that have open windows, and
scrolling over it switches workspaces.

Scope decision (intentional): the extension assumes a **2D / grid** workspace layout
(rows × columns), which GNOME only exposes when a static workspace grid is configured.
It is designed to pair with the **Workspace Matrix** extension
(https://extensions.gnome.org/extension/1485/workspace-matrix/); with the default
1×N linear layout it degrades to a single row.

Goal: prepare this for submission to **extensions.gnome.org** (EGO). The git history
(`prepare publication`, `support gnome 50`) reflects ongoing readiness work.

## Two processes — keep them separate

A GNOME extension runs in **two different processes**, and code must never cross the
boundary:

- **Shell side** (`extension.js`, `indicatorSettings.js`) runs inside the
  `gnome-shell` process. May import `St`, `Clutter`, `Meta`, `Shell`, `Main`, and
  touch `global.*`. **Must not** import GTK/Adwaita.
- **Prefs side** (`prefs.js`, `settings.ui`) runs in a separate GTK process. May import
  `Gtk`, `Adw`, `Gdk`, `Gio`. **Must not** import `St`/`Clutter`/`Main` or anything
  shell-side.

GJS ES modules throughout: `resource:///…` for shell/prefs framework modules, `gi://…`
for GI namespaces. Both entry points use the GNOME 45+ class style
(`export default class … extends Extension` / `extends ExtensionPreferences`).

## Layout

- `extension.js` — the shell-side extension. `GridWorkspaceIndicator` is a
  GObject-registered `PanelMenu.Button` that holds an `St.Widget` with a
  `Clutter.GridLayout` and one `St.Widget` cell per workspace. It connects to
  `global.workspace_manager` signals (`active-workspace-changed`,
  `workspace-added/removed`, `notify::layout-rows/columns`) to rebuild/repaint, handles
  `scroll-event` to cycle workspaces, and reacts to settings changes. `GridWorkspaceIndicatorExtension`
  is the `Extension` subclass with `enable()`/`disable()`.
- `indicatorSettings.js` — `IndicatorSettings`, a **singleton** wrapper around the
  extension's `Gio.Settings`. Caches typed values, exposes them via getters, and runs a
  small `connect`/`disconnect` callback registry that fires whenever any GSettings key
  changes. Initialized in `enable()` via `IndicatorSettings.initialize(this.getSettings())`
  and torn down in `disable()`. Shell-side only.
- `prefs.js` — `GridWorkspacePreferences extends ExtensionPreferences`. Loads
  `settings.ui` through `Gtk.Builder` and binds each widget to a GSettings key
  (dropdown, scale, color buttons, spin button, switches) plus a "Reset All Settings"
  button.
- `settings.ui` — GTK 4 / libadwaita `AdwPreferencesPage` consumed by `prefs.js`. Widget
  IDs here are the contract with `prefs.js`.
- `schemas/org.gnome.shell.extensions.gsi.gschema.xml` — GSettings schema (id
  `org.gnome.shell.extensions.gsi`). Keys: `cell-shape`, `cell-size`, `inactive-fill`,
  `active-fill`, `apps-outline-color`, `apps-outline-thickness`, `outline-active`,
  `debug-logging`. Must be compiled before the extension can load (see Commands).
- `metadata.json` — GNOME extension manifest. Carries the `uuid`, `settings-schema`,
  the supported `shell-version` list, and an **integer** `version`.
- `Makefile` — install / uninstall / compile-schemas / bundle targets.
- `.github/workflows/ci.yml` — on push/PR, installs `glib2.0-bin` + `gnome-shell`,
  compiles schemas, packs the bundle, and uploads it as an artifact.
- `LICENSE` — GPL-2.0-or-later (matches the SPDX header in `extension.js`).
- `schemas/gschemas.compiled` and `dist/` are gitignored build artifacts.

## Commands

- `make compile-schemas` — compile the GSettings schema to `schemas/gschemas.compiled`.
  Required after any edit to the `.gschema.xml`, and before the extension will load.
- `make install` — compile schemas, then copy the tree into
  `~/.local/share/gnome-shell/extensions/gsi@fett2k.com`.
- `make bundle` — `gnome-extensions pack` → `dist/gsi@fett2k.com.shell-extension.zip`.
  This is the artifact uploaded to EGO; the pack step embeds the compiled schema.
- `make uninstall` — remove the installed copy.

After installing, reload the shell and enable:
- **X11:** Alt+F2, type `r`, Enter. **Wayland:** log out/in (no live reload) — or test
  in a nested shell: `dbus-run-session -- gnome-shell --nested --wayland`.
- `gnome-extensions enable gsi@fett2k.com`
- `gnome-extensions prefs gsi@fett2k.com` — open the preferences window directly.

Watch logs while developing (debug lines are gated behind the **debug logging** setting):
- Shell side: `journalctl -f -o cat /usr/bin/gnome-shell`
- Prefs side: `journalctl -f -o cat | grep -i extension` (prefs runs in its own process)

There is no test runner or linter wired up yet — `make bundle` (which is what CI runs)
is the closest thing to a build gate. Run it before considering a change done.

## Conventions / hard rules

These reflect what EGO reviewers enforce — keep them holding:

- **Clean teardown — the #1 rejection reason.** Every signal connected, widget created,
  and GLib source scheduled in `enable()`/`_init()` must be disconnected/destroyed in
  `disable()`/`destroy()`. Disconnect from `global.workspace_manager` (a shell-owned
  object that outlives the extension), null out the stored handler IDs, and have any
  `GLib.idle_add`/timeout callback return `GLib.SOURCE_REMOVE`. `disable()` must leave
  no trace.
- **Only destroy your own objects.** Never destroy GNOME's panel, workspace manager, or
  windows — only widgets and the indicator this extension created.
- **No work at import time.** All side effects live in `enable()`; module top level only
  declares. Nothing should run just because a file was imported.
- **Respect the process split** (see "Two processes" above). The most common slip is
  pulling a GTK/Adw symbol into `extension.js` or an `St`/`Clutter` symbol into
  `prefs.js`.
- **Settings are the single source of truth.** The indicator repaints in response to
  GSettings `changed` (via `IndicatorSettings` callbacks); don't shadow setting values
  with separate state that can drift.
- **Logging behind the flag.** `console.debug`/`log` only inside
  `if (this._settings.debugLogging)`. No unconditional logging.
- **Keep the manifest coherent.** The `uuid`, `settings-schema`, and the schema `id`
  must stay in sync across `metadata.json` and the `.gschema.xml`. Bump the integer
  `version` for every EGO upload, and keep `shell-version` accurate for the versions you
  actually test.
- **Sentence case** in user-facing UI strings (settings titles/subtitles).
- Styling is applied **inline via `set_style`** because cell size/shape/color are
  computed at runtime from settings and the live workspace grid; there is no
  `stylesheet.css`. The `style_class` names are identifiers only.

## Contributing / PR rules

How changes land in this repo:

- **Conventional Commits everywhere.** Commit messages **and PR titles** follow
  `<type>(scope): description` (`feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, …).
  PR titles are enforced by `.github/workflows/pr-title.yml`
  (`amannn/action-semantic-pull-request`).
- **Squash-only merge.** Merge commits and rebase are disabled on the repo. The squash
  commit **subject comes from the PR title** and the **body from the PR description** —
  so write both to read like a good commit message. The PR *is* the commit.
- **Branch first.** Don't commit to `main` directly; open a PR from a topic branch.
- `feat` → minor and `fix` → patch in spirit, but the user-facing GNOME `version` in
  `metadata.json` is a separate integer bumped once per EGO upload.

## Submission tracking

EGO readiness is tracked in GitHub issues under the **`publication`** label, with
[#5](https://github.com/brunoribeiro2k/gnome-grid-workspace-indicator/issues/5) as the
umbrella checklist — check open `publication` issues for current state before starting
submission work. Concrete cleanup items from the first review pass: #1 (dead
grid-outline settings), #2 (README placeholders/name), #3 (cell-size default drift), #4
(screenshot + listing polish).

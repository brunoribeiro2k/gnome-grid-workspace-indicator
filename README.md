# Grid Workspace Indicator

A GNOME Shell extension that draws a small 2D grid in the top panel mirroring a **grid-based** workspace layout. It highlights the active workspace, outlines workspaces that have open windows, and lets you switch workspaces by scrolling over it.

<!-- Screenshot of the indicator in the panel goes here (tracked in #4). -->

## How it works

GNOME only exposes a true 2D workspace grid (rows × columns) when a **static workspace grid** is configured. This extension is built for that layout and pairs naturally with the [Workspace Matrix](https://extensions.gnome.org/extension/1485/workspace-matrix/) extension, which sets up the grid and adds directional navigation.

With the default 1×N linear workspace layout, GNOME reports a single row, so the indicator degrades gracefully to a single row of cells.

## Features

- **At-a-glance grid** — a compact rows × columns map of your workspaces in the panel.
- **Active highlight** — the current workspace is filled with its own color.
- **"Has windows" outline** — workspaces containing open windows are outlined.
- **Scroll to switch** — scroll up/down over the indicator to cycle workspaces (with wrap-around).
- **Configurable look** — cell shape, size, fill colors, and outline are all adjustable in preferences.

## Requirements

- GNOME Shell **46–50**.
- Recommended: [Workspace Matrix](https://extensions.gnome.org/extension/1485/workspace-matrix/) to configure a 2D workspace grid.

## Installation

### From extensions.gnome.org

Once published, the extension will be installable from [extensions.gnome.org](https://extensions.gnome.org) via the website toggle or the **Extensions** / **Extension Manager** app. _(Publication is in progress.)_

### From source

```bash
git clone https://github.com/brunoribeiro2k/gnome-grid-workspace-indicator.git
cd gnome-grid-workspace-indicator
make install
```

`make install` compiles the GSettings schema and copies the extension into `~/.local/share/gnome-shell/extensions/gsi@fett2k.com`.

Then reload GNOME Shell and enable it:

- **X11:** press <kbd>Alt</kbd>+<kbd>F2</kbd>, type `r`, press <kbd>Enter</kbd>.
- **Wayland:** log out and back in (the shell cannot reload in place).

```bash
gnome-extensions enable gsi@fett2k.com
```

To remove it, run `make uninstall`.

## Usage

- **Switch workspaces:** scroll up or down while hovering over the indicator.
- **Open settings:** click the indicator and choose **Settings**, or run `gnome-extensions prefs gsi@fett2k.com`.

## Configuration

Open the preferences window (`gnome-extensions prefs gsi@fett2k.com`) to adjust:

| Setting | Description | Default |
| --- | --- | --- |
| **Cell shape** | Circle or square cells | Circle |
| **Cell size** | Cell size as a percentage of the available panel height | 75% |
| **Active workspace color** | Fill color of the active workspace cell | Opaque white |
| **Other workspaces color** | Fill color of inactive cells | Translucent grey |
| **Outline** | Thickness (0–3 px) and color of the outline drawn on workspaces with open windows | 1 px, white |
| **Apply outline to active workspace** | Also outline the active workspace when it has windows | On |
| **Enable debug logging** | Write extra logs to the journal | Off |

A **Reset All Settings** button restores every option to its default.

## Development

To test changes without disrupting your session, run the extension in a **nested** GNOME Shell:

```bash
make install
dbus-run-session -- gnome-shell --devkit --wayland
```

A nested shell window opens; enable the extension inside it with `gnome-extensions enable gsi@fett2k.com`.

> The nesting flag is `--devkit` on **GNOME 49+** and `--nested` on **GNOME 48 and earlier**.

Other useful targets and commands:

- `make compile-schemas` — recompile the GSettings schema (needed after editing the `.gschema.xml`).
- `make bundle` — produce `dist/gsi@fett2k.com.shell-extension.zip` (the artifact uploaded to EGO).
- Watch shell-side logs: `journalctl -f -o cat /usr/bin/gnome-shell`.

Debug log lines are gated behind the **Enable debug logging** setting.

## Contributing

Commits and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `docs`, `refactor`, `chore`, `ci`, …); PR titles are linted in CI. Branch from `main` and open a pull request — merges are squash-only, so the PR title and description become the commit. See [CLAUDE.md](CLAUDE.md) for the full conventions and architecture notes.

## License

Licensed under the [GPL-2.0-or-later](LICENSE).

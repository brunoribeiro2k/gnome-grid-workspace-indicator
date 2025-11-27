# Grid Workspace Indicator

Grid Workspace Indicator is a GNOME Shell extension that renders your workspaces as a compact grid in the top bar. It keeps the current workspace highlighted, subtly marks workspaces with running applications, and lets you cycle between them with a quick scroll.

## Highlights

- **Accurate workspace state:** The indicator reacts instantly as windows open, close, or move between workspaces.
- **Touchpad-friendly navigation:** High-resolution scroll events are translated into smooth workspace switching.
- **Customisable look and feel:** Tweak cell size, shape, colours, and outlines from the preferences dialog.
- **Lightweight by design:** Only essential GNOME APIs are used and all signal handlers are cleaned up on shutdown.

## Requirements

- GNOME Shell 46, 47, or 48 (as listed in `metadata.json`)
- GTK 4 / libadwaita for the preferences window

## Installation

```bash
git clone https://github.com/brunoribeiro2k/gnome-grid-workspace-indicator.git
cd gnome-grid-workspace-indicator
make install
```

The Makefile compiles the bundled GSettings schema and installs the extension into `~/.local/share/gnome-shell/extensions/gsi@fett2k.com`.

Restart GNOME Shell (press `Alt+F2`, run `r`, then press Enter) and enable the extension via the Extensions app or with:

```bash
gnome-extensions enable gsi@fett2k.com
```

## Updating

Pull the latest changes and reinstall:

```bash
git pull
make install
```

## Uninstallation

```bash
make uninstall
```

Restart GNOME Shell once more to remove the indicator from the panel.

## Development

- Run `make compile-schemas` whenever you change `schemas/org.gnome.shell.extensions.gsi.gschema.xml`.
- Launch the preferences dialog with `gnome-extensions prefs gsi@fett2k.com` for live UI testing.
- Use `journalctl -f /usr/bin/gnome-shell` to inspect runtime logs.

Contributions and bug reports are welcome. Open an issue with details about your Shell version and any relevant logs so we can reproduce the problem.

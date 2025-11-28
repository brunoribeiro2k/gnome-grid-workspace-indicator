# Workspace Indicator

Workspace Indicator is a GNOME Shell extension that provides a simple 2D indicator tailored for grid-based workspace layouts. It pairs especially well with the [Workspace Matrix extension](https://extensions.gnome.org/extension/1485/workspace-matrix/), offering a quick glance at your workspace grid while highlighting the active workspace and those containing open applications.

## Features

1. **Visual Workspace Grid:** Get a clear, visual overview of your available workspaces.
2. **Workspace Switching:** Scroll over the indicator to switch between workspaces seamlessly.
3. **Access Preferences:** Modify extension settings easily through the built-in preferences menu.

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/workspace-indicator.git
   cd workspace-indicator
   ```

2. **Install the extension:**
   ```bash
   make install
   ```

3. **Compile Settings Schema (if applicable):**  
   The installation process automatically compiles the GSettings schemas. If you modify any schema, re-run:
   ```bash
   make compile-schemas
   ```

4. **Restart GNOME Shell and enable the extension:**
   1. Press **Alt + F2**, type `r`, and press **Enter**.
   2. Enable the extension using the GNOME Extensions application or run:
      ```bash
      gnome-extensions enable gsi@fett2k.com
      ```

## Uninstallation

1. To uninstall the extension, run:
   ```bash
   make uninstall
   ```

2. Then, restart GNOME Shell (Alt+F2, type `r`).

## Notes

1. **Overview Toggle:** The current version does not support toggling the GNOME Shell overview on click.
2. **Compatibility:** Ensure your GNOME Shell version is compatible with this extension.
3. **Customization:** Additional preferences are available via the extension settings. Explore options like cell shape, cell size, and color settings to tailor the indicator to your liking.

# Variables
METADATA = metadata.json
UUID = $(shell grep -Po '"uuid": *\K"[^"]*"' $(METADATA) | tr -d '"')
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMA_DIR = schemas
BUNDLE_DIR = dist
BUNDLE = $(UUID).shell-extension.zip
BUILD_INFO = build-info.txt

# Default target
all:
	@echo "Run 'make install' to install the extension."

# Compile the settings schemas
compile-schemas:
	@[ -d $(SCHEMA_DIR) ] && (cd $(SCHEMA_DIR) && glib-compile-schemas .) || echo "No schemas directory present."

# Record the build (commit hash + commit time) shown at the bottom of the prefs window
build-info:
	@hash=$$(git describe --always --dirty 2>/dev/null || echo unknown); \
	date=$$(git log -1 --format=%cd --date=format:'%Y-%m-%d %H:%M' 2>/dev/null); \
	echo "Build $$hash$${date:+ · $$date}" > $(BUILD_INFO)

# Install the extension
install: compile-schemas build-info
	mkdir -p $(INSTALL_DIR)
	cp -r * $(INSTALL_DIR)
	@echo "Extension installed to $(INSTALL_DIR)."
	@echo "Reload GNOME Shell, then run: gnome-extensions enable $(UUID)"
	@echo "  X11:     Alt+F2, type 'r', Enter."
	@echo "  Wayland: log out/in, or test nested: dbus-run-session -- gnome-shell --devkit --wayland"

# Build a distributable zip for GNOME Extensions
bundle: compile-schemas build-info
	mkdir -p $(BUNDLE_DIR)
	rm -f $(BUNDLE_DIR)/$(BUNDLE)
	gnome-extensions pack --force --out-dir $(BUNDLE_DIR) --extra-source=$(BUILD_INFO)
	@echo "Bundle created at $(BUNDLE_DIR)/$(BUNDLE)."

# Uninstall the extension
uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "Extension uninstalled from $(INSTALL_DIR)."
	@echo "Reload GNOME Shell (X11: Alt+F2, type 'r', Enter; Wayland: log out/in)."

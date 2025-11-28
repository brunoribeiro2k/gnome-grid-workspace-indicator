# Variables
METADATA = metadata.json
UUID = $(shell grep -Po '"uuid": *\K"[^"]*"' $(METADATA) | tr -d '"')
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SCHEMA_DIR = schemas
BUNDLE_DIR = dist
BUNDLE = $(UUID).shell-extension.zip

# Default target
all:
	@echo "Run 'make install' to install the extension."

# Compile the settings schemas
compile-schemas:
	@[ -d $(SCHEMA_DIR) ] && (cd $(SCHEMA_DIR) && glib-compile-schemas .) || echo "No schemas directory present."

# Install the extension
install: compile-schemas
	mkdir -p $(INSTALL_DIR)
	cp -r * $(INSTALL_DIR)
	@echo "Extension installed to $(INSTALL_DIR)."
	@echo "Restart GNOME Shell (Alt+F2, type 'r') and enable the extension."

# Build a distributable zip for GNOME Extensions
bundle: compile-schemas
	mkdir -p $(BUNDLE_DIR)
	rm -f $(BUNDLE_DIR)/$(BUNDLE)
	gnome-extensions pack --force --out-dir $(BUNDLE_DIR)
	@echo "Bundle created at $(BUNDLE_DIR)/$(BUNDLE)."

# Uninstall the extension
uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "Extension uninstalled from $(INSTALL_DIR)."
	@echo "Restart GNOME Shell (Alt+F2, type 'r')."

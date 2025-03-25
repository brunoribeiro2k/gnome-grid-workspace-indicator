# Variables
METADATA = metadata.json
UUID = $(shell grep -Po '"uuid": *\K"[^"]*"' $(METADATA) | tr -d '"')
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

# Default target
all:
	@echo "Run 'make install' to install the extension."

# Install the extension
install:
	mkdir -p $(INSTALL_DIR)
	cp -r * $(INSTALL_DIR)
	@echo "Extension installed to $(INSTALL_DIR)."
	@echo "Restart GNOME Shell (Alt+F2, type 'r') and enable the extension."

# Uninstall the extension
uninstall:
	rm -rf $(INSTALL_DIR)
	@echo "Extension uninstalled from $(INSTALL_DIR)."
	@echo "Restart GNOME Shell (Alt+F2, type 'r')."
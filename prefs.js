import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * Returns the directory of the current extension based on the ES module URL.
 *
 * @returns {string} The absolute path to the extension directory.
 */
function getExtensionDir() {
    let uri = import.meta.url;
    let path = uri.startsWith("file://") ? uri.slice("file://".length) : uri;
    return GLib.path_get_dirname(path);
}

/**
 * Preferences window implementation for the Grid Workspace extension.
 * Extends ExtensionPreferences and builds the preferences UI using a Gtk.Builder file.
 */
export default class GridWorkspacePreferences extends ExtensionPreferences {
    /**
     * Fills the preferences window with the UI loaded from the settings UI file and binds 
     * the widget events to the corresponding settings.
     *
     * @param {Gtk.Window} window - The preferences window to populate.
     */
    fillPreferencesWindow(window) {
        let extensionDir = getExtensionDir();
        let uiFile = extensionDir + '/settings.ui';
        log('Loading UI file from: ' + uiFile);

        let builder;
        try {
            builder = Gtk.Builder.new_from_file(uiFile);
        } catch (e) {
            log('Error creating Gtk.Builder: ' + e);
            return;
        }
        let mainWidget = builder.get_object('main_widget');
        if (!mainWidget) {
            log('Error: Could not find main_widget in the UI file');
            return;
        }
        window.add(mainWidget);
        log('Preferences UI loaded successfully.');

        // Get settings from the extension.
        const settings = this.getSettings();

        // Bind cell shape dropdown.
        const cellShapeDropdown = builder.get_object('cell_shape_dropdown');
        const updateCellShape = () => {
            const shape = settings.get_string('cell-shape');
            cellShapeDropdown.selected = shape === 'circle' ? 0 : 1;
        };
        updateCellShape();
        cellShapeDropdown.connect('notify::selected', () => {
            const shape = cellShapeDropdown.selected === 0 ? 'circle' : 'square';
            settings.set_string('cell-shape', shape);
        });
        settings.connect('changed::cell-shape', () => {
            updateCellShape();
        });

        // Bind cell size scale control.
        const cellSizeScale = builder.get_object('cell_size_scale');
        settings.bind(
            'cell-size',
            cellSizeScale.get_adjustment(),
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Bind theme settings: inactive and active fill colors.
        this._bindColorButton(builder, settings, 'inactive-fill', 'inactive_fill_button');
        this._bindColorButton(builder, settings, 'active-fill', 'active_fill_button');

        // Bind apps outline color setting.
        this._bindColorButton(builder, settings, 'apps-outline-color', 'outline_color_button');
        
        // Bind apps outline thickness setting.
        const outlineScale = builder.get_object('outline_thickness_scale');
        settings.bind(
            'apps-outline-thickness',
            outlineScale.get_adjustment(),
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Bind switch for outline-active setting.
        this._bindSwitch(builder, settings, 'outline-active', 'outline_active_switch');

        // Reset button functionality: reset all settings.
        const resetButton = builder.get_object('reset_button');
        resetButton.connect('clicked', () => {
            // settings.reset('grid-visible');
            // settings.reset('grid-color');
            settings.reset('cell-shape');
            settings.reset('cell-size');
            settings.reset('inactive-fill');
            settings.reset('active-fill');
            settings.reset('apps-outline-color');
            settings.reset('apps-outline-thickness');
            settings.reset('outline-active');
        });
    }

    /**
     * Binds a GSettings key to a switch widget.
     *
     * @param {Gtk.Builder} builder - The Gtk.Builder instance.
     * @param {Gio.Settings} settings - The settings object.
     * @param {string} key - The settings key to bind.
     * @param {string} switchId - The ID of the Gtk switch in the UI.
     *
     * @private
     */
    _bindSwitch(builder, settings, key, switchId) {
        settings.bind(
            key,
            builder.get_object(switchId),
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }

    /**
     * Binds a GSettings key to a color button widget.
     * Initializes the button's color and sets up listeners for user or settings changes.
     *
     * @param {Gtk.Builder} builder - The Gtk.Builder instance.
     * @param {Gio.Settings} settings - The settings object.
     * @param {string} key - The settings key to bind.
     * @param {string} buttonId - The ID of the Gtk color button in the UI.
     *
     * @private
     */
    _bindColorButton(builder, settings, key, buttonId) {
        const button = builder.get_object(buttonId);

        // Set initial color.
        const rgba = new Gdk.RGBA();
        rgba.parse(settings.get_string(key));
        button.set_rgba(rgba);

        // Update settings when the button's color changes.
        button.connect('color-set', () => {
            const color = button.get_rgba().to_string();
            settings.set_string(key, color);
        });

        // Update the button color if settings change externally.
        settings.connect(`changed::${key}`, () => {
            const newRgba = new Gdk.RGBA();
            newRgba.parse(settings.get_string(key));
            button.set_rgba(newRgba);
        });
    }
}

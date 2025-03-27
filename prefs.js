import Gdk from 'gi://Gdk';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

// Get the extension directory based on the ES module URL.
function getExtensionDir() {
    let uri = import.meta.url;
    let path = uri.startsWith("file://") ? uri.slice("file://".length) : uri;
    return GLib.path_get_dirname(path);
}

export default class GridWorkspacePreferences extends ExtensionPreferences {
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

        // Get settings
        const settings = this.getSettings();

        // Grid Settings
        this._bindSwitch(builder, settings, 'grid-visible', 'grid_visible_switch');
        this._bindColorButton(builder, settings, 'grid-color', 'grid_color_button');
        
        // Cell Settings
        const cellShapeDropdown = builder.get_object('cell_shape_dropdown');
        settings.bind(
            'cell-shape',
            cellShapeDropdown,
            'selected',
            Gio.SettingsBindFlags.DEFAULT
        );

        const cellSizeScale = builder.get_object('cell_size_scale');
        settings.bind(
            'cell-size',
            cellSizeScale.get_adjustment(),
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Theme Settings
        this._bindColorButton(builder, settings, 'inactive-fill', 'inactive_fill_button');
        this._bindColorButton(builder, settings, 'active-fill', 'active_fill_button');

        // Apps Outline Settings
        this._bindColorButton(builder, settings, 'apps-outline-color', 'outline_color_button');
        
        const outlineScale = builder.get_object('outline_thickness_scale');
        settings.bind(
            'apps-outline-thickness',
            outlineScale.get_adjustment(),
            'value',
            Gio.SettingsBindFlags.DEFAULT
        );

        // Debug Logging
        this._bindSwitch(builder, settings, 'log-debug', 'debug_logging_switch');

        // Reset button
        const resetButton = builder.get_object('reset_button');
        resetButton.connect('clicked', () => {
            settings.reset('grid-visible');
            settings.reset('grid-color');
            settings.reset('cell-shape');
            settings.reset('cell-size');
            settings.reset('inactive-fill');
            settings.reset('active-fill');
            settings.reset('apps-outline-color');
            settings.reset('apps-outline-thickness');
            settings.reset('log-debug');
        });
    }

    _bindSwitch(builder, settings, key, switchId) {
        settings.bind(
            key,
            builder.get_object(switchId),
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
    }

    _bindColorButton(builder, settings, key, buttonId) {
        const button = builder.get_object(buttonId);
        
        // Set initial color
        const rgba = new Gdk.RGBA();
        rgba.parse(settings.get_string(key));
        button.set_rgba(rgba);

        // Connect to color changes
        button.connect('color-set', () => {
            const color = button.get_rgba().to_string();
            settings.set_string(key, color);
        });

        // Watch for settings changes
        settings.connect(`changed::${key}`, () => {
            const newRgba = new Gdk.RGBA();
            newRgba.parse(settings.get_string(key));
            button.set_rgba(newRgba);
        });
    }
}
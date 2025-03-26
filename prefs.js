import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GridWorkspacePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Get settings
        const settings = this.getSettings();
        
        // Create a preferences page
        const page = new Adw.PreferencesPage();
        
        // Grid settings group
        const gridGroup = new Adw.PreferencesGroup({
            title: 'Grid Settings',
            description: 'Configure the appearance of the grid'
        });

        // Grid visibility switch
        const gridVisibleRow = new Adw.ActionRow({
            title: 'Show Grid Lines',
            subtitle: 'Display lines between workspaces'
        });
        const gridVisibleSwitch = new Gtk.Switch({
            active: settings.get_boolean('grid-visible'),
            valign: Gtk.Align.CENTER,
        });
        gridVisibleRow.add_suffix(gridVisibleSwitch);
        gridVisibleSwitch.connect('notify::active', (widget) => {
            settings.set_boolean('grid-visible', widget.get_active());
        });
        
        // Grid color button
        const gridColorRow = new Adw.ActionRow({
            title: 'Grid Color',
            subtitle: 'Choose the color of grid lines'
        });
        const gridColorButton = new Gtk.ColorButton({
            valign: Gtk.Align.CENTER,
            rgba: new Gdk.RGBA()
        });
        gridColorButton.get_rgba().parse(settings.get_string('grid-color'));
        gridColorRow.add_suffix(gridColorButton);
        gridColorButton.connect('color-set', (widget) => {
            const rgba = widget.get_rgba();
            settings.set_string('grid-color', rgba.to_string());
        });

        // Cell settings group
        const cellGroup = new Adw.PreferencesGroup({
            title: 'Cell Settings',
            description: 'Configure the appearance of workspace cells'
        });

        // Cell shape dropdown
        const cellShapeRow = new Adw.ComboRow({
            title: 'Cell Shape',
            subtitle: 'Choose the shape of workspace cells',
            model: new Gtk.StringList({
                strings: ['circle', 'square']
            }),
            selected: settings.get_string('cell-shape') === 'circle' ? 0 : 1
        });
        cellShapeRow.connect('notify::selected', (widget) => {
            const shapes = ['circle', 'square'];
            settings.set_string('cell-shape', shapes[widget.selected]);
        });

        // Cell size scale
        const cellSizeRow = new Adw.ActionRow({
            title: 'Cell Size',
            subtitle: 'Size of cells as percentage of available space'
        });
        const cellSizeScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                lower: 10,
                upper: 100,
                step_increment: 5,
                value: settings.get_int('cell-size')
            }),
            width_request: 200,
            value_pos: Gtk.PositionType.RIGHT,
            digits: 0,
            valign: Gtk.Align.CENTER
        });
        cellSizeRow.add_suffix(cellSizeScale);
        cellSizeScale.connect('value-changed', (widget) => {
            settings.set_int('cell-size', widget.get_value());
        });

        // Add rows to groups
        gridGroup.add(gridVisibleRow);
        gridGroup.add(gridColorRow);
        cellGroup.add(cellShapeRow);
        cellGroup.add(cellSizeRow);

        // Add groups to page
        page.add(gridGroup);
        page.add(cellGroup);

        // Add page to window
        window.add(page);
    }
}
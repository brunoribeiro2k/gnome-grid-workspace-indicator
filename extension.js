/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const WorkspaceIndicator = GObject.registerClass(
class WorkspaceIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Workspace Indicator'));

        // Get the extension's directory path using the dir property.
        this._extensionPath = extension.dir.get_path();
        log(`Extension path: ${this._extensionPath}`); // Debug log

        // Create an icon to display the workspace indicator.
        this._icon = new St.Icon({
            gicon: null, // Placeholder for the icon
            style_class: 'workspace-indicator-icon',
        });
        this.add_child(this._icon);

        // Connect a click event to toggle the overview.
        this.connect('button-press-event', () => {
            Main.overview.toggle(); // Toggle the GNOME Shell overview
        });

        // Connect a scroll event to iterate through workspaces.
        this.connect('scroll-event', (actor, event) => {
            let direction = event.get_scroll_direction();
            if (direction === Clutter.ScrollDirection.UP) {
                this._switchWorkspace(-1); // Scroll up to go to the previous workspace
            } else if (direction === Clutter.ScrollDirection.DOWN) {
                this._switchWorkspace(1); // Scroll down to go to the next workspace
            }
        });

        // Connect to the signal that fires when the active workspace changes.
        this._activeWsSignalId = global.workspace_manager.connect('active-workspace-changed', () => {
            this._updateWorkspace();
        });

        // Update the indicator immediately.
        this._updateWorkspace();
    }

    _getWorkspaceNumber(idx) {
        return idx + 1
    }

    _getWorkspaceCoordinates(idx, h, w) {
        let x = idx % w;
        let y = Math.floor(idx / h);
        return [y + 1, x + 1];
    }

    _getIconFileName(idx) {
        let [x, y] = this._getWorkspaceCoordinates(idx, 3, 3); // Assuming a 3x3 grid
        return `grid_${x}_${y}.svg`;
    }

    _updateWorkspace() {
        try {
            // Get the current active workspace index (0-based).
            let activeIndex = global.workspace_manager.get_active_workspace_index();
            log(`Active workspace index: ${activeIndex}`); // Debug log

            // Get the icon file name for the active workspace.
            let iconFileName = this._getIconFileName(activeIndex);
            log(`Icon file name: ${iconFileName}`); // Debug log

            // Construct the full path to the icon.
            let iconPath = `${this._extensionPath}/icons/${iconFileName}`;
            log(`Icon path: ${iconPath}`); // Debug log

            // Check if the file exists.
            let file = Gio.File.new_for_path(iconPath);
            if (!file.query_exists(null)) {
                logError(new Error(`Icon file does not exist: ${iconPath}`));
                return;
            }

            // Set the icon for the current workspace.
            this._icon.gicon = Gio.icon_new_for_string(iconPath);
            log(`Updated workspace icon to: ${iconPath}`); // Debug log
        } catch (error) {
            logError(error, 'Failed to update workspace indicator');
        }
    }

    _switchWorkspace(offset) {
        let workspaceManager = global.workspace_manager;
        let activeIndex = workspaceManager.get_active_workspace_index();
        let numWorkspaces = workspaceManager.get_n_workspaces();

        // Calculate the new workspace index without wrapping.
        let newIndex = activeIndex + offset;

        // Ensure the new index is within valid bounds.
        if (newIndex < 0 || newIndex >= numWorkspaces) {
            log(`Cannot switch to workspace ${newIndex}: Out of bounds`); // Debug log
            return;
        }

        // Activate the new workspace.
        let newWorkspace = workspaceManager.get_workspace_by_index(newIndex);
        if (newWorkspace) {
            newWorkspace.activate(global.get_current_time());
            log(`Switched to workspace ${newIndex}`); // Debug log
        }
    }

    destroy() {
        // Disconnect the workspace signal when the indicator is destroyed.
        if (this._activeWsSignalId) {
            global.workspace_manager.disconnect(this._activeWsSignalId);
            this._activeWsSignalId = null;
        }
        super.destroy();
    }
});

export default class IndicatorExampleExtension extends Extension {
    enable() {
        // Instantiate and add the indicator to the GNOME panel.
        this._indicator = new WorkspaceIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        // Clean up by destroying the indicator.
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}

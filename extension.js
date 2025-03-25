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
import GLib from 'gi://GLib';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// Define the active log level.
const LOG_LEVEL = 'error';

// Logging utility function.
function logWithLevel(level, message, error = null) {
    const levels = ['debug', 'info', 'error'];
    const currentLevelIndex = levels.indexOf(LOG_LEVEL);
    const messageLevelIndex = levels.indexOf(level);

    // Only log messages that are at or above the active log level.
    if (messageLevelIndex >= currentLevelIndex) {
        if (level === 'error' && error) {
            logError(error, message);
        } else {
            log(`[${level.toUpperCase()}] ${message}`);
        }
    }
}

const WorkspaceIndicator = GObject.registerClass(
class WorkspaceIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Workspace Indicator'));

        // Create an icon to display the workspace indicator.
        this._icon = new St.Icon({
            gicon: null, // Placeholder for the icon
            style_class: 'workspace-indicator-icon',
        });
        this.add_child(this._icon);

        // Connect a click event to toggle the overview.
        this.connect('button-press-event', () => {
            Main.overview.toggle();
        });

        // Connect a scroll event to iterate through workspaces.
        this.connect('scroll-event', (actor, event) => {
            let direction = event.get_scroll_direction();
            if (direction === Clutter.ScrollDirection.UP) {
                this._switchWorkspace(-1);
            } else if (direction === Clutter.ScrollDirection.DOWN) {
                this._switchWorkspace(1);
            }
        });

        // Connect to the signal that fires when the active workspace changes.
        this._activeWsSignalId = global.workspace_manager.connect('active-workspace-changed', () => {
            this._updateWorkspace();
        });

        // Update the indicator immediately.
        this._updateWorkspace();
    }

    _getWorkspaceCoordinates(idx, columns) {
        let x = idx % columns;
        let y = Math.floor(idx / columns);
        return [x, y];
    }

    _getWorkspaceDimensions() {
        let workspaceManager = global.workspace_manager;
        let rows = workspaceManager.get_layout_rows();
        let columns = workspaceManager.get_layout_columns();
        return [rows, columns];
    }

    _generateSVGIcon(x, y, rows, columns) {
        const cellWidth = 30 / columns;
        const cellHeight = 30 / rows;
        const rectX = x * cellWidth; // Horizontal position
        const rectY = y * cellHeight; // Vertical position
    
        let svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
        <rect x="${rectX}" y="${rectY}" width="${cellWidth}" height="${cellHeight}" fill="white"/>
    `;
    
        // Add vertical grid lines
        for (let col = 1; col < columns; col++) {
            const lineX = col * cellWidth;
            svg += `    <path d="M${lineX} 0 V30" stroke="white" stroke-width="1"/>\n`;
        }
    
        // Add horizontal grid lines
        for (let row = 1; row < rows; row++) {
            const lineY = row * cellHeight;
            svg += `    <path d="M0 ${lineY} H30" stroke="white" stroke-width="1"/>\n`;
        }
    
        svg += `</svg>`;
        return svg;
    }

    _updateWorkspace() {
        try {
            // Get the current active workspace index (0-based).
            let activeIndex = global.workspace_manager.get_active_workspace_index();
            logWithLevel('debug', `Active workspace index: ${activeIndex}`);

            // Get the workspace dimensions.
            let [rows, cols] = this._getWorkspaceDimensions();

            // Get the workspace coordinates.
            let [x, y] = this._getWorkspaceCoordinates(activeIndex, cols);
            logWithLevel('debug', `Workspace coordinates: (${x}, ${y})`);

            // Generate the SVG icon for the current workspace.
            let svgContent = this._generateSVGIcon(x, y, rows, cols);
            let tempFilePath = `${GLib.get_tmp_dir()}/workspace_${rows}x${cols}_${x}_${y}.svg`;
            GLib.file_set_contents(tempFilePath, svgContent);
            logWithLevel('debug', `Generated SVG saved to: ${tempFilePath}`);

            // Set the icon for the current workspace.
            this._icon.gicon = Gio.icon_new_for_string(tempFilePath);
            logWithLevel('debug', `Updated workspace icon to: ${tempFilePath}`);
        } catch (error) {
            logWithLevel('error', 'Failed to update workspace indicator', error);
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
            logWithLevel('debug', `Cannot switch to workspace ${newIndex}: Out of bounds`);
            return;
        }

        // Activate the new workspace.
        let newWorkspace = workspaceManager.get_workspace_by_index(newIndex);
        if (newWorkspace) {
            newWorkspace.activate(global.get_current_time());
            logWithLevel('debug', `Switched to workspace ${newIndex}`);
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

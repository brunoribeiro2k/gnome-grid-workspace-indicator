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

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const WorkspaceIndicator = GObject.registerClass(
class WorkspaceIndicator extends PanelMenu.Button {
    _init() {
        // Create a panel button with a descriptive name.
        super._init(0.0, _('Workspace Indicator'));

        // Create a label to display the workspace number.
        this._label = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this._label);

        // Connect to the signal that fires when the active workspace changes.
        this._activeWsSignalId = global.workspace_manager.connect('active-workspace-changed', () => {
            log('Active workspace changed'); // Debug log
            this._updateWorkspace();
        });

        // Update the indicator immediately.
        this._updateWorkspace();
    }

    _updateWorkspace() {
        try {
            // Get the current active workspace index (0-based) and add 1.
            let activeIndex = global.workspace_manager.get_active_workspace_index();
            let workspaceNumber = activeIndex + 1;

            log(`Active workspace index: ${activeIndex}`); // Debug log

            // Display only numbers from 1 to 9.
            this._label.set_text(workspaceNumber.toString());
        } catch (error) {
            logError(error, 'Failed to update workspace indicator');
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
        this._indicator = new WorkspaceIndicator();
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

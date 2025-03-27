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

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { SVGGenerator } from './svgGenerator.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// Define the active log level.
const LOG_LEVEL = 'debug';

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
            
            // Store extension reference for settings
            this._extension = extension;
            
            // Get panel height for icon sizing
            const panelHeight = Main.panel.height;
            logWithLevel('debug', `Panel height: ${panelHeight}`);
            
            // Create an icon to display the workspace indicator.
            this._icon = new St.Icon({
                gicon: null,
                style_class: 'workspace-indicator-icon',
                icon_size: Math.floor(panelHeight * 1) // Make icon slightly smaller than panel
            });
            this.add_child(this._icon);

            // Create popup menu
            let item = new PopupMenu.PopupMenuItem(_('Settings'));
            item.connect('activate', () => {
                this._extension.openPreferences();
            });
            this.menu.addMenuItem(item);

            // Manage clicks
            this.connect("button-press-event", (actor, event) => {
                let button = event.get_button();
                if (button == Clutter.BUTTON_PRIMARY || button == Clutter.BUTTON_MIDDLE) {
                    logWithLevel('debug', `Caught click on button ${button}, toggling overview`);
                    Main.overview.toggle();
                    return Clutter.EVENT_STOP; // Stop propagation to prevent menu from opening
                }
                return Clutter.EVENT_PROPAGATE;
            });

            // Handle secondary button on release.
            this.connect("button-release-event", (actor, event) => {
                let button = event.get_button();
                if (button == Clutter.BUTTON_SECONDARY) {
                    logWithLevel('debug', `Right-click released, toggling menu`);
                    this.menu.toggle();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
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

            // Connect to window creation
            this._windowCreatedId = global.display.connect('window-created', () => {
                this._updateWorkspace();
            });

            // Connect to window signals for each workspace
            this._windowSignals = [];
            this._connectWindowSignals();

            // Connect to workspace number changes to update window signals
            this._wsAddedId = global.workspace_manager.connect('workspace-added', () => {
                // Add small delay to ensure layout is updated
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    this._connectWindowSignals();
                    this._updateWorkspace();
                    return GLib.SOURCE_REMOVE;
                });
            });
            this._wsRemovedId = global.workspace_manager.connect('workspace-removed', () => {
                // Add small delay to ensure layout is updated
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    this._connectWindowSignals();
                    this._updateWorkspace();
                    return GLib.SOURCE_REMOVE;
                });
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
        
        _getWorkspacesWithApps() {
            let workspacesWithApps = [];
            let numWorkspaces = global.workspace_manager.get_n_workspaces();
            let [rows, cols] = this._getWorkspaceDimensions();
        
            for (let i = 0; i < numWorkspaces; i++) {
                let workspace = global.workspace_manager.get_workspace_by_index(i);
                if (workspace.list_windows().length > 0) {
                    // Convert the workspace index to coordinates.
                    let [x, y] = this._getWorkspaceCoordinates(i, cols);
                    workspacesWithApps.push([x, y]);
                }
            }
            return workspacesWithApps;
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
        
                // Get workspaces with open apps.
                let withApps = this._getWorkspacesWithApps()
                logWithLevel('debug', `Workspaces with active apps: ${JSON.stringify(withApps)}`)
                
                // Generate the SVG icon for the current workspace.
                let svgContent = SVGGenerator.create(x, y, rows, cols, withApps, this._icon.icon_size);
                
                // Create a GBytes object from the SVG content
                let bytes = GLib.Bytes.new(new TextEncoder().encode(svgContent));
                
                // Create a BytesIcon directly from the GBytes
                this._icon.gicon = new Gio.BytesIcon({ bytes: bytes });
                
                logWithLevel('debug', `Updated workspace icon from memory`);
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

        _connectWindowSignals() {
            // Disconnect existing signals
            this._disconnectWindowSignals();
            
            // Connect to window-removed signal for each workspace
            let numWorkspaces = global.workspace_manager.get_n_workspaces();
            for (let i = 0; i < numWorkspaces; i++) {
                let workspace = global.workspace_manager.get_workspace_by_index(i);
                let signalId = workspace.connect('window-removed', () => {
                    this._updateWorkspace();
                });
                this._windowSignals.push([workspace, signalId]);
            }
        }

        _disconnectWindowSignals() {
            for (let [workspace, signalId] of this._windowSignals) {
                workspace.disconnect(signalId);
            }
            this._windowSignals = [];
        }
        
        destroy() {
            // Disconnect the workspace signal when the indicator is destroyed.
            if (this._activeWsSignalId) {
                global.workspace_manager.disconnect(this._activeWsSignalId);
                this._activeWsSignalId = null;
            }
            if (this._windowCreatedId) {
                global.display.disconnect(this._windowCreatedId);
                this._windowCreatedId = null;
            }
            if (this._wsAddedId) {
                global.workspace_manager.disconnect(this._wsAddedId);
                this._wsAddedId = null;
            }
            if (this._wsRemovedId) {
                global.workspace_manager.disconnect(this._wsRemovedId);
                this._wsRemovedId = null;
            }
            
            // Disconnect window signals
            this._disconnectWindowSignals();
            
            super.destroy();
        }
    });
    
export default class IndicatorExampleExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        // Pass the schema ID to getSettings
        this._settings = this.getSettings();
    }

    enable() {
        // Update SVGGenerator config from settings
        SVGGenerator.DefaultConfig.grid.visible = this._settings.get_boolean('grid-visible');
        SVGGenerator.DefaultConfig.grid.color = this._settings.get_string('grid-color');
        SVGGenerator.DefaultConfig.cell.shape = this._settings.get_string('cell-shape');
        SVGGenerator.DefaultConfig.cell.size = this._settings.get_int('cell-size');

        // Connect to settings changes
        this._settingsChangedId = this._settings.connect('changed', () => {
            this._updateConfig();
        });

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

        // Disconnect settings changes
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
    }

    _updateConfig() {
        SVGGenerator.DefaultConfig.grid.visible = this._settings.get_boolean('grid-visible');
        SVGGenerator.DefaultConfig.grid.color = this._settings.get_string('grid-color');
        SVGGenerator.DefaultConfig.cell.shape = this._settings.get_string('cell-shape');
        SVGGenerator.DefaultConfig.cell.size = this._settings.get_int('cell-size');
        
        // Trigger indicator update
        if (this._indicator) {
            this._indicator._updateWorkspace();
        }
    }
}

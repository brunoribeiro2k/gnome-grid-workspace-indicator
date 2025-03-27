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
let LOG_LEVEL = 'error';

// Production-level logging utility.
function logWithLevel(level, message, error = null) {
    const levels = ['debug', 'info', 'error'];
    if (levels.indexOf(level) >= levels.indexOf(LOG_LEVEL)) {
        level === 'error' && error ? logError(error, message) : log(`[${level.toUpperCase()}] ${message}`);
    }
}

const WorkspaceIndicator = GObject.registerClass(
    class WorkspaceIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.0, _('Workspace Indicator'));
            this._extension = extension;
            this._initWidgets();
            this._initSignals();
            this._updateWorkspace();
        }
        
        _initWidgets() {
            // Setting up the icon.
            const panelHeight = Main.panel.height;
            logWithLevel('debug', `Panel height: ${panelHeight}`);
            this._icon = new St.Icon({
                gicon: null,
                style_class: 'workspace-indicator-icon',
                icon_size: Math.floor(panelHeight)
            });
            this.add_child(this._icon);
            
            // Adding popup menu for settings.
            let item = new PopupMenu.PopupMenuItem(_('Settings'));
            item.connect('activate', () => this._extension.openPreferences());
            this.menu.addMenuItem(item);
        }
        
        _initSignals() {
            // Connect signals and bind to this.
            this._activeWsSignalId = global.workspace_manager.connect('active-workspace-changed', this._updateWorkspace.bind(this));
            this._windowCreatedId = global.display.connect('window-created', this._updateWorkspace.bind(this));
            this._wsAddedId = global.workspace_manager.connect('workspace-added', () => {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    this._connectWindowSignals();
                    this._updateWorkspace();
                    return GLib.SOURCE_REMOVE;
                });
            });
            this._wsRemovedId = global.workspace_manager.connect('workspace-removed', () => {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                    this._connectWindowSignals();
                    this._updateWorkspace();
                    return GLib.SOURCE_REMOVE;
                });
            });
            // Scroll event for switching workspaces.
            this.connect('scroll-event', (actor, event) => {
                let direction = event.get_scroll_direction();
                if (direction === Clutter.ScrollDirection.UP) {
                    this._switchWorkspace(-1);
                } else if (direction === Clutter.ScrollDirection.DOWN) {
                    this._switchWorkspace(1);
                }
            });
            // Connect window signals.
            this._windowSignals = [];
            this._connectWindowSignals();
        }
        
        _getWorkspaceCoordinates(idx, columns) {
            return [idx % columns, Math.floor(idx / columns)];
        }
        
        _getWorkspaceDimensions() {
            let wm = global.workspace_manager;
            return [wm.get_layout_rows(), wm.get_layout_columns()];
        }
        
        _getWorkspacesWithApps() {
            let withApps = [];
            let total = global.workspace_manager.get_n_workspaces();
            const [rows, cols] = this._getWorkspaceDimensions();
            for (let i = 0; i < total; i++) {
                let workspace = global.workspace_manager.get_workspace_by_index(i);
                if (workspace.list_windows().length > 0) {
                    let [x, y] = this._getWorkspaceCoordinates(i, cols);
                    withApps.push([x, y]);
                }
            }
            return withApps;
        }
        
        _updateWorkspace() {
            try {
                let activeIndex = global.workspace_manager.get_active_workspace_index();
                logWithLevel('debug', `Active workspace index: ${activeIndex}`);
                const [rows, cols] = this._getWorkspaceDimensions();
                let [x, y] = this._getWorkspaceCoordinates(activeIndex, cols);
                logWithLevel('debug', `Workspace coordinates: (${x}, ${y})`);
                let withApps = this._getWorkspacesWithApps();
                logWithLevel('debug', `Workspaces with active apps: ${JSON.stringify(withApps)}`);
                let svgContent = SVGGenerator.create(x, y, rows, cols, withApps, this._icon.icon_size);
                let bytes = GLib.Bytes.new(new TextEncoder().encode(svgContent));
                this._icon.gicon = new Gio.BytesIcon({ bytes });
                logWithLevel('debug', `Updated workspace icon from memory`);
            } catch (error) {
                logWithLevel('error', 'Failed to update workspace indicator', error);
            }
        }
        
        _switchWorkspace(offset) {
            let wm = global.workspace_manager;
            let activeIndex = wm.get_active_workspace_index();
            let newIndex = activeIndex + offset;
            if (newIndex < 0 || newIndex >= wm.get_n_workspaces()) {
                logWithLevel('debug', `Cannot switch to workspace ${newIndex}: Out of bounds`);
                return;
            }
            let newWorkspace = wm.get_workspace_by_index(newIndex);
            if (newWorkspace) {
                newWorkspace.activate(global.get_current_time());
                logWithLevel('debug', `Switched to workspace ${newIndex}`);
            }
        }
        
        _connectWindowSignals() {
            // Disconnect previous window signals.
            this._disconnectWindowSignals();
            let total = global.workspace_manager.get_n_workspaces();
            for (let i = 0; i < total; i++) {
                let workspace = global.workspace_manager.get_workspace_by_index(i);
                let signalId = workspace.connect('window-removed', this._updateWorkspace.bind(this));
                this._windowSignals.push([workspace, signalId]);
            }
        }
        
        _disconnectWindowSignals() {
            this._windowSignals.forEach(([workspace, signalId]) => {
                workspace.disconnect(signalId);
            });
            this._windowSignals = [];
        }
        
        destroy() {
            // Disconnect all signals.
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
            this._disconnectWindowSignals();
            super.destroy();
        }
    });
    
export default class IndicatorExampleExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        // Retrieve settings using schema
        this._settings = this.getSettings();
    }
    
    enable() {
        this._updateSVGConfig();
        this._settingsChangedId = this._settings.connect('changed', this._updateConfig.bind(this));
        this._indicator = new WorkspaceIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }
    
    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
    }
    
    _updateConfig() {
        LOG_LEVEL = this._settings.get_boolean('log-debug') ? 'debug' : 'error';
        this._updateSVGConfig();
        if (this._indicator) {
            this._indicator._updateWorkspace();
        }
    }
    
    _updateSVGConfig() {
        SVGGenerator.Config.grid.visible = this._settings.get_boolean('grid-visible');
        SVGGenerator.Config.grid.color = this._settings.get_string('grid-color');
        SVGGenerator.Config.cell.shape = this._settings.get_string('cell-shape');
        SVGGenerator.Config.cell.size = this._settings.get_int('cell-size');
        
        // Update theme settings for new config structure
        SVGGenerator.Config.states.inactive.fill = this._settings.get_string('inactive-fill');
        SVGGenerator.Config.states.active.fill = this._settings.get_string('active-fill');
        SVGGenerator.Config.states.withApps.outline.color = this._settings.get_string('apps-outline-color');
        SVGGenerator.Config.states.withApps.outline.thickness = this._settings.get_double('apps-outline-thickness');
    }
}

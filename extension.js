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

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

class WorkspaceSettings {
    static instance = null;
    static schema = null;
    static LOG_LEVEL = 'error';

    constructor() {
        if (WorkspaceSettings.instance) {
            return WorkspaceSettings.instance;
        }
        this._settings = WorkspaceSettings.schema;
        this._loadSettings();
        
        // Connect to settings changes with the schema signal
        this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
            logWithLevel('debug', `Setting changed: ${key}`);
            this._loadSettings();
            this._notifyCallbacks();
        });
        
        this._callbacks = new Set();
        WorkspaceSettings.LOG_LEVEL = this._logDebug ? 'debug' : 'error';
        WorkspaceSettings.instance = this;
    }

    _loadSettings() {
		// Grid
		this._gridSize = 95
        this._gridOutlineThickness = '0px';
        this._gridOutlineColor = 'white';
		// Base cell
        this._cellSize = this._settings.get_int('cell-size');
        this._cellShape = this._settings.get_string('cell-shape');
		// Active/inactive
        this._activeFill = this._settings.get_string('active-fill');
        this._inactiveFill = this._settings.get_string('inactive-fill');
        // Has apps
		this._appsOutlineColor = this._settings.get_string('apps-outline-color');
        this._appsOutlineThickness = this._settings.get_int('apps-outline-thickness');
        this._outlineActive = this._settings.get_boolean('outline-active');
		// Debug
		this._logDebug = this._settings.get_boolean('log-debug');
        WorkspaceSettings.LOG_LEVEL = this._logDebug ? 'debug' : 'error';
    }

    _notifyCallbacks() {
        logWithLevel('debug', `Notifying ${this._callbacks.size} callbacks`);
        this._callbacks.forEach(callback => {
            try {
                callback();
            } catch (e) {
                logWithLevel('error', 'Error in settings callback', e);
            }
        });
    }

    static initialize(schema) {
        WorkspaceSettings.schema = schema;
        return new WorkspaceSettings();
    }

    // Properties
	// Grid
    get gridSize() { return this._gridSize; }
    get gridOutlineThickness() { return this._gridOutlineThickness; }
    get gridOutlineColor() { return this._gridOutlineColor; }
	// Base cell
    get cellSize() { return this._cellSize; }
    get cellShape() { return this._cellShape; }
	// Active/inactive
    get activeFill() { return this._activeFill; }
    get inactiveFill() { return this._inactiveFill; }
	// Has apps
    get appsOutlineColor() { return this._appsOutlineColor; }
    get appsOutlineThickness() { return this._appsOutlineThickness; }
    get outlineActive() { return this._outlineActive; }
	// Debug
    get logDebug() { return this._logDebug; }

    // Subscribe to settings changes
    connect(callback) {
        logWithLevel('debug', 'Adding settings callback');
        this._callbacks.add(callback);
    }

    disconnect(callback) {
        logWithLevel('debug', 'Removing settings callback');
        this._callbacks.delete(callback);
    }

    destroy() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        this._callbacks.clear();
        WorkspaceSettings.instance = null;
    }
}

const WorkspaceManager = global.workspace_manager;

const GridWorkspaceIndicator = GObject.registerClass(
class GridWorkspaceIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.0, _('Workspace Indicator'));
        this._extension = extension;
        this._settings = WorkspaceSettings.instance;
        this._settingsCallback = this._onSettingsChanged.bind(this);
        this._settings.connect(this._settingsCallback);
        this._layoutProperties = {};
        this._grid = new St.Widget({
            layout_manager: new Clutter.GridLayout(),
            reactive: true,
            style_class: 'workspace-indicator-grid',
            x_align: Clutter.ActorAlign.CENTER, // changed: using Clutter.ActorAlign.CENTER
            y_align: Clutter.ActorAlign.CENTER, // changed: using Clutter.ActorAlign.CENTER
            // x_expand: false,
            // y_expand: false,
        });
        this.add_child(this._grid);
        // Create the popup menu for settings.
        this.menu.addAction('Settings', () => {
            GLib.spawn_command_line_async(`gnome-shell-extension-prefs ${this._extension.metadata.uuid}`);
        });
        this.connect('scroll-event', this._onScroll.bind(this));
        // Create cells based on the current workspace layout.
        this._buildGrid();
        // Listen for workspace changes.
        this._workspaceSignal = WorkspaceManager.connect('active-workspace-changed', this._updateCells.bind(this));
        this._wsAddedId = WorkspaceManager.connect('workspace-added', this._onWorkspaceChanged.bind(this));
        this._wsRemovedId = WorkspaceManager.connect('workspace-removed', this._onWorkspaceChanged.bind(this));
        this._updateCells();
        this._updateGridOutline();
    }

    _clearGrid() {
        this._grid.get_children().forEach(child => child.destroy());
        this._cells = [];
    }

    _createWorkspaceCell() {
        return new St.Widget({
            width: this._layoutProperties.widgetSize,
            height: this._layoutProperties.widgetSize,
            style_class: 'workspace-cell inactive',
            reactive: false,
        });
    }

    _createSquareCell() {
        const cell = this._createWorkspaceCell();
        cell.set_style(`
            border-radius: 0px;
            margin: ${this._layoutProperties.margin}px;
        `);
        return cell;
    }

    _createCircleCell() {
        const cell = this._createWorkspaceCell();
        cell.set_style(`
            border-radius: ${this._layoutProperties.borderRadius}px;
            margin: ${this._layoutProperties.margin}px;
        `);
        return cell;
    }

	_calculateCellLayout(maxSide, numCells, occupationPercentage) {
		// Calculate the maximum size available per cell (integer)
		const cellSize = Math.floor(maxSide / numCells);
		
		// Compute the ideal core size (might be fractional)
		const idealCore = cellSize * (occupationPercentage / 100);
		
		// Start with a candidate core size rounded to nearest integer
		let candidate = Math.round(idealCore);
		// Ensure candidate is within valid bounds [0, cellSize]
		candidate = Math.max(0, Math.min(cellSize, candidate));
		
		// We require that the remaining space (cellSize - candidate) can be split evenly for margins.
		// If not, try adjusting candidate by +1 or -1.
		if ((cellSize - candidate) % 2 !== 0) {
		  const candidateDown = candidate - 1;
		  const candidateUp = candidate + 1;
		  const validDown = candidateDown >= 0 && (cellSize - candidateDown) % 2 === 0;
		  const validUp = candidateUp <= cellSize && (cellSize - candidateUp) % 2 === 0;
		  
		  if (validDown && validUp) {
			// Choose the one that stays closest to the ideal core size.
			candidate = (Math.abs(candidateDown - idealCore) <= Math.abs(candidateUp - idealCore))
			  ? candidateDown
			  : candidateUp;
		  } else if (validDown) {
			candidate = candidateDown;
		  } else if (validUp) {
			candidate = candidateUp;
		  }
		  // If neither candidate yields an even margin, we fall back on the original candidate.
		}
		
		// Calculate the margin per side (since margin is shared equally on left/right or top/bottom).
		const margin = (cellSize - candidate) / 2;
		
		return { coreSize: candidate, margin: margin };
	  }

    _buildGrid() {
		this._clearGrid();
        
        const gridLayout = this._grid.layout_manager;
        const nRows = Math.max(WorkspaceManager.get_layout_rows(), 1);
        const nColumns = Math.max(WorkspaceManager.get_layout_columns(), 1);
		logWithLevel('debug', `Grid layout: ${nRows} rows x ${nColumns} columns`);


        // Calculate and store layout properties
        const panelHeight = Main.panel.height;
        const auxIndicatorHeight = panelHeight * (this._settings.gridSize / 100);
		const cellLayout = this._calculateCellLayout(auxIndicatorHeight, nRows, this._settings.cellSize);
		const cellSize = cellLayout.coreSize;
		const cellMargin = cellLayout.margin;

		const indicatorHeight = (cellSize + cellMargin) * nRows;
		const indicatorWidth = (cellSize + cellMargin) * nColumns;
        const percent = this._settings.cellSize / 100;
		
        this._layoutProperties = {
			widgetSize: cellSize,
            margin: cellMargin,
			borderRadius: this._settings.cellShape.toLowerCase() === 'circle' ? (cellSize * percent) / 2 : 0
        };

        // Fix grid dimensions to center it in the indicator space.
        // this._grid.set_height(indicatorHeight);
        // this._grid.set_width(indicatorWidth);
        
		logWithLevel('debug', `Building grid: ${JSON.stringify({
			panelHeight: panelHeight,
			auxIndicatorHeight: auxIndicatorHeight,
			indicatorHeight: indicatorHeight,
			indicatorWidth: indicatorWidth,
			layoutProperties: this._layoutProperties
		})}`);

		// Construct cell widgets
        for (let row = 0; row < nRows; row++) {
            for (let col = 0; col < nColumns; col++) {
                const cell = this._settings.cellShape.toLowerCase() === 'circle' 
                    ? this._createCircleCell() 
                    : this._createSquareCell();
                this._cells.push(cell);
                gridLayout.attach(cell, col, row, 1, 1);
            }
        }
    }
    
    _updateCell(cell, isActive, hasApps) {
        // Determine outline based on open apps and active status.
        let outline = 'none';
        if (hasApps) {
            if (!isActive || this._settings.outlineActive) {
                outline = `${this._settings.appsOutlineThickness}px solid ${this._settings.appsOutlineColor}`;
            }
        }
        cell.set_style(`
            background-color: ${isActive ? this._settings.activeFill : this._settings.inactiveFill};
            border: ${outline};
            border-radius: ${this._settings.cellShape.toLowerCase() === 'circle' ? this._layoutProperties.borderRadius : 0}px;
            margin: ${this._layoutProperties.margin}px;
        `);
    }

    _updateCells() {
        let activeIndex = WorkspaceManager.get_active_workspace_index();
        logWithLevel('debug', `Active workspace index: ${activeIndex}`);
        // Determine which workspaces have open windows.
        const workspacesWithApps = this._getWorkspacesWithApps();
        this._cells.forEach((cell, idx) => {
            const hasApps = workspacesWithApps.includes(idx);
            this._updateCell(cell, idx === activeIndex, hasApps);
        });
    }
    
    _onWorkspaceChanged() {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._buildGrid();
            this._updateCells();
            return GLib.SOURCE_REMOVE;
        });
    }
    
    _onScroll(actor, event) {
        let direction = event.get_scroll_direction();
        logWithLevel('debug', `Scroll event direction: ${direction}`);
        if (direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.DOWN) {
            let activeIndex = WorkspaceManager.get_active_workspace_index();
            let n = WorkspaceManager.get_n_workspaces();
            let newIndex = direction === Clutter.ScrollDirection.UP ? activeIndex - 1 : activeIndex + 1;
            
            // Handle wrap-around
            if (newIndex < 0) {
                newIndex = n - 1;
            } else if (newIndex >= n) {
                newIndex = 0;
            }
            
            let workspace = WorkspaceManager.get_workspace_by_index(newIndex);
            workspace.activate(global.get_current_time());
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }
    
    _onSettingsChanged() {
        logWithLevel('debug', 'Indicator: Settings changed, updating display');
        this._buildGrid();
        this._updateCells();
        this._updateGridOutline();
    }

    // New: Move getWorkspacesWithApps into the class as a private method.
    _getWorkspacesWithApps() {
        let workspacesWithApps = new Set();
        let windows = global.get_window_actors().map(actor => actor.meta_window);
        windows.forEach(win => {
            let ws = win.get_workspace();
            if (ws) {
                workspacesWithApps.add(ws.index());
            }
        });
        return Array.from(workspacesWithApps);
    }

    // New private method to update grid outline
    _updateGridOutline() {
        this._grid.set_style(`border: ${this._settings.gridOutlineThickness} solid ${this._settings.gridOutlineColor};`);
    }

    destroy() {
        this._settings.disconnect(this._settingsCallback);
        if (this._workspaceSignal) {
            WorkspaceManager.disconnect(this._workspaceSignal);
            this._workspaceSignal = null;
        }
        if (this._wsAddedId) {
            WorkspaceManager.disconnect(this._wsAddedId);
            this._wsAddedId = null;
        }
        if (this._wsRemovedId) {
            WorkspaceManager.disconnect(this._wsRemovedId);
            this._wsRemovedId = null;
        }
        super.destroy();
    }
}
);

function logWithLevel(level, message, error = null) {
    const levels = ['debug', 'info', 'error'];
    if (levels.indexOf(level) >= levels.indexOf(WorkspaceSettings.LOG_LEVEL)) {
        level === 'error' && error ? logError(error, message) : log(`[${level.toUpperCase()}] ${message}`);
    }
}

export default class GridWorkspaceIndicatorExtension extends Extension {
    enable() {
        WorkspaceSettings.initialize(this.getSettings());
        this._indicator = new GridWorkspaceIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        WorkspaceSettings.instance?.destroy();
    }
}

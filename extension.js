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
import IndicatorSettings from './indicatorSettings.js';

const WorkspaceManager = global.workspace_manager;

/**
 * Class representing a grid workspace indicator for the GNOME Shell panel.
 * Extends PanelMenu.Button to integrate into the panel.
 */
const GridWorkspaceIndicator = GObject.registerClass(
class GridWorkspaceIndicator extends PanelMenu.Button {
    /**
     * Constructs a new GridWorkspaceIndicator instance.
     *
     * @param {Object} extension - The extension instance providing metadata and settings.
     */
    _init(extension) {
        super._init(0.0, _('Workspace Indicator'));
        this._extension = extension;
        this._settings = IndicatorSettings.instance;
        this._settingsCallback = this._onSettingsChanged.bind(this);
        this._settings.connect(this._settingsCallback);
        this._layoutProperties = {};
        this._grid = new St.Widget({
            layout_manager: new Clutter.GridLayout(),
            reactive: true,
            style_class: 'workspace-indicator-grid',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._grid);
        this.menu.addAction('Settings', () => {
            extension.openPreferences();
        });
        this.connect('scroll-event', this._onScroll.bind(this));
        this._workspaceSignal = WorkspaceManager.connect('active-workspace-changed', this._updateCells.bind(this));
        this._wsAddedId = WorkspaceManager.connect('workspace-added', this._onWorkspaceChanged.bind(this));
        this._wsRemovedId = WorkspaceManager.connect('workspace-removed', this._onWorkspaceChanged.bind(this));
        
        // Listen for workspace layout changes to rebuild the grid
        this._layoutChangedId = WorkspaceManager.connect('notify::layout-rows', this._onWorkspaceChanged.bind(this));
        this._layoutColumnsChangedId = WorkspaceManager.connect('notify::layout-columns', this._onWorkspaceChanged.bind(this));
        
        this._buildGrid();
        this._updateCells();
        this._updateGridOutline();
    }

    /**
     * Clears the current grid by destroying all child widgets.
     *
     * @private
     */
    _clearGrid() {
        this._grid.get_children().forEach(child => child.destroy());
        this._cells = [];
    }

    /**
     * Creates a new workspace cell widget.
     *
     * @returns {St.Widget} The new workspace cell widget.
     * @private
     */
    _createWorkspaceCell() {
        return new St.Widget({
            width: this._layoutProperties.widgetSize,
            height: this._layoutProperties.widgetSize,
            style_class: 'workspace-cell inactive',
            reactive: false,
        });
    }

    /**
     * Creates a square-shaped workspace cell widget.
     *
     * @returns {St.Widget} The new square workspace cell widget.
     * @private
     */
    _createSquareCell() {
        const cell = this._createWorkspaceCell();
        cell.set_style(`
            border-radius: 0px;
            margin: ${this._layoutProperties.margin}px;
        `);
        return cell;
    }

    /**
     * Creates a circle-shaped workspace cell widget.
     *
     * @returns {St.Widget} The new circular workspace cell widget.
     * @private
     */
    _createCircleCell() {
        const cell = this._createWorkspaceCell();
        cell.set_style(`
            border-radius: ${this._layoutProperties.borderRadius}px;
            margin: ${this._layoutProperties.margin}px;
        `);
        return cell;
    }

    /**
     * Calculates layout parameters for a cell, including core size and margin.
     *
     * @param {number} maxSide - The maximum available size on one side.
     * @param {number} numCells - The number of cells along that side.
     * @param {number} occupationPercentage - The desired percentage of cell occupation.
     * @returns {Object} An object containing {@code coreSize} and {@code margin}.
     * @private
     */
	_calculateCellLayout(maxSide, numCells, occupationPercentage) {
		// Calculate the maximum size available per cell (integer)
		const cellSize = Math.floor(maxSide / numCells);
		
		// Compute the ideal core size (might be fractional)
		const idealCore = cellSize * (occupationPercentage / 100);
		
		// Start with a candidate core size rounded to nearest integer
		let candidate = Math.round(idealCore);
		// Ensure candidate is within valid bounds [0, cellSize]
		candidate = Math.max(0, Math.min(cellSize, candidate));
		
		// Adjust candidate so that the remaining space can be evenly split as margins.
		if ((cellSize - candidate) % 2 !== 0) {
		  const candidateDown = candidate - 1;
		  const candidateUp = candidate + 1;
		  const validDown = candidateDown >= 0 && (cellSize - candidateDown) % 2 === 0;
		  const validUp = candidateUp <= cellSize && (cellSize - candidateUp) % 2 === 0;
		  
		  if (validDown && validUp) {
			candidate = (Math.abs(candidateDown - idealCore) <= Math.abs(candidateUp - idealCore))
			  ? candidateDown
			  : candidateUp;
		  } else if (validDown) {
			candidate = candidateDown;
		  } else if (validUp) {
			candidate = candidateUp;
		  }
		}
		
		// Calculate the margin per side.
		const margin = (cellSize - candidate) / 2;
		
		return { coreSize: candidate, margin: margin };
	}

    /**
     * Builds and lays out the grid of workspace cells based on current settings and workspace layout.
     *
     * @private
     */
    _buildGrid() {
		this._clearGrid();
        
        const gridLayout = this._grid.layout_manager;
        const nRows = Math.max(WorkspaceManager.get_layout_rows(), 1);
        const nColumns = Math.max(WorkspaceManager.get_layout_columns(), 1);
		console.debug(`Grid layout: ${nRows} rows x ${nColumns} columns`);

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

		console.debug(`Building grid: ${JSON.stringify({
			panelHeight: panelHeight,
			auxIndicatorHeight: auxIndicatorHeight,
			indicatorHeight: indicatorHeight,
			indicatorWidth: indicatorWidth,
			layoutProperties: this._layoutProperties
		})}`);

		// Attach cell widgets to the grid layout.
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
    
    /**
     * Updates the style of an individual workspace cell based on its state.
     *
     * @param {St.Widget} cell - The cell widget to update.
     * @param {boolean} isActive - Whether the workspace is active.
     * @param {boolean} hasApps - Whether the workspace has active applications.
     * @private
     */
    _updateCell(cell, isActive, hasApps) {
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

    /**
     * Updates all workspace cells to reflect the current active workspace and the presence of application windows.
     *
     * @private
     */
    _updateCells() {
        let activeIndex = WorkspaceManager.get_active_workspace_index();
        console.debug(`Active workspace index: ${activeIndex}`);
        const workspacesWithApps = this._getWorkspacesWithApps();
        this._cells.forEach((cell, idx) => {
            const hasApps = workspacesWithApps.includes(idx);
            this._updateCell(cell, idx === activeIndex, hasApps);
        });
    }
    
    /**
     * Handler invoked when a workspace is added or removed. Rebuilds the grid accordingly.
     *
     * @private
     */
    _onWorkspaceChanged() {
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._buildGrid();
            this._updateCells();
            return GLib.SOURCE_REMOVE;
        });
    }
    
    /**
     * Handles scroll events to cycle through workspaces.
     *
     * @param {Clutter.Actor} actor - The actor that received the scroll event.
     * @param {Clutter.Event} event - The scroll event.
     * @returns {number} The event propagation flag.
     * @private
     */
    _onScroll(actor, event) {
        let direction = event.get_scroll_direction();
        console.debug(`Scroll event direction: ${direction}`);
        if (direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.DOWN) {
            let activeIndex = WorkspaceManager.get_active_workspace_index();
            let n = WorkspaceManager.get_n_workspaces();
            let newIndex = direction === Clutter.ScrollDirection.UP ? activeIndex - 1 : activeIndex + 1;
            
            // Handle wrap-around.
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
    
    /**
     * Handler invoked when extension settings are changed.
     * Rebuilds the grid and updates the display.
     *
     * @private
     */
    _onSettingsChanged() {
        console.debug('Indicator: Settings changed, updating display');
        this._buildGrid();
        this._updateCells();
        this._updateGridOutline();
    }

    /**
     * Determines which workspaces currently have active application windows.
     *
     * @returns {Array<number>} An array of workspace indices with active applications.
     * @private
     */
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

    /**
     * Updates the grid outline based on current settings.
     *
     * @private
     */
    _updateGridOutline() {
        this._grid.set_style(`border: ${this._settings.gridOutlineThickness} solid ${this._settings.gridOutlineColor};`);
    }

    /**
     * Destroys the indicator and disconnects its signals.
     */
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
        if (this._layoutChangedId) {
            WorkspaceManager.disconnect(this._layoutChangedId);
            this._layoutChangedId = null;
        }
        if (this._layoutColumnsChangedId) {
            WorkspaceManager.disconnect(this._layoutColumnsChangedId);
            this._layoutColumnsChangedId = null;
        }
        super.destroy();
    }
}
);

/**
 * Extension class to manage the lifecycle of the GridWorkspaceIndicator.
 */
export default class GridWorkspaceIndicatorExtension extends Extension {
    /**
     * Enables the extension by initializing settings and adding the indicator to the panel.
     */
    enable() {
        IndicatorSettings.initialize(this.getSettings());
        this._indicator = new GridWorkspaceIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    /**
     * Disables the extension by destroying the indicator and cleaning up resources.
     */
    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        IndicatorSettings.instance?.destroy();
    }
}

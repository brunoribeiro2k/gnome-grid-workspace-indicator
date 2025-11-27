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
import Meta from 'gi://Meta';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import IndicatorSettings from './indicatorSettings.js';

const WorkspaceManager = global.workspace_manager;
const SCROLL_THRESHOLD = 0.8;

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
        super._init(0.0, 'Workspace Indicator');
        this._extension = extension;
        this._settings = IndicatorSettings.instance;
        this._settingsCallback = this._onSettingsChanged.bind(this);
        this._settings.connect(this._settingsCallback);
        this._layoutProperties = {};
        this._cells = [];
        this._signals = [];
        this._workspaceWindowSignals = [];
        this._pendingUpdateId = 0;
        this._pendingRebuildId = 0;
        this._scrollAccumulator = 0;
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
        this._watchWorkspaceManager();
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
            style_class: 'workspace-cell',
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
        const safeCells = Math.max(numCells, 1);
        const cellSize = Math.floor(maxSide / safeCells);
        const idealCore = cellSize * (occupationPercentage / 100);
        let candidate = Math.round(idealCore);

        candidate = Math.max(0, Math.min(cellSize, candidate));

        if ((cellSize - candidate) % 2 !== 0) {
            const candidateDown = candidate - 1;
            const candidateUp = candidate + 1;
            const validDown = candidateDown >= 0 && (cellSize - candidateDown) % 2 === 0;
            const validUp = candidateUp <= cellSize && (cellSize - candidateUp) % 2 === 0;

            if (validDown && validUp) {
                candidate = Math.abs(candidateDown - idealCore) <= Math.abs(candidateUp - idealCore) ? candidateDown : candidateUp;
            } else if (validDown) {
                candidate = candidateDown;
            } else if (validUp) {
                candidate = candidateUp;
            }
        }

        const margin = Math.max(0, (cellSize - candidate) / 2);

        return { coreSize: candidate, margin };
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
        const panelHeight = Main.panel.height;
        const auxIndicatorHeight = panelHeight * (this._settings.gridSize / 100);

        const cellLayout = this._calculateCellLayout(auxIndicatorHeight, nRows, this._settings.cellSize);
        const cellSize = cellLayout.coreSize;
        const cellMargin = cellLayout.margin;

        const indicatorHeight = (cellSize + cellMargin) * nRows;
        const indicatorWidth = (cellSize + cellMargin) * nColumns;
        const isCircle = this._settings.cellShape.toLowerCase() === 'circle';

        this._layoutProperties = {
            widgetSize: cellSize,
            margin: cellMargin,
            borderRadius: isCircle ? Math.floor(cellSize / 2) : 0,
            isCircle,
        };

        const gridWidth = Math.max(1, Math.round(indicatorWidth));
        const gridHeight = Math.max(1, Math.round(indicatorHeight));
        this._grid.set_size(gridWidth, gridHeight);

        // Attach cell widgets to the grid layout.
        for (let row = 0; row < nRows; row++) {
            for (let col = 0; col < nColumns; col++) {
                const cell = isCircle ? this._createCircleCell() : this._createSquareCell();
                this._cells.push(cell);
                gridLayout.attach(cell, col, row, 1, 1);
            }
        }

        this._rebindWorkspaceWindowSignals();
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
        const outlineRequired = hasApps || (this._settings.outlineActive && isActive);
        const outline = outlineRequired ? `${this._settings.appsOutlineThickness}px solid ${this._settings.appsOutlineColor}` : 'none';
        const borderRadius = this._layoutProperties.isCircle ? this._layoutProperties.borderRadius : 0;

        cell.set_style(`
            background-color: ${isActive ? this._settings.activeFill : this._settings.inactiveFill};
            border: ${outline};
            border-radius: ${borderRadius}px;
            margin: ${this._layoutProperties.margin}px;
        `);
    }

    /**
     * Updates all workspace cells to reflect the current active workspace and the presence of application windows.
     *
     * @private
     */
    _updateCells() {
        const activeIndex = WorkspaceManager.get_active_workspace_index();
        const workspacesWithApps = this._getWorkspacesWithApps();
        const totalWorkspaces = WorkspaceManager.get_n_workspaces();
        const borderRadius = this._layoutProperties.isCircle ? this._layoutProperties.borderRadius : 0;

        this._cells.forEach((cell, idx) => {
            if (idx < totalWorkspaces) {
                cell.opacity = 255;
                const hasApps = workspacesWithApps.has(idx);
                this._updateCell(cell, idx === activeIndex, hasApps);
            } else {
                cell.opacity = 96;
                cell.set_style(`
                    background-color: transparent;
                    border: none;
                    border-radius: ${borderRadius}px;
                    margin: ${this._layoutProperties.margin}px;
                `);
            }
        });
    }
    
    /**
     * Handler invoked when a workspace is added or removed. Rebuilds the grid accordingly.
     *
     * @private
     */
    _onWorkspaceChanged() {
        this._scheduleRebuild();
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
        const direction = event.get_scroll_direction();

        if (direction === Clutter.ScrollDirection.UP) {
            this._scrollAccumulator = 0;
            return this._activateRelativeWorkspace(-1);
        }
        if (direction === Clutter.ScrollDirection.DOWN) {
            this._scrollAccumulator = 0;
            return this._activateRelativeWorkspace(1);
        }

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [, deltaY] = event.get_scroll_delta();
            if (deltaY === 0)
                return Clutter.EVENT_STOP;

            // Accumulate smooth deltas so high-resolution touchpad gestures still switch workspaces predictably.
            this._scrollAccumulator += deltaY;

            while (Math.abs(this._scrollAccumulator) >= SCROLL_THRESHOLD) {
                const step = this._scrollAccumulator > 0 ? 1 : -1;
                this._activateRelativeWorkspace(step);
                this._scrollAccumulator -= SCROLL_THRESHOLD * step;
            }

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
        this._scheduleRebuild();
    }

    /**
     * Determines which workspaces currently have active application windows.
     *
     * @returns {Array<number>} An array of workspace indices with active applications.
     * @private
     */
    _getWorkspacesWithApps() {
        const withApps = new Set();
        const total = WorkspaceManager.get_n_workspaces();
        const windows = global.get_window_actors().map(actor => actor.meta_window);

        for (const win of windows) {
            if (!win)
                continue;

            const windowType = win.get_window_type();
            if (windowType === Meta.WindowType.DESKTOP || windowType === Meta.WindowType.DOCK)
                continue;

            if (win.skip_taskbar || win.skip_pager)
                continue;

            if (win.is_on_all_workspaces()) {
                for (let index = 0; index < total; index++)
                    withApps.add(index);
                continue;
            }

            const workspace = win.get_workspace();
            if (workspace)
                withApps.add(workspace.index());
        }

        return withApps;
    }

    /**
     * Updates the grid outline based on current settings.
     *
     * @private
     */
    _updateGridOutline() {
        const thickness = Math.max(this._settings.gridOutlineThickness, 0);
        const color = this._settings.gridOutlineColor;
        const style = thickness === 0 ? 'border: none;' : `border: ${thickness}px solid ${color};`;
        this._grid.set_style(style);
    }

    /**
     * Destroys the indicator and disconnects its signals.
     */
    destroy() {
        this._settings.disconnect(this._settingsCallback);
        this._disconnectWorkspaceWindowSignals();
        this._disconnectSignals();
        if (this._pendingUpdateId) {
            GLib.source_remove(this._pendingUpdateId);
            this._pendingUpdateId = 0;
        }
        if (this._pendingRebuildId) {
            GLib.source_remove(this._pendingRebuildId);
            this._pendingRebuildId = 0;
        }
        super.destroy();
    }

    _watchWorkspaceManager() {
        this._disconnectSignals();
        this._bindSignal(WorkspaceManager, 'active-workspace-changed', () => this._queueUpdateCells());
        this._bindSignal(WorkspaceManager, 'workspace-added', () => this._onWorkspaceChanged());
        this._bindSignal(WorkspaceManager, 'workspace-removed', () => this._onWorkspaceChanged());
        this._bindSignal(WorkspaceManager, 'notify::layout-columns', () => this._scheduleRebuild());
        this._bindSignal(WorkspaceManager, 'notify::layout-rows', () => this._scheduleRebuild());
    }

    _bindSignal(object, signal, callback) {
        const id = object.connect(signal, callback);
        this._signals.push([object, id]);
        return id;
    }

    _disconnectSignals() {
        for (const [object, id] of this._signals) {
            if (object && id)
                object.disconnect(id);
        }
        this._signals = [];
    }

    _queueUpdateCells() {
        if (this._pendingUpdateId)
            return;

        this._pendingUpdateId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._pendingUpdateId = 0;
            this._updateCells();
            return GLib.SOURCE_REMOVE;
        });
    }

    _scheduleRebuild() {
        if (this._pendingRebuildId)
            return;

        this._pendingRebuildId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._pendingRebuildId = 0;
            this._buildGrid();
            this._updateCells();
            this._updateGridOutline();
            return GLib.SOURCE_REMOVE;
        });
    }

    _rebindWorkspaceWindowSignals() {
        this._disconnectWorkspaceWindowSignals();

        const windowsCallback = () => this._queueUpdateCells();
        const total = WorkspaceManager.get_n_workspaces();

        for (let index = 0; index < total; index++) {
            const workspace = WorkspaceManager.get_workspace_by_index(index);
            if (!workspace)
                continue;

            // Track window additions/removals on every workspace so the grid stays accurate.
            this._workspaceWindowSignals.push([workspace, workspace.connect('window-added', windowsCallback)]);
            this._workspaceWindowSignals.push([workspace, workspace.connect('window-removed', windowsCallback)]);
        }
    }

    _disconnectWorkspaceWindowSignals() {
        for (const [workspace, id] of this._workspaceWindowSignals) {
            if (workspace && id)
                workspace.disconnect(id);
        }
        this._workspaceWindowSignals = [];
    }

    _activateRelativeWorkspace(step) {
        const total = WorkspaceManager.get_n_workspaces();
        if (total <= 0)
            return Clutter.EVENT_STOP;

        const activeIndex = WorkspaceManager.get_active_workspace_index();
        let newIndex = (activeIndex + step) % total;
        if (newIndex < 0)
            newIndex += total;

        const workspace = WorkspaceManager.get_workspace_by_index(newIndex);
        if (workspace)
            workspace.activate(global.display.get_current_time_roundtrip());

        return Clutter.EVENT_STOP;
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

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
import Gtk from 'gi://Gtk';

// Modified WorkspaceSettings to include static fromSchema method.
class WorkspaceSettings {
	constructor({ cellSize, cellShape, activeFill, inactiveFill, logDebug }) {
		this.cellSize = cellSize;
		this.cellShape = cellShape;
		this.activeFill = activeFill;
		this.inactiveFill = inactiveFill;
		this.logDebug = logDebug;
		Object.freeze(this);
	}
	static fromSchema(schema) {
		return new WorkspaceSettings({
			cellSize: schema.get_int('cell-size'),
			cellShape: schema.get_string('cell-shape'),
			activeFill: schema.get_string('active-fill'),
			inactiveFill: schema.get_string('inactive-fill'),
			logDebug: schema.get_boolean('log-debug')
		});
	}
}

const WorkspaceManager = global.workspace_manager;

const GridWorkspaceIndicator = GObject.registerClass(
class GridWorkspaceIndicator extends PanelMenu.Button {
	_init(extension, settings) {
		super._init(0.0, _('Workspace Indicator'));
		this._extension = extension;
		this._settings = settings;
		this._grid = new St.Widget({
			layout_manager: new Clutter.GridLayout(),
			reactive: true,
			style_class: 'workspace-indicator-grid',
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
		this._workspaceSignal = WorkspaceManager.connect('active-workspace-changed', this._updateActiveWorkspace.bind(this));
		this._wsAddedId = WorkspaceManager.connect('workspace-added', this._onWorkspaceChanged.bind(this));
		this._wsRemovedId = WorkspaceManager.connect('workspace-removed', this._onWorkspaceChanged.bind(this));
		this._updateActiveWorkspace();
	}
	
	_buildGrid() {
		// Clear existing children.
		this._grid.get_children().forEach(child => child.destroy());
		this._cells = [];
		const gridLayout = this._grid.layout_manager;
		const nRows = WorkspaceManager.get_layout_rows();
		const nColumns = WorkspaceManager.get_layout_columns();
		const panelHeight = Main.panel.height - 2;
		const cellSize = panelHeight / nRows;
		// Read settings.
		const percent = this._settings.cellSize / 100;
		const widgetSize = cellSize * percent;
		const shape = this._settings.cellShape.toLowerCase();
		const borderRadius = shape === 'circle' ? widgetSize / 2 : 0;
		const margin = (cellSize - widgetSize) / 2;
		// Save measurements for updates.
		this._widgetSize = widgetSize;
		this._borderRadius = borderRadius;
		this._margin = margin;
		
		// Construct cell widgets.
		for (let row = 0; row < nRows; row++) {
			for (let col = 0; col < nColumns; col++) {
				let cell = new St.Widget({
					width: widgetSize,
					height: widgetSize,
					// Use base CSS classes for cells.
					style_class: 'workspace-cell inactive',
					reactive: false,
				});
				this._cells.push(cell);
				gridLayout.attach(cell, col, row, 1, 1);
			}
		}
	}
	
	_updateActiveWorkspace() {
		let activeIndex = WorkspaceManager.get_active_workspace_index();
		this._cells.forEach((cell, idx) => {
			if (idx === activeIndex) {
				cell.add_style_class_name('active');
				cell.remove_style_class_name('inactive');
			} else {
				cell.add_style_class_name('inactive');
				cell.remove_style_class_name('active');
			}
		});
	}
	
	// New method to update CSS based on settings.
	_updateCss() {
		let css = `
			.workspace-indicator-grid .workspace-cell.active {
				background-color: ${this._settings.activeFill};
				border-radius: ${this._borderRadius}px;
				margin: ${this._margin}px;
			}
			.workspace-indicator-grid .workspace-cell.inactive {
				background-color: ${this._settings.inactiveFill};
				border-radius: ${this._borderRadius}px;
				margin: ${this._margin}px;
			}
		`;
		// Remove any existing provider.
		if (this._cssProvider) {
			Gtk.StyleContext.remove_provider_for_screen(global.screen, this._cssProvider);
		}
		this._cssProvider = new Gtk.CssProvider();
		this._cssProvider.load_from_data(css);
		Gtk.StyleContext.add_provider_for_screen(global.screen, this._cssProvider, Gtk.STYLE_PROVIDER_PRIORITY_USER);
	}
	
	_onWorkspaceChanged() {
		GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
			this._buildGrid();
			this._updateActiveWorkspace();
			return GLib.SOURCE_REMOVE;
		});
	}
	
	_onScroll(actor, event) {
		let direction = event.get_scroll_direction();
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
	
	destroy() {
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

let LOG_LEVEL = 'error';
function logWithLevel(level, message, error = null) {
    const levels = ['debug', 'info', 'error'];
    if (levels.indexOf(level) >= levels.indexOf(LOG_LEVEL)) {
        level === 'error' && error ? logError(error, message) : log(`[${level.toUpperCase()}] ${message}`);
    }
}

export default class IndicatorExampleExtension extends Extension {
	constructor(metadata) {
		super(metadata);
		this._wsSettings = WorkspaceSettings.fromSchema(this.getSettings());
	}
	
	enable() {
		this._settingsChangedId = this.getSettings().connect('changed', this._updateConfig.bind(this));
		this._indicator = new GridWorkspaceIndicator(this, this._wsSettings);
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
		this._wsSettings = WorkspaceSettings.fromSchema(this.getSettings());
		LOG_LEVEL = this._wsSettings.logDebug ? 'debug' : 'error';
		if (this._indicator) {
			this._indicator._buildGrid();
			this._indicator._updateActiveWorkspace();
			// Call _updateCss here now that the prefs were updated.
			this._indicator._updateCss();
		}
	}
}

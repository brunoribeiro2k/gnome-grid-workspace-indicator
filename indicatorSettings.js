class IndicatorSettings {
    static instance = null;
    static schema = null;

    constructor() {
        if (IndicatorSettings.instance) {
            return IndicatorSettings.instance;
        }
        this._settings = IndicatorSettings.schema;
        this._loadSettings();
        
        // Connect to settings changes with the schema signal
        this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
            console.debug(`Setting changed: ${key}`);
            this._loadSettings();
            this._notifyCallbacks();
        });
        
        this._callbacks = new Set();
        IndicatorSettings.instance = this;
    }

    _loadSettings() {
        // Grid
        this._gridSize = 95;
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
    }

    _notifyCallbacks() {
        console.debug(`Notifying ${this._callbacks.size} callbacks`);
        this._callbacks.forEach(callback => {
            try {
                callback();
            } catch (e) {
                console.error('Error in settings callback', e);
            }
        });
    }

    static initialize(schema) {
        IndicatorSettings.schema = schema;
        return new IndicatorSettings();
    }

    // Properties
    get gridSize() { return this._gridSize; }
    get gridOutlineThickness() { return this._gridOutlineThickness; }
    get gridOutlineColor() { return this._gridOutlineColor; }
    get cellSize() { return this._cellSize; }
    get cellShape() { return this._cellShape; }
    get activeFill() { return this._activeFill; }
    get inactiveFill() { return this._inactiveFill; }
    get appsOutlineColor() { return this._appsOutlineColor; }
    get appsOutlineThickness() { return this._appsOutlineThickness; }
    get outlineActive() { return this._outlineActive; }

    // Subscribe to settings changes
    connect(callback) {
        console.debug('Adding settings callback');
        this._callbacks.add(callback);
    }

    disconnect(callback) {
        console.debug('Removing settings callback');
        this._callbacks.delete(callback);
    }

    destroy() {
        if (this._settingsChangedId) {
            this._settings.disconnect(this._settingsChangedId);
            this._settingsChangedId = null;
        }
        this._callbacks.clear();
        IndicatorSettings.instance = null;
    }
}

export default IndicatorSettings;

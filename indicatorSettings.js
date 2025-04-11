class IndicatorSettings {
    static instance = null;
    static schema = null;

    /**
     * Constructs a new IndicatorSettings instance and enforces the singleton pattern.
     *
     * @returns {IndicatorSettings} The singleton instance.
     */
    constructor() {
        if (IndicatorSettings.instance) {
            return IndicatorSettings.instance;
        }
        this._settings = IndicatorSettings.schema;
        this._loadSettings();

        this._settingsChangedId = this._settings.connect('changed', (_settings, key) => {
            console.debug(`Setting changed: ${key}`);
            this._loadSettings();
            this._notifyCallbacks();
        });

        this._callbacks = new Set();
        IndicatorSettings.instance = this;
    }

    /**
     * Getters for settings properties:
     * - gridSize: number
     * - gridOutlineThickness: string
     * - gridOutlineColor: string
     * - cellSize: number
     * - cellShape: string
     * - activeFill: string
     * - inactiveFill: string
     * - appsOutlineColor: string
     * - appsOutlineThickness: number
     * - outlineActive: boolean
     */
    get gridSize() {
        return this._gridSize;
    }
    get gridOutlineThickness() {
        return this._gridOutlineThickness;
    }
    get gridOutlineColor() {
        return this._gridOutlineColor;
    }
    get cellSize() {
        return this._cellSize;
    }
    get cellShape() {
        return this._cellShape;
    }
    get activeFill() {
        return this._activeFill;
    }
    get inactiveFill() {
        return this._inactiveFill;
    }
    get appsOutlineColor() {
        return this._appsOutlineColor;
    }
    get appsOutlineThickness() {
        return this._appsOutlineThickness;
    }
    get outlineActive() {
        return this._outlineActive;
    }

    /**
     * Loads settings from the schema and initializes internal properties.
     *
     * @private
     */
    _loadSettings() {
        // Grid settings.
        this._gridSize = 95;
        this._gridOutlineThickness = '0px';
        this._gridOutlineColor = 'white';
        // Base cell settings.
        this._cellSize = this._settings.get_int('cell-size');
        this._cellShape = this._settings.get_string('cell-shape');
        // Active/inactive fill settings.
        this._activeFill = this._settings.get_string('active-fill');
        this._inactiveFill = this._settings.get_string('inactive-fill');
        // Applications outline settings.
        this._appsOutlineColor = this._settings.get_string('apps-outline-color');
        this._appsOutlineThickness = this._settings.get_int('apps-outline-thickness');
        this._outlineActive = this._settings.get_boolean('outline-active');
    }

    /**
     * Notifies all registered callbacks of a settings change.
     *
     * @private
     */
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

    /**
     * Initializes the settings instance with the provided schema.
     *
     * @param {any} schema - The settings schema to use.
     * @returns {IndicatorSettings} The singleton instance.
     */
    static initialize(schema) {
        IndicatorSettings.schema = schema;
        return new IndicatorSettings();
    }



    /**
     * Registers a callback to be notified when settings change.
     *
     * @param {Function} callback - The callback function to add.
     */
    connect(callback) {
        console.debug('Adding settings callback');
        this._callbacks.add(callback);
    }

    /**
     * Unregisters a previously registered settings callback.
     *
     * @param {Function} callback - The callback function to remove.
     */
    disconnect(callback) {
        console.debug('Removing settings callback');
        this._callbacks.delete(callback);
    }

    /**
     * Destroys the instance by disconnecting signals and clearing callbacks.
     */
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

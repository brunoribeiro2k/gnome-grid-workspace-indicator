export class SVGGenerator {
    static SVG_SIZE = 16; // Default size if not specified

    static Config = {
        grid: {
            color: 'rgba(255, 255, 255, 1.0)',
            thickness: 1,
            visible: false
        },
        cell: {
            shape: 'circle', // or 'square'
            size: 75, // percentage of cell size
        },
        states: {
            inactive: {
                fill: 'rgba(128, 128, 128, 0.5)'
            },
            active: {
                fill: 'rgba(255, 255, 255, 1)'
            },
            withApps: {
                outline: {
                    color: 'rgba(255, 255, 255, 1)',
                    thickness: 1
                }
            }
        }
    };

    // Define base cell classes
    static CellClass = {
        INACTIVE: 'workspace-inactive',
        ACTIVE: 'workspace-active'
    };

    static _generateStyles(config) {
        const getStateStyle = (state, fallback = {}) => {
            const fill = state.fill ?? fallback.fill ?? 'none';
            const outlineColor = state.outline?.color ?? fallback.outline?.color ?? 'none';
            const outlineThickness = state.outline?.thickness ?? fallback.outline?.thickness ?? 0;
            return { fill, outlineColor, outlineThickness };
        };

        return `
        .grid-line {
            stroke: ${config.grid.color};
            stroke-width: ${config.grid.thickness};
        }
        .${this.CellClass.INACTIVE} {
            fill: ${config.states.inactive.fill};
            stroke: none;
        }
        .${this.CellClass.ACTIVE} {
            fill: ${config.states.active.fill};
            stroke: none;
        }
        .with-apps {
            stroke: ${config.states.withApps.outline.color};
            stroke-width: ${config.states.withApps.outline.thickness};
        }`;
    }

    // Base layout and grid configuration
    static _createSvgLayout(styles) {
        return `
<svg xmlns="http://www.w3.org/2000/svg" width="${this.SVG_SIZE}" height="${this.SVG_SIZE}" 
    viewBox="0 0 ${this.SVG_SIZE} ${this.SVG_SIZE}">
    <style>${styles}</style>`;
    }

    static _createGridLines(rows, cols, style = '') {
        if (!style) return '';
        
        const cellWidth = this.SVG_SIZE / cols;
        const cellHeight = this.SVG_SIZE / rows;
        let grid = '';
        
        // Vertical lines
        for (let i = 1; i < cols; i++) {
            const x = i * cellWidth;
            grid += `    <line x1="${x}" y1="0" x2="${x}" y2="${this.SVG_SIZE}" class="grid-line"/>\n`;
        }
        // Horizontal lines
        for (let i = 1; i < rows; i++) {
            const y = i * cellHeight;
            grid += `    <line x1="0" y1="${y}" x2="${this.SVG_SIZE}" y2="${y}" class="grid-line"/>\n`;
        }
        return grid;
    }

    // Cell generators
    static _createBaseCell(x, y, cellWidth, cellHeight) {
        const cx = x * cellWidth + cellWidth / 2;
        const cy = y * cellHeight + cellHeight / 2;
        const radius = Math.min(cellWidth, cellHeight) / 3;
        return { cx, cy, radius };
    }

    static _createCell(x, y, cellWidth, cellHeight, className, config) {
        const cellSize = Math.min(cellWidth, cellHeight) * (config.cell.size / 100);
        const xPos = x * cellWidth + (cellWidth - cellSize) / 2;
        const yPos = y * cellHeight + (cellHeight - cellSize) / 2;

        if (config.cell.shape === 'circle') {
            const radius = cellSize / 2;
            const cx = xPos + radius;
            const cy = yPos + radius;
            return `    <circle cx="${cx}" cy="${cy}" r="${radius}" class="${className}"/>`;
        } else {
            return `    <rect x="${xPos}" y="${yPos}" width="${cellSize}" height="${cellSize}" class="${className}"/>`;
        }
    }

    static _getCellClass(col, row, isActive, hasApps) {
        const baseClass = isActive ? this.CellClass.ACTIVE : this.CellClass.INACTIVE;
        return hasApps ? `${baseClass} with-apps` : baseClass;
    }

    // Main generator function
    static create(x, y, rows, cols, withApps = [], size = this.SVG_SIZE) {
        this.SVG_SIZE = size; // Update size for this generation
        const cellWidth = this.SVG_SIZE / cols;
        const cellHeight = this.SVG_SIZE / rows;

        let svg = this._createSvgLayout(this._generateStyles(this.Config));
        
        if (this.Config.grid.visible) {
            svg += this._createGridLines(rows, cols, this.Config.grid.color);
        }

        // Generate cells
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const isActive = (col === x && row === y);
                const hasApps = withApps.some(([appX, appY]) => appX === col && appY === row);
                const cellClass = this._getCellClass(col, row, isActive, hasApps);
                svg += this._createCell(col, row, cellWidth, cellHeight, cellClass, this.Config) + '\n';
            }
        }

        svg += '</svg>';
        return svg;
    }
}
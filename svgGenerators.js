export class SVGGenerators {
    /**
     * Generates an SVG with a gradient highlight and soft edges.
     */
    static gradient(x, y, rows, cols, withApps = []) {
        const cellWidth = 30 / cols;
        const cellHeight = 30 / rows;
        const rectX = x * cellWidth;
        const rectY = y * cellHeight;
        let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FFCC00; stop-opacity:1" />
            <stop offset="100%" style="stop-color:#FF9900; stop-opacity:1" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="#333" />
        </filter>
    </defs>
    <rect x="${rectX}" y="${rectY}" width="${cellWidth}" height="${cellHeight}" 
          rx="${cellWidth * 0.2}" ry="${cellHeight * 0.2}" fill="url(#grad1)" filter="url(#shadow)"/>
    `;
        for (let col = 1; col < cols; col++) {
            const lineX = col * cellWidth;
            svg += `    <path d="M${lineX} 0 V30" stroke="rgba(255,255,255,0.5)" stroke-width="0.5"/>\n`;
        }
        for (let row = 1; row < rows; row++) {
            const lineY = row * cellHeight;
            svg += `    <path d="M0 ${lineY} H30" stroke="rgba(255,255,255,0.5)" stroke-width="0.5"/>\n`;
        }
        svg += `</svg>`;
        return svg;
    }

    /**
     * Generates an SVG with a minimalist monochrome theme and accent color.
     */
    static monochrome(x, y, rows, cols, withApps = []) {
        const cellWidth = 30 / cols;
        const cellHeight = 30 / rows;
        const rectX = x * cellWidth;
        const rectY = y * cellHeight;
        let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <rect width="30" height="30" fill="#333"/>
    <rect x="${rectX}" y="${rectY}" width="${cellWidth}" height="${cellHeight}" fill="#00BFFF"/>
    `;
        for (let col = 1; col < cols; col++) {
            const lineX = col * cellWidth;
            svg += `    <path d="M${lineX} 0 V30" stroke="white" stroke-width="0.5"/>\n`;
        }
        for (let row = 1; row < rows; row++) {
            const lineY = row * cellHeight;
            svg += `    <path d="M0 ${lineY} H30" stroke="white" stroke-width="0.5"/>\n`;
        }
        svg += `</svg>`;
        return svg;
    }

    /**
     * Generates an SVG with a neon glow effect.
     */
    static neon(x, y, rows, cols, withApps = []) {
        const cellWidth = 30 / cols;
        const cellHeight = 30 / rows;
        const rectX = x * cellWidth;
        const rectY = y * cellHeight;
        let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <defs>
        <filter id="neon">
            <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
            <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
            </feMerge>
        </filter>
    </defs>
    <rect width="30" height="30" fill="#111"/>
    <rect x="${rectX}" y="${rectY}" width="${cellWidth}" height="${cellHeight}" fill="#39FF14" filter="url(#neon)"/>
    `;
        for (let col = 1; col < cols; col++) {
            const lineX = col * cellWidth;
            svg += `    <path d="M${lineX} 0 V30" stroke="rgba(255,255,255,0.2)" stroke-width="0.8"/>\n`;
        }
        for (let row = 1; row < rows; row++) {
            const lineY = row * cellHeight;
            svg += `    <path d="M0 ${lineY} H30" stroke="rgba(255,255,255,0.2)" stroke-width="0.8"/>\n`;
        }
        svg += `</svg>`;
        return svg;
    }

    /**
     * Generates an SVG with a soft pastel theme and dotted grid lines.
     */
    static pastel(x, y, rows, cols, withApps = []) {
        const cellWidth = 30 / cols;
        const cellHeight = 30 / rows;
        const rectX = x * cellWidth;
        const rectY = y * cellHeight;
        let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <rect width="30" height="30" fill="#F7F7F7"/>
    <rect x="${rectX}" y="${rectY}" width="${cellWidth}" height="${cellHeight}" fill="#FFB6C1"/>
    `;
        for (let col = 1; col < cols; col++) {
            const lineX = col * cellWidth;
            svg += `    <path d="M${lineX} 0 V30" stroke="#DDD" stroke-width="1" stroke-dasharray="1,2"/>\n`;
        }
        for (let row = 1; row < rows; row++) {
            const lineY = row * cellHeight;
            svg += `    <path d="M0 ${lineY} H30" stroke="#DDD" stroke-width="1" stroke-dasharray="1,2"/>\n`;
        }
        svg += `</svg>`;
        return svg;
    }

    /**
     * Generates an SVG with a white rectangular highlight and grid lines.
     */
    static basicGridWithSquare(x, y, rows, cols, withApps = []) {
        const cellWidth = 30 / cols;
        const cellHeight = 30 / rows;
        const rectX = x * cellWidth; // Horizontal position
        const rectY = y * cellHeight; // Vertical position
        
        let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <rect x="${rectX}" y="${rectY}" width="${cellWidth}" height="${cellHeight}" fill="white"/>
    `;
        
        // Add vertical grid lines
        for (let col = 1; col < cols; col++) {
            const lineX = col * cellWidth;
            svg += `    <path d="M${lineX} 0 V30" stroke="white" stroke-width="1"/>\n`;
        }
        
        // Add horizontal grid lines
        for (let row = 1; row < rows; row++) {
            const lineY = row * cellHeight;
            svg += `    <path d="M0 ${lineY} H30" stroke="white" stroke-width="1"/>\n`;
        }
        
        svg += `</svg>`;
        return svg;
    }

    /**
     * Generates an SVG with a white circular highlight and grid lines.
     */
    static basicGridWithCircle(x, y, rows, cols, withApps = []) {
        const cellWidth = 30 / cols;
        const cellHeight = 30 / rows;
        const rectX = x * cellWidth;
        const rectY = y * cellHeight;
        
        let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    <circle cx="${rectX + cellWidth / 2}" cy="${rectY + cellHeight / 2}" r="${Math.min(cellWidth, cellHeight) / 3}" fill="white"/>
    `;
        for (let col = 1; col < cols; col++) {
            const lineX = col * cellWidth;
            svg += `<path d="M${lineX} 0 V30" stroke="white" stroke-width="1"/>\n`;
        }
        for (let row = 1; row < rows; row++) {
            const lineY = row * cellHeight;
            svg += `<path d="M0 ${lineY} H30" stroke="white" stroke-width="1"/>\n`;
        }
        svg += `</svg>`;
        return svg;
    }

    /**
     * Generates an SVG with no grid lines and highlighted cells.
     */
    static circlesNoGrid(x, y, rows, cols, withApps = []) {
        const cellWidth = 30 / cols;
        const cellHeight = 30 / rows;
        const radius = Math.min(cellWidth, cellHeight) / 3;
        const highlightRadius = radius * 1.5;
        
        let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">
    `;
        
        // Draw all cells as gray circles with light transparency.
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cx = col * cellWidth + cellWidth / 2;
                const cy = row * cellHeight + cellHeight / 2;
                const isHighlighted = (col === x && row === y);
                
                svg += `
        <circle cx="${cx}" cy="${cy}" r="${radius}" 
            fill="${isHighlighted ? 'white' : 'gray'}" 
            fill-opacity="${isHighlighted ? 1 : 0.5}" />
            `;
            }
        }
        
        svg += `</svg>`;
        return svg;
    }
}

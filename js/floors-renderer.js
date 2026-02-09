/**
 * Floors Renderer Module
 * Handles rendering of platforms and elevated floors
 */

const FloorsRenderer = {
    /**
     * Draws a single platform/floor
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleX - Function to scale X coordinates
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {Function} scaleLengthX - Function to scale X lengths
     * @param {Function} scaleYFactor - Y scale factor for heights
     * @param {object} floor - Floor configuration {y, height, x1, x2}
     */
    drawPlatform(ctx, scaleX, scaleY, scaleLengthX, scaleYFactor, floor) {
        const y = scaleY(floor.y);
        const height = (floor.height || 16) * scaleYFactor;
        const x = scaleX(floor.x1);
        const width = scaleLengthX(floor.x2 - floor.x1);
        
        // Draw platform with gradient
        const gradient = ctx.createLinearGradient(0, y, 0, y + height);
        gradient.addColorStop(0, '#a17952');
        gradient.addColorStop(1, '#7a5637');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, width, height);
        
        // Draw grass/vegetation on top
        ctx.fillStyle = '#3f9b3f';
        ctx.fillRect(x, y - 6, width, 6);
    },

    /**
     * Renders all platforms (skipping base ground floor)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleX - Function to scale X coordinates
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {Function} scaleLengthX - Function to scale X lengths
     * @param {number} scaleYFactor - Y scale factor
     * @param {object} config - Game configuration
     */
    render(ctx, scaleX, scaleY, scaleLengthX, scaleYFactor, config) {
        const floors = config.FLOORS || [{ y: config.GROUND_Y, height: 40, x1: 0, x2: config.GAME_WIDTH }];
        
        // Start from index 1 to skip base ground (index 0)
        for (let i = 1; i < floors.length; i++) {
            if (floors[i] && floors[i].render === false) continue;
            this.drawPlatform(ctx, scaleX, scaleY, scaleLengthX, scaleYFactor, floors[i]);
        }
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.FloorsRenderer = FloorsRenderer;
}

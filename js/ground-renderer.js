/**
 * Ground Renderer Module
 * Handles rendering of the base ground/terrain
 */

const GroundRenderer = {
    /**
     * Draws the main ground terrain
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     * @param {object} baseFloor - Base floor configuration {y, height, x1, x2}
     */
    drawGround(ctx, scaleY, canvasWidth, canvasHeight, baseFloor) {
        const baseY = scaleY(baseFloor.y);
        const baseHeight = canvasHeight - baseY;
        
        // Draw dirt/ground
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, baseY, canvasWidth, baseHeight);
        
        // Draw grass layer on top
        ctx.fillStyle = '#2f9e44';
        ctx.fillRect(0, baseY - 12, canvasWidth, 12);
    },

    /**
     * Renders the complete ground
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     * @param {object} config - Game configuration
     */
    render(ctx, scaleY, canvasWidth, canvasHeight, config) {
        const floors = config.FLOORS || [{ y: config.GROUND_Y, height: 40, x1: 0, x2: config.GAME_WIDTH }];
        if (floors.length === 0) return;
        
        const baseFloor = floors[0];
        this.drawGround(ctx, scaleY, canvasWidth, canvasHeight, baseFloor);
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.GroundRenderer = GroundRenderer;
}

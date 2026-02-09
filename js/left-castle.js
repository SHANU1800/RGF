/**
 * Left Castle Renderer Module
 * Renders the RED team castle on the left side
 */

const LeftCastleRenderer = {
    /**
     * Draws the left (RED) castle
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleX - Function to scale X coordinates
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {Function} scaleLengthX - Function to scale X lengths
     * @param {Function} scaleLengthY - Function to scale Y lengths
     * @param {number} worldX - World X position
     * @param {number} groundY - Ground Y position
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    render(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, worldX, groundY, canvasWidth, canvasHeight, gateOpenAnim) {
        const x = scaleX(worldX);
        const y = scaleY(groundY);
        const w = scaleLengthX(200);
        const h = scaleLengthY(320);
        const towerH = scaleLengthY(400);
        
        // Frustum culling - skip if off-screen
        const xMin = x - w * 1.2;
        const xMax = x + w * 1.2;
        const yTop = y - towerH - 40;
        if (xMax < -50 || xMin > canvasWidth + 50 || yTop > canvasHeight + 50) {
            return;
        }

        if (window.CastleBodyRenderer && typeof window.CastleBodyRenderer.drawWallAndStairs === 'function') {
            window.CastleBodyRenderer.drawWallAndStairs(
                ctx,
                scaleX,
                scaleY,
                scaleLengthX,
                scaleLengthY,
                worldX,
                groundY,
                'RED'
            );
        }
        if (window.CastleRoofRenderer && typeof window.CastleRoofRenderer.drawRoof === 'function') {
            window.CastleRoofRenderer.drawRoof(
                ctx,
                scaleX,
                scaleY,
                scaleLengthX,
                scaleLengthY,
                worldX,
                groundY,
                'RED'
            );
        }
        if (window.CastleGateRenderer && typeof window.CastleGateRenderer.drawGate === 'function') {
            window.CastleGateRenderer.drawGate(
                ctx,
                scaleX,
                scaleY,
                scaleLengthX,
                scaleLengthY,
                worldX,
                groundY,
                'RED',
                gateOpenAnim
            );
        }

        // RED team banner
        const poleX = x - w * 0.25;
        const poleTop = y - h - scaleLengthY(55);
        ctx.strokeStyle = '#2f2f2f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(poleX, y - h);
        ctx.lineTo(poleX, poleTop);
        ctx.stroke();
        
        ctx.fillStyle = '#e74c3c';  // RED banner
        ctx.beginPath();
        ctx.moveTo(poleX, poleTop);
        ctx.lineTo(poleX - scaleLengthX(36), poleTop + scaleLengthY(8));
        ctx.lineTo(poleX, poleTop + scaleLengthY(20));
        ctx.closePath();
        ctx.fill();
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.LeftCastleRenderer = LeftCastleRenderer;
}

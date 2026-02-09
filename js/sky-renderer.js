/**
 * Sky Renderer Module
 * Handles sky background and parallax layer rendering
 */

const SkyRenderer = {
    /**
     * Renders the sky gradient background
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    drawSky(ctx, canvasWidth, canvasHeight) {
        const sky = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        sky.addColorStop(0, '#6bb5ff');
        sky.addColorStop(1, '#d7f0ff');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    },

    /**
     * Draws a parallax layer (mountains/hills in the background)
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} cameraX - Camera X position
     * @param {number} scaleXFactor - X scale factor
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     * @param {number} factor - Parallax factor (0-1, lower = further away)
     * @param {string} color - Layer color
     * @param {number} heightFactor - Height factor (0-1)
     */
    drawParallaxLayer(ctx, cameraX, scaleXFactor, canvasWidth, canvasHeight, factor, color, heightFactor) {
        const baseY = canvasHeight * heightFactor;
        const offset = -cameraX * factor * scaleXFactor;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(offset, baseY);
        const step = canvasWidth / 5;
        for (let i = 0; i <= 6; i++) {
            const x = offset + i * step;
            const y = baseY - (Math.sin((i + 1) * 1.2) * 40 + 30);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(offset + canvasWidth + step, canvasHeight);
        ctx.lineTo(offset - step, canvasHeight);
        ctx.closePath();
        ctx.fill();
    },

    /**
     * Renders complete sky with all parallax layers
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} cameraX - Camera X position
     * @param {number} scaleXFactor - X scale factor
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    render(ctx, cameraX, scaleXFactor, canvasWidth, canvasHeight) {
        this.drawSky(ctx, canvasWidth, canvasHeight);
        this.drawParallaxLayer(ctx, cameraX, scaleXFactor, canvasWidth, canvasHeight, 0.2, '#7aa3b5', 0.6);
        this.drawParallaxLayer(ctx, cameraX, scaleXFactor, canvasWidth, canvasHeight, 0.4, '#5f8799', 0.8);
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.SkyRenderer = SkyRenderer;
}

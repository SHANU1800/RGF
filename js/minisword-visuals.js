/**
 * Mini Sword Visuals Module
 * Handles rendering of mini sword (dagger) weapon
 */

const MiniSwordVisuals = {
    /**
     * Draws equipped mini sword on player's belt
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} w - Player width
     * @param {number} h - Player height
     */
    drawEquippedMiniSword(ctx, player, w, h) {
        if (!player.loadout || !player.loadout.miniSword) return;
        
        const dir = player.team === 'RED' ? 1 : -1;
        const mx = dir * w * 0.16;
        const my = h * 0.25;
        
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(dir * 0.35);
        
        // Draw blade
        ctx.strokeStyle = '#d6dde0';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -h * 0.28);
        ctx.stroke();
        
        // Draw handle
        ctx.strokeStyle = '#6a4b2f';
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.moveTo(-w * 0.08, 0);
        ctx.lineTo(w * 0.08, 0);
        ctx.stroke();
        
        ctx.restore();
    },

    /**
     * Draws mini sword glyph for loadout badge
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} cx - Center X position
     * @param {number} cy - Center Y position
     * @param {number} size - Glyph size
     */
    drawMiniSwordGlyph(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Blade
        ctx.beginPath();
        ctx.moveTo(0, size * 0.34);
        ctx.lineTo(0, -size * 0.25);
        ctx.stroke();
        
        // Handle
        ctx.beginPath();
        ctx.moveTo(-size * 0.14, size * 0.12);
        ctx.lineTo(size * 0.14, size * 0.12);
        ctx.stroke();
        
        ctx.restore();
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.MiniSwordVisuals = MiniSwordVisuals;
}

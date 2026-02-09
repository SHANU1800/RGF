/**
 * Shield Visuals Module
 * Handles rendering of shield weapon
 */

const ShieldVisuals = {
    getShieldCombatProfile(loadout) {
        const active = !!(loadout && loadout.shield);
        return {
            active,
            moveSpeedMultiplier: active ? 0.93 : 1.0,
            incomingDamageMultiplier: 1.0,
        };
    },

    /**
     * Draws equipped shield on player's off-hand side
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} w - Player width
     * @param {number} h - Player height
     */
    drawEquippedShield(ctx, player, w, h) {
        if (!player.loadout || !player.loadout.shield) return;
        
        const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
            ? performance.now()
            : Date.now();
        const facing = Number(player.facingDir || (player.team === 'RED' ? 1 : -1));
        const dir = facing >= 0 ? 1 : -1;
        const blocking = !!player.shieldBlocking;
        const blockAngle = Number(player.shieldBlockAngle || 0);
        const clampedBlockAngle = Math.max(-1.35, Math.min(1.35, blockAngle));
        const impactPulse = Math.max(0, Math.min(1, (Number(player.shieldBlockHitUntil || 0) - now) / 220));

        const sx = -dir * w * (blocking ? 0.30 : 0.26);
        const sy = h * (blocking ? 0.01 : 0.04);
        const blockLean = blocking ? clampedBlockAngle * 0.22 : 0;
        const settleLean = dir < 0 ? Math.PI : 0;
        const pulseScale = 1 + impactPulse * 0.08;
        
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(settleLean + blockLean);
        ctx.scale(pulseScale, pulseScale);
        
        ctx.fillStyle = impactPulse > 0.01
            ? `rgba(${Math.round(52 + impactPulse * 80)}, ${Math.round(152 + impactPulse * 85)}, ${Math.round(219 + impactPulse * 18)}, 0.98)`
            : '#2f6ea4';
        ctx.strokeStyle = impactPulse > 0.01 ? '#e8fbff' : '#c8d8e6';
        ctx.lineWidth = blocking ? 3.0 : 2.6;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.17);
        ctx.lineTo(w * 0.15, -h * 0.05);
        ctx.lineTo(w * 0.11, h * 0.17);
        ctx.lineTo(-w * 0.11, h * 0.17);
        ctx.lineTo(-w * 0.15, -h * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (impactPulse > 0.01) {
            ctx.strokeStyle = `rgba(220, 248, 255, ${0.45 * impactPulse})`;
            ctx.lineWidth = 1.6 + impactPulse * 1.8;
            ctx.beginPath();
            ctx.moveTo(0, -h * 0.20);
            ctx.lineTo(w * 0.18, -h * 0.06);
            ctx.lineTo(w * 0.14, h * 0.2);
            ctx.lineTo(-w * 0.14, h * 0.2);
            ctx.lineTo(-w * 0.18, -h * 0.06);
            ctx.closePath();
            ctx.stroke();
        }
        
        ctx.restore();
    },

    /**
     * Draws shield glyph for loadout badge
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} cx - Center X position
     * @param {number} cy - Center Y position
     * @param {number} size - Glyph size
     */
    drawShieldGlyph(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.33);
        ctx.lineTo(size * 0.28, -size * 0.07);
        ctx.lineTo(size * 0.2, size * 0.33);
        ctx.lineTo(-size * 0.2, size * 0.33);
        ctx.lineTo(-size * 0.28, -size * 0.07);
        ctx.closePath();
        ctx.stroke();
        
        ctx.restore();
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.ShieldVisuals = ShieldVisuals;
}

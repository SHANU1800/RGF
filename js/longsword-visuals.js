/**
 * Axe Visuals (wired through existing longsword loadout key)
 */

const LongswordVisuals = {
    /**
     * Draws equipped axe on player's back / in swing.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} w - Player width
     * @param {number} h - Player height
     */
    drawEquippedLongsword(ctx, player, w, h) {
        if (!player.loadout || !player.loadout.longsword) return;
        
        const dir = player.facingDir || (player.team === 'RED' ? 1 : -1);
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const swingUntil = Number(player.swordSwingUntil || 0);
        const swingStarted = Number(player.swordSwingStarted || 0);
        const swingActive = swingUntil > now;
        const duration = Math.max(1, swingUntil - swingStarted || 180);
        const progress = swingActive ? Math.min(1, Math.max(0, (now - swingStarted) / duration)) : 0;
        const attack = player.swordSwingAttack || 'slash';
        const eased = progress < 0.52
            ? (progress / 0.52) * 0.28
            : 0.28 + ((progress - 0.52) / 0.48) * 0.72;
        
        ctx.save();
        if (swingActive) {
            const swingEase = Math.sin(eased * Math.PI);
            let startRot = dir * -0.9;
            let endRot = dir * 0.7;
            let tx = dir * w * 0.12;
            let ty = -h * 0.04;

            if (attack === 'upper_slash') {
                startRot = dir * 1.12;
                endRot = dir * -0.68;
                ty = -h * 0.16;
            } else if (attack === 'lower_slash') {
                startRot = dir * -0.22;
                endRot = dir * 1.24;
                ty = h * 0.12;
            } else if (attack === 'pierce') {
                startRot = dir * 0.04;
                endRot = dir * 0.04;
                tx += dir * (w * 0.42 * swingEase);
            } else {
                startRot = dir * -1.02;
                endRot = dir * 0.96;
            }

            ctx.translate(tx, ty);

            if (attack !== 'pierce') {
                const trailAlpha = 0.28 * swingEase;
                ctx.strokeStyle = `rgba(255, 208, 120, ${trailAlpha})`;
                ctx.lineWidth = 14;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.arc(0, -h * 0.15, h * 0.45, dir > 0 ? -1.95 : 3.1, dir > 0 ? -0.28 : 1.2);
                ctx.stroke();
            }
            ctx.rotate(startRot + (endRot - startRot) * eased);
        } else {
            ctx.rotate(dir * -0.72);
        }

        // Haft.
        ctx.strokeStyle = '#6a4b2f';
        ctx.lineWidth = 5.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-w * 0.2, h * 0.2);
        ctx.lineTo(-w * 0.2, -h * 0.36);
        ctx.stroke();

        // Grip wrap.
        ctx.strokeStyle = '#3b2a1b';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-w * 0.235, h * 0.08);
        ctx.lineTo(-w * 0.165, h * 0.08);
        ctx.stroke();

        // Axe head.
        ctx.fillStyle = '#c8cfd4';
        ctx.strokeStyle = '#8e989f';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(-w * 0.2, -h * 0.32);
        ctx.quadraticCurveTo(-w * 0.02, -h * 0.3, w * 0.04, -h * 0.14);
        ctx.lineTo(-w * 0.14, -h * 0.14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Spike/back edge.
        ctx.fillStyle = '#aeb7bd';
        ctx.beginPath();
        ctx.moveTo(-w * 0.2, -h * 0.31);
        ctx.lineTo(-w * 0.3, -h * 0.24);
        ctx.lineTo(-w * 0.2, -h * 0.2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    },

    /**
     * Draws axe glyph for loadout badge
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} cx - Center X position
     * @param {number} cy - Center Y position
     * @param {number} size - Glyph size
     */
    drawLongswordGlyph(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Haft
        ctx.beginPath();
        ctx.moveTo(-size * 0.05, size * 0.33);
        ctx.lineTo(-size * 0.05, -size * 0.34);
        ctx.stroke();
        
        // Axe head
        ctx.beginPath();
        ctx.moveTo(-size * 0.02, -size * 0.3);
        ctx.quadraticCurveTo(size * 0.34, -size * 0.28, size * 0.28, -size * 0.02);
        ctx.lineTo(size * 0.08, -size * 0.02);
        ctx.closePath();
        ctx.stroke();

        // Back spike
        ctx.beginPath();
        ctx.moveTo(-size * 0.04, -size * 0.27);
        ctx.lineTo(-size * 0.22, -size * 0.15);
        ctx.lineTo(-size * 0.05, -size * 0.08);
        ctx.stroke();
        
        ctx.restore();
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.LongswordVisuals = LongswordVisuals;
}

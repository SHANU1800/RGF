/**
 * Bow Visuals Module
 * Handles rendering of bow and bow drawing mechanics
 */

const BowVisuals = {
    _nowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    },

    _releaseRatio(player, nowMs) {
        if (player && typeof player.bowReleaseRatio === 'function') {
            return Math.max(0, Math.min(1, Number(player.bowReleaseRatio(nowMs) || 0)));
        }
        if (!player || !player.bowReleaseUntil || !player.bowReleaseDurationMs) {
            return 0;
        }
        const remaining = Number(player.bowReleaseUntil) - nowMs;
        if (remaining <= 0) return 0;
        return Math.max(0, Math.min(1, remaining / Number(player.bowReleaseDurationMs || 1)));
    },

    /**
     * Draws the bow rig with string and nocked arrow
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} h - Player height
     */
    drawBowRig(ctx, player, h) {
        const angle = player.aimAngle || 0;
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const perpX = -dirY;
        const perpY = dirX;
        const nowMs = this._nowMs();
        const releaseRatio = this._releaseRatio(player, nowMs);
        const releasePower = Math.max(0, Math.min(1, Number(player.bowReleasePower || 0)));
        const recoilKick = h * Number(player.bowRecoilKick || 0) * releaseRatio;

        const handX = dirX * h * 0.32 - dirX * recoilKick;
        const handY = dirY * h * 0.32 - dirY * recoilKick;
        const bowHalf = h * 0.21;
        const upperX = handX + perpX * bowHalf;
        const upperY = handY + perpY * bowHalf;
        const lowerX = handX - perpX * bowHalf;
        const lowerY = handY - perpY * bowHalf;
        const drawRatio = Math.max(0, Math.min(1, (player.drawPower || 0) / 100));
        const tension = Math.pow(drawRatio, 0.78);
        const drawPull = h * 0.24 + h * 0.24 * tension;
        const releaseSnapPull = h * (0.08 + releasePower * 0.06) * releaseRatio;
        const stringPull = player.bowDrawn ? drawPull : releaseSnapPull;
        const stringX = handX - dirX * stringPull;
        const stringY = handY - dirY * stringPull;
        const glowAlpha = Math.max(0.2 + drawRatio * 0.4, releaseRatio * (0.45 + releasePower * 0.35));
        const maxTensionShake = drawRatio > 0.92 ? (drawRatio - 0.92) / 0.08 : 0;
        const tensionWave = Math.sin(nowMs * 0.034) * h * 0.007 * maxTensionShake;
        const tensionShakeX = perpX * tensionWave;
        const tensionShakeY = perpY * tensionWave;

        ctx.save();
        
        // Bow glow while drawing/releasing
        if (player.bowDrawn || releaseRatio > 0.01) {
            ctx.strokeStyle = `rgba(255, 215, 120, ${glowAlpha})`;
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(upperX, upperY);
            ctx.quadraticCurveTo(handX + dirX * h * 0.16, handY + dirY * h * 0.16, lowerX, lowerY);
            ctx.stroke();
        }
        if (releaseRatio > 0.01) {
            ctx.strokeStyle = player.team === 'RED'
                ? `rgba(231, 76, 60, ${releaseRatio * 0.55})`
                : `rgba(52, 152, 219, ${releaseRatio * 0.55})`;
            ctx.lineWidth = 3 + releasePower * 2;
            ctx.beginPath();
            const snap = h * (0.12 + releasePower * 0.08);
            ctx.moveTo(stringX, stringY);
            ctx.lineTo(stringX - dirX * snap + perpX * snap * 0.14, stringY - dirY * snap + perpY * snap * 0.14);
            ctx.stroke();
        }

        // Main bow body (procedural for stable in-game readability)
        ctx.strokeStyle = '#3a2617';
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(upperX + tensionShakeX, upperY + tensionShakeY);
        ctx.quadraticCurveTo(handX + dirX * h * 0.2, handY + dirY * h * 0.2, lowerX + tensionShakeX, lowerY + tensionShakeY);
        ctx.stroke();

        ctx.strokeStyle = '#7a5133';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(upperX + tensionShakeX, upperY + tensionShakeY);
        ctx.quadraticCurveTo(handX + dirX * h * 0.18, handY + dirY * h * 0.18, lowerX + tensionShakeX, lowerY + tensionShakeY);
        ctx.stroke();

        // Bow string
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(upperX + tensionShakeX * 0.5, upperY + tensionShakeY * 0.5);
        if (player.bowDrawn) {
            const stringJitterX = tensionShakeX * 0.35;
            const stringJitterY = tensionShakeY * 0.35;
            ctx.lineTo(stringX + stringJitterX, stringY + stringJitterY);
            ctx.lineTo(lowerX + tensionShakeX * 0.5, lowerY + tensionShakeY * 0.5);
        } else {
            ctx.lineTo(lowerX + tensionShakeX * 0.5, lowerY + tensionShakeY * 0.5);
        }
        ctx.stroke();

        // Nocked arrow preview while drawing.
        if (player.bowDrawn) {
            if (window.ArrowVisuals && typeof window.ArrowVisuals.drawNockedArrowPreview === 'function') {
                window.ArrowVisuals.drawNockedArrowPreview(ctx, {
                    dirX,
                    dirY,
                    perpX,
                    perpY,
                    tailX: stringX,
                    tailY: stringY,
                    drawRatio,
                    team: player.team,
                    playerHeight: h,
                });
            }
        }
        
        ctx.restore();
    },

    /**
     * Draws bow draw power indicator
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} w - Player width
     * @param {number} h - Player height
     */
    drawDrawPowerIndicator(ctx, player, x, y, w, h) {
        if (!player.bowDrawn || player.drawPower <= 0) return;

        const powerScale = player.drawPower / 100;
        const nowMs = this._nowMs();
        const pulse = 0.5 + 0.5 * Math.sin(nowMs * 0.014);
        const chargeAlpha = 0.5 + powerScale * 0.35;

        // Draw aim trajectory line.
        ctx.strokeStyle = `rgba(255, 255, 255, ${chargeAlpha})`;
        ctx.lineWidth = 2.6 + powerScale * 1.2;
        ctx.setLineDash([10, 5]);
        
        const lineLength = 100 * powerScale;
        
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h / 2);
        ctx.lineTo(
            x + w / 2 + Math.cos(player.aimAngle) * lineLength,
            y + h / 2 + Math.sin(player.aimAngle) * lineLength
        );
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw power indicator circle.
        ctx.strokeStyle = powerScale > 0.82 ? '#e74c3c' : powerScale > 0.45 ? '#f39c12' : '#2ecc71';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 15 + powerScale * 20, 0, Math.PI * 2 * powerScale);
        ctx.stroke();

        // Add an outer pulse so fully charged releases feel urgent.
        if (powerScale > 0.7) {
            ctx.strokeStyle = `rgba(255, 220, 120, ${0.18 + pulse * 0.24})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h / 2, 26 + powerScale * 20 + pulse * 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.BowVisuals = BowVisuals;
}

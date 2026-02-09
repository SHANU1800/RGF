/**
 * Arrow Visuals Module
 * Handles rendering of arrows (both flying and nocked)
 */

const ArrowVisuals = {
    arrowSprite: null,
    arrowSpriteState: 'idle',
    maxFutureArcSteps: 6,

    ensureArrowSprite() {
        if (this.arrowSpriteState !== 'idle') return;
        this.arrowSpriteState = 'loading';
        const img = new Image();
        img.onload = () => {
            this.arrowSprite = img;
            this.arrowSpriteState = 'loaded';
        };
        img.onerror = () => {
            this.arrowSprite = null;
            this.arrowSpriteState = 'error';
        };
        img.src = 'assets/weapons/arrow.svg?v=20260208';
    },

    drawArrowSprite(ctx, centerX, centerY, angle, length, thickness) {
        if (this.arrowSpriteState !== 'loaded' || !this.arrowSprite) return false;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(angle);
        ctx.drawImage(this.arrowSprite, -length * 0.5, -thickness * 0.5, length, thickness);
        ctx.restore();
        return true;
    },

    /**
     * Draws a flying arrow
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} scaleFunctions - Object containing scale functions
     * @param {object} arrow - Arrow object
     */
    drawArrow(ctx, scaleFunctions, arrow) {
        this.ensureArrowSprite();

        const x = scaleFunctions.scaleX(arrow.x);
        const y = scaleFunctions.scaleY(arrow.y);
        const vx = Number(arrow.vx || 0);
        const vy = Number(arrow.vy || 0);
        const projectileType = arrow.projectile_type || arrow.projectileType || 'arrow';
        const isBallistaBolt = projectileType === 'ballista_bolt' || arrow.source === 'ballista';
        const speed = Math.hypot(vx, vy);
        const speedNorm = Math.max(0, Math.min(1.45, speed / Math.max(1, Number((window.CONFIG && window.CONFIG.ARROW_SPEED) || 900))));
        const powerRatio = Math.max(0, Math.min(1, Number(arrow.power_ratio || arrow.powerRatio || 0)));
        const chargeNorm = Math.max(speedNorm * 0.75, powerRatio);
        const angle = speed > 0.0001 ? Math.atan2(vy, vx) : Number(arrow.angle || 0);
        const shaftLen = isBallistaBolt ? 64 : 30;
        const shaftHalf = shaftLen * 0.5;
        const blurLen = Math.max(0, Math.min(28, speed * 0.013 + chargeNorm * 8));
        this.drawFlightArcTrail(ctx, scaleFunctions, arrow, isBallistaBolt);
        this.drawFutureArcGuide(ctx, scaleFunctions, arrow, isBallistaBolt);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Motion blur for fast shots.
        if (blurLen > 1) {
            const trail = ctx.createLinearGradient(-shaftHalf - blurLen, 0, -shaftHalf, 0);
            trail.addColorStop(0, 'rgba(240, 220, 180, 0)');
            trail.addColorStop(1, `rgba(240, 220, 180, ${0.35 + chargeNorm * 0.35})`);
            ctx.strokeStyle = trail;
            ctx.lineWidth = isBallistaBolt ? 4.4 : 3;
            ctx.beginPath();
            ctx.moveTo(-shaftHalf - blurLen, 0);
            ctx.lineTo(-shaftHalf, 0);
            ctx.stroke();
        }

        const usedSprite = !isBallistaBolt && this.arrowSpriteState === 'loaded' && this.arrowSprite;
        if (usedSprite) {
            const drawLen = shaftLen + 8;
            const drawThickness = 9;
            ctx.drawImage(this.arrowSprite, -drawLen * 0.5, -drawThickness * 0.5, drawLen, drawThickness);
        } else {
            // Shaft.
            ctx.strokeStyle = isBallistaBolt ? '#7c512e' : '#b99367';
            ctx.lineWidth = isBallistaBolt ? 6.6 : 3.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-shaftHalf, 0);
            ctx.lineTo(shaftHalf, 0);
            ctx.stroke();

            // Tip.
            ctx.fillStyle = isBallistaBolt ? '#d0d0d0' : '#8d8d8d';
            ctx.beginPath();
            ctx.moveTo(shaftHalf + (isBallistaBolt ? 16 : 7), 0);
            ctx.lineTo(shaftHalf - 4, isBallistaBolt ? -9 : -4);
            ctx.lineTo(shaftHalf - 4, isBallistaBolt ? 9 : 4);
            ctx.closePath();
            ctx.fill();

            if (!isBallistaBolt && chargeNorm > 0.55) {
                ctx.fillStyle = `rgba(255, 245, 210, ${0.15 + chargeNorm * 0.25})`;
                ctx.beginPath();
                ctx.moveTo(shaftHalf + 10, 0);
                ctx.lineTo(shaftHalf - 8, -6.5);
                ctx.lineTo(shaftHalf - 8, 6.5);
                ctx.closePath();
                ctx.fill();
            }

            // Fletching.
            const fletchColor = isBallistaBolt ? '#d9d9d9' : (arrow.team === 'RED' ? '#e74c3c' : '#3498db');
            ctx.fillStyle = fletchColor;
            ctx.beginPath();
            ctx.moveTo(-shaftHalf, 0);
            ctx.lineTo(-shaftHalf - (isBallistaBolt ? 8 : 7), isBallistaBolt ? -5 : -4);
            ctx.lineTo(-shaftHalf - (isBallistaBolt ? 12 : 10), 0);
            ctx.closePath();
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(-shaftHalf, 0);
            ctx.lineTo(-shaftHalf - (isBallistaBolt ? 8 : 7), isBallistaBolt ? 5 : 4);
            ctx.lineTo(-shaftHalf - (isBallistaBolt ? 12 : 10), 0);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    },

    drawFlightArcTrail(ctx, scaleFunctions, arrow, isBallistaBolt) {
        if (!Array.isArray(arrow.trailPoints) || arrow.trailPoints.length < 2) return;

        const color = isBallistaBolt
            ? '220, 220, 220'
            : (arrow.team === 'RED' ? '231, 76, 60' : '52, 152, 219');
        const maxSegments = Math.min(arrow.trailPoints.length - 1, 12);
        const startIndex = Math.max(0, (arrow.trailPoints.length - 1) - maxSegments);
        const points = arrow.trailPoints;
        const speed = Math.hypot(Number(arrow.vx || 0), Number(arrow.vy || 0));
        const speedNorm = Math.max(0, Math.min(1.4, speed / Math.max(1, Number((window.CONFIG && window.CONFIG.ARROW_SPEED) || 900))));
        ctx.save();
        ctx.lineCap = 'round';
        for (let i = startIndex + 1; i < points.length; i++) {
            const prev = points[i - 1];
            const next = points[i];
            const t = (i - startIndex) / Math.max(1, points.length - startIndex);
            const alpha = 0.03 + t * (0.18 + speedNorm * 0.17);
            const width = (isBallistaBolt ? 1.6 : 1.2) + t * (isBallistaBolt ? 2.0 : (1.5 + speedNorm * 1.3));
            ctx.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(scaleFunctions.scaleX(prev.x), scaleFunctions.scaleY(prev.y));
            ctx.lineTo(scaleFunctions.scaleX(next.x), scaleFunctions.scaleY(next.y));
            ctx.stroke();
        }

        // Bright inner thread keeps fast shots readable on busy backgrounds.
        if (!isBallistaBolt && speedNorm > 0.52) {
            for (let i = startIndex + 1; i < points.length; i++) {
                const prev = points[i - 1];
                const next = points[i];
                const t = (i - startIndex) / Math.max(1, points.length - startIndex);
                const alpha = 0.03 + t * 0.16;
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 0.85 + t * 0.95;
                ctx.beginPath();
                ctx.moveTo(scaleFunctions.scaleX(prev.x), scaleFunctions.scaleY(prev.y));
                ctx.lineTo(scaleFunctions.scaleX(next.x), scaleFunctions.scaleY(next.y));
                ctx.stroke();
            }
        }
        ctx.restore();
    },

    drawFutureArcGuide(ctx, scaleFunctions, arrow, isBallistaBolt) {
        if (isBallistaBolt) return;
        const vx = Number(arrow.vx || 0);
        const vy = Number(arrow.vy || 0);
        const speed = Math.hypot(vx, vy);
        if (speed < 180) return;

        const gravity = Number((window.CONFIG && window.CONFIG.ARROW_GRAVITY) || 1200);
        const dt = 0.04;
        let x = Number(arrow.x || 0);
        let y = Number(arrow.y || 0);
        let yVel = vy;

        ctx.save();
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        for (let i = 1; i <= this.maxFutureArcSteps; i++) {
            const prevX = x;
            const prevY = y;
            yVel += gravity * dt;
            x += vx * dt;
            y += yVel * dt;
            const alpha = Math.max(0.02, 0.18 - i * 0.02);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(scaleFunctions.scaleX(prevX), scaleFunctions.scaleY(prevY));
            ctx.lineTo(scaleFunctions.scaleX(x), scaleFunctions.scaleY(y));
            ctx.stroke();
        }
        ctx.restore();
    },

    /**
     * Draws nocked arrow preview when bow is drawn
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} params - Parameters object
     */
    drawNockedArrowPreview(ctx, params) {
        this.ensureArrowSprite();
        const {dirX, dirY, perpX, perpY, tailX, tailY, drawRatio, team, playerHeight} = params;
        
        const arrowLen = playerHeight * 0.36;
        const tipX = tailX + dirX * arrowLen;
        const tipY = tailY + dirY * arrowLen;
        const angle = Math.atan2(dirY, dirX);
        const centerX = (tailX + tipX) * 0.5;
        const centerY = (tailY + tipY) * 0.5;

        if (this.drawArrowSprite(ctx, centerX, centerY, angle, arrowLen + 8, playerHeight * 0.07)) {
            return;
        }
        
        // Arrow shaft
        ctx.strokeStyle = '#b99367';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        
        // Arrowhead
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - dirX * 9 + perpX * 4, tipY - dirY * 9 + perpY * 4);
        ctx.lineTo(tipX - dirX * 9 - perpX * 4, tipY - dirY * 9 - perpY * 4);
        ctx.closePath();
        ctx.fill();
        
        // Fletching
        const fletchColor = team === 'RED' ? '#e74c3c' : '#3498db';
        ctx.fillStyle = fletchColor;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tailX - dirX * 8 + perpX * 5, tailY - dirY * 8 + perpY * 5);
        ctx.lineTo(tailX - dirX * 12, tailY - dirY * 12);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tailX - dirX * 8 - perpX * 5, tailY - dirY * 8 - perpY * 5);
        ctx.lineTo(tailX - dirX * 12, tailY - dirY * 12);
        ctx.closePath();
        ctx.fill();
    }
};

// Arrow weapon glyph for loadout badges
const ArrowWeaponVisuals = {
    /**
     * Draws arrow glyph for loadout badge
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} cx - Center X position
     * @param {number} cy - Center Y position
     * @param {number} size - Glyph size
     */
    drawArrowGlyph(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#111';
        ctx.fillStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Arrow shaft
        ctx.beginPath();
        ctx.moveTo(-size * 0.38, size * 0.18);
        ctx.lineTo(size * 0.35, -size * 0.18);
        ctx.stroke();
        
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(size * 0.35, -size * 0.18);
        ctx.lineTo(size * 0.16, -size * 0.22);
        ctx.lineTo(size * 0.23, -size * 0.03);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.ArrowVisuals = ArrowVisuals;
    window.ArrowWeaponVisuals = ArrowWeaponVisuals;
}

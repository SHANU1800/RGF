(function () {
    function getArrowCombatProfile(loadout) {
        const hasArrows = !!(loadout && loadout.arrows);
        return {
            canShoot: hasArrows,
            baseSpeedMultiplier: 1.0,
        };
    }

    function drawArrowGlyph(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#111';
        ctx.fillStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(-size * 0.38, size * 0.18);
        ctx.lineTo(size * 0.35, -size * 0.18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(size * 0.35, -size * 0.18);
        ctx.lineTo(size * 0.16, -size * 0.22);
        ctx.lineTo(size * 0.23, -size * 0.03);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    window.ArrowWeaponVisuals = {
        getArrowCombatProfile,
        drawArrowGlyph,
    };
})();

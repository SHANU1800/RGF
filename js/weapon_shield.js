(function () {
    function getShieldCombatProfile(loadout) {
        const active = !!(loadout && loadout.shield);
        return {
            active,
            moveSpeedMultiplier: active ? 0.88 : 1.0,
            incomingDamageMultiplier: active ? 0.72 : 1.0,
        };
    }

    function drawEquippedShield(ctx, player, w, h) {
        if (!player?.loadout?.shield) return;
        const dir = player.team === 'RED' ? 1 : -1;
        const sx = -dir * w * 0.26;
        const sy = h * 0.04;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = '#2f6ea4';
        ctx.strokeStyle = '#c8d8e6';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.17);
        ctx.lineTo(w * 0.15, -h * 0.05);
        ctx.lineTo(w * 0.11, h * 0.17);
        ctx.lineTo(-w * 0.11, h * 0.17);
        ctx.lineTo(-w * 0.15, -h * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    function drawShieldGlyph(ctx, cx, cy, size) {
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

    window.ShieldVisuals = {
        getShieldCombatProfile,
        drawEquippedShield,
        drawShieldGlyph,
    };
})();

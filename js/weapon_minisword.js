(function () {
    function getMiniSwordCombatProfile(loadout) {
        const active = !!(loadout && loadout.miniSword);
        return {
            active,
            moveSpeedMultiplier: active ? 1.12 : 1.0,
            drawPowerMultiplier: active ? 1.15 : 1.0,
            outgoingDamageMultiplier: active ? 1.04 : 1.0,
        };
    }

    function drawEquippedMiniSword(ctx, player, w, h) {
        if (!player?.loadout?.miniSword) return;
        const dir = player.team === 'RED' ? 1 : -1;
        const mx = dir * w * 0.16;
        const my = h * 0.25;
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(dir * 0.35);
        ctx.strokeStyle = '#d6dde0';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -h * 0.28);
        ctx.stroke();
        ctx.strokeStyle = '#6a4b2f';
        ctx.lineWidth = 3.8;
        ctx.beginPath();
        ctx.moveTo(-w * 0.08, 0);
        ctx.lineTo(w * 0.08, 0);
        ctx.stroke();
        ctx.restore();
    }

    function drawMiniSwordGlyph(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, size * 0.34);
        ctx.lineTo(0, -size * 0.25);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size * 0.14, size * 0.12);
        ctx.lineTo(size * 0.14, size * 0.12);
        ctx.stroke();
        ctx.restore();
    }

    window.MiniSwordVisuals = {
        getMiniSwordCombatProfile,
        drawEquippedMiniSword,
        drawMiniSwordGlyph,
    };
})();

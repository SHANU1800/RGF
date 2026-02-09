(function () {
    function getLongswordCombatProfile(loadout) {
        const active = !!(loadout && loadout.longsword);
        return {
            active,
            moveSpeedMultiplier: 1.0,
            outgoingDamageMultiplier: 1.0,
            arrowSpeedMultiplier: 1.0,
        };
    }

    function drawEquippedLongsword(ctx, player, w, h) {
        if (!player?.loadout?.longsword) return;
        const dir = player.team === 'RED' ? 1 : -1;
        ctx.save();
        ctx.rotate(dir * -0.6);
        ctx.strokeStyle = '#c9d2d6';
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(-w * 0.22, h * 0.18);
        ctx.lineTo(-w * 0.22, -h * 0.42);
        ctx.stroke();
        ctx.strokeStyle = '#4a3b2a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-w * 0.31, h * 0.16);
        ctx.lineTo(-w * 0.13, h * 0.16);
        ctx.stroke();
        ctx.restore();
    }

    function drawLongswordGlyph(ctx, cx, cy, size) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, size * 0.34);
        ctx.lineTo(0, -size * 0.36);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size * 0.2, size * 0.1);
        ctx.lineTo(size * 0.2, size * 0.1);
        ctx.stroke();
        ctx.restore();
    }

    window.LongswordVisuals = {
        getLongswordCombatProfile,
        drawEquippedLongsword,
        drawLongswordGlyph,
    };
})();

(function () {
    function getStyle(side) {
        if (side === 'RED') {
            return {
                wallFill: 'rgba(160, 106, 99, 0.48)',
                wallStroke: 'rgba(70, 35, 30, 0.65)',
                stairFill: 'rgba(124, 86, 78, 0.5)',
                stairStroke: 'rgba(52, 34, 29, 0.65)',
                ballistaWood: '#7b5232',
                ballistaMetal: '#d9d9d9',
            };
        }

        return {
            wallFill: 'rgba(107, 126, 161, 0.48)',
            wallStroke: 'rgba(38, 49, 73, 0.65)',
            stairFill: 'rgba(89, 108, 142, 0.5)',
            stairStroke: 'rgba(37, 50, 74, 0.65)',
            ballistaWood: '#6e5a42',
            ballistaMetal: '#e4edf9',
        };
    }

    function drawWallAndStairs(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, worldX, groundY, side) {
        const style = getStyle(side);
        const dir = side === 'RED' ? 1 : -1;
        const x = scaleX(worldX);
        const y = scaleY(groundY);
        const wallW = scaleLengthX(200);
        const wallH = scaleLengthY(320);

        ctx.save();

        ctx.fillStyle = style.wallFill;
        ctx.strokeStyle = style.wallStroke;
        ctx.lineWidth = 2;
        ctx.fillRect(x - wallW * 0.5, y - wallH, wallW, wallH);
        ctx.strokeRect(x - wallW * 0.5, y - wallH, wallW, wallH);

        const stairStartX = x + dir * wallW * 0.5;
        const stairBaseY = y;
        const stairCount = 8;
        const stairDepth = scaleLengthX(24);
        const stairRise = scaleLengthY(40);

        ctx.fillStyle = style.stairFill;
        ctx.strokeStyle = style.stairStroke;
        for (let i = 0; i < stairCount; i++) {
            const stepW = stairDepth * (i + 1);
            const stepH = stairRise;
            const stepX = dir > 0
                ? stairStartX
                : stairStartX - stepW;
            const stepY = stairBaseY - stepH * (i + 1);
            ctx.fillRect(stepX, stepY, stepW, stepH);
            ctx.strokeRect(stepX, stepY, stepW, stepH);
        }

        const ballistaBaseX = x + dir * wallW * 0.24;
        const ballistaBaseY = y - wallH - scaleLengthY(12);
        const ballistaUser = window.CastleRenderer
            ? window.CastleRenderer.getBallistaUser(side)
            : null;

        ctx.fillStyle = style.ballistaWood;
        ctx.fillRect(ballistaBaseX - dir * scaleLengthX(26), ballistaBaseY - scaleLengthY(12), scaleLengthX(52), scaleLengthY(12));

        ctx.strokeStyle = style.ballistaWood;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ballistaBaseX, ballistaBaseY - scaleLengthY(12));
        ctx.lineTo(ballistaBaseX + dir * scaleLengthX(64), ballistaBaseY - scaleLengthY(30));
        ctx.stroke();

        ctx.strokeStyle = style.ballistaMetal;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ballistaBaseX + dir * scaleLengthX(64), ballistaBaseY - scaleLengthY(30));
        ctx.lineTo(ballistaBaseX + dir * scaleLengthX(84), ballistaBaseY - scaleLengthY(24));
        ctx.moveTo(ballistaBaseX + dir * scaleLengthX(64), ballistaBaseY - scaleLengthY(30));
        ctx.lineTo(ballistaBaseX + dir * scaleLengthX(84), ballistaBaseY - scaleLengthY(36));
        ctx.stroke();

        if (ballistaUser != null) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
            ctx.beginPath();
            ctx.arc(ballistaBaseX, ballistaBaseY - scaleLengthY(30), scaleLengthX(8), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    window.CastleBodyRenderer = {
        drawWallAndStairs,
    };
})();

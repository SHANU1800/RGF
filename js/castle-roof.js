(function () {
    function getStyle(side) {
        if (side === 'RED') {
            return {
                roofFill: 'rgba(120, 66, 58, 0.72)',
                roofStroke: 'rgba(66, 35, 31, 0.7)',
            };
        }
        return {
            roofFill: 'rgba(79, 95, 123, 0.72)',
            roofStroke: 'rgba(43, 57, 82, 0.7)',
        };
    }

    function drawRoof(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, worldX, groundY, side) {
        const x = scaleX(worldX);
        const y = scaleY(groundY);
        const wallW = scaleLengthX(200);
        const wallH = scaleLengthY(320);
        const roofY = y - wallH;
        const roofThickness = scaleLengthY(16);
        const crenelH = scaleLengthY(18);
        const crenelW = wallW / 8;
        const style = getStyle(side);

        ctx.save();
        ctx.fillStyle = style.roofFill;
        ctx.strokeStyle = style.roofStroke;
        ctx.lineWidth = 2;
        ctx.fillRect(x - wallW * 0.5, roofY, wallW, roofThickness);
        ctx.strokeRect(x - wallW * 0.5, roofY, wallW, roofThickness);

        for (let i = 0; i < 8; i += 2) {
            const crenelX = x - wallW * 0.5 + i * crenelW;
            ctx.fillRect(crenelX, roofY - crenelH, crenelW, crenelH);
            ctx.strokeRect(crenelX, roofY - crenelH, crenelW, crenelH);
        }

        ctx.restore();
    }

    window.CastleRoofRenderer = {
        drawRoof,
    };
})();

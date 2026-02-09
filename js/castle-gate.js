(function () {
    function getStyle(side) {
        if (side === 'RED') {
            return {
                gateFill: '#3b2b1f',
                frame: 'rgba(80, 45, 38, 0.8)',
            };
        }
        return {
            gateFill: '#2d3647',
            frame: 'rgba(43, 57, 82, 0.8)',
        };
    }

    function drawGate(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, worldX, groundY, side, openness) {
        const x = scaleX(worldX);
        const y = scaleY(groundY);
        const wallW = scaleLengthX(200);
        const rightEdgeX = x + wallW * 0.5;
        const gateW = scaleLengthX(12);
        const gateDepth = scaleLengthX(18);
        const gateH = scaleLengthY(88);
        const lift = Math.max(0, Math.min(1, Number(openness || 0))) * gateH * 0.95;
        const topY = y - gateH - lift;
        const bottomY = y - lift;
        const style = getStyle(side);

        ctx.save();
        ctx.fillStyle = style.frame;
        ctx.fillRect(rightEdgeX - gateW, y - gateH - scaleLengthY(8), gateW + gateDepth + scaleLengthX(4), scaleLengthY(8));
        ctx.fillRect(rightEdgeX - gateW, y - gateH - scaleLengthY(8), gateW, gateH + scaleLengthY(8));
        ctx.fillRect(rightEdgeX + gateDepth, y - gateH - scaleLengthY(8), scaleLengthX(4), gateH + scaleLengthY(8));

        ctx.fillStyle = style.gateFill;
        ctx.fillRect(rightEdgeX - gateW * 0.5, topY, gateW, gateH);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(rightEdgeX + gateW * 0.5, topY);
        ctx.lineTo(rightEdgeX + gateW * 0.5 + gateDepth, topY + scaleLengthY(4));
        ctx.lineTo(rightEdgeX + gateW * 0.5 + gateDepth, bottomY + scaleLengthY(4));
        ctx.lineTo(rightEdgeX + gateW * 0.5, bottomY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= 2; i++) {
            const gx = rightEdgeX - gateW * 0.35 + i * gateW * 0.35;
            ctx.beginPath();
            ctx.moveTo(gx, bottomY - scaleLengthY(2));
            ctx.lineTo(gx, topY + scaleLengthY(2));
            ctx.stroke();
        }
        ctx.restore();
    }

    window.CastleGateRenderer = {
        drawGate,
    };
})();

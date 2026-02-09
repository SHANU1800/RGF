(function () {
    function teamPalette(team) {
        const isRed = team === 'RED';
        return {
            tip: isRed ? '#e74c3c' : '#3498db',
            feather: isRed ? '#ff9a8f' : '#9ed3ff',
            trail: isRed ? 'rgba(231,76,60,0.62)' : 'rgba(52,152,219,0.62)',
            shaft: '#b99367',
            shaftHighlight: '#ead7bd',
        };
    }

    function drawArrow(ctx, helpers, arrow) {
        const x = helpers.scaleX(arrow.x);
        const y = helpers.scaleY(arrow.y);
        const baseLength = Number(arrow.length || 42);
        const length = helpers.scaleLengthX(baseLength * 1.6);
        const palette = teamPalette(arrow.team);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(arrow.angle || 0);

        const speed = Math.hypot(arrow.vx || 0, arrow.vy || 0);
        const motion = Math.max(0, Math.min(1, speed / 900));
        const trailLen = length * (0.6 + motion * 1.0);
        const shaftWidth = 4.6;

        const trailGradient = ctx.createLinearGradient(-trailLen, 0, 0, 0);
        trailGradient.addColorStop(0, 'rgba(255,255,255,0)');
        trailGradient.addColorStop(1, palette.trail);
        ctx.strokeStyle = trailGradient;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-trailLen, 0);
        ctx.lineTo(-length * 0.18, 0);
        ctx.stroke();

        ctx.strokeStyle = palette.shaft;
        ctx.lineWidth = shaftWidth;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-length, 0);
        ctx.stroke();

        ctx.strokeStyle = palette.shaftHighlight;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-length * 0.06, -1.0);
        ctx.lineTo(-length * 0.94, -1.0);
        ctx.stroke();

        const tipLen = 18.5;
        const tipHalfHeight = 9.4;
        ctx.fillStyle = palette.tip;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-tipLen, -tipHalfHeight);
        ctx.lineTo(-tipLen, tipHalfHeight);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(20,20,20,0.48)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        const tail = -length + 4;
        ctx.fillStyle = palette.feather;
        ctx.beginPath();
        ctx.moveTo(tail, 0);
        ctx.lineTo(tail - 15, -8);
        ctx.lineTo(tail - 4.6, -2);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(tail, 0);
        ctx.lineTo(tail - 15, 8);
        ctx.lineTo(tail - 4.6, 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawNockedArrowPreview(ctx, payload) {
        const dirX = payload.dirX;
        const dirY = payload.dirY;
        const perpX = payload.perpX;
        const perpY = payload.perpY;
        const tailX = payload.tailX;
        const tailY = payload.tailY;
        const drawRatio = Math.max(0, Math.min(1, payload.drawRatio || 0));
        const h = payload.playerHeight || 80;
        const team = payload.team;
        const palette = teamPalette(team);

        const shaftLen = h * (0.44 + 0.22 * drawRatio);
        const tipX = tailX + dirX * shaftLen;
        const tipY = tailY + dirY * shaftLen;

        ctx.strokeStyle = palette.shaftHighlight;
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        ctx.strokeStyle = palette.shaft;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tailX + dirX * 2, tailY + dirY * 2);
        ctx.lineTo(tipX - dirX * 2, tipY - dirY * 2);
        ctx.stroke();

        ctx.fillStyle = palette.tip;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - dirX * 11 + perpX * 5.8, tipY - dirY * 11 + perpY * 5.8);
        ctx.lineTo(tipX - dirX * 11 - perpX * 5.8, tipY - dirY * 11 - perpY * 5.8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.feather;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tailX - dirX * 5 + perpX * 4.5, tailY - dirY * 5 + perpY * 4.5);
        ctx.lineTo(tailX - dirX * 1.5 + perpX * 1.1, tailY - dirY * 1.5 + perpY * 1.1);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(tailX - dirX * 5 - perpX * 4.5, tailY - dirY * 5 - perpY * 4.5);
        ctx.lineTo(tailX - dirX * 1.5 - perpX * 1.1, tailY - dirY * 1.5 - perpY * 1.1);
        ctx.closePath();
        ctx.fill();
    }

    const legacyArrowVisuals = {
        drawArrow,
        drawNockedArrowPreview,
    };

    if (!window.ArrowVisuals) {
        window.ArrowVisuals = legacyArrowVisuals;
    } else {
        window.LegacyArrowVisuals = legacyArrowVisuals;
    }
})();

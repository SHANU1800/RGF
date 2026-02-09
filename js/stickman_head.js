(function () {
    function drawHead(ctx, h) {
        const headRadius = h * 0.25;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(0, -h * 0.3, headRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawRagdollHead(ctx, headPart) {
        if (!headPart) return;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(headPart.x, headPart.y, headPart.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = Math.max(1, headPart.radius * 0.12);
        ctx.stroke();
    }

    window.StickmanHead = {
        drawHead,
        drawRagdollHead,
    };
})();

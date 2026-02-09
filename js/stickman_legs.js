(function () {
    function drawLegs(ctx, w, h, color, vx) {
        const speed = Math.abs(Number(vx || 0));
        const moving = speed > 8;
        const time = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.01;
        const strideRate = 0.06 + Math.min(0.14, speed / 1800);
        const swing = moving ? Math.sin(time * strideRate * 100) : 0;
        const hipY = h * 0.18;
        const strideX = w * (0.48 + Math.abs(swing) * 0.2);
        const legBaseY = h * 0.7;
        const lift = h * 0.1 * Math.max(0, -swing);

        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, hipY);
        ctx.lineTo(-strideX * (0.8 + swing * 0.2), legBaseY - lift);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, hipY);
        ctx.lineTo(strideX * (0.8 - swing * 0.2), legBaseY - (h * 0.1 * Math.max(0, swing)));
        ctx.stroke();
    }

    function drawLegChain(ctx, hip, upper, lower, color) {
        if (!hip || !upper || !lower) return;
        const widthBase = Math.max(upper.radius || 7, lower.radius || 7);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, widthBase * 0.85);
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(hip.x, hip.y);
        ctx.lineTo(upper.x, upper.y);
        ctx.lineTo(lower.x, lower.y);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(upper.x, upper.y, Math.max(1.8, (upper.radius || 7) * 0.35), 0, Math.PI * 2);
        ctx.fill();
    }

    function drawRagdollLegs(ctx, partsByType, color) {
        const pelvis = partsByType.pelvis;
        drawLegChain(ctx, pelvis, partsByType.lUpperLeg, partsByType.lLowerLeg, color);
        drawLegChain(ctx, pelvis, partsByType.rUpperLeg, partsByType.rLowerLeg, color);
    }

    window.StickmanLegs = {
        drawLegs,
        drawRagdollLegs,
    };
})();

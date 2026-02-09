(function () {
    function drawArms(ctx, h, aimAngle, color) {
        const armLength = h * 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.05);
        ctx.lineTo(Math.cos(aimAngle || 0) * armLength, Math.sin(aimAngle || 0) * armLength);
        ctx.stroke();
    }

    function drawArmChain(ctx, shoulder, upper, lower, color) {
        if (!shoulder || !upper || !lower) return;
        const widthBase = Math.max(upper.radius || 6, lower.radius || 6);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, widthBase * 0.75);
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(shoulder.x, shoulder.y);
        ctx.lineTo(upper.x, upper.y);
        ctx.lineTo(lower.x, lower.y);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(upper.x, upper.y, Math.max(1.5, (upper.radius || 6) * 0.35), 0, Math.PI * 2);
        ctx.fill();
    }

    function drawRagdollArms(ctx, partsByType, color) {
        const chest = partsByType.chest;
        drawArmChain(ctx, chest, partsByType.lUpperArm, partsByType.lLowerArm, color);
        drawArmChain(ctx, chest, partsByType.rUpperArm, partsByType.rLowerArm, color);
    }

    window.StickmanArms = {
        drawArms,
        drawRagdollArms,
    };
})();

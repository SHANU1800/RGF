(function () {
    function drawTorso(ctx, h, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.1);
        ctx.lineTo(0, h * 0.2);
        ctx.stroke();
    }

    function drawRagdollTorso(ctx, partsByType, color) {
        const head = partsByType.head;
        const chest = partsByType.chest;
        const pelvis = partsByType.pelvis;
        if (!chest || !pelvis) return;

        const widthBase = chest.radius || 8;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, widthBase * 0.7);
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(chest.x, chest.y);
        ctx.lineTo(pelvis.x, pelvis.y);
        ctx.stroke();

        if (head) {
            ctx.lineWidth = Math.max(2, widthBase * 0.45);
            ctx.beginPath();
            ctx.moveTo(chest.x, chest.y);
            ctx.lineTo(head.x, head.y);
            ctx.stroke();
        }
    }

    window.StickmanTorso = {
        drawTorso,
        drawRagdollTorso,
    };
})();

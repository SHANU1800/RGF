(function () {
    function normalizeAngle(angle) {
        let value = Number(angle || 0);
        const tau = Math.PI * 2;
        while (value > Math.PI) value -= tau;
        while (value < -Math.PI) value += tau;
        return value;
    }

    function screenToWorld(canvas, camera, event) {
        const rect = canvas.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width;
        const ny = (event.clientY - rect.top) / rect.height;
        const viewW = CONFIG.CAMERA_VIEW_WIDTH || 1600;
        const viewH = CONFIG.CAMERA_VIEW_HEIGHT || 900;
        return {
            x: Number(camera.x || 0) + nx * viewW,
            y: Number(camera.y || 0) + ny * viewH,
        };
    }

    function calculateDragShot(playerCenter, dragCurrent, minDistance) {
        const dx = playerCenter.x - dragCurrent.x;
        const dy = playerCenter.y - dragCurrent.y;
        const distance = Math.hypot(dx, dy);
        const min = Number(minDistance || 20);
        if (distance <= min) {
            return { canShoot: false, power: 0, angle: 0, distance };
        }

        return {
            canShoot: true,
            power: Math.min(distance / 2, 100),
            angle: Math.atan2(dy, dx),
            distance,
        };
    }

    function calculateJoystickVector(startScreen, currentScreen, radius, deadzone) {
        const dx = Number(currentScreen.x || 0) - Number(startScreen.x || 0);
        const dy = Number(currentScreen.y || 0) - Number(startScreen.y || 0);
        const maxRadius = Math.max(1, Number(radius || 1));
        const distance = Math.hypot(dx, dy);
        const clampedDistance = Math.min(distance, maxRadius);
        const normalizedDistance = clampedDistance / maxRadius;
        const minDeadzone = Math.max(0, Math.min(0.95, Number(deadzone || 0)));

        let nx = 0;
        let ny = 0;
        if (distance > 0.0001 && normalizedDistance > minDeadzone) {
            const strength = (normalizedDistance - minDeadzone) / (1 - minDeadzone);
            const ux = dx / distance;
            const uy = dy / distance;
            nx = ux * strength;
            ny = uy * strength;
        }

        return {
            dx,
            dy,
            distance,
            clampedDistance,
            normalizedX: nx,
            normalizedY: ny,
            strength: Math.hypot(nx, ny),
        };
    }

    function applyBowAimAssist(origin, rawAngle, candidates, options = {}) {
        const baseAngle = Number(rawAngle || 0);
        const source = origin || { x: 0, y: 0 };
        const list = Array.isArray(candidates) ? candidates : [];
        const maxRange = Math.max(1, Number(options.maxRange || 700));
        const assistCone = Math.max(0.02, Number(options.assistConeRad || 0.26));
        const maxCorrection = Math.max(0, Number(options.maxCorrectionRad || 0.11));
        const strength = Math.max(0, Math.min(1, Number(options.strength == null ? 1 : options.strength)));

        if (list.length === 0 || maxCorrection <= 0 || strength <= 0) {
            return {
                angle: baseAngle,
                assisted: false,
                correctionRad: 0,
                targetId: null,
            };
        }

        let best = null;
        for (const candidate of list) {
            if (!candidate) continue;
            const tx = Number(candidate.x);
            const ty = Number(candidate.y);
            if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;

            const dx = tx - Number(source.x || 0);
            const dy = ty - Number(source.y || 0);
            const distance = Math.hypot(dx, dy);
            if (distance < 8 || distance > maxRange) continue;

            const targetAngle = Math.atan2(dy, dx);
            const diff = normalizeAngle(targetAngle - baseAngle);
            const absDiff = Math.abs(diff);
            if (absDiff > assistCone) continue;

            const rangeWeight = 1 - (distance / maxRange);
            const coneWeight = 1 - (absDiff / assistCone);
            const score = (rangeWeight * 0.6) + (coneWeight * 0.4);

            if (!best || score > best.score) {
                best = {
                    score,
                    angle: targetAngle,
                    diff,
                    targetId: candidate.id == null ? null : candidate.id,
                };
            }
        }

        if (!best) {
            return {
                angle: baseAngle,
                assisted: false,
                correctionRad: 0,
                targetId: null,
            };
        }

        const boundedPull = Math.min(Math.abs(best.diff), maxCorrection);
        const weightedPull = boundedPull * Math.max(0, Math.min(1, best.score)) * strength;
        const correction = Math.sign(best.diff || 0) * weightedPull;

        return {
            angle: normalizeAngle(baseAngle + correction),
            assisted: Math.abs(correction) > 0.0005,
            correctionRad: correction,
            targetId: best.targetId,
        };
    }

    window.ControllerUtils = {
        screenToWorld,
        calculateDragShot,
        calculateJoystickVector,
        normalizeAngle,
        applyBowAimAssist,
    };
})();

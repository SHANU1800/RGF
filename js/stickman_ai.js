(function () {
    const memoryByPlayerId = new Map();

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function nowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    function centerOf(player) {
        return {
            x: Number(player.x || 0) + Number(player.width || 0) / 2,
            y: Number(player.y || 0) + Number(player.height || 0) / 2,
        };
    }

    function getMemory(selfPlayer, now) {
        const key = String(selfPlayer && selfPlayer.id != null ? selfPlayer.id : 'default');
        if (!memoryByPlayerId.has(key)) {
            memoryByPlayerId.set(key, {
                lastNow: now,
                targetId: null,
                nextTargetRefreshAt: 0,
                nextJumpAt: 0,
                nextSwordAttackAt: 0,
                nextArrowShotAt: 0,
                drawingBow: false,
                bowDrawStartedAt: 0,
                bowReleaseAfterMs: 0,
                stuckSince: 0,
                unstuckUntil: 0,
                unstuckDir: 0,
                lastPosX: Number(selfPlayer.x || 0),
                lastPosY: Number(selfPlayer.y || 0),
                lastMoveIntent: 0,
            });
        }
        return memoryByPlayerId.get(key);
    }

    function floorUnder(player, floors) {
        if (!player || !Array.isArray(floors)) return null;
        const bottom = Number(player.y || 0) + Number(player.height || 0);
        const cx = Number(player.x || 0) + Number(player.width || 0) / 2;
        let best = null;
        let bestGap = Number.POSITIVE_INFINITY;
        floors.forEach((floor) => {
            if (!floor) return;
            if (cx < Number(floor.x1) || cx > Number(floor.x2)) return;
            const gap = Math.abs(bottom - Number(floor.y));
            if (gap <= 28 && gap < bestGap) {
                best = floor;
                bestGap = gap;
            }
        });
        return best;
    }

    function chooseTarget(selfPlayer, players, memory, now) {
        if (!selfPlayer || !Array.isArray(players)) return null;
        const selfCenter = centerOf(selfPlayer);
        const hasBow = !!(selfPlayer.loadout && selfPlayer.loadout.arrows);
        const hasSword = !!(selfPlayer.loadout && selfPlayer.loadout.longsword);

        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;
        players.forEach((enemy) => {
            if (!enemy || enemy.id === selfPlayer.id || !enemy.alive || enemy.team === selfPlayer.team) return;
            const enemyCenter = centerOf(enemy);
            const dx = enemyCenter.x - selfCenter.x;
            const dy = enemyCenter.y - selfCenter.y;
            const dist = Math.hypot(dx, dy);
            const health = Number(enemy.health != null ? enemy.health : 100);
            const enemyHasSword = !!(enemy.loadout && enemy.loadout.longsword);
            const enemyHasBow = !!(enemy.loadout && enemy.loadout.arrows);

            let score = dist;
            score += Math.abs(dy) * 0.22;
            score += health * 1.1;
            if (enemyHasSword) score -= 95;
            if (enemyHasBow) score -= 45;
            if (hasBow) score += dist < 180 ? 160 : 0;
            if (hasSword) score += dist > 280 ? 55 : 0;
            if (memory.targetId === enemy.id) score -= 70;

            if (score < bestScore) {
                bestScore = score;
                best = enemy;
            }
        });

        if (best) {
            memory.targetId = best.id;
            memory.nextTargetRefreshAt = now + 230;
            return best;
        }

        memory.targetId = null;
        return null;
    }

    function getTarget(selfPlayer, players, memory, now) {
        if (!memory.targetId || now >= memory.nextTargetRefreshAt) {
            return chooseTarget(selfPlayer, players, memory, now);
        }
        const cached = players.find((p) => p && p.id === memory.targetId && p.alive && p.team !== selfPlayer.team);
        if (cached) return cached;
        return chooseTarget(selfPlayer, players, memory, now);
    }

    function findIncomingArrowThreat(selfPlayer, arrows) {
        if (!selfPlayer || !Array.isArray(arrows)) return null;
        const selfCenter = centerOf(selfPlayer);
        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;

        arrows.forEach((arrow) => {
            if (!arrow || arrow.team === selfPlayer.team) return;
            const vx = Number(arrow.vx || 0);
            const vy = Number(arrow.vy || 0);
            const speedSq = vx * vx + vy * vy;
            if (speedSq < 1) return;

            const rx = Number(arrow.x || 0) - selfCenter.x;
            const ry = Number(arrow.y || 0) - selfCenter.y;
            const dot = rx * vx + ry * vy;
            if (dot >= 0) return;

            const t = clamp(-(dot / speedSq), 0, 0.85);
            const nearX = Number(arrow.x || 0) + vx * t;
            const nearY = Number(arrow.y || 0) + vy * t;
            const dist = Math.hypot(nearX - selfCenter.x, nearY - selfCenter.y);
            const dangerRadius = Math.max(72, Number(selfPlayer.width || 40) * 1.8);
            if (dist > dangerRadius) return;
            const score = t * 1000 + dist;
            if (score < bestScore) {
                bestScore = score;
                best = { arrow, t, dist, nearX, nearY };
            }
        });

        return best;
    }

    function chooseSwordAttack(dx, dy, dist) {
        if (dist > 112 && Math.abs(dy) < 48) return 'pierce';
        if (dy < -34) return 'upper_slash';
        if (dy > 40) return 'lower_slash';
        return 'slash';
    }

    function computePathing(selfPlayer, enemy, floors, memory, now) {
        const selfCenter = centerOf(selfPlayer);
        const enemyCenter = centerOf(enemy);
        const dx = enemyCenter.x - selfCenter.x;
        const dy = enemyCenter.y - selfCenter.y;
        const dist = Math.hypot(dx, dy);
        const hasBow = !!(selfPlayer.loadout && selfPlayer.loadout.arrows);
        const hasSword = !!(selfPlayer.loadout && selfPlayer.loadout.longsword);
        const onGround = !!selfPlayer.onGround;

        let desiredX = enemyCenter.x;
        let jumpPressed = false;
        let sprint = false;

        if (hasBow && !hasSword) {
            const preferredMin = 280;
            const preferredMax = 520;
            desiredX = selfCenter.x;
            if (dist < preferredMin) {
                desiredX = selfCenter.x - Math.sign(dx || 1) * 240;
            } else if (dist > preferredMax) {
                desiredX = enemyCenter.x - Math.sign(dx || 1) * 160;
            }
            sprint = dist > 610 && Math.abs(dx) > 180 && Number(selfPlayer.stamina || 0) > 28;
        } else {
            desiredX = enemyCenter.x;
            sprint = dist > 190 && Math.abs(dx) > 140 && Number(selfPlayer.stamina || 0) > 34;
        }

        const selfFloor = floorUnder(selfPlayer, floors);
        const enemyFloor = floorUnder(enemy, floors);
        const enemyIsHigher = enemyFloor && selfFloor && Number(enemyFloor.y) < Number(selfFloor.y) - 30;
        const verticalGap = enemyCenter.y - selfCenter.y;
        if (
            onGround &&
            now >= memory.nextJumpAt &&
            (
                (enemyIsHigher && Math.abs(dx) < 130) ||
                (verticalGap < -90 && Math.abs(dx) < 160)
            )
        ) {
            jumpPressed = true;
            memory.nextJumpAt = now + 520;
        }

        const intentThreshold = 22;
        const moveIntent = (desiredX - selfCenter.x);
        const left = moveIntent < -intentThreshold;
        const right = moveIntent > intentThreshold;

        return { left, right, jumpPressed, sprint, dx, dy, dist };
    }

    function updateStuckRecovery(selfPlayer, movement, memory, now, dt) {
        const posX = Number(selfPlayer.x || 0);
        const posY = Number(selfPlayer.y || 0);
        const moved = Math.hypot(posX - memory.lastPosX, posY - memory.lastPosY);
        const wantsMove = Math.abs(movement.dx) > 65;
        const pushing = movement.left || movement.right;
        const grounded = !!selfPlayer.onGround;
        const elapsed = Math.max(0, Number(dt || 0));

        if (wantsMove && pushing && grounded && moved < 1.8) {
            if (!memory.stuckSince) memory.stuckSince = now;
        } else {
            memory.stuckSince = 0;
        }

        if (memory.stuckSince && (now - memory.stuckSince) > 820) {
            memory.unstuckUntil = now + 650;
            memory.unstuckDir = movement.dx >= 0 ? -1 : 1;
            memory.nextJumpAt = Math.min(memory.nextJumpAt || now, now);
            memory.stuckSince = 0;
        }

        memory.lastPosX = posX;
        memory.lastPosY = posY;
        memory.lastMoveIntent = movement.dx;
        memory.lastNow = now + elapsed * 1000;
    }

    function decideInput(selfPlayer, players, context) {
        if (!selfPlayer || !Array.isArray(players)) {
            return { left: false, right: false, jumpPressed: false, bowDrawn: false, drawPower: 0, shoot: false, aimAngle: 0 };
        }

        const now = Number(context && context.now) || nowMs();
        const dt = Number(context && context.dt) || 0;
        const memory = getMemory(selfPlayer, now);
        const floors = (context && context.config && Array.isArray(context.config.FLOORS))
            ? context.config.FLOORS
            : (typeof CONFIG !== 'undefined' && Array.isArray(CONFIG.FLOORS) ? CONFIG.FLOORS : []);
        const arrows = Array.isArray(context && context.arrows) ? context.arrows : [];
        const enemy = getTarget(selfPlayer, players, memory, now);

        if (!enemy) {
            return {
                left: false,
                right: false,
                jumpPressed: false,
                bowDrawn: false,
                drawPower: 0,
                shoot: false,
                aimAngle: Number(selfPlayer.aimAngle || 0),
                sprint: false,
                shieldBlock: false,
                shieldBlockAngle: Number(selfPlayer.aimAngle || 0),
                swordAttack: null,
            };
        }

        const pathing = computePathing(selfPlayer, enemy, floors, memory, now);
        updateStuckRecovery(selfPlayer, pathing, memory, now, dt);
        const hasBow = !!(selfPlayer.loadout && selfPlayer.loadout.arrows);
        const hasSword = !!(selfPlayer.loadout && selfPlayer.loadout.longsword);
        const hasShield = !!(selfPlayer.loadout && selfPlayer.loadout.shield);
        const threat = findIncomingArrowThreat(selfPlayer, arrows);
        const selfCenter = centerOf(selfPlayer);
        const enemyCenter = centerOf(enemy);
        const dx = enemyCenter.x - selfCenter.x;
        const dy = enemyCenter.y - selfCenter.y;
        const dist = Math.hypot(dx, dy);
        const aimAngle = Math.atan2(dy, dx);

        let left = pathing.left;
        let right = pathing.right;
        let jumpPressed = pathing.jumpPressed;
        let sprint = pathing.sprint;
        let bowDrawn = false;
        let drawPower = 0;
        let shoot = false;
        let shootAngle = aimAngle;
        let shootPower = 0;
        let swordAttack = null;
        let shieldBlock = false;
        let shieldBlockAngle = aimAngle;

        if (threat) {
            const arrow = threat.arrow;
            const evadeDir = Number(arrow.vx || 0) >= 0 ? -1 : 1;
            left = evadeDir < 0;
            right = evadeDir > 0;
            sprint = sprint || (Math.abs(arrow.vx || 0) > 280);
            if (Math.abs(Number(arrow.vx || 0)) > Math.abs(Number(arrow.vy || 0)) * 1.2 && now >= memory.nextJumpAt) {
                jumpPressed = true;
                memory.nextJumpAt = now + 430;
            }
            if (hasShield && hasSword) {
                shieldBlock = true;
                shieldBlockAngle = Math.atan2(Number(arrow.vy || 0), Number(arrow.vx || 0));
            }
            memory.drawingBow = false;
        }

        if (memory.unstuckUntil > now) {
            left = memory.unstuckDir < 0;
            right = memory.unstuckDir > 0;
            sprint = true;
            if (now >= memory.nextJumpAt) {
                jumpPressed = true;
                memory.nextJumpAt = now + 360;
            }
            memory.drawingBow = false;
        }

        if (hasBow && !hasSword && !threat && memory.unstuckUntil <= now) {
            const inFireRange = dist >= 160 && dist <= 940;
            const canBeginDraw = inFireRange && now >= memory.nextArrowShotAt;
            if (!memory.drawingBow && canBeginDraw) {
                memory.drawingBow = true;
                memory.bowDrawStartedAt = now;
                const targetDrawMs = clamp(250 + dist * 0.6, 260, 760);
                memory.bowReleaseAfterMs = targetDrawMs;
            }

            if (memory.drawingBow) {
                const elapsed = now - memory.bowDrawStartedAt;
                bowDrawn = true;
                drawPower = clamp(28 + (elapsed / Math.max(180, memory.bowReleaseAfterMs)) * 78, 20, 100);
                if (elapsed >= memory.bowReleaseAfterMs) {
                    bowDrawn = false;
                    shoot = true;
                    shootAngle = aimAngle;
                    shootPower = clamp(drawPower, 24, 100);
                    memory.nextArrowShotAt = now + clamp(300 + (100 - shootPower) * 5, 280, 760);
                    memory.drawingBow = false;
                }
            } else {
                drawPower = clamp(26 + dist * 0.08, 24, 76);
            }
        } else {
            memory.drawingBow = false;
        }

        if (hasSword) {
            const inMeleeRange = dist <= 132;
            const attackReady = now >= memory.nextSwordAttackAt;
            if (inMeleeRange && attackReady && memory.unstuckUntil <= now) {
                swordAttack = chooseSwordAttack(dx, dy, dist);
                memory.nextSwordAttackAt = now + clamp(320 + dist * 1.4, 320, 620);
            }
            if (hasShield && (threat || (dist > 165 && !!(enemy.loadout && enemy.loadout.arrows)))) {
                shieldBlock = true;
                shieldBlockAngle = aimAngle;
            }
        }

        return {
            left,
            right,
            jumpPressed,
            aimAngle,
            bowDrawn,
            drawPower,
            shoot,
            shootAngle,
            shootPower,
            swordAttack,
            sprint,
            shieldBlock,
            shieldBlockAngle,
        };
    }

    window.StickmanAI = {
        decideInput,
    };
})();

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

    function ensureTargetTrack(memory, targetId, now, center) {
        const key = String(targetId);
        if (!memory.targetTracks) {
            memory.targetTracks = new Map();
        }
        if (!memory.targetTracks.has(key)) {
            memory.targetTracks.set(key, {
                x: center.x,
                y: center.y,
                now,
                vx: 0,
                vy: 0,
            });
        }
        return memory.targetTracks.get(key);
    }

    function estimateTargetVelocity(memory, enemy, now) {
        if (!enemy) return { vx: 0, vy: 0 };
        const enemyCenter = centerOf(enemy);
        const track = ensureTargetTrack(memory, enemy.id, now, enemyCenter);
        const dtSec = Math.max(0.001, (now - Number(track.now || now)) / 1000);
        const rawVx = (enemyCenter.x - Number(track.x || enemyCenter.x)) / dtSec;
        const rawVy = (enemyCenter.y - Number(track.y || enemyCenter.y)) / dtSec;
        const smooth = clamp(dtSec * 8.0, 0.1, 0.65);
        track.vx = Number(track.vx || 0) + (rawVx - Number(track.vx || 0)) * smooth;
        track.vy = Number(track.vy || 0) + (rawVy - Number(track.vy || 0)) * smooth;
        track.x = enemyCenter.x;
        track.y = enemyCenter.y;
        track.now = now;
        return { vx: Number(track.vx || 0), vy: Number(track.vy || 0) };
    }

    function predictBowShot(selfPlayer, enemy, memory, context, now) {
        const selfCenter = centerOf(selfPlayer);
        const enemyCenter = centerOf(enemy);
        const vel = estimateTargetVelocity(memory, enemy, now);
        const dxNow = enemyCenter.x - selfCenter.x;
        const dyNow = enemyCenter.y - selfCenter.y;
        const dist = Math.hypot(dxNow, dyNow);

        const baseSpeed = Number((context && context.config && context.config.ARROW_SPEED) || (typeof CONFIG !== 'undefined' ? CONFIG.ARROW_SPEED : 900) || 900);
        const gravity = Number((context && context.config && context.config.ARROW_GRAVITY) || (typeof CONFIG !== 'undefined' ? CONFIG.ARROW_GRAVITY : 1200) || 1200);
        const speed = clamp(baseSpeed * clamp(0.6 + dist / 1100, 0.68, 1.0), 420, 1400);
        const travelTime = clamp(dist / Math.max(1, speed), 0.06, 1.15);

        const leadX = enemyCenter.x + vel.vx * travelTime;
        const leadY = enemyCenter.y + vel.vy * travelTime;
        const compensatedY = leadY - 0.5 * gravity * travelTime * travelTime * 0.72;
        const angle = Math.atan2(compensatedY - selfCenter.y, leadX - selfCenter.x);
        return {
            angle,
            dist,
            travelTime,
        };
    }

    function getMemory(selfPlayer, now) {
        const key = String(selfPlayer && selfPlayer.id != null ? selfPlayer.id : 'default');
        if (!memoryByPlayerId.has(key)) {
            memoryByPlayerId.set(key, {
                lastNow: now,
                targetId: null,
                nextTargetRefreshAt: 0,
                targetLockUntil: 0,
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
                strafeFlipAt: 0,
                strafeDir: 1,
                nextDefensiveJumpAt: 0,
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
            const lowHealth = Math.max(0, 100 - health);

            let score = dist;
            score += Math.abs(dy) * 0.22;
            score += health * 1.1;
            score -= lowHealth * 0.74;
            if (health <= 34) score -= 95;
            if (enemyHasSword) score -= 95;
            if (enemyHasBow) score -= 45;
            if (hasBow) score += dist < 180 ? 160 : 0;
            if (hasBow && enemyHasSword && dist < 230) score += 70;
            if (hasSword) score += dist > 280 ? 55 : 0;
            if (hasSword && enemyHasBow && dist < 220) score -= 55;
            if (memory.targetId === enemy.id) score -= 70;
            if (memory.targetId === enemy.id && now < Number(memory.targetLockUntil || 0)) score -= 120;

            if (score < bestScore) {
                bestScore = score;
                best = enemy;
            }
        });

        if (best) {
            memory.targetId = best.id;
            memory.nextTargetRefreshAt = now + 230;
            memory.targetLockUntil = now + 480;
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
        if (cached && now < Number(memory.targetLockUntil || 0)) return cached;
        if (cached && now < memory.nextTargetRefreshAt) return cached;
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

    function resolveCombatState(selfPlayer, enemy, dist, threat) {
        const health = Number(selfPlayer.health != null ? selfPlayer.health : 100);
        const stamina = Number(selfPlayer.stamina || 0);
        const enemyHealth = Number(enemy && enemy.health != null ? enemy.health : 100);
        const enemyHasSword = !!(enemy && enemy.loadout && enemy.loadout.longsword);
        const enemyHasBow = !!(enemy && enemy.loadout && enemy.loadout.arrows);
        const lowHealth = health <= 34;
        const lowStamina = stamina <= 18;
        const panic = !!threat || (enemyHasSword && dist < 215 && (lowHealth || lowStamina));
        const pressure = !panic && stamina >= 42 && health >= 56 && (enemyHealth <= 55 || (enemyHasBow && dist < 240));
        const survivalMode = lowHealth || lowStamina || (enemyHasSword && dist < 185);
        const meleeDanger = enemyHasSword && dist < 245;
        const kiteBias = (!!threat ? 1 : 0) + (meleeDanger ? 1 : 0) + (survivalMode ? 1 : 0);
        return {
            health,
            stamina,
            enemyHealth,
            enemyHasSword,
            enemyHasBow,
            lowHealth,
            lowStamina,
            panic,
            pressure,
            survivalMode,
            meleeDanger,
            kiteBias,
        };
    }

    function computePathing(selfPlayer, enemy, floors, memory, now, combatState) {
        const selfCenter = centerOf(selfPlayer);
        const enemyCenter = centerOf(enemy);
        const dx = enemyCenter.x - selfCenter.x;
        const dy = enemyCenter.y - selfCenter.y;
        const dist = Math.hypot(dx, dy);
        const hasBow = !!(selfPlayer.loadout && selfPlayer.loadout.arrows);
        const hasSword = !!(selfPlayer.loadout && selfPlayer.loadout.longsword);
        const onGround = !!selfPlayer.onGround;
        const stamina = combatState ? Number(combatState.stamina || 0) : Number(selfPlayer.stamina || 0);
        const jumpCost = Number((typeof CONFIG !== 'undefined' && CONFIG.STAMINA_JUMP_COST) || 24);
        const sprintStartThreshold = Number((typeof CONFIG !== 'undefined' && CONFIG.STAMINA_SPRINT_START_THRESHOLD) || 6);
        const panic = !!(combatState && combatState.panic);
        const pressure = !!(combatState && combatState.pressure);
        const enemyHasSword = !!(combatState && combatState.enemyHasSword);
        const survivalMode = !!(combatState && combatState.survivalMode);
        const kiteBias = Number((combatState && combatState.kiteBias) || 0);

        let desiredX = enemyCenter.x;
        let jumpPressed = false;
        let sprint = false;

        if (hasBow && !hasSword) {
            const preferredMin = panic ? 340 : (pressure ? 220 : 280);
            const preferredMax = panic ? 620 : (pressure ? 450 : 520);
            const spacingBoost = clamp(kiteBias * 36 + (survivalMode ? 54 : 0), 0, 180);
            desiredX = selfCenter.x;
            if (dist < preferredMin + spacingBoost) {
                desiredX = selfCenter.x - Math.sign(dx || 1) * (panic ? 340 : 250);
            } else if (dist > preferredMax + (survivalMode ? 30 : 0)) {
                desiredX = enemyCenter.x - Math.sign(dx || 1) * (pressure ? 130 : 160);
            }
            if (enemyHasSword && dist < 230) {
                desiredX = selfCenter.x - Math.sign(dx || 1) * (panic ? 390 : 320);
            }
            sprint = (panic && Math.abs(dx) > 120 && stamina > 22)
                || (dist > 610 && Math.abs(dx) > 180 && stamina > 28)
                || (survivalMode && Math.abs(dx) > 90 && stamina > 20);
        } else {
            const rushOffset = panic ? 130 : 0;
            desiredX = enemyCenter.x - Math.sign(dx || 1) * rushOffset;
            sprint = !panic && !survivalMode && dist > 190 && Math.abs(dx) > 140 && stamina > 34;
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
        if (jumpPressed && stamina < jumpCost * 0.9) {
            jumpPressed = false;
        }
        if (sprint && stamina <= sprintStartThreshold + 1.5) {
            sprint = false;
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

        const hasBow = !!(selfPlayer.loadout && selfPlayer.loadout.arrows);
        const hasSword = !!(selfPlayer.loadout && selfPlayer.loadout.longsword);
        const hasShield = !!(selfPlayer.loadout && selfPlayer.loadout.shield);
        const stamina = Number(selfPlayer.stamina || 0);
        const health = Number(selfPlayer.health != null ? selfPlayer.health : 100);
        const jumpCost = Number((typeof CONFIG !== 'undefined' && CONFIG.STAMINA_JUMP_COST) || 24);
        const heavyAttackCost = Number((typeof CONFIG !== 'undefined' && CONFIG.STAMINA_HEAVY_ATTACK_COST) || 30);
        const threat = findIncomingArrowThreat(selfPlayer, arrows);
        const combatState = resolveCombatState(selfPlayer, enemy, Math.hypot(
            (Number(enemy.x || 0) + Number(enemy.width || 0) / 2) - (Number(selfPlayer.x || 0) + Number(selfPlayer.width || 0) / 2),
            (Number(enemy.y || 0) + Number(enemy.height || 0) / 2) - (Number(selfPlayer.y || 0) + Number(selfPlayer.height || 0) / 2)
        ), threat);
        const pathing = computePathing(selfPlayer, enemy, floors, memory, now, combatState);
        updateStuckRecovery(selfPlayer, pathing, memory, now, dt);
        const selfCenter = centerOf(selfPlayer);
        const enemyCenter = centerOf(enemy);
        const dx = enemyCenter.x - selfCenter.x;
        const dy = enemyCenter.y - selfCenter.y;
        const dist = Math.hypot(dx, dy);
        const directAimAngle = Math.atan2(dy, dx);
        const predictedShot = predictBowShot(selfPlayer, enemy, memory, context, now);
        const aimAngle = hasBow ? predictedShot.angle : directAimAngle;
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

        if (hasBow && !hasSword && now >= Number(memory.strafeFlipAt || 0)) {
            const base = combatState.panic ? 160 : 260;
            const jitter = Math.floor(((now + Number(selfPlayer.id || 0) * 33) % 170));
            memory.strafeFlipAt = now + base + jitter;
            memory.strafeDir = Number(memory.strafeDir || 1) * -1;
        }
        if (hasBow && !hasSword && !combatState.panic && dist >= 220 && dist <= 560) {
            const strafe = Number(memory.strafeDir || 1);
            left = strafe < 0;
            right = strafe > 0;
        }

        if (hasBow && !hasSword && combatState.meleeDanger && dist < 290) {
            const retreatDir = dx >= 0 ? -1 : 1;
            left = retreatDir < 0;
            right = retreatDir > 0;
            sprint = sprint || stamina > 16;
            memory.drawingBow = false;
        }

        if (threat) {
            const arrow = threat.arrow;
            const evadeDir = Number(arrow.vx || 0) >= 0 ? -1 : 1;
            left = evadeDir < 0;
            right = evadeDir > 0;
            sprint = sprint || (Math.abs(arrow.vx || 0) > 280);
            if (
                Math.abs(Number(arrow.vx || 0)) > Math.abs(Number(arrow.vy || 0)) * 1.2
                && now >= memory.nextJumpAt
                && stamina >= jumpCost * 0.9
            ) {
                jumpPressed = true;
                memory.nextJumpAt = now + 430;
            }
            if (hasShield && hasSword) {
                shieldBlock = true;
                shieldBlockAngle = Math.atan2(-Number(arrow.vy || 0), -Number(arrow.vx || 0));
            }
            memory.drawingBow = false;
        }

        if (memory.unstuckUntil > now) {
            left = memory.unstuckDir < 0;
            right = memory.unstuckDir > 0;
            sprint = stamina > 8;
            if (now >= memory.nextJumpAt && stamina >= jumpCost * 0.9) {
                jumpPressed = true;
                memory.nextJumpAt = now + 360;
            }
            memory.drawingBow = false;
        }

        if (
            hasBow
            && !hasSword
            && combatState.survivalMode
            && combatState.enemyHasSword
            && dist < 190
            && Number(selfPlayer.onGround ? 1 : 0) === 1
            && now >= Number(memory.nextDefensiveJumpAt || 0)
            && stamina >= jumpCost * 0.95
        ) {
            jumpPressed = true;
            memory.nextDefensiveJumpAt = now + 520;
        }

        if (hasBow && !hasSword && !threat && memory.unstuckUntil <= now) {
            const panicDistance = combatState.panic ? 190 : 135;
            const inFireRange = dist >= 160 && dist <= 940;
            const shouldAbortDraw = dist < panicDistance
                || (combatState.lowStamina && dist < 260)
                || (combatState.meleeDanger && dist < 280);
            if (shouldAbortDraw) {
                memory.drawingBow = false;
            }
            const canBeginDraw = inFireRange && now >= memory.nextArrowShotAt;
            if (!memory.drawingBow && canBeginDraw) {
                memory.drawingBow = true;
                memory.bowDrawStartedAt = now;
                const targetDrawMs = clamp(
                    220 + dist * 0.62 + (combatState.lowHealth ? -35 : 0) + (combatState.lowStamina ? 55 : 0),
                    210,
                    840
                );
                memory.bowReleaseAfterMs = targetDrawMs;
            }

            if (memory.drawingBow) {
                const elapsed = now - memory.bowDrawStartedAt;
                bowDrawn = true;
                drawPower = clamp(28 + (elapsed / Math.max(180, memory.bowReleaseAfterMs)) * 78, 20, 100);
                if (elapsed >= memory.bowReleaseAfterMs) {
                    bowDrawn = false;
                    shoot = true;
                    shootAngle = predictedShot.angle;
                    shootPower = clamp(drawPower, 24, 100);
                    memory.nextArrowShotAt = now + clamp(280 + (100 - shootPower) * 5 + (combatState.panic ? 60 : 0), 260, 820);
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
            const attackThreshold = combatState.lowHealth ? 0.96 : 0.88;
            if (inMeleeRange && attackReady && memory.unstuckUntil <= now && stamina >= heavyAttackCost * attackThreshold) {
                swordAttack = chooseSwordAttack(dx, dy, dist);
                const recoveryBias = combatState.pressure ? -35 : (combatState.lowStamina ? 55 : 0);
                memory.nextSwordAttackAt = now + clamp(320 + dist * 1.4 + recoveryBias, 280, 690);
            }
            if (hasShield && (threat || (dist > 165 && !!(enemy.loadout && enemy.loadout.arrows)))) {
                shieldBlock = true;
                shieldBlockAngle = aimAngle;
            }
        }

        if (stamina <= 2 || health <= 6) {
            sprint = false;
            jumpPressed = false;
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

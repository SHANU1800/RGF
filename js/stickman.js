(function () {
    const TAU = Math.PI * 2;
    const DEFAULT_CONFIG = {
        skinColor: '#FFD700',
        lineWidth: 4,
        ragdollJointScale: 0.35,
        moveThreshold: 8,
        runThreshold: 300,
        runEnterThreshold: 250,
        runExitThreshold: 210,
        landTriggerVY: 180,
        moveAccelRate: 13,
        moveDecelRate: 8,
        jumpEnterHold: 0.07,
        landHoldDuration: 0.1,
        attackHoldDuration: 0.08,
        idleCadence: 0.85,
        walkCadence: 1.9,
        runCadence: 3.05,
        lowHealthTint: 'rgba(231, 76, 60, 0.26)',
    };

    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function smoothExp(current, target, rate, dt) {
        const t = 1 - Math.exp(-Math.max(0, rate) * Math.max(0, dt));
        return lerp(current, target, t);
    }

    function smoothStep01(t) {
        const c = clamp(t, 0, 1);
        return c * c * (3 - 2 * c);
    }

    function easeOutCubic(t) {
        const c = clamp(t, 0, 1);
        const r = 1 - c;
        return 1 - r * r * r;
    }

    function angleDelta(a, b) {
        const d = (a - b + Math.PI) % TAU;
        return (d < 0 ? d + TAU : d) - Math.PI;
    }

    function chain(ctx, points, color, width) {
        if (!Array.isArray(points) || points.length < 2) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    }

    function joint(ctx, x, y, radius, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawHead(ctx, h, cfg, pose) {
        const headRadius = h * 0.25;
        const lookX = clamp(Number(pose.lookX || 0), -1, 1);
        const lookY = clamp(Number(pose.lookY || 0), -1, 1);
        const flinch = clamp(Number(pose.flinch || 0), 0, 1);
        const death = clamp(Number(pose.death || 0), 0, 1);
        const tilt = Number(pose.headTilt || 0);

        ctx.save();
        ctx.translate(Number(pose.headX || 0), Number(pose.headY || 0));
        if (Math.abs(tilt) > 0.001) {
            ctx.rotate(tilt);
        }

        ctx.fillStyle = cfg.skinColor;
        ctx.beginPath();
        ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
        ctx.fill();

        const eyeSpread = headRadius * 0.38;
        const eyeY = -headRadius * 0.12 + lookY * headRadius * 0.13 + flinch * headRadius * 0.05;
        const eyeOffset = lookX * headRadius * 0.11;
        const eyeRadius = Math.max(1.1, headRadius * (0.098 - death * 0.05));
        ctx.lineWidth = Math.max(1, headRadius * 0.1);
        ctx.strokeStyle = '#111';
        ctx.fillStyle = '#111';

        if (death > 0.72) {
            const xSize = Math.max(1.4, headRadius * 0.11);
            [-1, 1].forEach((side) => {
                const ex = side * eyeSpread;
                const ey = eyeY + (side * lookX * headRadius * 0.04);
                ctx.beginPath();
                ctx.moveTo(ex - xSize + eyeOffset, ey - xSize);
                ctx.lineTo(ex + xSize + eyeOffset, ey + xSize);
                ctx.moveTo(ex - xSize + eyeOffset, ey + xSize);
                ctx.lineTo(ex + xSize + eyeOffset, ey - xSize);
                ctx.stroke();
            });
        } else {
            [-1, 1].forEach((side) => {
                ctx.beginPath();
                ctx.arc(side * eyeSpread + eyeOffset, eyeY, eyeRadius, 0, Math.PI * 2);
                ctx.fill();
            });
        }
        ctx.restore();
    }

    function drawTorso(ctx, h, color, cfg, healthRatio, pose) {
        chain(ctx, [
            { x: pose.shoulderX, y: pose.shoulderY },
            { x: pose.hipX, y: pose.hipY },
        ], color, cfg.lineWidth);

        const armorBreak = clamp(Number(pose.armorBreak || 0), 0, 1);
        const armorPulse = clamp(Number(pose.armorPulse || 0), 0, 1);
        if (armorBreak > 0.08) {
            const crackAlpha = clamp(0.2 + armorBreak * 0.42 + armorPulse * 0.2, 0.18, 0.72);
            const midX = (pose.shoulderX + pose.hipX) * 0.5;
            const midY = (pose.shoulderY + pose.hipY) * 0.5;
            const crackSpread = h * (0.038 + armorBreak * 0.03);
            const crackDrop = h * (0.048 + armorBreak * 0.04);
            ctx.strokeStyle = `rgba(255, 176, 104, ${crackAlpha})`;
            ctx.lineWidth = Math.max(1, cfg.lineWidth * (0.42 + armorBreak * 0.26));
            ctx.beginPath();
            ctx.moveTo(midX - crackSpread, midY - crackDrop * 0.82);
            ctx.lineTo(midX + crackSpread * 0.64, midY - crackDrop * 0.18);
            ctx.moveTo(midX + crackSpread * 0.18, midY - crackDrop * 0.1);
            ctx.lineTo(midX - crackSpread * 0.7, midY + crackDrop * 0.84);
            if (armorBreak > 0.5) {
                ctx.moveTo(midX - crackSpread * 0.2, midY - crackDrop * 0.95);
                ctx.lineTo(midX + crackSpread * 0.78, midY + crackDrop * 0.64);
            }
            ctx.stroke();
        }

        if (healthRatio < 0.35) {
            ctx.strokeStyle = cfg.lowHealthTint;
            ctx.lineWidth = cfg.lineWidth + 2;
            ctx.beginPath();
            ctx.moveTo(pose.shoulderX - h * 0.012, pose.shoulderY - h * 0.02);
            ctx.lineTo(pose.hipX + h * 0.012, pose.hipY + h * 0.02);
            ctx.stroke();
        }
    }

    function drawArms(ctx, color, cfg, pose) {
        chain(ctx, [pose.shoulder, pose.leadElbow, pose.leadHand], color, cfg.lineWidth);
        chain(ctx, [pose.shoulder, pose.offElbow, pose.offHand], color, Math.max(2, cfg.lineWidth - 0.4));

        joint(ctx, pose.leadElbow.x, pose.leadElbow.y, Math.max(1.4, cfg.lineWidth * 0.35), color);
        joint(ctx, pose.offElbow.x, pose.offElbow.y, Math.max(1.2, cfg.lineWidth * 0.3), color);
    }

    function drawLegs(ctx, color, cfg, pose) {
        chain(ctx, [pose.hip, pose.leftKnee, pose.leftFoot], color, cfg.lineWidth);
        chain(ctx, [pose.hip, pose.rightKnee, pose.rightFoot], color, cfg.lineWidth);
        joint(ctx, pose.leftKnee.x, pose.leftKnee.y, Math.max(1.5, cfg.lineWidth * 0.35), color);
        joint(ctx, pose.rightKnee.x, pose.rightKnee.y, Math.max(1.5, cfg.lineWidth * 0.35), color);
    }

    function ensureAnimState(player) {
        if (player._stickmanAnim) return player._stickmanAnim;
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        player._stickmanAnim = {
            lastTs: now,
            phase: 0,
            breathCycle: 0,
            moveSpeed: Number(Math.abs(player.vx || 0)),
            runGate: Number(Math.abs(player.vx || 0) >= DEFAULT_CONFIG.runEnterThreshold ? 1 : 0),
            jumpEnter: 0,
            jumpEnterHoldTimer: 0,
            landHoldTimer: 0,
            idle: 1,
            walk: 0,
            run: 0,
            crouch: 0,
            slide: 0,
            wallSlide: 0,
            ledgeGrab: 0,
            wallContactSide: 0,
            jump: 0,
            land: 0,
            aim: 0.2,
            spineTwist: 0,
            spineImpact: 0,
            attack: 0,
            attackPulse: 0,
            attackHoldTimer: 0,
            hitReact: 0,
            leftArmAim: 0.2,
            leftArmWeapon: 0.2,
            leftArmReact: 0,
            leftArmImpact: 0,
            mountedBlend: 0,
            mountedAimOffset: 0,
            dismountReact: 0,
            dismountDir: 0,
            rightLegGait: 0.2,
            rightLegTakeoff: 0,
            rightLegLanding: 0,
            rightLegStagger: 0,
            rightLegKnockback: 0,
            rightLegImpactHead: 0,
            rightLegImpactBody: 0,
            rightLegImpactFront: 0,
            rightLegImpactBack: 0,
            interactionLadder: 0,
            interactionGate: 0,
            interactionBallista: 0,
            interactionInterrupt: 0,
            armorBreak: 0,
            armorBreakPulse: 0,
            headRecoil: 0,
            headFlinchX: 0,
            headFlinchY: 0,
            prevOnGround: !!player.onGround,
            prevVX: Number(player.vx || 0),
            prevVY: Number(player.vy || 0),
            prevBowDrawn: !!player.bowDrawn,
            prevDrawPower: Number(player.drawPower || 0),
            prevHealth: Number(player.health || 100),
            prevAlive: player.alive !== false,
            prevArmorBreakStage: Number(player.armorBreakStage || 0),
            prevMounted: player.mountedHorseId != null,
            prevSwordPhase: String(player.swordPhase || 'idle'),
            prevSwordPhaseProgress: 0,
            lastAudioHitSignature: '',
            audioHookSeq: 0,
        };
        return player._stickmanAnim;
    }

    function phaseCrossedForward(prevPhase, nextPhase, targetPhase) {
        let prev = prevPhase % TAU;
        let next = nextPhase % TAU;
        let target = targetPhase % TAU;
        if (prev < 0) prev += TAU;
        if (next < 0) next += TAU;
        if (target < 0) target += TAU;
        if (next < prev) next += TAU;
        if (target <= prev) target += TAU;
        return target > prev && target <= next;
    }

    function queueAudioHook(player, anim, hook) {
        if (!player || !anim || !hook || typeof hook !== 'object') return;
        if (!Array.isArray(player._stickmanAudioHooks)) {
            player._stickmanAudioHooks = [];
        }
        anim.audioHookSeq = Number(anim.audioHookSeq || 0) + 1;
        player._stickmanAudioHooks.push({
            ...hook,
            seq: anim.audioHookSeq,
            at: Number(hook.at || (typeof performance !== 'undefined' ? performance.now() : Date.now())),
        });
        if (player._stickmanAudioHooks.length > 18) {
            player._stickmanAudioHooks = player._stickmanAudioHooks.slice(player._stickmanAudioHooks.length - 18);
        }
    }

    function updateAnimState(player, dt, cfg) {
        const anim = ensureAnimState(player);
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        let dtSec = Number(dt || 0);
        if (!(dtSec > 0)) {
            dtSec = clamp((now - anim.lastTs) / 1000, 1 / 240, 0.05);
        }
        anim.lastTs = now;

        const onGround = !!player.onGround;
        const onWall = !!player.onWall;
        const ledgeGrabbed = !!player.ledgeGrabbed;
        const wallSide = Number(player.wallSide || 0);
        const vx = Number(player.vx || 0);
        const vy = Number(player.vy || 0);
        const speed = Math.abs(vx);
        const moveRate = speed > anim.moveSpeed ? cfg.moveAccelRate : cfg.moveDecelRate;
        anim.moveSpeed = smoothExp(anim.moveSpeed, speed, moveRate, dtSec);

        const runEnter = Math.max(cfg.moveThreshold, Number(cfg.runEnterThreshold || cfg.runThreshold * 0.84));
        const runExit = Math.max(cfg.moveThreshold, Math.min(runEnter - 8, Number(cfg.runExitThreshold || cfg.runThreshold * 0.7)));
        if (anim.runGate > 0.5) {
            anim.runGate = anim.moveSpeed <= runExit ? 0 : 1;
        } else {
            anim.runGate = anim.moveSpeed >= runEnter ? 1 : 0;
        }

        const locomotion = clamp((anim.moveSpeed - cfg.moveThreshold) / (cfg.runThreshold - cfg.moveThreshold), 0, 1);
        const moveT = smoothStep01(locomotion);
        const runIntent = smoothStep01(clamp((anim.moveSpeed - runExit) / Math.max(1, runEnter - runExit), 0, 1));
        const locomotionGrounded = onGround && !onWall && !ledgeGrabbed;
        const runTargetRaw = locomotionGrounded ? clamp((anim.runGate ? 0.3 + runIntent * 0.7 : runIntent * 0.24) * moveT, 0, 1) : 0;
        const walkShape = (1 - Math.abs(moveT * 2 - 1));
        const walkTargetRaw = locomotionGrounded ? clamp(walkShape * (1 - runTargetRaw * 0.72), 0, 1) : 0;
        const idleTargetRaw = locomotionGrounded ? clamp(1 - moveT * 1.1, 0, 1) : 0;
        const groundTotal = Math.max(0.0001, idleTargetRaw + walkTargetRaw + runTargetRaw);
        const idleTarget = idleTargetRaw / groundTotal;
        const walkTarget = walkTargetRaw / groundTotal;
        const runTarget = runTargetRaw / groundTotal;

        anim.idle = smoothExp(anim.idle, idleTarget, idleTarget > anim.idle ? 8.2 : 6.4, dtSec);
        anim.walk = smoothExp(anim.walk, walkTarget, walkTarget > anim.walk ? 10.8 : 7.2, dtSec);
        anim.run = smoothExp(anim.run, runTarget, runTarget > anim.run ? 11.8 : 6.8, dtSec);
        const crouchTarget = onGround && (player.crouching || player.sliding) ? 1 : 0;
        anim.crouch = smoothExp(anim.crouch || 0, crouchTarget, crouchTarget > (anim.crouch || 0) ? 14 : 10, dtSec);
        const slideTarget = onGround && player.sliding ? 1 : 0;
        anim.slide = smoothExp(anim.slide || 0, slideTarget, slideTarget > (anim.slide || 0) ? 18 : 8.8, dtSec);
        const wallSlideTarget = onWall && !ledgeGrabbed ? 1 : 0;
        const ledgeGrabTarget = ledgeGrabbed ? 1 : 0;
        anim.wallSlide = smoothExp(anim.wallSlide || 0, wallSlideTarget, wallSlideTarget > (anim.wallSlide || 0) ? 18 : 8.8, dtSec);
        anim.ledgeGrab = smoothExp(anim.ledgeGrab || 0, ledgeGrabTarget, ledgeGrabTarget > (anim.ledgeGrab || 0) ? 18 : 9.4, dtSec);
        anim.wallContactSide = smoothExp(anim.wallContactSide || 0, wallSide, 13, dtSec);

        if (anim.prevOnGround && !onGround) {
            anim.jumpEnter = Math.max(anim.jumpEnter, clamp((-vy - 70) / 420 + 0.28, 0.2, 1));
            anim.jumpEnterHoldTimer = cfg.jumpEnterHold;
        }
        if (anim.jumpEnterHoldTimer > 0) {
            anim.jumpEnterHoldTimer = Math.max(0, anim.jumpEnterHoldTimer - dtSec);
        } else {
            anim.jumpEnter = smoothExp(anim.jumpEnter, 0, 11, dtSec);
        }
        const airborneRise = clamp((-vy - 40) / 620, 0, 1);
        const airborneFall = clamp((vy + 40) / 800, 0, 1);
        const jumpTarget = onGround || ledgeGrabbed
            ? 0
            : clamp(0.4 + airborneRise * 0.6 + airborneFall * 0.35 + anim.jumpEnter * 0.42, 0.32, 1);
        anim.jump = smoothExp(anim.jump, jumpTarget, onGround ? 12 : 8.2, dtSec);
        const rightGaitTarget = locomotionGrounded
            ? clamp(0.2 + anim.walk * 0.58 + anim.run * 0.92, 0, 1)
            : clamp(anim.jump * 0.46, 0, 1);
        anim.rightLegGait = smoothExp(anim.rightLegGait, rightGaitTarget, 9.5, dtSec);
        if (anim.prevOnGround && !onGround && vy < -55) {
            const takeoffImpulse = clamp((Math.abs(vy) - 55) / 420 + 0.2, 0, 1);
            anim.rightLegTakeoff = Math.max(anim.rightLegTakeoff, takeoffImpulse);
        }
        anim.rightLegTakeoff *= Math.exp(-dtSec * 10.8);

        if (!anim.prevOnGround && onGround && Math.abs(anim.prevVY) > cfg.landTriggerVY) {
            anim.land = 1;
            anim.landHoldTimer = cfg.landHoldDuration;
            const landingImpulse = clamp((Math.abs(anim.prevVY) - cfg.landTriggerVY) / 420 + 0.35, 0, 1);
            const rightLead = clamp(0.5 + Math.sin(anim.phase + Math.PI) * 0.5, 0, 1);
            anim.rightLegLanding = Math.max(anim.rightLegLanding, landingImpulse * (0.65 + rightLead * 0.35));
        }
        if (anim.landHoldTimer > 0) {
            anim.landHoldTimer = Math.max(0, anim.landHoldTimer - dtSec);
        } else {
            anim.land *= Math.exp(-dtSec * 8.1);
        }
        anim.rightLegLanding *= Math.exp(-dtSec * 11.4);

        const aimAngle = Number(player.aimAngle || 0);
        const loadout = player.loadout || {};
        const hasBow = !!loadout.arrows;
        const hasShield = !!loadout.shield;
        const hasLongsword = !!loadout.longsword;
        const mounted = player.mountedHorseId != null;
        const mountedTarget = mounted ? 1 : 0;
        anim.mountedBlend = smoothExp(anim.mountedBlend || 0, mountedTarget, mounted ? 12 : 8.5, dtSec);
        const aimDeltaNorm = clamp(Math.abs(angleDelta(aimAngle, -0.08)) / 1.35, 0, 1);
        const aimBias = hasBow ? 0.32 : 0.2;
        const aimTarget = clamp(aimBias + aimDeltaNorm * 0.82 + (player.bowDrawn ? 0.18 : 0), 0, 1);
        anim.aim = smoothExp(anim.aim, aimTarget, 8.5, dtSec);
        const mountedAimTarget = mounted
            ? (
                (hasBow ? -0.12 : -0.06)
                + clamp(Number(vy || 0) / 1800, -0.03, 0.04)
                - clamp(Math.sin(aimAngle) * 0.02, -0.02, 0.02)
            )
            : 0;
        anim.mountedAimOffset = smoothExp(anim.mountedAimOffset || 0, mountedAimTarget, mounted ? 14.5 : 8.2, dtSec);
        const aimTwistTarget = clamp(angleDelta(aimAngle, 0) / 1.25, -1, 1) * anim.aim;
        anim.spineTwist = smoothExp(anim.spineTwist, aimTwistTarget, 10.5, dtSec);

        const interactionHint = String(player.interactionHint || '').toLowerCase();
        const interactionHintUntil = Number(player.interactionHintUntil || 0);
        const interactionHintActive = interactionHint !== '' && interactionHintUntil > now - 16;
        const interactionInterruptUntil = Number(player.interactionHintInterruptUntil || 0);
        const interactionInterrupted = !!player.interactionInterrupted || interactionInterruptUntil > now;
        const interactionBusy =
            !onGround
            || !!player.sliding
            || !!player.bowDrawn
            || (!!player.swordPhase && player.swordPhase !== 'idle')
            || Number(player.swordReactionTimer || 0) > 0
            || player.alive === false;
        let ladderTarget =
            (interactionHintActive && interactionHint === 'ladder')
                ? 1
                : ((onWall || ledgeGrabbed) ? 0.9 : 0);
        let gateTarget = interactionHintActive && interactionHint === 'gate' ? 1 : 0;
        let ballistaTarget =
            (player.usingBallistaSide != null || (interactionHintActive && interactionHint === 'ballista'))
                ? 1
                : 0;
        if (interactionBusy || interactionInterrupted) {
            if ((anim.interactionLadder + anim.interactionGate + anim.interactionBallista) > 0.04) {
                anim.interactionInterrupt = Math.max(anim.interactionInterrupt || 0, 1);
            }
        }
        anim.interactionInterrupt = smoothExp(anim.interactionInterrupt || 0, 0, 8.8, dtSec);
        const interruptionBlend = smoothStep01(clamp(Number(anim.interactionInterrupt || 0), 0, 1));
        const allowedScale = 1 - interruptionBlend;
        ladderTarget *= allowedScale;
        gateTarget *= allowedScale;
        ballistaTarget *= allowedScale;
        anim.interactionLadder = smoothExp(
            anim.interactionLadder || 0,
            ladderTarget,
            ladderTarget > (anim.interactionLadder || 0) ? 14.5 : 7.6,
            dtSec
        );
        anim.interactionGate = smoothExp(
            anim.interactionGate || 0,
            gateTarget,
            gateTarget > (anim.interactionGate || 0) ? 17.5 : 8.8,
            dtSec
        );
        anim.interactionBallista = smoothExp(
            anim.interactionBallista || 0,
            ballistaTarget,
            ballistaTarget > (anim.interactionBallista || 0) ? 16 : 8.6,
            dtSec
        );

        const reactionTimer = Number(player.swordReactionTimer || 0);
        const reactionTarget = reactionTimer > 0 ? clamp(reactionTimer / 0.24, 0, 1) : 0;
        const reactionRate = reactionTarget > anim.hitReact ? 22 : 10;
        anim.hitReact = smoothExp(anim.hitReact, reactionTarget, reactionRate, dtSec);

        const releaseRatio = typeof player.bowReleaseRatio === 'function'
            ? clamp(Number(player.bowReleaseRatio(now) || 0), 0, 1)
            : 0;
        const recoilKickNorm = clamp(Number(player.bowRecoilKick || 0) / 0.32, 0, 1);
        const headRecoilTarget = releaseRatio * recoilKickNorm;
        const recoilRate = headRecoilTarget > anim.headRecoil ? 34 : 15;
        anim.headRecoil = smoothExp(anim.headRecoil, headRecoilTarget, recoilRate, dtSec);

        const healthNow = Number(player.health);
        const prevHealth = Number(anim.prevHealth);
        const damageTaken = Number.isFinite(healthNow) && Number.isFinite(prevHealth)
            ? Math.max(0, prevHealth - healthNow)
            : 0;
        if (damageTaken > 0.01) {
            const side = Number(player.vx || 0) >= 0 ? -1 : 1;
            const impulse = clamp(0.14 + damageTaken / 120, 0.12, 0.75);
            anim.headFlinchX = clamp(anim.headFlinchX + side * impulse, -1, 1);
            anim.headFlinchY = clamp(anim.headFlinchY + impulse * 0.9, 0, 1);
            const spineImpulse = clamp(0.22 + damageTaken / 80, 0.18, 1);
            anim.spineImpact = clamp(anim.spineImpact + side * spineImpulse, -1, 1);
            anim.leftArmImpact = clamp(anim.leftArmImpact + (0.22 + damageTaken / 65), 0, 1);
            anim.rightLegStagger = clamp(anim.rightLegStagger + (0.18 + damageTaken / 85), 0, 1);
        }
        if (reactionTarget > 0.02) {
            const side = Number(player.vx || 0) >= 0 ? -1 : 1;
            anim.headFlinchX = smoothExp(anim.headFlinchX, side * reactionTarget * 0.32, 20, dtSec);
            anim.headFlinchY = Math.max(anim.headFlinchY, reactionTarget * 0.4);
            anim.spineImpact = smoothExp(anim.spineImpact, side * reactionTarget * 0.55, 20, dtSec);
            anim.leftArmImpact = Math.max(anim.leftArmImpact, reactionTarget * 0.95);
            anim.rightLegStagger = Math.max(anim.rightLegStagger, reactionTarget * 0.9);
        }
        if (anim.prevMounted && !mounted) {
            const dismountDir = Number(player.facingDir || (Number(vx || 0) >= 0 ? 1 : -1)) >= 0 ? -1 : 1;
            const dismountImpact = clamp(0.48 + damageTaken / 55 + reactionTarget * 0.45, 0.46, 1.18);
            anim.dismountDir = dismountDir;
            anim.dismountReact = Math.max(anim.dismountReact || 0, dismountImpact);
        }
        const dismountReact = clamp(Number(anim.dismountReact || 0), 0, 1.4);
        if (dismountReact > 0.02) {
            const dismountEase = smoothStep01(clamp(dismountReact, 0, 1));
            const dismountDir = Number(anim.dismountDir || 0) !== 0 ? (anim.dismountDir >= 0 ? 1 : -1) : -1;
            anim.headFlinchX = smoothExp(anim.headFlinchX, dismountDir * dismountEase * 0.88, 24, dtSec);
            anim.headFlinchY = Math.max(anim.headFlinchY, dismountEase * 0.62);
            anim.spineImpact = smoothExp(anim.spineImpact, dismountDir * dismountEase * 1.05, 22, dtSec);
            anim.leftArmImpact = Math.max(anim.leftArmImpact, dismountEase * 0.9);
            anim.rightLegStagger = Math.max(anim.rightLegStagger, dismountEase * 0.98);
            anim.rightLegKnockback = smoothExp(anim.rightLegKnockback, dismountDir * dismountEase * 0.72, 18, dtSec);
        }
        anim.dismountReact = smoothExp(anim.dismountReact || 0, 0, 9.2, dtSec);

        const armorStage = Math.max(0, Math.min(3, Number(player.armorBreakStage || 0) | 0));
        const armorRatioInput = Number(player.armorBreakRatio);
        const armorRatio = Number.isFinite(armorRatioInput)
            ? clamp(armorRatioInput, 0, 1)
            : clamp(armorStage / 3, 0, 1);
        const armorTarget = clamp(armorRatio * 0.78 + (armorStage / 3) * 0.22, 0, 1);
        anim.armorBreak = smoothExp(anim.armorBreak || 0, armorTarget, armorTarget > (anim.armorBreak || 0) ? 12.5 : 5.4, dtSec);
        if (armorStage > Number(anim.prevArmorBreakStage || 0)) {
            anim.armorBreakPulse = 1;
        }
        anim.armorBreakPulse = smoothExp(anim.armorBreakPulse || 0, 0, 8.8, dtSec);

        const arrowHit = player.arrowHitReact && typeof player.arrowHitReact === 'object'
            ? player.arrowHitReact
            : null;
        if (arrowHit) {
            const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            const until = Number(arrowHit.until || 0);
            const active = until > nowMs;
            if (active) {
                const totalMs = Math.max(40, Number(arrowHit.durationMs || 220));
                const remaining = clamp((until - nowMs) / totalMs, 0, 1);
                const impactT = smoothStep01(remaining);
                const staggerUntil = Number(arrowHit.staggerUntil || until);
                const staggerMs = Math.max(40, Number(arrowHit.staggerMs || Math.min(140, totalMs)));
                const staggerRemaining = clamp((staggerUntil - nowMs) / staggerMs, 0, 1);
                const intensity = clamp(Number(arrowHit.intensity || 0.6), 0, 1.4);
                const dir = clamp(Number(arrowHit.dir || -1), -1, 1);
                const knockback = clamp(Number(arrowHit.knockback || 0), 0, 1.5);
                const pose = String(arrowHit.pose || 'stagger');
                const hitRegion = String(arrowHit.hitRegion || (pose === 'head' ? 'head' : 'body'));
                const hitSide = String(arrowHit.hitSide || 'front');
                const hitState = String(arrowHit.state || (pose === 'knockback' ? 'knockback' : 'stagger'));
                const hitSource = String(arrowHit.source || 'arrow');
                const hitSignature = `${Math.round(until)}|${hitSource}|${hitRegion}|${hitSide}|${hitState}`;
                if (hitSignature !== String(anim.lastAudioHitSignature || '')) {
                    queueAudioHook(player, anim, {
                        type: 'body_hit',
                        source: hitSource,
                        region: hitRegion,
                        side: hitSide,
                        state: hitState,
                        intensity,
                    });
                    anim.lastAudioHitSignature = hitSignature;
                }
                const sideScale = hitSide === 'back' ? 1.12 : 1.0;
                const directionalFlinch = hitSide === 'back' ? 0.92 : 0.74;

                anim.rightLegStagger = Math.max(
                    anim.rightLegStagger,
                    intensity * (0.32 + impactT * 0.34 + staggerRemaining * 0.7)
                );
                anim.rightLegKnockback = smoothExp(
                    anim.rightLegKnockback,
                    dir * knockback * (hitState === 'knockback' ? 1.0 : 0.68) * (0.64 + impactT * 0.56),
                    16,
                    dtSec
                );
                const headTarget = hitRegion === 'head' ? intensity : 0;
                const bodyTarget = hitRegion === 'body' ? intensity : (hitState === 'knockback' ? intensity * 0.65 : 0);
                anim.rightLegImpactHead = Math.max(anim.rightLegImpactHead, headTarget * (0.62 + impactT * 0.72));
                anim.rightLegImpactBody = Math.max(anim.rightLegImpactBody, bodyTarget * (0.5 + impactT * 0.5));
                anim.rightLegImpactFront = Math.max(
                    anim.rightLegImpactFront,
                    (hitSide === 'front' ? intensity : 0) * sideScale * (0.45 + impactT * 0.62)
                );
                anim.rightLegImpactBack = Math.max(
                    anim.rightLegImpactBack,
                    (hitSide === 'back' ? intensity : 0) * sideScale * (0.42 + impactT * 0.64)
                );
                anim.headFlinchX = smoothExp(anim.headFlinchX, dir * intensity * directionalFlinch, 24, dtSec);
                anim.spineImpact = smoothExp(anim.spineImpact, dir * intensity * (hitSide === 'back' ? 0.84 : 0.68), 21, dtSec);
                if (hitRegion === 'head') {
                    anim.headFlinchY = Math.max(anim.headFlinchY, intensity * (0.52 + impactT * 0.48));
                }
            }
        }
        const accelX = (vx - Number(anim.prevVX || 0)) / Math.max(1 / 240, dtSec);
        const abruptDecel =
            onGround &&
            Math.abs(accelX) > 1100 &&
            Math.abs(anim.prevVX || 0) > cfg.moveThreshold &&
            (vx * Number(anim.prevVX || 0) < 0 || Math.abs(vx) < Math.abs(Number(anim.prevVX || 0)) * 0.65);
        if (abruptDecel) {
            const decelImpulse = clamp((Math.abs(accelX) - 1100) / 2200, 0, 1) * 0.46;
            anim.rightLegStagger = Math.max(anim.rightLegStagger, decelImpulse);
        }
        anim.rightLegStagger = smoothExp(anim.rightLegStagger, 0, 8.2, dtSec);
        anim.rightLegKnockback = smoothExp(anim.rightLegKnockback, 0, 7.8, dtSec);
        anim.rightLegImpactHead = smoothExp(anim.rightLegImpactHead, 0, 7.2, dtSec);
        anim.rightLegImpactBody = smoothExp(anim.rightLegImpactBody, 0, 7.2, dtSec);
        anim.rightLegImpactFront = smoothExp(anim.rightLegImpactFront, 0, 7.4, dtSec);
        anim.rightLegImpactBack = smoothExp(anim.rightLegImpactBack, 0, 7.4, dtSec);
        anim.headFlinchX = smoothExp(anim.headFlinchX, 0, 9.5, dtSec);
        anim.headFlinchY *= Math.exp(-dtSec * 12.5);
        anim.spineImpact = smoothExp(anim.spineImpact, 0, 8.5, dtSec);
        anim.leftArmImpact *= Math.exp(-dtSec * 10.2);
        if (anim.prevAlive && player.alive === false) {
            anim.headFlinchY = 1;
            anim.headRecoil = Math.max(anim.headRecoil, 0.9);
            anim.spineImpact = Math.max(anim.spineImpact, 0.9);
            anim.leftArmImpact = Math.max(anim.leftArmImpact, 1);
            anim.rightLegStagger = Math.max(anim.rightLegStagger, 1);
            anim.rightLegKnockback = Math.max(anim.rightLegKnockback, 0.8);
            anim.rightLegImpactFront = Math.max(anim.rightLegImpactFront, 0.55);
            anim.rightLegImpactBack = Math.max(anim.rightLegImpactBack, 0.55);
        }

        let attackTarget = 0;
        const swordPhase = player.swordPhase || 'idle';
        const phaseTimer = Number(player.swordPhaseTimer || 0);
        const phaseDuration = Math.max(0.0001, Number(player.swordPhaseDuration || 0));
        if (swordPhase !== 'idle' && player.loadout && player.loadout.longsword) {
            const phaseProgress = clamp(1 - (phaseTimer / phaseDuration), 0, 1);
            if (swordPhase === 'windup') {
                attackTarget = 0.18 + phaseProgress * 0.52;
            } else if (swordPhase === 'active') {
                attackTarget = 1;
            } else if (swordPhase === 'recovery') {
                attackTarget = clamp(phaseTimer / phaseDuration, 0, 1) * 0.72;
            }
        } else {
            const swingUntil = Number(player.swordSwingUntil || 0);
            if (swingUntil > now) {
                const swingStart = Number(player.swordSwingStarted || (swingUntil - 180));
                const duration = Math.max(80, swingUntil - swingStart);
                const t = clamp((now - swingStart) / duration, 0, 1);
                attackTarget = Math.sin(t * Math.PI);
            }
        }
        if (anim.prevBowDrawn && !player.bowDrawn && anim.prevDrawPower > 20) {
            anim.attackPulse = Math.max(anim.attackPulse, clamp(anim.prevDrawPower / 100, 0.34, 1));
            queueAudioHook(player, anim, {
                type: 'bow_release',
                drawPower: Number(anim.prevDrawPower || 0),
                intensity: clamp(
                    Math.max(Number(player.bowReleasePower || 0), Number(anim.prevDrawPower || 0) / 100),
                    0.2,
                    1.4
                ),
                angle: Number(player.bowReleaseAngle || player.aimAngle || 0),
            });
        }
        anim.attackPulse *= Math.exp(-dtSec * 8.8);
        attackTarget = Math.max(attackTarget, anim.attackPulse);
        if (attackTarget > 0.25) {
            anim.attackHoldTimer = cfg.attackHoldDuration;
        }
        if (anim.attackHoldTimer > 0 && attackTarget < anim.attack * 0.8) {
            anim.attackHoldTimer = Math.max(0, anim.attackHoldTimer - dtSec);
            attackTarget = Math.max(attackTarget, anim.attack * 0.86);
        } else if (anim.attackHoldTimer > 0) {
            anim.attackHoldTimer = Math.max(0, anim.attackHoldTimer - dtSec);
        }
        const attackRate = attackTarget > anim.attack ? 20 : 8.6;
        anim.attack = smoothExp(anim.attack, attackTarget, attackRate, dtSec);
        if (swordPhase === 'active' && hasLongsword) {
            const swordAttack = String(player.swordAttack || player.swordSwingAttack || 'slash');
            const phaseProgress = clamp(1 - (phaseTimer / phaseDuration), 0, 1);
            const impactKeyMoment = ({
                slash: 0.43,
                upper_slash: 0.38,
                lower_slash: 0.46,
                pierce: 0.52,
            }[swordAttack] || 0.44);
            const prevSwordPhase = String(anim.prevSwordPhase || 'idle');
            const prevSwordProgress = clamp(Number(anim.prevSwordPhaseProgress || 0), 0, 1);
            const crossedKeyMoment = prevSwordPhase !== 'active'
                ? phaseProgress >= impactKeyMoment
                : (prevSwordProgress < impactKeyMoment && phaseProgress >= impactKeyMoment);
            if (crossedKeyMoment) {
                queueAudioHook(player, anim, {
                    type: 'blade_impact',
                    attack: swordAttack,
                    phaseProgress,
                    intensity: clamp(0.42 + phaseProgress * 0.9, 0.35, 1.45),
                });
            }
            anim.prevSwordPhaseProgress = phaseProgress;
        } else {
            anim.prevSwordPhaseProgress = 0;
        }

        const drawRatio = clamp(Number(player.drawPower || 0) / 100, 0, 1);
        const shieldBlocking = !!player.shieldBlocking;
        const leftAimTarget = clamp(
            anim.aim * (hasBow ? 1 : 0.38) +
            (player.bowDrawn ? 0.28 : 0) +
            (hasShield ? 0.16 : 0),
            0,
            1
        );
        const leftWeaponTarget = clamp(
            (hasShield ? (shieldBlocking ? 1 : 0.62) : 0) +
            (hasBow ? (0.34 + drawRatio * 0.66) : 0) +
            (hasLongsword ? (0.22 + anim.attack * 0.35) : 0),
            0,
            1
        );
        const armorGuardFatigue = clamp((anim.armorBreak || 0) * 0.3, 0, 0.3);
        const leftReactTarget = clamp(Math.max(anim.leftArmImpact, reactionTarget * 0.9), 0, 1);
        anim.leftArmAim = smoothExp(anim.leftArmAim, leftAimTarget, 10.5, dtSec);
        anim.leftArmWeapon = smoothExp(anim.leftArmWeapon, Math.max(0, leftWeaponTarget - armorGuardFatigue), 12, dtSec);
        anim.leftArmReact = smoothExp(anim.leftArmReact, leftReactTarget, leftReactTarget > anim.leftArmReact ? 20 : 10, dtSec);

        const prevPhase = anim.phase;
        const gait =
            cfg.idleCadence * anim.idle +
            cfg.walkCadence * anim.walk +
            cfg.runCadence * anim.run +
            anim.jump * 0.55;
        anim.phase = (anim.phase + dtSec * gait * TAU) % TAU;
        const breatheRate = 0.22 + anim.idle * 0.26 + anim.walk * 0.06;
        anim.breathCycle = (anim.breathCycle + dtSec * breatheRate * TAU) % TAU;

        const stepGrounded = onGround && !onWall && !ledgeGrabbed && !mounted;
        const stepActive = stepGrounded && anim.moveSpeed > (cfg.moveThreshold + 6) && !player.sliding;
        if (stepActive) {
            const footstepIntensity = clamp((anim.walk * 0.7 + anim.run * 1.2), 0.2, 1.5);
            if (phaseCrossedForward(prevPhase, anim.phase, 0)) {
                queueAudioHook(player, anim, {
                    type: 'footstep',
                    foot: 'right',
                    intensity: footstepIntensity,
                });
            }
            if (phaseCrossedForward(prevPhase, anim.phase, Math.PI)) {
                queueAudioHook(player, anim, {
                    type: 'footstep',
                    foot: 'left',
                    intensity: footstepIntensity,
                });
            }
        }

        anim.prevOnGround = onGround;
        anim.prevVX = vx;
        anim.prevVY = vy;
        anim.prevBowDrawn = !!player.bowDrawn;
        anim.prevDrawPower = Number(player.drawPower || 0);
        anim.prevHealth = Number.isFinite(healthNow) ? healthNow : anim.prevHealth;
        anim.prevAlive = player.alive !== false;
        anim.prevArmorBreakStage = armorStage;
        anim.prevMounted = mounted;
        anim.prevSwordPhase = swordPhase;
        return anim;
    }

    function computePose(data, anim) {
        const w = Number(data.w || 0);
        const h = Number(data.h || 0);
        const aimAngleBase = Number(data.aimAngle || 0);
        const mountedBlend = clamp(Number(anim.mountedBlend || 0), 0, 1);
        const mountedAimOffsetRaw = Number.isFinite(Number(data.mountedAimOffset))
            ? Number(data.mountedAimOffset)
            : Number(anim.mountedAimOffset || 0);
        const mountedAimOffset = mountedAimOffsetRaw * mountedBlend;
        const aimAngle = aimAngleBase + mountedAimOffset;
        const swing = Math.sin(anim.phase);
        const swingOpp = Math.sin(anim.phase + Math.PI);
        const bounce = Math.sin(anim.phase * 2);

        const mountStrideDampen = 1 - mountedBlend * 0.85;
        const stride = w * (0.14 + anim.walk * 0.2 + anim.run * 0.42) * mountStrideDampen;
        const crouchBlend = clamp(Number(anim.crouch || 0), 0, 1);
        const slideBlend = clamp(Number(anim.slide || 0), 0, 1);
        const wallSlideBlend = clamp(Number(anim.wallSlide || 0), 0, 1);
        const ledgeGrabBlend = clamp(Number(anim.ledgeGrab || 0), 0, 1);
        const ladderBlend = clamp(Number(anim.interactionLadder || 0), 0, 1);
        const gateBlend = clamp(Number(anim.interactionGate || 0), 0, 1);
        const ballistaBlend = clamp(Number(anim.interactionBallista || 0), 0, 1);
        const wallSide = clamp(Number(anim.wallContactSide || 0), -1, 1);
        const armorBreak = clamp(Number(anim.armorBreak || 0), 0, 1);
        const armorPulse = clamp(Number(anim.armorBreakPulse || 0), 0, 1);
        const stepLift = h * (0.03 + anim.walk * 0.07 + anim.run * 0.11) * (1 - crouchBlend * 0.45) * (1 - mountedBlend * 0.78);
        const torsoBob = h * (anim.walk * 0.02 + anim.run * 0.035) * Math.max(0, bounce) * (1 - crouchBlend * 0.42);
        const airLift = h * anim.jump * 0.08;
        const landCompress = h * smoothStep01(anim.land) * 0.09;
        const crouchDrop = h * (
            crouchBlend * 0.16
            + slideBlend * 0.06
            + wallSlideBlend * 0.02
            + armorBreak * 0.055
            + gateBlend * 0.045
            + ballistaBlend * 0.055
        );

        const torsoLeanMove = clamp(Number(data.vx || 0) / 900, -0.18, 0.18) * (anim.walk * 0.4 + anim.run * 0.9);
        const torsoLeanAir = !data.onGround ? clamp(Number(data.vy || 0) / 2200, -0.2, 0.22) : 0;
        const torsoLeanAim = Math.sin(aimAngle) * anim.aim * 0.05;
        const torsoLeanAttack = (anim.attack * 0.1) * (aimAngle >= 0 ? 1 : -1);
        const torsoLeanReact = clamp(-(Number(data.vx || 0) / 520), -0.12, 0.12) * anim.hitReact;
        const torsoImpactLean = anim.spineImpact * 0.19;
        const wallLean = -wallSide * wallSlideBlend * 0.22;
        const ledgeLean = wallSide * ledgeGrabBlend * 0.08;
        const armorSlouchLean = (Number(data.player && data.player.facingDir || 1) >= 0 ? 1 : -1) * armorBreak * 0.06;
        const ladderLean = wallSide * ladderBlend * 0.055;
        const gateLean = (Number(data.player && data.player.facingDir || 1) >= 0 ? 1 : -1) * gateBlend * 0.045;
        const ballistaLean = -((Number(data.player && data.player.facingDir || 1) >= 0 ? 1 : -1) * ballistaBlend * 0.08);
        const torsoLean =
            torsoLeanMove
            + torsoLeanAir
            + torsoLeanAim
            + torsoLeanAttack
            + torsoLeanReact
            + torsoImpactLean
            + wallLean
            + ledgeLean
            + armorSlouchLean
            + ladderLean
            + gateLean
            + ballistaLean;

        const breathWave = Math.sin(anim.breathCycle || 0);
        const breathAmplitude = h * (0.0045 + anim.idle * 0.011) * (1 - clamp(anim.walk + anim.run, 0, 1) * 0.55);
        const breathLift = breathWave * breathAmplitude;
        const spineTwistX = anim.spineTwist * h * 0.085;
        const spineImpactX = anim.spineImpact * h * 0.068;

        const mountSeatDrop = h * mountedBlend * 0.08;
        const shoulderY = -h * 0.11 + torsoBob - airLift + landCompress * 0.25 - breathLift + crouchDrop * 0.75 + mountSeatDrop;
        const hipY = h * 0.2 + torsoBob - airLift + landCompress + breathLift * 0.28 + crouchDrop + mountSeatDrop * 1.2;
        const shoulderX = -torsoLean * h * 0.26 + spineTwistX + spineImpactX;
        const hipX = torsoLean * h * 0.4 - spineTwistX * 0.58 - spineImpactX * 0.35;

        const thighLen = h * 0.24;
        const shinLen = h * 0.27;

        function leg(forwardSwing, forwardBias) {
            const forward = stride * (forwardSwing * 0.9 + forwardBias);
            const lift = stepLift * Math.max(0, Math.sin(anim.phase + forwardBias * Math.PI));
            const jumpTuck = h * anim.jump * 0.1;
            const crouchTuck = h * (crouchBlend * 0.11 + slideBlend * 0.05);
            const kneeX = hipX + forward * 0.5;
            const kneeY = hipY + thighLen - lift * 0.4 - jumpTuck * 0.5 - crouchTuck;
            const footX = hipX + forward;
            const footY = hipY + thighLen + shinLen - lift - jumpTuck + landCompress * 0.8 - crouchTuck * 0.35;
            return {
                knee: { x: kneeX, y: kneeY },
                foot: { x: footX, y: footY },
            };
        }

        const leftLeg = leg(swing, 0);
        const rightLeg = leg(swingOpp, 1);
        if (wallSlideBlend > 0.001) {
            const grabDir = wallSide !== 0 ? wallSide : (Number(data.player && data.player.wallSide || 0) || 1);
            leftLeg.knee.x += grabDir * h * wallSlideBlend * 0.06;
            rightLeg.knee.x += grabDir * h * wallSlideBlend * 0.05;
            leftLeg.foot.x += grabDir * h * wallSlideBlend * 0.075;
            rightLeg.foot.x += grabDir * h * wallSlideBlend * 0.07;
            leftLeg.knee.y += h * wallSlideBlend * 0.09;
            rightLeg.knee.y += h * wallSlideBlend * 0.07;
            leftLeg.foot.y += h * wallSlideBlend * 0.08;
            rightLeg.foot.y += h * wallSlideBlend * 0.07;
        }
        if (ledgeGrabBlend > 0.001) {
            const hangDir = wallSide !== 0 ? wallSide : (Number(data.player && data.player.ledgeSide || 0) || 1);
            leftLeg.knee.x -= hangDir * h * ledgeGrabBlend * 0.03;
            rightLeg.knee.x -= hangDir * h * ledgeGrabBlend * 0.04;
            leftLeg.foot.x -= hangDir * h * ledgeGrabBlend * 0.045;
            rightLeg.foot.x -= hangDir * h * ledgeGrabBlend * 0.058;
            leftLeg.knee.y += h * ledgeGrabBlend * 0.14;
            rightLeg.knee.y += h * ledgeGrabBlend * 0.14;
            leftLeg.foot.y += h * ledgeGrabBlend * 0.11;
            rightLeg.foot.y += h * ledgeGrabBlend * 0.11;
        }
        const rightGait = clamp(Number(anim.rightLegGait || 0), 0, 1);
        const rightTakeoff = clamp(Number(anim.rightLegTakeoff || 0), 0, 1);
        const rightLanding = smoothStep01(Number(anim.rightLegLanding || 0));
        const rightStagger = clamp(Number(anim.rightLegStagger || 0), 0, 1);
        const rightKnockback = clamp(Number(anim.rightLegKnockback || 0), -1.2, 1.2);
        const rightImpactHead = clamp(Number(anim.rightLegImpactHead || 0), 0, 1.2);
        const rightImpactBody = clamp(Number(anim.rightLegImpactBody || 0), 0, 1.2);
        const rightImpactFront = clamp(Number(anim.rightLegImpactFront || 0), 0, 1.2);
        const rightImpactBack = clamp(Number(anim.rightLegImpactBack || 0), 0, 1.2);
        const locomotionSign = Number(data.vx || 0) >= 0 ? 1 : -1;
        const facingSign = Number(data.player && data.player.facingDir != null ? data.player.facingDir : locomotionSign) >= 0 ? 1 : -1;
        const rightPhase = anim.phase + (locomotionSign > 0 ? Math.PI : 0);
        const rightStrideWave = Math.sin(rightPhase);
        const rightRecoverWave = Math.sin(rightPhase - Math.PI * 0.5);
        const rightPushDir = locomotionSign > 0 ? 1 : -1;
        rightLeg.knee.x += stride * rightGait * 0.08 * rightRecoverWave;
        rightLeg.knee.y += h * rightGait * (0.018 * Math.max(0, rightRecoverWave));
        rightLeg.foot.x += stride * rightGait * 0.14 * rightStrideWave;
        rightLeg.foot.y -= h * rightGait * (0.024 + 0.04 * Math.max(0, -rightStrideWave));
        rightLeg.knee.x += rightPushDir * h * rightTakeoff * 0.028;
        rightLeg.knee.y -= h * rightTakeoff * 0.048;
        rightLeg.foot.x += rightPushDir * h * rightTakeoff * 0.062;
        rightLeg.foot.y -= h * rightTakeoff * 0.072;
        rightLeg.knee.y += h * rightLanding * 0.082;
        rightLeg.foot.y += h * rightLanding * 0.044;
        rightLeg.foot.x -= rightPushDir * h * rightLanding * 0.024;
        const stumbleDir = locomotionSign > 0 ? -1 : 1;
        rightLeg.knee.x += stumbleDir * h * rightStagger * 0.05;
        rightLeg.knee.y += h * rightStagger * 0.042;
        rightLeg.foot.x += stumbleDir * h * rightStagger * 0.088;
        rightLeg.foot.y += h * rightStagger * 0.058;
        rightLeg.knee.x += stumbleDir * h * armorBreak * 0.032;
        rightLeg.foot.x += stumbleDir * h * armorBreak * 0.058;
        rightLeg.knee.y += h * armorBreak * 0.028;
        rightLeg.foot.y += h * armorBreak * 0.035;
        rightLeg.knee.x += rightKnockback * h * 0.052;
        rightLeg.foot.x += rightKnockback * h * 0.096;
        rightLeg.knee.y += h * rightImpactBody * 0.078;
        rightLeg.foot.y += h * rightImpactBody * 0.06;
        rightLeg.knee.x += h * rightImpactHead * 0.052 * (locomotionSign > 0 ? -1 : 1);
        rightLeg.foot.x += h * rightImpactHead * 0.095 * (locomotionSign > 0 ? -1 : 1);
        rightLeg.foot.y -= h * rightImpactHead * 0.088;
        rightLeg.knee.x -= facingSign * h * rightImpactFront * 0.055;
        rightLeg.foot.x -= facingSign * h * rightImpactFront * 0.1;
        rightLeg.knee.y += h * rightImpactFront * 0.05;
        rightLeg.foot.y += h * rightImpactFront * 0.038;
        rightLeg.knee.x += facingSign * h * rightImpactBack * 0.052;
        rightLeg.foot.x += facingSign * h * rightImpactBack * 0.094;
        rightLeg.foot.y -= h * rightImpactBack * 0.034;
        if (slideBlend > 0.001) {
            const slideDir = Number(data.player && data.player.slideDir != null ? data.player.slideDir : locomotionSign) >= 0 ? 1 : -1;
            rightLeg.knee.x += slideDir * h * slideBlend * 0.082;
            rightLeg.foot.x += slideDir * h * slideBlend * 0.15;
            rightLeg.knee.y += h * slideBlend * 0.065;
            rightLeg.foot.y -= h * slideBlend * 0.05;
            leftLeg.knee.x += slideDir * h * slideBlend * 0.038;
            leftLeg.foot.x -= slideDir * h * slideBlend * 0.078;
            leftLeg.knee.y += h * slideBlend * 0.082;
            leftLeg.foot.y += h * slideBlend * 0.035;
        }
        if (mountedBlend > 0.001) {
            const riderDir = Number(data.player && data.player.facingDir || 1) >= 0 ? 1 : -1;
            const kneeLift = h * mountedBlend * 0.12;
            const footLift = h * mountedBlend * 0.16;
            leftLeg.knee.x -= riderDir * h * mountedBlend * 0.055;
            rightLeg.knee.x += riderDir * h * mountedBlend * 0.045;
            leftLeg.foot.x -= riderDir * h * mountedBlend * 0.11;
            rightLeg.foot.x += riderDir * h * mountedBlend * 0.08;
            leftLeg.knee.y -= kneeLift;
            rightLeg.knee.y -= kneeLift * 0.92;
            leftLeg.foot.y -= footLift;
            rightLeg.foot.y -= footLift * 0.9;
        }
        if (ladderBlend > 0.001) {
            const climbWave = Math.sin(anim.phase * 1.5 + Math.PI * 0.2);
            const climbWaveOpp = Math.sin(anim.phase * 1.5 + Math.PI * 1.2);
            leftLeg.knee.y -= h * ladderBlend * (0.06 + Math.max(0, climbWave) * 0.06);
            rightLeg.knee.y -= h * ladderBlend * (0.06 + Math.max(0, climbWaveOpp) * 0.06);
            leftLeg.foot.y -= h * ladderBlend * (0.05 + Math.max(0, climbWave) * 0.04);
            rightLeg.foot.y -= h * ladderBlend * (0.05 + Math.max(0, climbWaveOpp) * 0.04);
            leftLeg.knee.x -= h * ladderBlend * 0.022;
            rightLeg.knee.x -= h * ladderBlend * 0.018;
            leftLeg.foot.x -= h * ladderBlend * 0.014;
            rightLeg.foot.x -= h * ladderBlend * 0.01;
        }
        if (gateBlend > 0.001) {
            const gateBrace = Math.sin(anim.phase * 2.1);
            leftLeg.knee.x -= h * gateBlend * 0.028;
            rightLeg.knee.x += h * gateBlend * 0.042;
            leftLeg.foot.x -= h * gateBlend * 0.054;
            rightLeg.foot.x += h * gateBlend * 0.088;
            leftLeg.knee.y += h * gateBlend * (0.04 + Math.max(0, gateBrace) * 0.012);
            rightLeg.knee.y += h * gateBlend * (0.045 + Math.max(0, -gateBrace) * 0.014);
        }
        if (ballistaBlend > 0.001) {
            const braceWave = Math.sin(anim.phase * 2.8);
            leftLeg.knee.x -= h * ballistaBlend * 0.046;
            rightLeg.knee.x += h * ballistaBlend * 0.05;
            leftLeg.foot.x -= h * ballistaBlend * 0.088;
            rightLeg.foot.x += h * ballistaBlend * 0.09;
            leftLeg.knee.y += h * ballistaBlend * (0.055 + Math.max(0, braceWave) * 0.02);
            rightLeg.knee.y += h * ballistaBlend * (0.055 + Math.max(0, -braceWave) * 0.02);
        }

        const shoulder = { x: shoulderX, y: shoulderY };
        const upperLen = h * 0.17;
        const lowerLen = h * 0.16;

        const attackSign = aimAngle >= 0 ? 1 : -1;
        const loadout = data.loadout || (data.player && data.player.loadout) || {};
        const drawRatio = clamp(Number(data.drawPower || 0) / 100, 0, 1);
        const shieldBlocking = !!data.shieldBlocking;
        const shieldBlockAngle = Number(data.shieldBlockAngle || aimAngle);
        const leftArmAim = clamp(Number(anim.leftArmAim || 0), 0, 1);
        const leftArmWeapon = clamp(Number(anim.leftArmWeapon || 0), 0, 1);
        const leftArmReact = clamp(Number(anim.leftArmReact || 0), 0, 1);
        const attackType = data.attackType || 'slash';
        const playerRef = data.player || {};
        const swordPhase = playerRef.swordPhase || 'idle';
        const swordPhaseTimer = Number(playerRef.swordPhaseTimer || 0);
        const swordPhaseDuration = Math.max(0.0001, Number(playerRef.swordPhaseDuration || 0));
        const attackBias =
            attackType === 'upper_slash' ? -0.25 :
            attackType === 'lower_slash' ? 0.2 :
            attackType === 'pierce' ? -0.06 : -0.12;
        const easedAttack = easeOutCubic(anim.attack);
        const swordPhaseProgress = clamp(1 - (swordPhaseTimer / swordPhaseDuration), 0, 1);
        let rightExec = easedAttack;
        if (loadout.longsword && swordPhase !== 'idle') {
            if (swordPhase === 'windup') {
                rightExec = Math.max(rightExec, smoothStep01(swordPhaseProgress) * 0.7);
            } else if (swordPhase === 'active') {
                rightExec = Math.max(rightExec, 1);
            }
        }
        const nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const releaseRatio = typeof playerRef.bowReleaseRatio === 'function'
            ? clamp(Number(playerRef.bowReleaseRatio(nowMs) || 0), 0, 1)
            : 0;
        const releaseKick = Math.pow(releaseRatio, 0.66);
        const releaseT = 1 - releaseRatio;
        const releaseSettle = smoothStep01(releaseT) * releaseKick;
        const recoveryT = (loadout.longsword && swordPhase === 'recovery') ? swordPhaseProgress : 0;
        const recoverySettle = Math.sin(smoothStep01(recoveryT) * Math.PI) * (1 - recoveryT);
        const rightArmMotion = clamp(
            rightExec + releaseKick * 0.46 - recoveryT * 0.18,
            0,
            1.18
        );
        const mountedArcScale = 1 + mountedBlend * (attackType === 'pierce' ? 0.26 : 0.42);
        const mountedArcBias = mountedBlend * (
            attackType === 'lower_slash' ? -0.08
                : (attackType === 'upper_slash' ? 0.12 : 0.06)
        ) * attackSign;
        const attackArc = rightArmMotion * (attackType === 'pierce' ? 0.26 : 0.56) * attackSign * mountedArcScale;
        const releaseArc = (releaseKick * 0.16 - releaseSettle * 0.1) * attackSign;
        const recoveryArc = -recoverySettle * 0.08 * attackSign;
        let leadAngle = aimAngle + mountedArcBias + attackArc + attackBias * rightArmMotion + releaseArc + recoveryArc;
        const offSwing = (anim.walk + anim.run * 1.25) * 0.7;
        let leftArmAngle = -0.45 + Math.sin(anim.phase + Math.PI * 0.25) * offSwing - anim.aim * 0.2 + anim.attack * 0.08;
        if (wallSlideBlend > 0.001 || ledgeGrabBlend > 0.001) {
            const gripDir = wallSide !== 0 ? wallSide : (Number(data.player && (data.player.wallSide || data.player.ledgeSide) || 0) || 1);
            const gripBlend = clamp(wallSlideBlend * 0.9 + ledgeGrabBlend, 0, 1);
            const wallGripAngle = gripDir > 0 ? -0.45 : -2.7;
            leftArmAngle = lerp(leftArmAngle, wallGripAngle, gripBlend);
            leadAngle = lerp(leadAngle, wallGripAngle + (gripDir > 0 ? 0.12 : -0.12), gripBlend * 0.86);
        }
        if (loadout.arrows) {
            const bowSupportBlend = clamp(leftArmAim * 0.82 + leftArmWeapon * 0.45, 0, 1);
            const drawStabilize = drawRatio * 0.18;
            leftArmAngle = lerp(leftArmAngle, aimAngle - 0.1 - drawStabilize, bowSupportBlend);
        }
        if (loadout.shield) {
            const shieldBlend = clamp(leftArmWeapon * (shieldBlocking ? 1 : 0.68), 0, 1);
            const guardDrop = armorBreak * (0.24 + armorPulse * 0.14);
            leftArmAngle = lerp(leftArmAngle, shieldBlockAngle - 0.14 + guardDrop, shieldBlend);
        } else if (loadout.longsword) {
            const supportBlend = clamp(0.2 + leftArmWeapon * 0.62 + anim.attack * 0.25, 0, 1);
            leftArmAngle = lerp(leftArmAngle, aimAngle - 0.56, supportBlend);
        }
        if (ladderBlend > 0.001) {
            const climbWave = Math.sin(anim.phase * 1.5 + Math.PI * 0.15);
            const climbWaveOpp = Math.sin(anim.phase * 1.5 + Math.PI);
            const ladderLeadAngle = -1.34 + Math.max(-0.3, Math.min(0.35, climbWave * 0.34));
            const ladderOffAngle = -1.18 + Math.max(-0.3, Math.min(0.35, climbWaveOpp * 0.32));
            leadAngle = lerp(leadAngle, ladderLeadAngle, ladderBlend);
            leftArmAngle = lerp(leftArmAngle, ladderOffAngle, ladderBlend);
        }
        if (gateBlend > 0.001) {
            const pushWave = Math.sin(anim.phase * 2.2);
            const pushLeadAngle = 0.06 + pushWave * 0.08;
            const pushOffAngle = 0.18 - pushWave * 0.06;
            leadAngle = lerp(leadAngle, pushLeadAngle, gateBlend);
            leftArmAngle = lerp(leftArmAngle, pushOffAngle, gateBlend);
        }
        if (ballistaBlend > 0.001) {
            const crankWave = Math.sin(anim.phase * 2.7);
            const ballistaLeadAngle = -0.08 + crankWave * 0.04;
            const ballistaOffAngle = -0.92 + crankWave * 0.34;
            leadAngle = lerp(leadAngle, ballistaLeadAngle, ballistaBlend);
            leftArmAngle = lerp(leftArmAngle, ballistaOffAngle, ballistaBlend);
        }
        leftArmAngle += leftArmReact * -0.25 * attackSign;

        function armFromAngle(base, angle, attackWeight, options) {
            const opts = options || {};
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            const perpX = -dirY;
            const perpY = dirX;
            const reach = Number(opts.reach || 1);
            const bendScale = Number(opts.bendScale || 1);
            const bendSign = Number(opts.bendSign || 1);
            const backPull = Number(opts.backPull || 0);
            const elbowBend = h * (0.04 + attackWeight * 0.035) * bendScale;
            const elbow = {
                x: base.x + dirX * upperLen * reach + perpX * elbowBend * bendSign - dirX * backPull,
                y: base.y + dirY * upperLen * reach + perpY * elbowBend * bendSign - dirY * backPull,
            };
            const hand = {
                x: elbow.x + dirX * lowerLen * reach - perpX * elbowBend * 0.42 * bendSign - dirX * backPull * 0.65,
                y: elbow.y + dirY * lowerLen * reach - perpY * elbowBend * 0.42 * bendSign - dirY * backPull * 0.65,
            };
            return { elbow, hand };
        }

        const rightReach = clamp(
            1 + rightExec * 0.14 + releaseKick * 0.1 - recoveryT * 0.08,
            0.84,
            1.3
        );
        const rightBend = clamp(
            1 - rightExec * 0.26 + releaseSettle * 0.24 + recoverySettle * 0.34,
            0.74,
            1.28
        );
        const rightBackPull = h * (releaseKick * 0.038 + recoverySettle * 0.03);
        const leadArm = armFromAngle(shoulder, leadAngle, rightArmMotion, {
            reach: rightReach,
            bendScale: rightBend,
            backPull: rightBackPull,
        });
        const leftArmReach = clamp(1 + leftArmAim * 0.16 + leftArmWeapon * 0.12 - leftArmReact * 0.3, 0.74, 1.28);
        const leftArmBend = clamp(1 + leftArmReact * 0.55, 0.9, 1.75);
        const leftBackPull = h * leftArmReact * (0.06 + (loadout.shield ? 0.045 : 0.025));
        const offArm = armFromAngle(shoulder, leftArmAngle, anim.walk + anim.run * 0.8, {
            reach: leftArmReach,
            bendScale: leftArmBend,
            bendSign: -1,
            backPull: leftBackPull,
        });
        const headLookX = clamp(Math.cos(aimAngle) * (0.32 + anim.aim * 0.58), -0.95, 0.95);
        const headLookY = clamp(Math.sin(aimAngle) * (0.22 + anim.aim * 0.45), -0.9, 0.9);
        const headRecoilX = anim.headRecoil * h * 0.08;
        const headRecoilY = anim.headRecoil * h * 0.035;
        const headFlinchX = anim.headFlinchX * h * 0.07;
        const headFlinchY = anim.headFlinchY * h * 0.1;
        const deathBlend = data.player && data.player.alive === false ? 1 : 0;
        const headTilt =
            torsoLean * 0.35 +
            headLookX * 0.08 -
            anim.headRecoil * 0.22 -
            anim.headFlinchX * 0.18 +
            deathBlend * 0.58;

        return {
            shoulderX,
            shoulderY,
            hipX,
            hipY,
            headX: shoulderX - torsoLean * h * 0.25 + headLookX * h * 0.045 - headRecoilX + headFlinchX,
            headY: -h * 0.33 + torsoBob * 0.6 - airLift * 0.7 + landCompress * 0.2 + headLookY * h * 0.03 + headRecoilY + headFlinchY + deathBlend * h * 0.03,
            headTilt,
            lookX: headLookX,
            lookY: headLookY,
            flinch: clamp(Math.abs(anim.headFlinchX) * 0.8 + anim.headFlinchY, 0, 1),
            armorBreak,
            armorPulse,
            death: deathBlend,
            shoulder,
            hip: { x: hipX, y: hipY },
            leftKnee: leftLeg.knee,
            leftFoot: leftLeg.foot,
            rightKnee: rightLeg.knee,
            rightFoot: rightLeg.foot,
            leadElbow: leadArm.elbow,
            leadHand: leadArm.hand,
            offElbow: offArm.elbow,
            offHand: offArm.hand,
        };
    }

    function drawRagdoll(ctx, partsByType, color, cfg, severed = null) {
        const severedMap = severed && typeof severed === 'object' ? severed : {};
        const isSevered = (type) => !!severedMap[type];
        const head = partsByType.head;
        const chest = partsByType.chest;
        const pelvis = partsByType.pelvis;

        if (chest && pelvis) {
            chain(ctx, [{ x: chest.x, y: chest.y }, { x: pelvis.x, y: pelvis.y }], color, Math.max(2, (chest.radius || 8) * 0.7));
            if (head) {
                chain(ctx, [{ x: chest.x, y: chest.y }, { x: head.x, y: head.y }], color, Math.max(2, (chest.radius || 8) * 0.45));
            }
        }

        function arm(side) {
            const upper = partsByType[`${side}UpperArm`];
            const lower = partsByType[`${side}LowerArm`];
            if (!upper || !lower) return;
            const widthBase = Math.max(upper.radius || 6, lower.radius || 6);
            const detached = isSevered(`${side}UpperArm`) || isSevered(`${side}LowerArm`);
            if (!detached && chest) {
                chain(ctx, [{ x: chest.x, y: chest.y }, { x: upper.x, y: upper.y }, { x: lower.x, y: lower.y }], color, Math.max(2, widthBase * 0.75));
            } else {
                chain(ctx, [{ x: upper.x, y: upper.y }, { x: lower.x, y: lower.y }], color, Math.max(2, widthBase * 0.75));
                ctx.fillStyle = 'rgba(156, 24, 24, 0.95)';
                ctx.beginPath();
                ctx.arc(upper.x, upper.y, Math.max(2.2, widthBase * 0.28), 0, Math.PI * 2);
                ctx.fill();
            }
            joint(ctx, upper.x, upper.y, Math.max(1.5, (upper.radius || 6) * cfg.ragdollJointScale), color);
        }

        function leg(side) {
            const upper = partsByType[`${side}UpperLeg`];
            const lower = partsByType[`${side}LowerLeg`];
            if (!upper || !lower) return;
            const widthBase = Math.max(upper.radius || 7, lower.radius || 7);
            const detached = isSevered(`${side}UpperLeg`) || isSevered(`${side}LowerLeg`);
            if (!detached && pelvis) {
                chain(ctx, [{ x: pelvis.x, y: pelvis.y }, { x: upper.x, y: upper.y }, { x: lower.x, y: lower.y }], color, Math.max(2, widthBase * 0.85));
            } else {
                chain(ctx, [{ x: upper.x, y: upper.y }, { x: lower.x, y: lower.y }], color, Math.max(2, widthBase * 0.85));
                ctx.fillStyle = 'rgba(156, 24, 24, 0.95)';
                ctx.beginPath();
                ctx.arc(upper.x, upper.y, Math.max(2.4, widthBase * 0.32), 0, Math.PI * 2);
                ctx.fill();
            }
            joint(ctx, upper.x, upper.y, Math.max(1.8, (upper.radius || 7) * cfg.ragdollJointScale), color);
        }

        arm('l');
        arm('r');
        leg('l');
        leg('r');

        if (head) {
            const neckDX = chest ? (head.x - chest.x) : 0;
            const neckDY = chest ? (head.y - chest.y) : Math.max(1, head.radius || 1);
            const roll = Math.atan2(neckDX, Math.max(0.001, Math.abs(neckDY))) * 0.9;
            const vx = Number(head.x - (head.prevX != null ? head.prevX : head.x));
            const vy = Number(head.y - (head.prevY != null ? head.prevY : head.y));
            const impact = clamp(Math.hypot(vx, vy) * 0.22, 0, 1);
            const eyeSpread = (head.radius || 0) * 0.38;
            const eyeY = -(head.radius || 0) * 0.12 + impact * (head.radius || 0) * 0.04;
            const xSize = Math.max(1, (head.radius || 0) * 0.12);

            ctx.save();
            ctx.translate(head.x, head.y);
            if (Math.abs(roll) > 0.001) {
                ctx.rotate(roll);
            }
            ctx.fillStyle = cfg.skinColor;
            ctx.beginPath();
            ctx.arc(0, 0, head.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#111';
            ctx.lineWidth = Math.max(1, (head.radius || 0) * 0.12);
            ctx.stroke();
            [-1, 1].forEach((side) => {
                const ex = side * eyeSpread;
                ctx.beginPath();
                ctx.moveTo(ex - xSize, eyeY - xSize);
                ctx.lineTo(ex + xSize, eyeY + xSize);
                ctx.moveTo(ex - xSize, eyeY + xSize);
                ctx.lineTo(ex + xSize, eyeY - xSize);
                ctx.stroke();
            });
            ctx.restore();
        }
    }

    const Stickman = {
        config: { ...DEFAULT_CONFIG },
        setConfig(next) {
            if (!next || typeof next !== 'object') return;
            this.config = { ...this.config, ...next };
        },
        update(player, dt) {
            if (!player) return;
            updateAnimState(player, dt, this.config);
        },
        animate(player, dt) {
            this.update(player, dt);
        },
        consumeAudioHooks(player, maxCount = Infinity) {
            if (!player || !Array.isArray(player._stickmanAudioHooks) || player._stickmanAudioHooks.length === 0) {
                return [];
            }
            const requested = Number(maxCount);
            const count = Number.isFinite(requested)
                ? Math.max(0, Math.floor(requested))
                : player._stickmanAudioHooks.length;
            if (count <= 0) return [];
            const hooks = player._stickmanAudioHooks.slice(0, count);
            player._stickmanAudioHooks = player._stickmanAudioHooks.slice(count);
            return hooks;
        },
        draw(ctx, data) {
            const cfg = this.config;
            const player = data.player || {};
            const anim = ensureAnimState(player);
            const pose = computePose(data, anim);
            drawHead(ctx, data.h, cfg, pose);
            drawTorso(ctx, data.h, data.color, cfg, data.healthRatio, pose);
            drawArms(ctx, data.color, cfg, pose);
            drawLegs(ctx, data.color, cfg, pose);
        },
        drawRagdoll(ctx, partsByType, color, options = {}) {
            drawRagdoll(ctx, partsByType, color, this.config, options.severed || null);
        },
    };

    window.Stickman = Stickman;

    // Backward-compat aliases.
    function drawRagdollTorsoCompat(ctx, partsByType, color) {
        const head = partsByType.head;
        const chest = partsByType.chest;
        const pelvis = partsByType.pelvis;
        if (!chest || !pelvis) return;
        const widthBase = chest.radius || 8;
        chain(ctx, [{ x: chest.x, y: chest.y }, { x: pelvis.x, y: pelvis.y }], color, Math.max(2, widthBase * 0.7));
        if (head) {
            chain(ctx, [{ x: chest.x, y: chest.y }, { x: head.x, y: head.y }], color, Math.max(2, widthBase * 0.45));
        }
    }

    function drawRagdollArmsCompat(ctx, partsByType, color) {
        const chest = partsByType.chest;
        const leftUpper = partsByType.lUpperArm;
        const leftLower = partsByType.lLowerArm;
        const rightUpper = partsByType.rUpperArm;
        const rightLower = partsByType.rLowerArm;
        if (chest && leftUpper && leftLower) {
            const widthBase = Math.max(leftUpper.radius || 6, leftLower.radius || 6);
            chain(ctx, [{ x: chest.x, y: chest.y }, { x: leftUpper.x, y: leftUpper.y }, { x: leftLower.x, y: leftLower.y }], color, Math.max(2, widthBase * 0.75));
            joint(ctx, leftUpper.x, leftUpper.y, Math.max(1.5, (leftUpper.radius || 6) * Stickman.config.ragdollJointScale), color);
        }
        if (chest && rightUpper && rightLower) {
            const widthBase = Math.max(rightUpper.radius || 6, rightLower.radius || 6);
            chain(ctx, [{ x: chest.x, y: chest.y }, { x: rightUpper.x, y: rightUpper.y }, { x: rightLower.x, y: rightLower.y }], color, Math.max(2, widthBase * 0.75));
            joint(ctx, rightUpper.x, rightUpper.y, Math.max(1.5, (rightUpper.radius || 6) * Stickman.config.ragdollJointScale), color);
        }
    }

    function drawRagdollLegsCompat(ctx, partsByType, color) {
        const pelvis = partsByType.pelvis;
        const leftUpper = partsByType.lUpperLeg;
        const leftLower = partsByType.lLowerLeg;
        const rightUpper = partsByType.rUpperLeg;
        const rightLower = partsByType.rLowerLeg;
        if (pelvis && leftUpper && leftLower) {
            const widthBase = Math.max(leftUpper.radius || 7, leftLower.radius || 7);
            chain(ctx, [{ x: pelvis.x, y: pelvis.y }, { x: leftUpper.x, y: leftUpper.y }, { x: leftLower.x, y: leftLower.y }], color, Math.max(2, widthBase * 0.85));
            joint(ctx, leftUpper.x, leftUpper.y, Math.max(1.8, (leftUpper.radius || 7) * Stickman.config.ragdollJointScale), color);
        }
        if (pelvis && rightUpper && rightLower) {
            const widthBase = Math.max(rightUpper.radius || 7, rightLower.radius || 7);
            chain(ctx, [{ x: pelvis.x, y: pelvis.y }, { x: rightUpper.x, y: rightUpper.y }, { x: rightLower.x, y: rightLower.y }], color, Math.max(2, widthBase * 0.85));
            joint(ctx, rightUpper.x, rightUpper.y, Math.max(1.8, (rightUpper.radius || 7) * Stickman.config.ragdollJointScale), color);
        }
    }

    window.StickmanHead = {
        drawHead: (ctx, h) => drawHead(ctx, h, Stickman.config, {
            headX: 0,
            headY: -h * 0.3,
        }),
        drawRagdollHead: (ctx, headPart) => {
            if (!headPart) return;
            ctx.fillStyle = Stickman.config.skinColor;
            ctx.beginPath();
            ctx.arc(headPart.x, headPart.y, headPart.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#111';
            ctx.lineWidth = Math.max(1, headPart.radius * 0.12);
            ctx.stroke();
        },
    };
    window.StickmanTorso = {
        drawTorso: (ctx, h, color) => drawTorso(ctx, h, color, Stickman.config, 1, {
            shoulderX: 0,
            shoulderY: -h * 0.1,
            hipX: 0,
            hipY: h * 0.2,
        }),
        drawRagdollTorso: drawRagdollTorsoCompat,
    };
    window.StickmanArms = {
        drawArms: (ctx, h, aimAngle, color) => {
            const shoulder = { x: 0, y: -h * 0.05 };
            const upper = h * 0.17;
            const lower = h * 0.16;
            const angle = Number(aimAngle || 0);
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            const elbow = { x: shoulder.x + dirX * upper, y: shoulder.y + dirY * upper };
            const hand = { x: elbow.x + dirX * lower, y: elbow.y + dirY * lower };
            drawArms(ctx, color, Stickman.config, {
                shoulder,
                leadElbow: elbow,
                leadHand: hand,
                offElbow: { x: -h * 0.08, y: h * 0.06 },
                offHand: { x: -h * 0.12, y: h * 0.16 },
            });
        },
        drawRagdollArms: drawRagdollArmsCompat,
    };
    window.StickmanLegs = {
        drawLegs: (ctx, w, h, color, vx) => {
            const stride = Math.max(0, Math.min(1, Math.abs(Number(vx || 0)) / Stickman.config.runThreshold));
            const hip = { x: 0, y: h * 0.2 };
            drawLegs(ctx, color, Stickman.config, {
                hip,
                leftKnee: { x: -w * (0.1 + stride * 0.2), y: h * 0.42 },
                leftFoot: { x: -w * (0.16 + stride * 0.32), y: h * 0.69 },
                rightKnee: { x: w * (0.1 + stride * 0.2), y: h * 0.42 },
                rightFoot: { x: w * (0.16 + stride * 0.32), y: h * 0.69 },
            });
        },
        drawRagdollLegs: drawRagdollLegsCompat,
    };
})();

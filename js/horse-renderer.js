/**
 * Horse Renderer Module
 * Handles rendering of horses that players can ride
 */

const HorseRenderer = {
    _animStateByHorseId: new Map(),
    _animStateByHorseRef: new WeakMap(),

    _getHorseAnimState(horse) {
        const createState = () => ({
            prevLift: [0, 0, 0, 0],
            prevGrounded: [false, false, false, false],
            lastContactAt: [-100, -100, -100, -100],
            particles: [],
            lastTime: null
        });
        if (horse && horse.id != null) {
            const horseKey = `id:${horse.id}`;
            let state = this._animStateByHorseId.get(horseKey);
            if (!state) {
                state = createState();
                this._animStateByHorseId.set(horseKey, state);
            }
            return state;
        }
        let state = this._animStateByHorseRef.get(horse);
        if (!state) {
            state = createState();
            this._animStateByHorseRef.set(horse, state);
        }
        return state;
    },

    _updateDustParticles(animState, dt) {
        if (!animState || !Array.isArray(animState.particles) || animState.particles.length === 0) return;
        const gravity = 190;
        for (let i = animState.particles.length - 1; i >= 0; i -= 1) {
            const p = animState.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                animState.particles.splice(i, 1);
                continue;
            }
            p.vy += gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.radius *= (1 - (dt * 0.95));
            if (p.radius < 0.35) {
                animState.particles.splice(i, 1);
            }
        }
    },

    _spawnHoofDust(animState, worldX, worldY, dir, speedNorm) {
        if (!animState || !Array.isArray(animState.particles)) return;
        const count = speedNorm > 0.72 ? 4 : 3;
        for (let i = 0; i < count; i += 1) {
            const scatter = (Math.random() - 0.5);
            animState.particles.push({
                x: worldX + (scatter * 8),
                y: worldY - (Math.random() * 3),
                vx: ((-dir * (26 + Math.random() * 22)) + (scatter * 34)) * (0.35 + speedNorm * 0.85),
                vy: -(18 + Math.random() * 42) * (0.4 + speedNorm * 0.75),
                life: 0.18 + (Math.random() * 0.16),
                maxLife: 0.34,
                radius: 1.2 + (Math.random() * 1.6)
            });
        }
        if (animState.particles.length > 90) {
            animState.particles.splice(0, animState.particles.length - 90);
        }
    },

    _renderDustParticles(ctx, scaleX, scaleY, particles) {
        if (!Array.isArray(particles) || particles.length === 0) return;
        ctx.save();
        for (let i = 0; i < particles.length; i += 1) {
            const p = particles[i];
            const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
            if (alpha <= 0) continue;
            ctx.globalAlpha = alpha * 0.32;
            ctx.fillStyle = '#b69a79';
            ctx.beginPath();
            ctx.arc(scaleX(p.x), scaleY(p.y), Math.max(0.35, p.radius), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    /**
     * Draws a horse
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleX - Function to scale X coordinates
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {Function} scaleLengthX - Function to scale X lengths
     * @param {Function} scaleLengthY - Function to scale Y lengths
     * @param {object} horse - Horse object with {x, y, width, height, facing, color}
     */
    drawHorse(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, horse) {
        const x = scaleX(horse.x);
        const y = scaleY(horse.y);
        const w = scaleLengthX(horse.width || 80);
        const h = scaleLengthY(horse.height || 60);
        const facing = horse.facing || 'right';
        const dir = facing === 'right' ? 1 : -1;
        const state = horse.state || 'idle';
        const stateTime = Number(horse.state_time || 0);
        const isDead = state === 'dead';
        const isJump = state === 'jump';
        const isEat = state === 'eat';
        const isWalk = state === 'walk';
        const isTrot = state === 'trot' || state === 'run';
        const isStop = state === 'stop';

        const speed = Math.abs(Number(horse.vx || 0));
        const speedNorm = Math.max(0, Math.min(1, speed / 260));
        const movingOnGround = !isDead && !isJump && !isEat && speed > 14;
        const speedBlend = movingOnGround ? Math.min(1, speed / 220) : 0;
        const stateBlend = isTrot ? 1 : (isWalk ? 0.48 : (isStop ? 0.2 : 0));
        const stopDecay = isStop ? Math.max(0, 1 - Math.min(1, stateTime * 5.8)) : 1;
        const gaitBlend = Math.max(0, Math.min(1, Math.max(stateBlend, speedBlend) * stopDecay));
        const animTime = (typeof performance !== 'undefined' ? performance.now() * 0.001 : stateTime);
        const animState = this._getHorseAnimState(horse);
        const dt = animState.lastTime == null
            ? (1 / 60)
            : Math.max(1 / 240, Math.min(0.06, animTime - animState.lastTime));
        animState.lastTime = animTime;
        this._updateDustParticles(animState, dt);
        const gaitPhaseSpeed = 4.0 + (gaitBlend * 7.0);
        const gaitPhase = (animTime * gaitPhaseSpeed) + (Number(horse.id || 0) * 0.63);
        const legSwing = Math.sin(gaitPhase) * (0.05 + gaitBlend * 0.95);
        const eatBlend = isEat ? Math.min(1, stateTime * 3.6) : 0;
        const jumpTuck = isJump ? 1 : 0;
        const deadRoll = isDead ? Math.min(1, stateTime * 1.8) : 0;
        const spineBob = Math.sin(gaitPhase * 2) * h * (0.004 + gaitBlend * 0.028);
        const headNod = Math.sin(gaitPhase + 0.5) * h * (0.006 + gaitBlend * 0.034);
        const headDrop = (h * 0.26 * eatBlend) + (h * 0.06 * jumpTuck) + headNod;
        const neckDrop = (h * 0.16 * eatBlend) + (h * 0.05 * jumpTuck) + (headNod * 0.45);
        const torsoCenterY = h * 0.02 + spineBob;
        const torsoRadiusY = h * 0.46;
        const torsoTopY = torsoCenterY - torsoRadiusY;
        const headTilt = (Math.sin(gaitPhase + 0.5) * (0.04 + gaitBlend * 0.05)) * dir;
        
        ctx.save();
        ctx.translate(x, y);
        if (isDead) {
            ctx.rotate(-0.95 * deadRoll);
            ctx.globalAlpha = 1 - (Math.min(1, Number(horse.death_timer || 0) / 2.4) * 0.2);
        }
        
        // Horse body color (brown by default)
        const bodyColor = horse.color || '#8B4513';
        const maneColor = '#3a2618';
        
        // Body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, torsoCenterY, w * 0.5, torsoRadiusY, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Neck
        ctx.beginPath();
        ctx.moveTo(dir * w * 0.35, torsoTopY + h * 0.18);
        ctx.lineTo(dir * w * 0.5, -h * 0.52 + neckDrop);
        ctx.lineTo(dir * w * 0.42, -h * 0.54 + neckDrop);
        ctx.lineTo(dir * w * 0.27, torsoTopY + h * 0.16);
        ctx.closePath();
        ctx.fill();
        
        // Head
        ctx.beginPath();
        ctx.ellipse(dir * w * 0.5, -h * 0.62 + headDrop, w * 0.15, h * 0.2, headTilt, 0, Math.PI * 2);
        ctx.fill();
        
        // Mane
        ctx.fillStyle = maneColor;
        ctx.beginPath();
        ctx.moveTo(dir * w * 0.42, -h * 0.52 + neckDrop);
        ctx.lineTo(dir * w * 0.45, -h * 0.58 + neckDrop);
        ctx.lineTo(dir * w * 0.38, -h * 0.56 + neckDrop);
        ctx.lineTo(dir * w * 0.4, -h * 0.5 + neckDrop);
        ctx.closePath();
        ctx.fill();
        
        // Ears
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(dir * w * 0.48, -h * 0.72 + headDrop);
        ctx.lineTo(dir * w * 0.45, -h * 0.8 + headDrop);
        ctx.lineTo(dir * w * 0.5, -h * 0.75 + headDrop);
        ctx.closePath();
        ctx.fill();
        
        // Eye
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(dir * w * 0.52, -h * 0.62 + headDrop, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Legs
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        const tuck = h * 0.22 * jumpTuck;
        const strideScale = movingOnGround
            ? (0.86 + (speedNorm * 0.56))
            : (0.82 + (gaitBlend * 0.2));
        const strideAmp = h * (0.015 + gaitBlend * 0.145) * strideScale;
        const liftAmp = h * (0.008 + gaitBlend * 0.067);
        const strideAt = (phase) => Math.sin(phase) + (Math.sin(phase * 2) * 0.28);
        const liftAt = (phase) => Math.max(0, -Math.cos(phase)) * liftAmp;
        const frontA = strideAt(gaitPhase + 0.08) * strideAmp;
        const frontB = strideAt(gaitPhase + Math.PI + 0.08) * strideAmp;
        const backA = strideAt(gaitPhase + Math.PI + 0.4) * strideAmp * 0.95;
        const backB = strideAt(gaitPhase + 0.4) * strideAmp * 0.95;
        const frontALift = liftAt(gaitPhase + 0.08);
        const frontBLift = liftAt(gaitPhase + Math.PI + 0.08);
        const backALift = liftAt(gaitPhase + Math.PI + 0.4);
        const backBLift = liftAt(gaitPhase + 0.4);
        const legTop = h * 0.32;
        const legBottomBase = h * 0.9 - tuck;
        const contactThreshold = liftAmp * 0.14;

        // Front legs
        ctx.beginPath();
        ctx.moveTo(dir * w * 0.25, legTop);
        ctx.lineTo(dir * w * 0.25 + frontA, legBottomBase - frontALift);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(dir * w * 0.35, legTop);
        ctx.lineTo(dir * w * 0.35 + frontB, legBottomBase - frontBLift);
        ctx.stroke();
        
        // Back legs
        ctx.beginPath();
        ctx.moveTo(dir * w * -0.25, legTop);
        ctx.lineTo(dir * w * -0.25 + backA, legBottomBase - backALift);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(dir * w * -0.35, legTop);
        ctx.lineTo(dir * w * -0.35 + backB, legBottomBase - backBLift);
        ctx.stroke();
        
        // Hooves
        ctx.fillStyle = '#2f2f2f';
        const hoofPositions = [
            [dir * w * 0.25 + frontA, legBottomBase - frontALift],
            [dir * w * 0.35 + frontB, legBottomBase - frontBLift],
            [dir * w * -0.25 + backA, legBottomBase - backALift],
            [dir * w * -0.35 + backB, legBottomBase - backBLift]
        ];
        const hoofLifts = [frontALift, frontBLift, backALift, backBLift];
        
        hoofPositions.forEach(([hx, hy]) => {
            ctx.fillRect(hx - 3, hy, 6, 4);
        });

        if (movingOnGround && !isDead && !isJump && !isEat) {
            const wWorld = Number(horse.width || 80);
            const hWorld = Number(horse.height || 60);
            const tuckWorld = hWorld * 0.22 * jumpTuck;
            const strideAmpWorld = hWorld * (0.015 + gaitBlend * 0.145) * strideScale;
            const liftAmpWorld = hWorld * (0.008 + gaitBlend * 0.067);
            const liftAtWorld = (phase) => Math.max(0, -Math.cos(phase)) * liftAmpWorld;
            const frontAWorld = strideAt(gaitPhase + 0.08) * strideAmpWorld;
            const frontBWorld = strideAt(gaitPhase + Math.PI + 0.08) * strideAmpWorld;
            const backAWorld = strideAt(gaitPhase + Math.PI + 0.4) * strideAmpWorld * 0.95;
            const backBWorld = strideAt(gaitPhase + 0.4) * strideAmpWorld * 0.95;
            const hoofWorldPositions = [
                [horse.x + (dir * wWorld * 0.25 + frontAWorld), horse.y + (hWorld * 0.9 - tuckWorld - liftAtWorld(gaitPhase + 0.08))],
                [horse.x + (dir * wWorld * 0.35 + frontBWorld), horse.y + (hWorld * 0.9 - tuckWorld - liftAtWorld(gaitPhase + Math.PI + 0.08))],
                [horse.x + (dir * -wWorld * 0.25 + backAWorld), horse.y + (hWorld * 0.9 - tuckWorld - liftAtWorld(gaitPhase + Math.PI + 0.4))],
                [horse.x + (dir * -wWorld * 0.35 + backBWorld), horse.y + (hWorld * 0.9 - tuckWorld - liftAtWorld(gaitPhase + 0.4))]
            ];
            for (let i = 0; i < hoofLifts.length; i += 1) {
                const wasGrounded = animState.prevGrounded[i];
                const wasLift = animState.prevLift[i];
                const liftNow = hoofLifts[i];
                const groundedNow = liftNow <= contactThreshold;
                const descendingIntoGround = wasLift > (liftNow + (liftAmp * 0.03));
                const contactCooldownOk = (animTime - animState.lastContactAt[i]) > 0.11;
                if (!wasGrounded && groundedNow && descendingIntoGround && contactCooldownOk) {
                    animState.lastContactAt[i] = animTime;
                    this._spawnHoofDust(
                        animState,
                        hoofWorldPositions[i][0],
                        hoofWorldPositions[i][1] + (hWorld * 0.025),
                        dir,
                        speedNorm
                    );
                }
                animState.prevGrounded[i] = groundedNow;
                animState.prevLift[i] = liftNow;
            }
        } else {
            for (let i = 0; i < animState.prevGrounded.length; i += 1) {
                animState.prevGrounded[i] = false;
                animState.prevLift[i] = hoofLifts[i] || 0;
            }
        }
        
        // Tail
        ctx.strokeStyle = maneColor;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(dir * w * -0.48, h * 0.05);
        ctx.quadraticCurveTo(dir * w * -0.6, h * (0.25 + legSwing * 0.05), dir * w * -0.55, h * 0.5);
        ctx.stroke();
        
        ctx.restore();
        this._renderDustParticles(ctx, scaleX, scaleY, animState.particles);
    },

    /**
     * Renders a horse mount
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleX - Function to scale X coordinates
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {Function} scaleLengthX - Function to scale X lengths
     * @param {Function} scaleLengthY - Function to scale Y lengths
     * @param {object} horse - Horse object
     */
    render(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, horse) {
        this.drawHorse(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, horse);
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.HorseRenderer = HorseRenderer;
}

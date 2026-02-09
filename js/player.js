class Player {
    constructor(id, nickname, team, isMe = false) {
        this.id = id;
        this.nickname = nickname;
        this.team = team;
        this.isMe = isMe;
        
        const center = CONFIG.GAME_WIDTH / 2;
        this.x = team === 'RED' ? center - 280 : center + 240;
        this.y = CONFIG.GROUND_Y - CONFIG.PLAYER_HEIGHT;
        this.width = CONFIG.PLAYER_WIDTH;
        this.height = CONFIG.PLAYER_HEIGHT;
        this.standingHeight = CONFIG.PLAYER_HEIGHT;
        this.crouchHeight = Number(CONFIG.CROUCH_HEIGHT || Math.round(CONFIG.PLAYER_HEIGHT * 0.7));
        
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.coyoteTimeMs = 0;
        this.jumpBufferMs = 0;
        
        this.health = 100;
        this.maxHealth = 100;
        this.maxStamina = Number(CONFIG.STAMINA_MAX || 100);
        this.stamina = this.maxStamina;
        this.staminaRegenBlockedUntil = 0;
        this.sprinting = false;
        this.alive = true;
        
        this.aimAngle = 0;
        this.bowDrawn = false;
        this.drawPower = 0;
        this.bowReleaseStartedAt = 0;
        this.bowReleaseUntil = 0;
        this.bowReleaseDurationMs = 0;
        this.bowReleasePower = 0;
        this.bowReleaseAngle = 0;
        this.bowRecoilKick = 0;
        this.loadout = {
            arrows: true,
            longsword: false,
            shield: false,
            miniSword: false
        };
        this.ragdollParts = null;
        this.ragdollLinks = null;
        this.ragdollState = null;
        this.ragdollQueuedImpact = null;
        this.ragdollSevered = null;
        this.ragdollQueuedSevers = [];
        this.facingDir = team === 'RED' ? 1 : -1;
        this.mountedHorseId = null;
        this.usingBallistaSide = null;
        this.swordPhase = 'idle';
        this.swordAttack = null;
        this.swordPhaseTimer = 0;
        this.swordPhaseDuration = 0;
        this.swordReactionTimer = 0;
        this.swordReactionAttack = null;
        this.shieldBlocking = false;
        this.shieldBlockAngle = 0;
        this.shieldBlockHitUntil = 0;
        this.armorBreakStage = 0;
        this.armorBreakRatio = 0;
        this.armorBreakPulseUntil = 0;
        this.arrowHitReact = null;
        this.crouching = false;
        this.sliding = false;
        this.slideTimer = 0;
        this.slideDir = team === 'RED' ? 1 : -1;
        this.slideRequested = false;
        this.onWall = false;
        this.wallSide = 0;
        this.wallJumpLock = 0;
        this.ledgeGrabbed = false;
        this.ledgeSide = 0;
        this.ledgeX = 0;
        this.ledgeY = 0;
        this.ledgeHangTimer = 0;
        
        this.color = team === 'RED' ? '#e74c3c' : '#3498db';
    }
    
    setLoadout(loadout) {
        const hasSword = !!(loadout && loadout.longsword);
        const hasShield = !!(loadout && loadout.shield);
        this.loadout = {
            ...this.loadout,
            arrows: !hasSword,
            longsword: hasSword,
            shield: hasSword ? hasShield : false,
            miniSword: false,
        };
    }
    
    update(input, dt) {
        if (!this.alive) {
            this.updateRagdoll(dt);
            return;
        }
        const step = dt || 0;
        const wasBowDrawn = !!this.bowDrawn;
        const prevDrawPower = Number(this.drawPower || 0);

        if (this.isMe && input) {
            const dtMs = step * 1000;
            const dir = (input.left ? -1 : 0) + (input.right ? 1 : 0);
            const wantsCrouch = !!input.crouch;
            const slidePressed = !!input.slidePressed;
            const jumpPressed = !!input.jumpPressed;
            const weaponMods = window.WeaponDynamics
                ? window.WeaponDynamics.aggregateModifiers(this.loadout)
                : null;
            const moveMultiplier = weaponMods ? weaponMods.moveSpeedMultiplier : 1.0;
            const blockRequestedRaw = !!(this.loadout && this.loadout.shield && input.shieldBlock);
            const blockMoveMultiplier = blockRequestedRaw ? 0.68 : 1.0;
            const effectiveMoveMultiplier = moveMultiplier * blockMoveMultiplier;
            const accel = (this.onGround ? CONFIG.MOVE_ACCEL : CONFIG.MOVE_ACCEL * CONFIG.AIR_CONTROL) * moveMultiplier;
            const decel = (this.onGround ? CONFIG.MOVE_DECEL : CONFIG.MOVE_DECEL * CONFIG.AIR_CONTROL) * moveMultiplier;
            const moveAxis = dir;
            const wantsSprint = !!input.sprint;
            const canStartSprint = this.stamina >= Number(CONFIG.STAMINA_SPRINT_START_THRESHOLD || 0);
            const canContinueSprint = this.stamina > 0;
            this.slideRequested = slidePressed;
            this.wallJumpLock = Math.max(0, Number(this.wallJumpLock || 0) - step);
            if (wantsSprint && moveAxis !== 0 && !blockRequestedRaw) {
                this.sprinting = this.sprinting ? canContinueSprint : canStartSprint;
            } else {
                this.sprinting = false;
            }
            if (this.crouching || this.sliding || wantsCrouch || this.onWall || this.ledgeGrabbed) {
                this.sprinting = false;
            }
            const sprintMoveMultiplier = this.sprinting ? Number(CONFIG.SPRINT_MOVE_MULTIPLIER || 1) : 1;
            const accelEffective = accel * blockMoveMultiplier;
            const decelEffective = decel * blockMoveMultiplier;
            const crouchMult = wantsCrouch ? Number(CONFIG.CROUCH_MOVE_MULTIPLIER || 0.58) : 1;
            const targetVx = dir * CONFIG.MOVE_SPEED * effectiveMoveMultiplier * sprintMoveMultiplier * crouchMult;

            if (
                this.onGround &&
                !this.sliding &&
                !this.onWall &&
                !this.ledgeGrabbed &&
                slidePressed &&
                Math.abs(this.vx) >= Number(CONFIG.SLIDE_SPEED_MIN || 230)
            ) {
                this._startSlide();
            }

            if (this.ledgeGrabbed) {
                this.x = Math.max(0, Math.min(CONFIG.GAME_WIDTH - this.width, Number(this.ledgeX || this.x)));
                this.y = Number(this.ledgeY || this.y) - this.height * Number(CONFIG.LEDGE_HANG_Y_RATIO || 0.36);
                this.vx = 0;
                this.vy = 0;
                this.onGround = false;
                this.coyoteTimeMs = 0;
                this.jumpBufferMs = 0;
                this.ledgeHangTimer = Math.max(0, Number(this.ledgeHangTimer || 0) - step);

                if (wantsCrouch || this.ledgeHangTimer <= 0) {
                    this.ledgeGrabbed = false;
                    this.vy = Math.max(this.vy, Number(CONFIG.LEDGE_DROP_VY || 160));
                    this.ledgeHangTimer = 0;
                } else if (jumpPressed) {
                    if (dir === -this.ledgeSide && this._consumeStamina(CONFIG.STAMINA_JUMP_COST || 0, dtMs)) {
                        this.vx = -this.ledgeSide * Number(CONFIG.WALL_JUMP_FORCE_X || 560);
                        this.vy = Number(CONFIG.WALL_JUMP_FORCE_Y || -860);
                        this.wallJumpLock = Number(CONFIG.WALL_JUMP_LOCK_TIME || 0.16);
                        this.onGround = false;
                    } else {
                        const inset = Number(CONFIG.LEDGE_CLIMB_INSET || 8);
                        if (this.ledgeSide >= 0) {
                            this.x = Number(this.ledgeX || this.x) + inset;
                        } else {
                            this.x = Number(this.ledgeX || this.x) - this.width - inset;
                        }
                        this.y = Number(this.ledgeY || this.y) - this.height;
                        this.vx = 0;
                        this.vy = 0;
                        this.onGround = true;
                        this.coyoteTimeMs = Number(CONFIG.COYOTE_TIME_MS || 120);
                    }
                    this.onWall = false;
                    this.wallSide = 0;
                    this.ledgeGrabbed = false;
                    this.ledgeSide = 0;
                    this.ledgeHangTimer = 0;
                }
            } else if (this.onWall) {
                this.sliding = false;
                this.slideTimer = 0;
                this.vx = 0;
                if (dir === -this.wallSide) {
                    this.onWall = false;
                    this.wallSide = 0;
                } else {
                    this.vy = Math.min(Number(CONFIG.WALL_SLIDE_SPEED || 220), Math.max(this.vy, -140));
                }
            } else if (this.sliding) {
                this.slideTimer = Math.max(0, Number(this.slideTimer || 0) - step);
                const slideDir = Number(this.slideDir || (this.vx >= 0 ? 1 : -1)) >= 0 ? 1 : -1;
                const friction = Number(CONFIG.SLIDE_FRICTION || 2450);
                this.vx = approach(this.vx, 0, friction * step);
                if (Math.abs(this.vx) < 18) {
                    this.vx = 0;
                }
                if (this.slideTimer <= 0) {
                    this.sliding = false;
                } else {
                    this.facingDir = slideDir;
                }
            } else {
                if (dir !== 0) {
                    this.vx = approach(this.vx, targetVx, accelEffective * step);
                    this.facingDir = dir >= 0 ? 1 : -1;
                } else {
                    this.vx = approach(this.vx, 0, decelEffective * step);
                }
            }

            if (this.onGround) {
                this.coyoteTimeMs = CONFIG.COYOTE_TIME_MS;
            } else {
                this.coyoteTimeMs = Math.max(0, this.coyoteTimeMs - dtMs);
            }

            if (jumpPressed) {
                this.jumpBufferMs = CONFIG.JUMP_BUFFER_MS;
            } else {
                this.jumpBufferMs = Math.max(0, this.jumpBufferMs - dtMs);
            }

            if (this.jumpBufferMs > 0 && this.onWall) {
                if (this._consumeStamina(CONFIG.STAMINA_JUMP_COST || 0, dtMs)) {
                    const jumpDir = this.wallSide !== 0 ? -this.wallSide : (dir >= 0 ? -1 : 1);
                    this.vx = jumpDir * Number(CONFIG.WALL_JUMP_FORCE_X || 560);
                    this.vy = Number(CONFIG.WALL_JUMP_FORCE_Y || -860);
                    this.onWall = false;
                    this.wallSide = 0;
                    this.wallJumpLock = Number(CONFIG.WALL_JUMP_LOCK_TIME || 0.16);
                    this.coyoteTimeMs = 0;
                    this.jumpBufferMs = 0;
                }
            } else if (this.jumpBufferMs > 0 && this.coyoteTimeMs > 0) {
                if (this._consumeStamina(CONFIG.STAMINA_JUMP_COST || 0, dtMs)) {
                    this.vy = CONFIG.JUMP_FORCE;
                    this.onGround = false;
                    this.coyoteTimeMs = 0;
                    this.jumpBufferMs = 0;
                }
            }

            this.aimAngle = input.aimAngle || 0;
            this.bowDrawn = input.bowDrawn || false;
            this.drawPower = input.drawPower || 0;
            const blockRequested = !!(this.loadout && this.loadout.shield && input.shieldBlock);
            const canStartBlock = this.stamina >= Number(CONFIG.STAMINA_BLOCK_START_THRESHOLD || 0);
            const canContinueBlock = this.stamina > 0;
            if (blockRequested) {
                this.shieldBlocking = this.shieldBlocking ? canContinueBlock : canStartBlock;
            } else {
                this.shieldBlocking = false;
            }
            this.shieldBlockAngle = Number.isFinite(Number(input.shieldBlockAngle))
                ? Number(input.shieldBlockAngle)
                : Number(this.aimAngle || 0);
            if (wasBowDrawn && !this.bowDrawn && prevDrawPower > 6) {
                this.triggerBowRelease(prevDrawPower, this.aimAngle);
            }

            const requestedCrouch = (wantsCrouch || this.sliding) && !this.onWall && !this.ledgeGrabbed;
            this._syncCrouchState(requestedCrouch);

            this._tickStamina(step);
        } else {
            return;
        }

        const prevY = this.y;
        const prevBottom = this.y + this.height;
        if (!this.ledgeGrabbed) {
            const gravityScale = this.onWall ? 0.6 : 1.0;
            this.vy += CONFIG.GRAVITY * step * gravityScale;
            this.vy = Math.min(this.vy, CONFIG.MAX_FALL_SPEED);
            if (this.onWall) {
                this.vy = Math.min(this.vy, Number(CONFIG.WALL_SLIDE_SPEED || 220));
            }
        }

        this.x += this.vx * step;
        this.y += this.vy * step;
        
        if (this.x < 0) this.x = 0;
        if (this.x > CONFIG.GAME_WIDTH - this.width) {
            this.x = CONFIG.GAME_WIDTH - this.width;
        }

        if (!this.ledgeGrabbed) {
            const contactDir = dirSign((input && input.left ? -1 : 0) + (input && input.right ? 1 : 0), this.vx);
            if (!this.onGround && !this.onWall && this.wallJumpLock <= 0) {
                const wall = detectWallContact(this, contactDir);
                if (wall && !(input && input.crouch) && !this.sliding) {
                    this.onWall = true;
                    this.wallSide = wall.side;
                    this.x = wall.snapX;
                    this.vx = 0;
                    this.vy = Math.min(this.vy, Number(CONFIG.WALL_SLIDE_SPEED || 220));
                }
            }
            if (!this.onGround && !this.onWall && !this.ledgeGrabbed) {
                const ledge = detectLedgeGrab(this, contactDir, prevY);
                if (ledge && !(input && input.crouch)) {
                    this.ledgeGrabbed = true;
                    this.ledgeSide = ledge.side;
                    this.ledgeX = ledge.ledgeX;
                    this.ledgeY = ledge.ledgeY;
                    this.x = Math.max(0, Math.min(CONFIG.GAME_WIDTH - this.width, ledge.hangX));
                    this.y = ledge.hangY;
                    this.vx = 0;
                    this.vy = 0;
                    this.onWall = false;
                    this.wallSide = 0;
                    this.onGround = false;
                    this.coyoteTimeMs = 0;
                    this.jumpBufferMs = 0;
                    this.ledgeHangTimer = Number(CONFIG.LEDGE_HANG_MAX || 0.9);
                }
            }

            const floor = this.ledgeGrabbed
                ? null
                : findLandingFloor(prevBottom, this.y + this.height, this.x, this.width);
            if (floor) {
                this.y = floor.y - this.height;
                this.vy = 0;
                this.onGround = true;
                this.onWall = false;
                this.wallSide = 0;
                this.ledgeGrabbed = false;
                this.ledgeSide = 0;
                this.ledgeHangTimer = 0;
            } else {
                this.onGround = false;
                if (!this.ledgeGrabbed) {
                    this.sliding = false;
                }
            }
        }

        if (this.sliding && (!this.onGround || this.onWall || this.ledgeGrabbed)) {
            this.sliding = false;
        }
        if (this.sliding && !this.onWall && !this.ledgeGrabbed) {
            this._setHeight(this.crouchHeight);
        } else if (!this.crouching || this.onWall || this.ledgeGrabbed) {
            this._syncCrouchState(false);
        }
    }

    _setHeight(nextHeight) {
        const targetHeight = Math.max(28, Number(nextHeight || this.standingHeight));
        if (Math.abs(targetHeight - this.height) < 0.001) return;
        const bottom = this.y + this.height;
        this.height = targetHeight;
        this.y = bottom - this.height;
    }

    _startSlide() {
        const dir = Math.abs(this.vx) > 4 ? (this.vx >= 0 ? 1 : -1) : (this.facingDir >= 0 ? 1 : -1);
        const speed = Math.max(Math.abs(this.vx), Number(CONFIG.SLIDE_BOOST_SPEED || 520));
        this.slideDir = dir;
        this.vx = dir * speed;
        this.sliding = true;
        this.slideTimer = Math.max(0.08, Number(CONFIG.SLIDE_DURATION || 0.42));
        this.crouching = true;
        this._setHeight(this.crouchHeight);
    }

    _syncCrouchState(requestedCrouch) {
        const crouchRequested = !!requestedCrouch;
        if (crouchRequested || this.sliding) {
            this.crouching = true;
            this._setHeight(this.crouchHeight);
            return true;
        }
        const canStand = hasStandClearance(this.x, this.y + this.height, this.width, this.standingHeight);
        if (canStand) {
            this.crouching = false;
            this._setHeight(this.standingHeight);
            return true;
        }
        this.crouching = true;
        this._setHeight(this.crouchHeight);
        return false;
    }

    triggerBowRelease(power, angle) {
        const now = this._nowMs();
        const charge = Math.max(0, Math.min(100, Number(power || 0))) / 100;
        const duration = 90 + charge * 85;
        this.bowReleaseStartedAt = now;
        this.bowReleaseDurationMs = duration;
        this.bowReleaseUntil = now + duration;
        this.bowReleasePower = charge;
        this.bowReleaseAngle = Number.isFinite(Number(angle)) ? Number(angle) : Number(this.aimAngle || 0);
        this.bowRecoilKick = 0.14 + charge * 0.18;
    }

    bowReleaseRatio(nowMs) {
        const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : this._nowMs();
        if (!(this.bowReleaseUntil > now) || this.bowReleaseDurationMs <= 0) {
            return 0;
        }
        const elapsed = now - this.bowReleaseStartedAt;
        const t = Math.max(0, Math.min(1, elapsed / this.bowReleaseDurationMs));
        return 1 - t;
    }

    _nowMs() {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
            return performance.now();
        }
        return Date.now();
    }

    _consumeStamina(amount, dtMs = 0) {
        const cost = Math.max(0, Number(amount || 0));
        if (cost <= 0) return true;
        if (this.stamina + 0.001 < cost) {
            return false;
        }
        this.stamina = Math.max(0, this.stamina - cost);
        const now = this._nowMs();
        const regenDelay = Number(CONFIG.STAMINA_REGEN_DELAY_MS || 0);
        this.staminaRegenBlockedUntil = Math.max(this.staminaRegenBlockedUntil || 0, now + regenDelay + dtMs);
        return true;
    }

    _tickStamina(dt) {
        const now = this._nowMs();
        const dtSec = Math.max(0, Number(dt || 0));
        let spent = false;
        let drain = 0;
        if (this.sprinting) {
            drain += Number(CONFIG.STAMINA_SPRINT_DRAIN_PER_SEC || 0) * dtSec;
        }
        if (this.shieldBlocking) {
            drain += Number(CONFIG.STAMINA_BLOCK_DRAIN_PER_SEC || 0) * dtSec;
        }
        if (drain > 0) {
            const prev = this.stamina;
            this.stamina = Math.max(0, this.stamina - drain);
            spent = Math.abs(this.stamina - prev) > 0.0001;
            if (spent) {
                this.staminaRegenBlockedUntil = Math.max(
                    this.staminaRegenBlockedUntil || 0,
                    now + Number(CONFIG.STAMINA_REGEN_DELAY_MS || 0)
                );
            }
        }
        if (this.stamina <= 0) {
            this.sprinting = false;
            this.shieldBlocking = false;
        }
        if (!spent && now >= (this.staminaRegenBlockedUntil || 0)) {
            const regen = Number(CONFIG.STAMINA_REGEN_PER_SEC || 0) * dtSec;
            this.stamina = Math.min(this.maxStamina, this.stamina + regen);
        }
    }
    
    takeDamage(amount) {
        const weaponMods = window.WeaponDynamics
            ? window.WeaponDynamics.aggregateModifiers(this.loadout)
            : null;
        const incomingMultiplier = weaponMods ? weaponMods.incomingDamageMultiplier : 1.0;
        const finalDamage = Math.max(1, amount * incomingMultiplier);
        this.health -= finalDamage;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            if (!this.ragdollParts) {
                this.spawnRagdoll();
            }
        }
    }
    
    getState() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            vx: this.vx,
            vy: this.vy,
            health: this.health,
            alive: this.alive,
            aimAngle: this.aimAngle,
            bowDrawn: this.bowDrawn,
            drawPower: this.drawPower,
            loadout: this.loadout,
            shield_blocking: this.shieldBlocking,
            shield_block_angle: this.shieldBlockAngle,
            armor_break_stage: this.armorBreakStage,
            armor_break_ratio: this.armorBreakRatio,
            stamina: this.stamina,
            stamina_max: this.maxStamina,
            sprinting: this.sprinting,
            crouching: this.crouching,
            sliding: this.sliding,
            slide_timer: this.slideTimer,
            slide_dir: this.slideDir,
            on_wall: this.onWall,
            wall_side: this.wallSide,
            ledge_grabbed: this.ledgeGrabbed,
            ledge_side: this.ledgeSide,
            ledge_x: this.ledgeX,
            ledge_y: this.ledgeY,
            ledge_hang_timer: this.ledgeHangTimer,
            height: this.height,
        };
    }
    
    setState(state) {
        const wasBowDrawn = !!this.bowDrawn;
        const prevDrawPower = Number(this.drawPower || 0);
        this.x = state.x;
        this.y = state.y;
        this.vx = state.vx || 0;
        this.vy = state.vy || 0;
        if (Math.abs(this.vx) > 6) {
            this.facingDir = this.vx > 0 ? 1 : -1;
        }
        this.health = state.health;
        this.alive = state.alive;
        this.aimAngle = state.aimAngle || 0;
        this.bowDrawn = state.bowDrawn || false;
        this.drawPower = state.drawPower || 0;
        if (wasBowDrawn && !this.bowDrawn && prevDrawPower > 6) {
            this.triggerBowRelease(prevDrawPower, this.aimAngle);
        }
        if (state.facing_dir) {
            this.facingDir = state.facing_dir >= 0 ? 1 : -1;
        }
        if (state.loadout) {
            this.loadout = { ...this.loadout, ...state.loadout };
        }
        this.mountedHorseId = state.mounted_horse_id != null ? state.mounted_horse_id : this.mountedHorseId;
        this.usingBallistaSide = state.using_ballista_side != null ? state.using_ballista_side : this.usingBallistaSide;
        this.swordPhase = state.sword_phase || 'idle';
        this.swordAttack = state.sword_attack || null;
        this.swordPhaseTimer = Number(state.sword_phase_timer || 0);
        this.swordPhaseDuration = Number(state.sword_phase_duration || 0);
        this.swordReactionTimer = Number(state.sword_reaction_timer || 0);
        this.swordReactionAttack = state.sword_reaction_attack || null;
        this.shieldBlocking = !!state.shield_blocking;
        this.shieldBlockAngle = Number(state.shield_block_angle || this.aimAngle || 0);
        if (Number.isFinite(Number(state.armor_break_stage))) {
            this.armorBreakStage = Math.max(0, Math.min(3, Number(state.armor_break_stage) | 0));
        }
        if (Number.isFinite(Number(state.armor_break_ratio))) {
            this.armorBreakRatio = Math.max(0, Math.min(1, Number(state.armor_break_ratio)));
        } else {
            this.armorBreakRatio = Math.max(0, Math.min(1, this.armorBreakStage / 3));
        }
        this.crouching = !!state.crouching;
        this.sliding = !!state.sliding;
        this.slideTimer = Math.max(0, Number(state.slide_timer || 0));
        if (Number.isFinite(Number(state.slide_dir))) {
            this.slideDir = Number(state.slide_dir) >= 0 ? 1 : -1;
        }
        this.onWall = !!state.on_wall;
        this.wallSide = Number.isFinite(Number(state.wall_side))
            ? (Number(state.wall_side) >= 0 ? (Number(state.wall_side) > 0 ? 1 : 0) : -1)
            : 0;
        this.ledgeGrabbed = !!state.ledge_grabbed;
        this.ledgeSide = Number.isFinite(Number(state.ledge_side))
            ? (Number(state.ledge_side) >= 0 ? (Number(state.ledge_side) > 0 ? 1 : 0) : -1)
            : 0;
        if (Number.isFinite(Number(state.ledge_x))) {
            this.ledgeX = Number(state.ledge_x);
        }
        if (Number.isFinite(Number(state.ledge_y))) {
            this.ledgeY = Number(state.ledge_y);
        }
        this.ledgeHangTimer = Math.max(0, Number(state.ledge_hang_timer || 0));
        if (Number.isFinite(Number(state.height))) {
            this.height = Math.max(28, Number(state.height));
        } else if (this.sliding || this.crouching) {
            this.height = this.crouchHeight;
        } else {
            this.height = this.standingHeight;
        }
        if (Number.isFinite(Number(state.stamina_max))) {
            this.maxStamina = Math.max(1, Number(state.stamina_max));
        }
        if (Number.isFinite(Number(state.stamina))) {
            this.stamina = Math.max(0, Math.min(this.maxStamina, Number(state.stamina)));
        }
        this.sprinting = !!state.sprinting;
        if (!this.alive && !this.ragdollParts) {
            this.spawnRagdoll();
        }
    }

    _applyRagdollImpulseToParts(parts, impulse = {}) {
        if (!Array.isArray(parts) || parts.length === 0) return;
        const horizontal = Number.isFinite(Number(impulse.horizontal)) ? Number(impulse.horizontal) : 0;
        const vertical = Number.isFinite(Number(impulse.vertical)) ? Number(impulse.vertical) : 0;
        const chaos = Number.isFinite(Number(impulse.chaos)) ? Math.max(0, Number(impulse.chaos)) : 0;
        const pivotY = Number.isFinite(Number(impulse.pivotY))
            ? Number(impulse.pivotY)
            : parts.reduce((sum, p) => sum + Number(p.y || 0), 0) / parts.length;
        const sourceY = Number.isFinite(Number(impulse.sourceY)) ? Number(impulse.sourceY) : pivotY;
        parts.forEach((p, index) => {
            const invMass = Math.max(0.01, Number(p.invMass || 1));
            const ySign = Number(p.y || 0) < sourceY ? -1 : 1;
            const spread = (index % 2 === 0 ? 1 : -1) * chaos * (0.05 + Math.abs(Number(p.y || 0) - pivotY) * 0.003);
            const impulseX = (horizontal + spread) * invMass;
            const impulseY = (vertical + ySign * chaos * 0.09) * invMass;
            p.prevX -= impulseX;
            p.prevY -= impulseY;
        });
    }

    applyRagdollImpact(impact = {}) {
        if (!this.ragdollParts) {
            this.ragdollQueuedImpact = { ...impact };
            return;
        }
        const dirRaw = Number(impact.dir);
        const dir = Number.isFinite(dirRaw) && Math.abs(dirRaw) > 0.001
            ? (dirRaw >= 0 ? 1 : -1)
            : (Number(this.facingDir || 1) >= 0 ? 1 : -1);
        const intensity = Math.max(0, Math.min(1.85, Number(impact.intensity || 0)));
        const speedX = Number(impact.vx || 0);
        const speedY = Number(impact.vy || 0);
        const speedNorm = Math.max(0, Math.min(1.6, Math.hypot(speedX, speedY) / Math.max(1, Number(CONFIG.ARROW_SPEED || 900))));
        const source = String(impact.source || 'arrow');
        const sourceBoost = source === 'sword' ? 1.18 : (source === 'ballista' ? 1.42 : 1.0);
        const horizontal = dir * (18 + (intensity * 34 + speedNorm * 28) * sourceBoost);
        const vertical = -Math.max(6, (intensity * 19 + speedNorm * 17) * sourceBoost);
        const chaos = Math.max(2, Math.min(16, 2 + intensity * 7 + speedNorm * 4));
        this._applyRagdollImpulseToParts(this.ragdollParts, {
            horizontal,
            vertical,
            chaos,
            sourceY: Number.isFinite(Number(impact.hitY)) ? Number(impact.hitY) : (this.y + this.height * 0.5),
        });
        this.ragdollState = this.ragdollState || {};
        this.ragdollState.extraIterations = Math.max(2, Number(this.ragdollState.extraIterations || 0));
    }

    severRagdollLimb(limb = 'rArm', options = {}) {
        const normalizedLimb = String(limb || '').trim();
        const limbToParts = {
            lArm: ['lUpperArm', 'lLowerArm'],
            rArm: ['rUpperArm', 'rLowerArm'],
            lLeg: ['lUpperLeg', 'lLowerLeg'],
            rLeg: ['rUpperLeg', 'rLowerLeg'],
        };
        const severParts = limbToParts[normalizedLimb];
        if (!severParts) return false;

        if (!this.ragdollParts || !Array.isArray(this.ragdollLinks)) {
            this.ragdollQueuedSevers = Array.isArray(this.ragdollQueuedSevers) ? this.ragdollQueuedSevers : [];
            this.ragdollQueuedSevers.push({ limb: normalizedLimb, options: { ...options } });
            if (this.ragdollQueuedSevers.length > 6) {
                this.ragdollQueuedSevers = this.ragdollQueuedSevers.slice(this.ragdollQueuedSevers.length - 6);
            }
            return true;
        }

        this.ragdollSevered = this.ragdollSevered || {};
        const alreadySevered = severParts.every((partType) => !!this.ragdollSevered[partType]);
        if (alreadySevered) return false;

        const severSet = new Set(severParts);
        const partByType = {};
        this.ragdollParts.forEach((part) => {
            if (!part || !part.type) return;
            partByType[part.type] = part;
        });

        severParts.forEach((partType) => {
            this.ragdollSevered[partType] = true;
        });

        this.ragdollLinks = this.ragdollLinks.filter((link) => {
            const a = this.ragdollParts[link.a];
            const b = this.ragdollParts[link.b];
            if (!a || !b) return false;
            const aSever = severSet.has(a.type);
            const bSever = severSet.has(b.type);
            // Keep links only if both points are on the same side of the sever.
            return (aSever && bSever) || (!aSever && !bSever);
        });

        const dirRaw = Number(options.dir);
        const dir = Number.isFinite(dirRaw) && Math.abs(dirRaw) > 0.001
            ? (dirRaw >= 0 ? 1 : -1)
            : (Number(this.facingDir || 1) >= 0 ? 1 : -1);
        const intensity = Math.max(0.4, Math.min(2.2, Number(options.intensity || 1)));
        const detachedParts = severParts
            .map((partType) => partByType[partType])
            .filter(Boolean);
        this._applyRagdollImpulseToParts(detachedParts, {
            horizontal: dir * (18 + intensity * 28),
            vertical: -Math.max(6, 10 + intensity * 16),
            chaos: 10 + intensity * 6,
            sourceY: Number.isFinite(Number(options.hitY)) ? Number(options.hitY) : (this.y + this.height * 0.5),
        });
        this.ragdollState = this.ragdollState || {};
        this.ragdollState.extraIterations = Math.max(3, Number(this.ragdollState.extraIterations || 0));
        return true;
    }

    spawnRagdoll(options = {}) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const step = 1 / 60;
        const baseVx = Number(this.vx || 0) * step;
        const baseVy = Number(this.vy || 0) * step;

        const add = (type, radius, ox, oy, invMass = 1) => ({
            type,
            radius,
            x: cx + ox,
            y: cy + oy,
            prevX: cx + ox - baseVx,
            prevY: cy + oy - baseVy,
            invMass,
            color: this.color
        });
        
        const parts = [
            add('head', 12, 0, -38, 0.82),
            add('chest', 11, 0, -20, 0.56),
            add('pelvis', 11, 0, 0, 0.5),
            add('lUpperArm', 8, -16, -22, 0.98),
            add('lLowerArm', 7, -32, -20, 1.08),
            add('rUpperArm', 8, 16, -22, 0.98),
            add('rLowerArm', 7, 32, -20, 1.08),
            add('lUpperLeg', 9, -8, 20, 0.9),
            add('lLowerLeg', 8, -8, 44, 1.0),
            add('rUpperLeg', 9, 8, 20, 0.9),
            add('rLowerLeg', 8, 8, 44, 1.0)
        ];
        
        const link = (a, b, factor = 1, stiffness = 0.86) => ({
            a, b,
            rest: distance(parts[a], parts[b]) * factor,
            stiffness
        });
        
        const links = [
            link(0, 1, 1, 0.92),
            link(1, 2, 1, 0.94),
            link(1, 3, 1, 0.84), link(3, 4, 1, 0.8),
            link(1, 5, 1, 0.84), link(5, 6, 1, 0.8),
            link(2, 7, 1, 0.88), link(7, 8, 1, 0.84),
            link(2, 9, 1, 0.88), link(9, 10, 1, 0.84),
            link(1, 7, 1.05, 0.78), link(1, 9, 1.05, 0.78),
            link(2, 3, 1.08, 0.72), link(2, 5, 1.08, 0.72),
            link(7, 9, 1.2, 0.64)
        ];
        
        this.ragdollParts = parts;
        this.ragdollLinks = links;
        this.ragdollState = {
            sleepTimer: 0,
            extraIterations: 2
        };
        this.ragdollSevered = {};
        this._applyRagdollImpulseToParts(parts, {
            horizontal: Number(this.facingDir || 1) * 18,
            vertical: -10,
            chaos: 6,
            pivotY: cy
        });
        if (this.ragdollQueuedImpact) {
            this.applyRagdollImpact(this.ragdollQueuedImpact);
            this.ragdollQueuedImpact = null;
        } else if (options && options.impact) {
            this.applyRagdollImpact(options.impact);
        }
        if (Array.isArray(this.ragdollQueuedSevers) && this.ragdollQueuedSevers.length > 0) {
            const queuedSevers = this.ragdollQueuedSevers.slice(0);
            this.ragdollQueuedSevers = [];
            queuedSevers.forEach((entry) => {
                if (!entry || !entry.limb) return;
                this.severRagdollLimb(entry.limb, entry.options || {});
            });
        }
    }

    _resolveRagdollFloorCollisions(friction = 0.55, bounce = 0.08) {
        if (!this.ragdollParts) return false;
        let touchedFloor = false;
        this.ragdollParts.forEach((p) => {
            const floor = findLandingFloor(p.prevY + p.radius, p.y + p.radius, p.x - p.radius, p.radius * 2, true);
            if (!floor) return;
            touchedFloor = true;
            p.y = floor.y - p.radius;
            const vy = p.y - p.prevY;
            const vx = p.x - p.prevX;
            if (vy > 0) {
                p.prevY = p.y + vy * bounce;
            }
            p.prevX = p.x - vx * (1 - friction);
        });
        return touchedFloor;
    }

    updateRagdoll(dt = 0) {
        if (!this.ragdollParts) return;
        const step = Math.max(1 / 240, Math.min(0.05, Number(dt || 0)));
        const g = Number(CONFIG.GRAVITY || 0);
        const damping = 0.992;
        const maxStepSpeed = 56;
        let energy = 0;
        
        // Verlet integration
        this.ragdollParts.forEach((p) => {
            const vx = (p.x - p.prevX) * damping;
            const vy = (p.y - p.prevY) * damping + g * step * step;
            let nextVx = vx;
            let nextVy = vy;
            const speed = Math.hypot(nextVx, nextVy);
            if (speed > maxStepSpeed) {
                const scale = maxStepSpeed / speed;
                nextVx *= scale;
                nextVy *= scale;
            }
            energy += Math.abs(nextVx) + Math.abs(nextVy);
            const nextX = p.x + nextVx;
            const nextY = p.y + nextVy;
            p.prevX = p.x;
            p.prevY = p.y;
            p.x = nextX;
            p.y = nextY;
        });

        const touchedFloor = this._resolveRagdollFloorCollisions(0.58, 0.04);
        const state = this.ragdollState || { sleepTimer: 0, extraIterations: 0 };
        const baseIterations = 5;
        const extraIterations = Math.max(0, Math.min(3, Number(state.extraIterations || 0)));
        const settleIterations = touchedFloor && energy < this.ragdollParts.length * 1.2 ? 1 : 0;
        const iterations = baseIterations + extraIterations + settleIterations;

        for (let iter = 0; iter < iterations; iter++) {
            this.ragdollLinks.forEach(link => {
                const a = this.ragdollParts[link.a];
                const b = this.ragdollParts[link.b];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
                const diff = (dist - link.rest) / dist;
                const stiffness = Number.isFinite(Number(link.stiffness)) ? Number(link.stiffness) : 0.86;
                const totalInvMass = Math.max(0.001, Number(a.invMass || 1) + Number(b.invMass || 1));
                const aShare = Number(a.invMass || 1) / totalInvMass;
                const bShare = Number(b.invMass || 1) / totalInvMass;
                const adjustX = dx * diff * stiffness;
                const adjustY = dy * diff * stiffness;
                a.x += adjustX * aShare;
                a.y += adjustY * aShare;
                b.x -= adjustX * bShare;
                b.y -= adjustY * bShare;
            });
            this._resolveRagdollFloorCollisions(0.6, 0);
        }

        state.extraIterations = Math.max(0, Number(state.extraIterations || 0) - step * 30);
        if (touchedFloor && energy < this.ragdollParts.length * 0.5) {
            state.sleepTimer = Math.min(2, Number(state.sleepTimer || 0) + step);
        } else {
            state.sleepTimer = Math.max(0, Number(state.sleepTimer || 0) - step * 2);
        }
        if (state.sleepTimer > 0.45) {
            this.ragdollParts.forEach((p) => {
                p.prevX = p.x - (p.x - p.prevX) * 0.15;
                p.prevY = p.y - (p.y - p.prevY) * 0.15;
            });
        }
        this.ragdollState = state;
    }
}

function dirSign(inputDir, velocityX) {
    const dir = Number(inputDir || 0);
    if (dir > 0) return 1;
    if (dir < 0) return -1;
    const vx = Number(velocityX || 0);
    if (vx > 40) return 1;
    if (vx < -40) return -1;
    return 0;
}

function detectWallContact(player, moveDir) {
    if (!player || !moveDir) return null;
    const detectDist = Number(CONFIG.WALL_DETECT_DIST || 16);
    const topMargin = Number(CONFIG.WALL_ATTACH_TOP_MARGIN || 18);
    const attachHeight = Number(CONFIG.WALL_ATTACH_HEIGHT || 260);
    const px = Number(player.x || 0);
    const py = Number(player.y || 0);
    const pw = Number(player.width || CONFIG.PLAYER_WIDTH || 40);
    const ph = Number(player.height || CONFIG.PLAYER_HEIGHT || 80);
    const top = py;
    const bottom = py + ph;

    if (moveDir < 0 && px <= detectDist) {
        return { side: -1, snapX: 0 };
    }
    if (moveDir > 0 && px >= Number(CONFIG.GAME_WIDTH || 0) - pw - detectDist) {
        return { side: 1, snapX: Number(CONFIG.GAME_WIDTH || 0) - pw };
    }

    const floors = Array.isArray(CONFIG.FLOORS) ? CONFIG.FLOORS : [];
    for (let i = 0; i < floors.length; i += 1) {
        const floor = floors[i];
        const floorY = Number(floor.y || 0);
        if (floorY >= Number(CONFIG.GROUND_Y || 700) - 1) continue;
        const wallTop = floorY - topMargin;
        const wallBottom = floorY + attachHeight;
        if (!(bottom > wallTop && top < wallBottom)) continue;

        const leftEdge = Number(floor.x1 || 0);
        const rightEdge = Number(floor.x2 || 0);
        const playerRight = px + pw;
        if (moveDir > 0) {
            const dist = leftEdge - playerRight;
            if (Math.abs(dist) <= detectDist && px < leftEdge) {
                return { side: 1, snapX: leftEdge - pw };
            }
        } else if (moveDir < 0) {
            const dist = px - rightEdge;
            if (Math.abs(dist) <= detectDist && px > rightEdge - pw) {
                return { side: -1, snapX: rightEdge };
            }
        }
    }
    return null;
}

function detectLedgeGrab(player, moveDir, prevY) {
    if (!player || !moveDir) return null;
    const vy = Number(player.vy || 0);
    if (vy < Number(CONFIG.LEDGE_MIN_FALL_SPEED || 80)) return null;

    const px = Number(player.x || 0);
    const py = Number(player.y || 0);
    const pw = Number(player.width || CONFIG.PLAYER_WIDTH || 40);
    const ph = Number(player.height || CONFIG.PLAYER_HEIGHT || 80);
    const handRatio = Number(CONFIG.LEDGE_HAND_HEIGHT_RATIO || 0.34);
    const windowY = Number(CONFIG.LEDGE_GRAB_Y_WINDOW || 24);
    const handY = py + ph * handRatio;
    const prevHandY = Number(prevY || py) + ph * handRatio;
    const edgeDistLimit = Number(CONFIG.LEDGE_GRAB_X_DIST || 18);

    const floors = Array.isArray(CONFIG.FLOORS) ? CONFIG.FLOORS : [];
    for (let i = 0; i < floors.length; i += 1) {
        const floor = floors[i];
        const floorY = Number(floor.y || 0);
        if (floorY >= Number(CONFIG.GROUND_Y || 700) - 1) continue;
        const nearTop = Math.abs(handY - floorY) <= windowY;
        const crossedTop = prevHandY <= floorY + windowY && handY >= floorY - windowY;
        if (!(nearTop || crossedTop)) continue;

        const leftEdge = Number(floor.x1 || 0);
        const rightEdge = Number(floor.x2 || 0);
        const playerRight = px + pw;
        const playerLeft = px;

        if (moveDir > 0) {
            const edgeDist = Math.abs(playerRight - leftEdge);
            if (edgeDist <= edgeDistLimit && playerRight <= leftEdge + edgeDistLimit) {
                return {
                    side: 1,
                    ledgeX: leftEdge,
                    ledgeY: floorY,
                    hangX: leftEdge - pw + 1,
                    hangY: floorY - ph * Number(CONFIG.LEDGE_HANG_Y_RATIO || 0.36),
                };
            }
        } else if (moveDir < 0) {
            const edgeDist = Math.abs(playerLeft - rightEdge);
            if (edgeDist <= edgeDistLimit && playerLeft >= rightEdge - edgeDistLimit) {
                return {
                    side: -1,
                    ledgeX: rightEdge,
                    ledgeY: floorY,
                    hangX: rightEdge - 1,
                    hangY: floorY - ph * Number(CONFIG.LEDGE_HANG_Y_RATIO || 0.36),
                };
            }
        }
    }
    return null;
}

function approach(current, target, delta) {
    if (current < target) return Math.min(current + delta, target);
    if (current > target) return Math.max(current - delta, target);
    return current;
}

class Arrow {
    constructor(x, y, angle, power, team) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.vx = Math.cos(angle) * power;
        this.vy = Math.sin(angle) * power;
        this.angle = angle;
        this.team = team;
        this.active = true;
        this.length = 42;
    }
    
    update(dt) {
        const prevY = this.y;
        this.prevX = this.x;
        this.prevY = this.y;
        this.vy += CONFIG.ARROW_GRAVITY * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle = Math.atan2(this.vy, this.vx);
        
        const floor = findLandingFloor(prevY, this.y, this.x, 2, true);
        if (floor) {
            this.y = floor.y;
            this.active = false;
        }
        
        if (this.y > CONFIG.GROUND_Y + 200 || this.x < 0 || this.x > CONFIG.GAME_WIDTH) {
            this.active = false;
        }
    }
    
    checkCollision(player) {
        if (!this.active || !player.alive) return false;

        const x0 = Number.isFinite(Number(this.prevX)) ? Number(this.prevX) : Number(this.x);
        const y0 = Number.isFinite(Number(this.prevY)) ? Number(this.prevY) : Number(this.y);
        const x1 = Number(this.x);
        const y1 = Number(this.y);
        const left = Number(player.x || 0);
        const top = Number(player.y || 0);
        const right = left + Number(player.width || CONFIG.PLAYER_WIDTH || 40);
        const bottom = top + Number(player.height || CONFIG.PLAYER_HEIGHT || 80);

        return Arrow.segmentIntersectsRect(x0, y0, x1, y1, left, right, top, bottom);
    }

    static segmentIntersectsRect(x0, y0, x1, y1, left, right, top, bottom) {
        const minX = Math.min(Number(left), Number(right));
        const maxX = Math.max(Number(left), Number(right));
        const minY = Math.min(Number(top), Number(bottom));
        const maxY = Math.max(Number(top), Number(bottom));
        if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
            return false;
        }
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
            return false;
        }

        const dx = x1 - x0;
        const dy = y1 - y0;
        let tMin = 0;
        let tMax = 1;

        const clipAxis = (origin, delta, axisMin, axisMax) => {
            if (Math.abs(delta) <= 1e-7) {
                return origin >= axisMin && origin <= axisMax ? [tMin, tMax] : null;
            }
            const inv = 1 / delta;
            let t1 = (axisMin - origin) * inv;
            let t2 = (axisMax - origin) * inv;
            if (t1 > t2) {
                const tmp = t1;
                t1 = t2;
                t2 = tmp;
            }
            const nextMin = Math.max(tMin, t1);
            const nextMax = Math.min(tMax, t2);
            if (nextMin > nextMax) return null;
            return [nextMin, nextMax];
        };

        const xHit = clipAxis(x0, dx, minX, maxX);
        if (!xHit) return false;
        tMin = xHit[0];
        tMax = xHit[1];

        const yHit = clipAxis(y0, dy, minY, maxY);
        if (!yHit) return false;
        tMin = yHit[0];
        tMax = yHit[1];

        return tMax >= 0 && tMin <= 1;
    }
}

function findLandingFloor(prevBottom, newBottom, x, width, pointOnly = false) {
    if (!CONFIG.FLOORS || CONFIG.FLOORS.length === 0) return null;
    
    let candidate = null;
    CONFIG.FLOORS.forEach(floor => {
        const withinX = pointOnly
            ? x >= floor.x1 && x <= floor.x2
            : (x + width) > floor.x1 && x < floor.x2;
        
        if (!withinX) return;
        
        // Crossing the floor line downward (y grows downward)
        if (prevBottom <= floor.y && newBottom >= floor.y) {
            if (!candidate || floor.y < candidate.y) {
                candidate = floor;
            }
        }
    });
    return candidate;
}

function hasStandClearance(x, bottom, width, standingHeight) {
    if (!CONFIG.FLOORS || CONFIG.FLOORS.length === 0) return true;
    const standTop = bottom - standingHeight;
    for (let i = 0; i < CONFIG.FLOORS.length; i += 1) {
        const floor = CONFIG.FLOORS[i];
        const overlapsX = (x + width) > floor.x1 && x < floor.x2;
        if (!overlapsX) continue;
        const ceilY = Number(floor.y) + Number(floor.height || 0);
        if (ceilY > standTop + 0.001 && ceilY < bottom - 0.001) {
            return false;
        }
    }
    return true;
}

function distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

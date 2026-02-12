class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.camera = { x: 0, y: 0 };
        this.jumpPressed = false;
        this.slidePressed = false;
        this.mountPressed = false;
        this.jumpKeys = new Set(['w', ' ']);
        this.crouchKeys = new Set(['s', 'arrowdown', 'control']);
        this.playerCenter = { x: CONFIG.GAME_WIDTH / 2, y: CONFIG.GROUND_Y - CONFIG.PLAYER_HEIGHT / 2 };
        this.activeWeapon = 'arrows';
        this.localLoadout = { arrows: true, longsword: false, shield: false };
        this.rightMouseDown = false;
        this.aimAssistCandidates = [];
        this.isTouchDevice = (!!window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
            || ('ontouchstart' in window)
            || Number(navigator.maxTouchPoints || 0) > 0;
        this.touchInputEnabled = true;
        this.mobileJoystickEl = document.getElementById('mobileJoystick');

        this.touchMove = {
            active: false,
            id: null,
            startScreen: { x: 0, y: 0 },
            currentScreen: { x: 0, y: 0 },
            normalizedX: 0,
            normalizedY: 0,
            radius: 112,
            deadzone: 0.1,
            jumpConsumed: false,
        };
        if (this.mobileJoystickEl) {
            this.mobileJoystickEl.classList.toggle('enabled', this.isTouchDevice);
        }

        this.archerController = window.ArcherController ? new window.ArcherController(this) : null;
        this.swordController = window.SwordController ? new window.SwordController(this) : null;

        this.setupListeners();
        if (this.archerController && typeof this.archerController.attachListeners === 'function') {
            this.archerController.attachListeners();
        }
    }

    setCamera(camera) {
        if (!camera) return;
        this.camera.x = Number(camera.x || 0);
        this.camera.y = Number(camera.y || 0);
    }

    _screenToWorld(e) {
        if (window.ControllerUtils && typeof window.ControllerUtils.screenToWorld === 'function') {
            return window.ControllerUtils.screenToWorld(this.canvas, this.camera, e);
        }

        const rect = this.canvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;
        const viewW = CONFIG.CAMERA_VIEW_WIDTH || 1600;
        const viewH = CONFIG.CAMERA_VIEW_HEIGHT || 900;
        return {
            x: this.camera.x + nx * viewW,
            y: this.camera.y + ny * viewH,
        };
    }

    _resetTouchMove() {
        this.touchMove.active = false;
        this.touchMove.id = null;
        this.touchMove.normalizedX = 0;
        this.touchMove.normalizedY = 0;
        this.touchMove.jumpConsumed = false;
        if (this.mobileJoystickEl) {
            this.mobileJoystickEl.classList.remove('active');
            this.mobileJoystickEl.style.setProperty('--knob-x', '0px');
            this.mobileJoystickEl.style.setProperty('--knob-y', '0px');
        }
    }

    _positionJoystickAt(screenX, screenY) {
        if (!this.mobileJoystickEl) return;
        const margin = 62;
        const x = Math.max(margin, Math.min(window.innerWidth - margin, Number(screenX || 0)));
        const y = Math.max(margin, Math.min(window.innerHeight - margin, Number(screenY || 0)));
        this.mobileJoystickEl.style.left = `${x}px`;
        this.mobileJoystickEl.style.top = `${y}px`;
    }

    _refreshJoystickVisual() {
        if (!this.mobileJoystickEl) return;
        const knobRange = Math.min(46, this.touchMove.radius * 0.45);
        this.mobileJoystickEl.style.setProperty('--knob-x', `${this.touchMove.normalizedX * knobRange}px`);
        this.mobileJoystickEl.style.setProperty('--knob-y', `${this.touchMove.normalizedY * knobRange}px`);
    }

    setTouchInputEnabled(enabled) {
        const nextEnabled = !!enabled;
        if (this.touchInputEnabled === nextEnabled) return;
        this.touchInputEnabled = nextEnabled;
        if (!nextEnabled) {
            this._resetTouchMove();
            if (this.archerController) {
                this.archerController.isDragging = false;
                this.archerController.touchAim.active = false;
                this.archerController.touchAim.id = null;
                this.archerController.holdStartMs = 0;
                this.archerController.resetShoot();
            }
        }
    }

    setAimAssistContext(localPlayer, players) {
        if (!localPlayer || !Array.isArray(players)) {
            this.aimAssistCandidates = [];
            return;
        }

        const localId = Number(localPlayer.id);
        const localTeam = localPlayer.team;
        this.aimAssistCandidates = players
            .filter((player) => {
                if (!player || !player.alive) return false;
                const playerId = Number(player.id);
                if (Number.isFinite(localId) && playerId === localId) return false;
                if (localTeam && player.team && player.team === localTeam) return false;
                return true;
            })
            .map((player) => ({
                id: player.id,
                x: Number(player.x || 0) + Number(player.width || CONFIG.PLAYER_WIDTH || 40) * 0.5,
                y: Number(player.y || 0) + Number(player.height || CONFIG.PLAYER_HEIGHT || 80) * 0.5,
            }));
    }

    getAimAssistCandidates() {
        return this.aimAssistCandidates;
    }

    _startTouchMove(touch) {
        this.touchMove.active = true;
        this.touchMove.id = touch.identifier;
        this.touchMove.startScreen.x = touch.clientX;
        this.touchMove.startScreen.y = touch.clientY;
        this.touchMove.currentScreen.x = touch.clientX;
        this.touchMove.currentScreen.y = touch.clientY;
        this.touchMove.normalizedX = 0;
        this.touchMove.normalizedY = 0;
        this.touchMove.jumpConsumed = false;
        this._positionJoystickAt(touch.clientX, touch.clientY);
        if (this.mobileJoystickEl) {
            this.mobileJoystickEl.classList.add('active');
        }
        this._refreshJoystickVisual();
    }

    _updateTouchMove(touch) {
        this.touchMove.currentScreen.x = touch.clientX;
        this.touchMove.currentScreen.y = touch.clientY;

        const vector = window.ControllerUtils && typeof window.ControllerUtils.calculateJoystickVector === 'function'
            ? window.ControllerUtils.calculateJoystickVector(
                this.touchMove.startScreen,
                this.touchMove.currentScreen,
                this.touchMove.radius,
                this.touchMove.deadzone
            )
            : null;

        if (vector) {
            this.touchMove.normalizedX = Math.sign(vector.normalizedX) * Math.pow(Math.abs(vector.normalizedX), 0.82);
            this.touchMove.normalizedY = Math.sign(vector.normalizedY) * Math.pow(Math.abs(vector.normalizedY), 0.82);
            this._refreshJoystickVisual();
        }

        if (this.touchMove.normalizedY < -0.8 && !this.touchMove.jumpConsumed) {
            this.jumpPressed = true;
            this.touchMove.jumpConsumed = true;
        } else if (this.touchMove.normalizedY > -0.35) {
            this.touchMove.jumpConsumed = false;
        }
    }

    setupListeners() {
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            if (this.jumpKeys.has(key)) {
                this.jumpPressed = true;
            }
            if (this.crouchKeys.has(key)) {
                this.slidePressed = true;
            }
            if (key === 'e') {
                this.mountPressed = true;
                e.preventDefault();
            }
            if (key === 'r' && CONFIG.ENABLE_MANUAL_SURRENDER) {
                // Manual respawn/surrender
                if (window.game && window.game.localPlayer) {
                    const player = window.game.localPlayer;
                    // Only allow surrender if player is ragdolled
                    if (player.ragdollParts && (!player.alive || !player.ragdollMotorsEnabled)) {
                        window.game.requestPlayerRespawn(player.id);
                    }
                }
                e.preventDefault();
            }
            if (this.swordController && typeof this.swordController.handleKeyDown === 'function') {
                this.swordController.handleKeyDown(e);
            }

            if (['w', 'a', 's', 'd', ' ', 'shift', 'arrowdown', 'control'].includes(key)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });

        window.addEventListener('touchstart', (e) => {
            if (!this.touchInputEnabled) return;
            const target = e.target;
            if (target && target.closest && target.closest('button, a, input, textarea, select, [data-weapon]')) {
                return;
            }
            let handled = false;
            
            for (const touch of e.changedTouches) {
                const rect = this.canvas.getBoundingClientRect();
                const touchX = touch.clientX - rect.left;
                const screenMidpoint = rect.width / 2;
                const isLeftSide = touchX < screenMidpoint;
                
                // Left side of screen: movement joystick
                if (isLeftSide && !this.touchMove.active) {
                    this._startTouchMove(touch);
                    handled = true;
                }
                // Right side of screen with arrows: aiming
                else if (!isLeftSide && this.archerController && this.activeWeapon === 'arrows') {
                    handled = this.archerController.startTouchAim(touch) || handled;
                }
                // Fallback: if no movement active yet, start movement
                else if (!this.touchMove.active) {
                    this._startTouchMove(touch);
                    handled = true;
                }
            }
            if (handled) {
                e.preventDefault();
            }
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            if (!this.touchInputEnabled) return;
            let handled = false;
            for (const touch of e.changedTouches) {
                if (this.touchMove.active && touch.identifier === this.touchMove.id) {
                    this._updateTouchMove(touch);
                    handled = true;
                }
                if (this.archerController && this.activeWeapon === 'arrows') {
                    handled = this.archerController.updateTouchAim(touch) || handled;
                }
            }
            if (handled) {
                e.preventDefault();
            }
        }, { passive: false });

        const releaseTouch = (e) => {
            if (!this.touchInputEnabled) return;
            let handled = false;
            for (const touch of e.changedTouches) {
                if (this.touchMove.active && touch.identifier === this.touchMove.id) {
                    this._resetTouchMove();
                    handled = true;
                }
                if (this.archerController && this.activeWeapon === 'arrows') {
                    handled = this.archerController.releaseTouchAim(touch) || handled;
                }
            }
            if (handled) {
                e.preventDefault();
            }
        };

        window.addEventListener('touchend', releaseTouch, { passive: false });
        window.addEventListener('touchcancel', releaseTouch, { passive: false });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('mousemove', (e) => {
            const w = this._screenToWorld(e);
            this.mouse.x = w.x;
            this.mouse.y = w.y;
        });
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2) {
                this.rightMouseDown = true;
                e.preventDefault();
            }
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) {
                this.rightMouseDown = false;
                e.preventDefault();
            }
        });
    }

    _resolveActiveWeapon(player) {
        if (player && player.usingBallistaSide) {
            this.activeWeapon = 'arrows';
            return;
        }
        const loadout = this.localLoadout || (player && player.loadout ? player.loadout : null);
        this.activeWeapon = loadout && loadout.longsword ? 'longsword' : 'arrows';
    }

    setLoadout(loadout) {
        this.localLoadout = {
            arrows: !!(loadout && loadout.arrows),
            longsword: !!(loadout && loadout.longsword),
            shield: !!(loadout && loadout.shield),
        };
        this._resolveActiveWeapon();
    }

    getInput(player) {
        if (player) {
            this.playerCenter.x = player.x + player.width / 2;
            this.playerCenter.y = player.y + player.height / 2;
            this._resolveActiveWeapon(player);
        }

        const keyboardAxis = (this.keys['d'] ? 1 : 0) + (this.keys['a'] ? -1 : 0);
        const touchAxis = this.touchMove.active ? this.touchMove.normalizedX : 0;
        const moveAxis = Math.abs(touchAxis) > 0.01 ? touchAxis : keyboardAxis;

        const archerPayload = this.archerController
            ? this.archerController.getInputPayload()
            : { aimAngle: 0, bowDrawn: false, drawPower: 0, shoot: false, shootAngle: 0, shootPower: 0 };

        const swordPayload = this.swordController
            ? this.swordController.getInputPayload()
            : { swordAttack: null };
        const blockHeld = !!(this.keys['f'] || this.rightMouseDown);
        const sprintHeldTouch = this.touchMove.active && Math.abs(touchAxis) > 0.86;
        const sprintHeld = !!this.keys['shift'] || sprintHeldTouch;
        const hasShield = !!(this.localLoadout && this.localLoadout.shield);
        const canBlock = hasShield && this.activeWeapon === 'longsword';
        const crouchHeldKeyboard = this.crouchKeys.has('s') && this.keys['s']
            || this.crouchKeys.has('arrowdown') && this.keys['arrowdown']
            || this.crouchKeys.has('control') && (this.keys['control'] || this.keys['ctrl']);
        const crouchHeldTouch = this.touchMove.active && this.touchMove.normalizedY > 0.45;
        const dx = Number(this.mouse.x || 0) - this.playerCenter.x;
        const dy = Number(this.mouse.y || 0) - this.playerCenter.y;
        const blockAngle = Math.hypot(dx, dy) > 0.001
            ? Math.atan2(dy, dx)
            : (player && Number(player.facingDir || (player.team === 'RED' ? 1 : -1)) < 0 ? Math.PI : 0);

        return {
            left: moveAxis < -0.12,
            right: moveAxis > 0.12,
            jumpPressed: this.consumeJumpPressed(),
            mountPressed: this.consumeMountPressed(),
            aimAngle: archerPayload.aimAngle,
            bowDrawn: archerPayload.bowDrawn,
            drawPower: archerPayload.drawPower,
            shoot: archerPayload.shoot,
            shootAngle: archerPayload.shootAngle,
            shootPower: archerPayload.shootPower,
            crouch: !!(crouchHeldKeyboard || crouchHeldTouch),
            slidePressed: this.consumeSlidePressed(),
            swordAttack: swordPayload.swordAttack,
            sprint: sprintHeld,
            shieldBlock: canBlock && blockHeld,
            shieldBlockAngle: blockAngle,
        };
    }

    resetShoot() {
        if (this.archerController && typeof this.archerController.resetShoot === 'function') {
            this.archerController.resetShoot();
        }
    }

    consumeJumpPressed() {
        const pressed = this.jumpPressed;
        this.jumpPressed = false;
        return pressed;
    }

    consumeMountPressed() {
        const pressed = this.mountPressed;
        this.mountPressed = false;
        return pressed;
    }

    consumeSlidePressed() {
        const pressed = this.slidePressed;
        this.slidePressed = false;
        return pressed;
    }

    getDragInfo(player) {
        if (player) {
            this.playerCenter.x = player.x + player.width / 2;
            this.playerCenter.y = player.y + player.height / 2;
            this._resolveActiveWeapon(player);
        }
        if (!this.archerController || typeof this.archerController.getDragInfo !== 'function') {
            return null;
        }
        return this.archerController.getDragInfo();
    }
}

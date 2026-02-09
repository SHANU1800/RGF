(function () {
    class ArcherController {
        constructor(inputManager) {
            this.input = inputManager;
            this.isDragging = false;
            this.dragStart = { x: 0, y: 0 };
            this.dragCurrent = { x: 0, y: 0 };
            this.lastDragPower = 0;
            this.lastDragAngle = 0;
            this.shouldShoot = false;
            this.touchAim = { active: false, id: null };
            this.dragInputMode = 'mouse';
            this.holdStartMs = 0;
            this.maxHoldMs = 1800;
            this.maxHoldBonus = 45;
            this.idealReleaseMs = 720;
            this.releaseWindowMs = 230;
            this.releaseWindowBonus = 12;
            this.aimAssistStrength = 0.62;
            this.aimAssistConeRad = 0.24;
            this.aimAssistMaxCorrectionRad = 0.12;
            this.aimAssistMaxRange = 720;
        }

        isActive() {
            return this.input.activeWeapon === 'arrows';
        }

        attachListeners() {
            const canvas = this.input.canvas;

            canvas.addEventListener('mousemove', (e) => {
                if (!this.isActive() && !this.isDragging) return;
                const w = this.input._screenToWorld(e);
                this.input.mouse.x = w.x;
                this.input.mouse.y = w.y;
                if (this.isDragging) {
                    this.dragCurrent.x = w.x;
                    this.dragCurrent.y = w.y;
                }
            });

            canvas.addEventListener('mousedown', (e) => {
                if (!this.isActive()) return;
                const w = this.input._screenToWorld(e);
                this.input.mouse.x = w.x;
                this.input.mouse.y = w.y;
                this.beginDrag(w, 'mouse');
            });

            window.addEventListener('mouseup', (e) => {
                if (this.isDragging) {
                    const w = this.input._screenToWorld(e);
                    this.input.mouse.x = w.x;
                    this.input.mouse.y = w.y;
                    this.dragCurrent.x = w.x;
                    this.dragCurrent.y = w.y;
                    this.commitShot();
                }
                this.isDragging = false;
            });

            canvas.addEventListener('mouseleave', () => {
                if (this.isDragging) {
                    this.commitShot();
                }
                this.isDragging = false;
            });
        }

        beginDrag(worldPoint, source = 'mouse') {
            this.isDragging = true;
            this.dragStart.x = this.input.playerCenter.x;
            this.dragStart.y = this.input.playerCenter.y;
            this.dragCurrent.x = worldPoint.x;
            this.dragCurrent.y = worldPoint.y;
            this.dragInputMode = source === 'touch' || source === 'controller' ? source : 'mouse';
            this.holdStartMs = performance.now();
        }

        updateDrag(worldPoint) {
            this.dragCurrent.x = worldPoint.x;
            this.dragCurrent.y = worldPoint.y;
        }

        commitShot() {
            if (!this.isDragging) return;

            const shot = this._calculateCurrentShot(12);

            if (shot.canShoot) {
                this.lastDragPower = shot.power;
                this.lastDragAngle = shot.angle;
                this.shouldShoot = true;
            }
        }

        _holdMetrics() {
            if (!this.holdStartMs) {
                return { heldMs: 0, ratio: 0, holdBonus: 0 };
            }
            const heldMs = Math.max(0, performance.now() - this.holdStartMs);
            const ratio = Math.min(1, heldMs / this.maxHoldMs);
            // Ease-in draw tension: early pull ramps quickly, then stabilizes.
            const eased = 1 - Math.pow(1 - ratio, 1.85);
            return {
                heldMs,
                ratio,
                holdBonus: this.maxHoldBonus * eased,
            };
        }

        _timingBonusPower(heldMs) {
            if (!Number.isFinite(heldMs) || heldMs <= 0) return 0;
            const spread = Math.max(80, this.releaseWindowMs);
            const delta = (heldMs - this.idealReleaseMs) / spread;
            const gaussian = Math.exp(-0.5 * delta * delta);
            return this.releaseWindowBonus * gaussian;
        }

        _calculateCurrentShot(minDistance) {
            const baseShot = window.ControllerUtils && typeof window.ControllerUtils.calculateDragShot === 'function'
                ? window.ControllerUtils.calculateDragShot(this.input.playerCenter, this.dragCurrent, minDistance)
                : this._fallbackShotFromPlayerCenter(minDistance);
            const assistedShot = this._withAimAssist(baseShot);
            const hold = this._holdMetrics();
            const timingBonus = this._timingBonusPower(hold.heldMs || 0);
            const timingScore = Math.max(0, Math.min(1, timingBonus / Math.max(1, this.releaseWindowBonus)));
            return {
                ...assistedShot,
                power: Math.min(100, assistedShot.power + hold.holdBonus + timingBonus),
                holdMs: hold.heldMs || 0,
                timingScore,
            };
        }

        _withAimAssist(shot) {
            if (!shot || !shot.canShoot) return shot;
            const mode = this.dragInputMode;
            if (mode !== 'touch' && mode !== 'controller') {
                return shot;
            }
            const utils = window.ControllerUtils;
            if (!utils || typeof utils.applyBowAimAssist !== 'function') {
                return shot;
            }
            const candidates = this.input && typeof this.input.getAimAssistCandidates === 'function'
                ? this.input.getAimAssistCandidates()
                : [];
            if (!Array.isArray(candidates) || candidates.length === 0) {
                return shot;
            }

            const assisted = utils.applyBowAimAssist(
                this.input.playerCenter,
                shot.angle,
                candidates,
                {
                    strength: this.aimAssistStrength,
                    assistConeRad: this.aimAssistConeRad,
                    maxCorrectionRad: this.aimAssistMaxCorrectionRad,
                    maxRange: this.aimAssistMaxRange,
                }
            );

            if (!assisted || !assisted.assisted) {
                return shot;
            }
            return {
                ...shot,
                angle: assisted.angle,
            };
        }

        _fallbackShotFromPlayerCenter(minDistance) {
            const dx = this.input.playerCenter.x - this.dragCurrent.x;
            const dy = this.input.playerCenter.y - this.dragCurrent.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= Number(minDistance || 16)) {
                return { canShoot: false, power: 0, angle: 0, distance };
            }
            return {
                canShoot: true,
                power: Math.min(distance / 2, 100),
                angle: Math.atan2(dy, dx),
                distance,
            };
        }

        startTouchAim(touch) {
            if (!this.isActive() || this.touchAim.active) return false;
            const w = this.input._screenToWorld({ clientX: touch.clientX, clientY: touch.clientY });
            this.input.mouse.x = w.x;
            this.input.mouse.y = w.y;
            this.touchAim.active = true;
            this.touchAim.id = touch.identifier;
            this.beginDrag(w, 'touch');
            return true;
        }

        updateTouchAim(touch) {
            if (!this.touchAim.active || touch.identifier !== this.touchAim.id) return false;
            const w = this.input._screenToWorld({ clientX: touch.clientX, clientY: touch.clientY });
            this.input.mouse.x = w.x;
            this.input.mouse.y = w.y;
            if (this.isDragging) {
                this.updateDrag(w);
            }
            return true;
        }

        releaseTouchAim(touch) {
            if (!this.touchAim.active || touch.identifier !== this.touchAim.id) return false;
            if (this.isDragging) {
                this.commitShot();
            }
            this.isDragging = false;
            this.touchAim.active = false;
            this.touchAim.id = null;
            return true;
        }

        getInputPayload() {
            if (!this.isActive()) {
                this.isDragging = false;
                this.touchAim.active = false;
                this.touchAim.id = null;
                this.shouldShoot = false;
                this.holdStartMs = 0;
                return {
                    aimAngle: 0,
                    bowDrawn: false,
                    drawPower: 0,
                    shoot: false,
                    shootAngle: 0,
                    shootPower: 0,
                };
            }

            let aimAngle = 0;
            let drawPower = 0;
            if (this.isDragging) {
                const shot = this._calculateCurrentShot(0);
                aimAngle = shot.angle;
                drawPower = shot.power;
            } else {
                const dx = this.input.mouse.x - this.input.playerCenter.x;
                const dy = this.input.mouse.y - this.input.playerCenter.y;
                if (Math.hypot(dx, dy) > 0.001) {
                    aimAngle = Math.atan2(dy, dx);
                }
            }

            return {
                aimAngle,
                bowDrawn: this.isDragging,
                drawPower,
                shoot: this.shouldShoot,
                shootAngle: this.lastDragAngle,
                shootPower: this.lastDragPower,
            };
        }

        resetShoot() {
            this.shouldShoot = false;
            this.lastDragPower = 0;
            this.lastDragAngle = 0;
        }

        getDragInfo() {
            if (!this.isActive() || !this.isDragging) return null;
            this.dragStart.x = this.input.playerCenter.x;
            this.dragStart.y = this.input.playerCenter.y;
            const shot = this._calculateCurrentShot(0);
            return {
                startX: this.dragStart.x,
                startY: this.dragStart.y,
                currentX: this.dragCurrent.x,
                currentY: this.dragCurrent.y,
                drawPower: shot.power,
                holdMs: shot.holdMs,
                timingScore: shot.timingScore,
            };
        }
    }

    window.ArcherController = ArcherController;
})();

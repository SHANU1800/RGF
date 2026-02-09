class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.camera = { x: 0, y: 0 };
        this.scaleXFactor = 1;
        this.scaleYFactor = 1;
        this.resize();
        
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        const viewW = CONFIG.CAMERA_VIEW_WIDTH || 1600;
        const viewH = CONFIG.CAMERA_VIEW_HEIGHT || 900;
        this.scaleXFactor = this.canvas.width / viewW;
        this.scaleYFactor = this.canvas.height / viewH;
    }

    setCamera(worldX, worldY, options = {}) {
        const viewW = CONFIG.CAMERA_VIEW_WIDTH || 1600;
        const viewH = CONFIG.CAMERA_VIEW_HEIGHT || 900;
        const halfW = viewW / 2;
        const halfH = viewH / 2;
        const offsetX = Number(options.offsetX || 0);
        const offsetY = Number(options.offsetY || 0);

        let cx = worldX - halfW + (Number.isFinite(offsetX) ? offsetX : 0);
        let cy = worldY - halfH + (Number.isFinite(offsetY) ? offsetY : 0);

        cx = Math.max(0, Math.min(CONFIG.GAME_WIDTH - viewW, cx));
        cy = Math.max(0, Math.min(CONFIG.GAME_HEIGHT - viewH, cy));

        this.camera.x = cx;
        this.camera.y = cy;
    }

    clear() {
        // Use SkyRenderer module if available
        if (window.SkyRenderer) {
            window.SkyRenderer.render(
                this.ctx, 
                this.camera.x, 
                this.scaleXFactor, 
                this.canvas.width, 
                this.canvas.height
            );
        } else {
            // Fallback to inline rendering
            const sky = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
            sky.addColorStop(0, '#6bb5ff');
            sky.addColorStop(1, '#d7f0ff');
            this.ctx.fillStyle = sky;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.drawParallaxLayer(0.2, '#7aa3b5', 0.6);
            this.drawParallaxLayer(0.4, '#5f8799', 0.8);
        }
    }

    drawParallaxLayer(factor, color, heightFactor) {
        const ctx = this.ctx;
        const baseY = this.canvas.height * heightFactor;
        const offset = -this.camera.x * factor * this.scaleXFactor;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(offset, baseY);
        const step = this.canvas.width / 5;
        for (let i = 0; i <= 6; i++) {
            const x = offset + i * step;
            const y = baseY - (Math.sin((i + 1) * 1.2) * 40 + 30);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(offset + this.canvas.width + step, this.canvas.height);
        ctx.lineTo(offset - step, this.canvas.height);
        ctx.closePath();
        ctx.fill();
    }
    
    drawGround() {
        const floors = CONFIG.FLOORS || [{ y: CONFIG.GROUND_Y, height: 40, x1: 0, x2: CONFIG.GAME_WIDTH }];
        if (floors.length === 0) return;
        
        const base = floors[0];
        
        // Use modular Ground Renderer if available
        if (window.GroundRenderer) {
            window.GroundRenderer.render(
                this.ctx,
                (y) => this.scaleY(y),
                this.canvas.width,
                this.canvas.height,
                CONFIG
            );
        } else {
            // Fallback to inline rendering
            const baseY = this.scaleY(base.y);
            const baseHeight = this.canvas.height - baseY;
            
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(0, baseY, this.canvas.width, baseHeight);
            
            this.ctx.fillStyle = '#2f9e44';
            this.ctx.fillRect(0, baseY - 12, this.canvas.width, 12);
        }
        
        // Use modular Floors Renderer for additional platforms
        if (window.FloorsRenderer) {
            window.FloorsRenderer.render(
                this.ctx,
                (x) => this.scaleX(x),
                (y) => this.scaleY(y),
                (len) => this.scaleLengthX(len),
                this.scaleYFactor,
                CONFIG
            );
        } else {
            // Fallback: Additional platforms
            for (let i = 1; i < floors.length; i++) {
                const floor = floors[i];
                const y = this.scaleY(floor.y);
                const height = (floor.height || 16) * this.scaleYFactor;
                const x = this.scaleX(floor.x1);
                const width = this.scaleLengthX(floor.x2 - floor.x1);
                
                const gradient = this.ctx.createLinearGradient(0, y, 0, y + height);
                gradient.addColorStop(0, '#a17952');
                gradient.addColorStop(1, '#7a5637');
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(x, y, width, height);
                
                this.ctx.fillStyle = '#3f9b3f';
                this.ctx.fillRect(x, y - 6, width, 6);
            }
        }

        // Use modular Castle Renderer
        if (window.CastleRenderer) {
            window.CastleRenderer.renderCastles(
                this.ctx,
                (x) => this.scaleX(x),
                (y) => this.scaleY(y),
                (len) => this.scaleLengthX(len),
                (len) => this.scaleLengthY(len),
                base.y,
                CONFIG,
                this.canvas.width,
                this.canvas.height
            );
        } else {
            // Fallback: World landmarks
            this.drawCastle(130, base.y, 'RED');
            this.drawCastle(CONFIG.GAME_WIDTH - 130, base.y, 'BLUE');
        }
    }

    drawHorses(horses) {
        if (!Array.isArray(horses) || !window.HorseRenderer) return;
        horses.forEach((horse) => {
            if (!horse) return;
            window.HorseRenderer.render(
                this.ctx,
                (x) => this.scaleX(x),
                (y) => this.scaleY(y),
                (len) => this.scaleLengthX(len),
                (len) => this.scaleLengthY(len),
                horse
            );
        });
    }

    drawCastle(worldX, groundY, side) {
        const x = this.scaleX(worldX);
        const y = this.scaleY(groundY);
        const w = this.scaleLengthX(170);
        const h = this.scaleLengthY(220);
        const towerW = this.scaleLengthX(58);
        const towerH = this.scaleLengthY(290);
        const xMin = Math.min(x - w * 0.55 - towerW, x - w * 0.45);
        const xMax = Math.max(x + w * 0.55 + towerW, x + w * 0.45);
        const yTop = y - towerH - 40;
        if (xMax < -50 || xMin > this.canvas.width + 50 || yTop > this.canvas.height + 50) {
            return;
        }

        const wallColor = side === 'RED' ? '#a06a63' : '#6b7ea1';
        const towerColor = side === 'RED' ? '#8f5b55' : '#5f6f90';
        const trimColor = side === 'RED' ? '#d7a39a' : '#9ec2ff';

        // Main keep.
        this.ctx.fillStyle = wallColor;
        this.ctx.fillRect(x - w * 0.45, y - h, w * 0.9, h);
        this.ctx.strokeStyle = 'rgba(20,20,20,0.35)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x - w * 0.45, y - h, w * 0.9, h);

        // Side towers.
        this.ctx.fillStyle = towerColor;
        this.ctx.fillRect(x - w * 0.55 - towerW, y - towerH, towerW, towerH);
        this.ctx.fillRect(x + w * 0.55, y - towerH, towerW, towerH);

        // Battlements.
        const crenelW = w * 0.1;
        const crenelH = this.scaleLengthY(22);
        this.ctx.fillStyle = trimColor;
        for (let i = -4; i <= 3; i++) {
            const bx = x + i * crenelW * 1.1;
            this.ctx.fillRect(bx, y - h - crenelH, crenelW, crenelH);
        }
        this.ctx.fillRect(x - w * 0.55 - towerW, y - towerH - crenelH, towerW, crenelH);
        this.ctx.fillRect(x + w * 0.55, y - towerH - crenelH, towerW, crenelH);

        // Gate.
        const gateW = w * 0.2;
        const gateH = h * 0.32;
        this.ctx.fillStyle = '#3b2b1f';
        this.ctx.beginPath();
        this.ctx.moveTo(x - gateW / 2, y);
        this.ctx.lineTo(x - gateW / 2, y - gateH * 0.65);
        this.ctx.quadraticCurveTo(x, y - gateH, x + gateW / 2, y - gateH * 0.65);
        this.ctx.lineTo(x + gateW / 2, y);
        this.ctx.closePath();
        this.ctx.fill();

        // Banner.
        const poleX = side === 'RED' ? x - w * 0.2 : x + w * 0.2;
        const poleTop = y - h - this.scaleLengthY(65);
        this.ctx.strokeStyle = '#2f2f2f';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(poleX, y - h);
        this.ctx.lineTo(poleX, poleTop);
        this.ctx.stroke();
        this.ctx.fillStyle = side === 'RED' ? '#e74c3c' : '#3498db';
        this.ctx.beginPath();
        this.ctx.moveTo(poleX, poleTop);
        this.ctx.lineTo(poleX + (side === 'RED' ? -1 : 1) * this.scaleLengthX(36), poleTop + this.scaleLengthY(8));
        this.ctx.lineTo(poleX, poleTop + this.scaleLengthY(20));
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawPlayer(player, renderOptions = {}) {
        if (!player.alive && player.ragdollParts) {
            this.drawRagdoll(player);
            return;
        }
        const stickmanLod = Math.max(0, Math.min(2, Number(renderOptions.stickmanLod || 0)));
        const x = this.scaleX(player.x);
        const y = this.scaleY(player.y);
        const w = this.scaleLengthX(player.width);
        const h = this.scaleLengthY(player.height);
        const facing = player.facingDir || (player.team === 'RED' ? 1 : -1);
        const aimAngleWorld = Number(player.aimAngle || 0);
        const aimAngleLocal = facing >= 0 ? aimAngleWorld : (Math.PI - aimAngleWorld);
        const mountedAimOffset = this._computeMountedAimOffset(player, aimAngleLocal);
        const renderedAimAngleLocal = aimAngleLocal + mountedAimOffset;
        const renderedAimAngleWorld = facing >= 0
            ? (aimAngleWorld + mountedAimOffset)
            : (aimAngleWorld - mountedAimOffset);
        const releaseRatio = typeof player.bowReleaseRatio === 'function'
            ? Math.max(0, Math.min(1, Number(player.bowReleaseRatio() || 0)))
            : 0;
        const isCriticalPose = player.isMe || player.bowDrawn || releaseRatio > 0.01 || (player.swordPhase && player.swordPhase !== 'idle');
        const useSimplifiedStickman = stickmanLod >= 2 && !isCriticalPose;
        
        this.ctx.save();
        this.ctx.translate(x + w / 2, y + h / 2);
        this.ctx.scale(facing, 1);
        const recoil = releaseRatio * h * Number(player.bowRecoilKick || 0);
        if (recoil > 0.01) {
            this.ctx.translate(-recoil, 0);
        }

        const hasUnifiedStickman = window.Stickman && typeof window.Stickman.draw === 'function';
        const hasPartModules =
            window.StickmanHead && typeof window.StickmanHead.drawHead === 'function' &&
            window.StickmanTorso && typeof window.StickmanTorso.drawTorso === 'function' &&
            window.StickmanArms && typeof window.StickmanArms.drawArms === 'function' &&
            window.StickmanLegs && typeof window.StickmanLegs.drawLegs === 'function';

        if (hasUnifiedStickman && !useSimplifiedStickman) {
            window.Stickman.draw(this.ctx, {
                player,
                w,
                h,
                color: player.color,
                vx: player.vx,
                vy: player.vy,
                onGround: !!player.onGround,
                aimAngle: aimAngleLocal,
                mountedAimOffset,
                bowDrawn: !!player.bowDrawn,
                drawPower: Number(player.drawPower || 0),
                attackType: player.swordAttack || player.swordSwingAttack || 'slash',
                shieldBlocking: !!player.shieldBlocking,
                shieldBlockAngle: Number(player.shieldBlockAngle || renderedAimAngleLocal || 0),
                loadout: player.loadout,
                healthRatio: Math.max(0, Math.min(1, player.maxHealth > 0 ? (player.health / player.maxHealth) : 1)),
            });
        } else if (hasPartModules) {
            window.StickmanHead.drawHead(this.ctx, h);
            window.StickmanTorso.drawTorso(this.ctx, h, player.color);
            window.StickmanArms.drawArms(this.ctx, h, renderedAimAngleLocal, player.color);
            window.StickmanLegs.drawLegs(this.ctx, w, h, player.color, player.vx);
        } else {
            const headRadius = h * 0.25;
            this.ctx.fillStyle = '#FFD700';
            this.ctx.beginPath();
            this.ctx.arc(0, -h * 0.3, headRadius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.strokeStyle = player.color;
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';

            this.ctx.beginPath();
            this.ctx.moveTo(0, -h * 0.1);
            this.ctx.lineTo(0, h * 0.2);
            this.ctx.stroke();

            const armAngle = renderedAimAngleLocal;
            const armLength = h * 0.3;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -h * 0.05);
            this.ctx.lineTo(Math.cos(armAngle) * armLength, Math.sin(armAngle) * armLength);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(0, h * 0.2);
            this.ctx.lineTo(-w * 0.3, h * 0.5);
            this.ctx.stroke();

            this.ctx.beginPath();
            this.ctx.moveTo(0, h * 0.2);
            this.ctx.lineTo(w * 0.3, h * 0.5);
            this.ctx.stroke();
        }

        const drawEquipment = stickmanLod <= 1 || isCriticalPose;
        if (drawEquipment) {
            this.drawEquippedWeapons(player, w, h);
        }
        const drawBowRig = stickmanLod <= 1 || player.isMe || player.bowDrawn || releaseRatio > 0.02;
        if (drawBowRig) {
            this.drawBowRig(player, h, renderedAimAngleLocal);
        }
        
        this.ctx.restore();
        
        // Use StatsRenderer module if available
        if (window.StatsRenderer) {
            window.StatsRenderer.render(
                this.ctx,
                player,
                x,
                y,
                w,
                (kind, cx, cy, size) => this.drawWeaponGlyph(kind, cx, cy, size)
            );
        } else {
            // Fallback to inline stats rendering
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(player.nickname, x + w / 2, y - 10);
            
            const healthBarWidth = w;
            const healthBarHeight = 5;
            const healthPercent = player.health / player.maxHealth;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(x, y - 20, healthBarWidth, healthBarHeight);
            
            this.ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
            this.ctx.fillRect(x, y - 20, healthBarWidth * healthPercent, healthBarHeight);
            
            this.drawLoadoutBadges(player, x, y, w);
        }
        
        // Use BowVisuals module for draw power indicator if available
        if (player.bowDrawn && player.drawPower > 0 && stickmanLod <= 1) {
            if (window.BowVisuals && typeof window.BowVisuals.drawDrawPowerIndicator === 'function') {
                const indicatorPlayer = mountedAimOffset !== 0
                    ? { ...player, aimAngle: renderedAimAngleWorld }
                    : player;
                window.BowVisuals.drawDrawPowerIndicator(this.ctx, indicatorPlayer, x, y, w, h);
            } else {
                // Fallback: Draw aim trajectory line
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                this.ctx.lineWidth = 3;
                this.ctx.setLineDash([10, 5]);
                
                const powerScale = player.drawPower / 100;
                const lineLength = 100 * powerScale;
                
                this.ctx.beginPath();
                this.ctx.moveTo(x + w / 2, y + h / 2);
                this.ctx.lineTo(
                    x + w / 2 + Math.cos(renderedAimAngleWorld) * lineLength,
                    y + h / 2 + Math.sin(renderedAimAngleWorld) * lineLength
                );
                this.ctx.stroke();
                this.ctx.setLineDash([]);
                
                // Draw power indicator circle
                this.ctx.strokeStyle = powerScale > 0.7 ? '#e74c3c' : powerScale > 0.4 ? '#f39c12' : '#2ecc71';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.arc(x + w / 2, y + h / 2, 15 + powerScale * 20, 0, Math.PI * 2 * powerScale);
                this.ctx.stroke();
            }
        }
    }

    drawBowRig(player, h, aimAngle) {
        if (window.BowVisuals && typeof window.BowVisuals.drawBowRig === 'function') {
            const localPlayer = { ...player, aimAngle: aimAngle };
            window.BowVisuals.drawBowRig(this.ctx, localPlayer, h);
            return;
        }

        const ctx = this.ctx;
        const angle = Number(aimAngle || 0);
        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);
        const perpX = -dirY;
        const perpY = dirX;

        const handX = dirX * h * 0.32;
        const handY = dirY * h * 0.32;
        const bowHalf = h * 0.21;
        const upperX = handX + perpX * bowHalf;
        const upperY = handY + perpY * bowHalf;
        const lowerX = handX - perpX * bowHalf;
        const lowerY = handY - perpY * bowHalf;
        const drawRatio = Math.max(0, Math.min(1, (player.drawPower || 0) / 100));
        const stringPull = player.bowDrawn ? (h * 0.26 + h * 0.18 * drawRatio) : 0;
        const stringX = handX - dirX * stringPull;
        const stringY = handY - dirY * stringPull;
        const glowAlpha = 0.22 + drawRatio * 0.4;

        ctx.save();
        // Bow glow while drawing.
        if (player.bowDrawn) {
            ctx.strokeStyle = `rgba(255, 215, 120, ${glowAlpha})`;
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(upperX, upperY);
            ctx.quadraticCurveTo(handX + dirX * h * 0.16, handY + dirY * h * 0.16, lowerX, lowerY);
            ctx.stroke();
        }

        // Main bow body.
        ctx.strokeStyle = '#6f4b2f';
        ctx.lineWidth = 5.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(upperX, upperY);
        ctx.quadraticCurveTo(handX + dirX * h * 0.18, handY + dirY * h * 0.18, lowerX, lowerY);
        ctx.stroke();

        // Bow string.
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(upperX, upperY);
        if (player.bowDrawn) {
            ctx.lineTo(stringX, stringY);
            ctx.lineTo(lowerX, lowerY);
        } else {
            ctx.lineTo(lowerX, lowerY);
        }
        ctx.stroke();

        // Nocked arrow preview when drawing.
        if (player.bowDrawn) {
            if (window.ArrowVisuals && typeof window.ArrowVisuals.drawNockedArrowPreview === 'function') {
                window.ArrowVisuals.drawNockedArrowPreview(ctx, {
                    dirX,
                    dirY,
                    perpX,
                    perpY,
                    tailX: stringX,
                    tailY: stringY,
                    drawRatio,
                    team: player.team,
                    playerHeight: h,
                });
            }
        }
        ctx.restore();
    }

    _computeMountedAimOffset(player, aimAngleLocal = 0) {
        if (!player || player.mountedHorseId == null) return 0;
        const hasBow = !!(player.loadout && player.loadout.arrows);
        const vy = Number(player.vy || 0);
        const recoil = Number(player.bowRecoilKick || 0) * 0.04;
        const base = hasBow ? -0.12 : -0.06;
        const movementLift = Math.max(-0.03, Math.min(0.04, vy / 1800));
        const aimCorrection = -Math.max(-0.02, Math.min(0.02, Math.sin(Number(aimAngleLocal || 0)) * 0.02));
        return base + movementLift + aimCorrection - recoil;
    }

    drawEquippedWeapons(player, w, h) {
        const handledByModules =
            window.LongswordVisuals &&
            window.ShieldVisuals &&
            window.MiniSwordVisuals &&
            typeof window.LongswordVisuals.drawEquippedLongsword === 'function' &&
            typeof window.ShieldVisuals.drawEquippedShield === 'function' &&
            typeof window.MiniSwordVisuals.drawEquippedMiniSword === 'function';

        if (handledByModules) {
            window.LongswordVisuals.drawEquippedLongsword(this.ctx, player, w, h);
            window.ShieldVisuals.drawEquippedShield(this.ctx, player, w, h);
            window.MiniSwordVisuals.drawEquippedMiniSword(this.ctx, player, w, h);
            return;
        }

        if (!player.loadout) return;
        const ctx = this.ctx;
        const dir = 1;

        // Longsword on back/hip.
        if (player.loadout.longsword) {
            ctx.save();
            ctx.rotate(dir * -0.6);
            ctx.strokeStyle = '#c9d2d6';
            ctx.lineWidth = 4.2;
            ctx.beginPath();
            ctx.moveTo(-w * 0.22, h * 0.18);
            ctx.lineTo(-w * 0.22, -h * 0.42);
            ctx.stroke();
            ctx.strokeStyle = '#4a3b2a';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(-w * 0.31, h * 0.16);
            ctx.lineTo(-w * 0.13, h * 0.16);
            ctx.stroke();
            ctx.restore();
        }

        // Shield on off-hand side.
        if (player.loadout.shield) {
            const sx = -dir * w * 0.26;
            const sy = h * 0.04;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.fillStyle = '#2f6ea4';
            ctx.strokeStyle = '#c8d8e6';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.moveTo(0, -h * 0.17);
            ctx.lineTo(w * 0.15, -h * 0.05);
            ctx.lineTo(w * 0.11, h * 0.17);
            ctx.lineTo(-w * 0.11, h * 0.17);
            ctx.lineTo(-w * 0.15, -h * 0.05);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Mini sword on belt.
        if (player.loadout.miniSword) {
            const mx = dir * w * 0.16;
            const my = h * 0.25;
            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(dir * 0.35);
            ctx.strokeStyle = '#d6dde0';
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -h * 0.28);
            ctx.stroke();
            ctx.strokeStyle = '#6a4b2f';
            ctx.lineWidth = 3.8;
            ctx.beginPath();
            ctx.moveTo(-w * 0.08, 0);
            ctx.lineTo(w * 0.08, 0);
            ctx.stroke();
            ctx.restore();
        }
    }
    
    drawRagdoll(player) {
        if (!player.ragdollParts) return;
        const partsByType = {};
        player.ragdollParts.forEach((part) => {
            partsByType[part.type] = {
                ...part,
                x: this.scaleX(part.x),
                y: this.scaleY(part.y),
                radius: this.scaleLengthX(part.radius),
            };
        });

        const hasUnifiedStickman = window.Stickman && typeof window.Stickman.drawRagdoll === 'function';
        const hasPartModules =
            window.StickmanHead && typeof window.StickmanHead.drawRagdollHead === 'function' &&
            window.StickmanTorso && typeof window.StickmanTorso.drawRagdollTorso === 'function' &&
            window.StickmanArms && typeof window.StickmanArms.drawRagdollArms === 'function' &&
            window.StickmanLegs && typeof window.StickmanLegs.drawRagdollLegs === 'function';

        if (hasUnifiedStickman) {
            window.Stickman.drawRagdoll(this.ctx, partsByType, player.color, {
                severed: player.ragdollSevered || null,
            });
            return;
        }
        if (hasPartModules) {
            window.StickmanTorso.drawRagdollTorso(this.ctx, partsByType, player.color);
            window.StickmanArms.drawRagdollArms(this.ctx, partsByType, player.color);
            window.StickmanLegs.drawRagdollLegs(this.ctx, partsByType, player.color);
            window.StickmanHead.drawRagdollHead(this.ctx, partsByType.head);
            return;
        }

        // Fallback to simple links/joints when part modules are unavailable.
        if (player.ragdollLinks) {
            this.ctx.strokeStyle = player.color;
            this.ctx.lineWidth = 3;
            player.ragdollLinks.forEach(link => {
                const a = player.ragdollParts[link.a];
                const b = player.ragdollParts[link.b];
                this.ctx.beginPath();
                this.ctx.moveTo(this.scaleX(a.x), this.scaleY(a.y));
                this.ctx.lineTo(this.scaleX(b.x), this.scaleY(b.y));
                this.ctx.stroke();
            });
        }

        player.ragdollParts.forEach(part => {
            const x = this.scaleX(part.x);
            const y = this.scaleY(part.y);
            const r = this.scaleLengthX(part.radius);
            this.ctx.fillStyle = part.color;
            this.ctx.beginPath();
            this.ctx.arc(x, y, r, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#111';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
        });
    }
    
    drawLoadoutBadges(player, x, y, w) {
        if (!player.loadout) return;
        const items = [];
        if (player.loadout.arrows) items.push({ kind: 'arrow', color: '#f1c40f', title: 'Arrows' });
        if (player.loadout.longsword) items.push({ kind: 'longsword', color: '#bdc3c7', title: 'Axe' });
        if (player.loadout.shield) items.push({ kind: 'shield', color: '#3498db', title: 'Shield' });
        if (player.loadout.miniSword) items.push({ kind: 'dagger', color: '#9b59b6', title: 'Mini Sword' });
        if (items.length === 0) return;
        
        const size = 18;
        const padding = 4;
        const totalWidth = items.length * size + (items.length - 1) * padding;
        const startX = x + w / 2 - totalWidth / 2;
        const badgeY = y - 34;
        
        items.forEach((item, idx) => {
            const bx = startX + idx * (size + padding);
            this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
            this.ctx.fillRect(bx - 2, badgeY - 2, size + 4, size + 4);
            
            this.ctx.fillStyle = item.color;
            this.ctx.fillRect(bx, badgeY, size, size);

            this.drawWeaponGlyph(item.kind, bx + size / 2, badgeY + size / 2, size * 0.7);
        });
    }

    drawWeaponGlyph(kind, cx, cy, size) {
        const hasGlyphModules =
            window.ArrowWeaponVisuals &&
            window.LongswordVisuals &&
            window.ShieldVisuals &&
            window.MiniSwordVisuals;
        if (hasGlyphModules) {
            if (kind === 'arrow' && typeof window.ArrowWeaponVisuals.drawArrowGlyph === 'function') {
                window.ArrowWeaponVisuals.drawArrowGlyph(this.ctx, cx, cy, size);
                return;
            }
            if (kind === 'longsword' && typeof window.LongswordVisuals.drawLongswordGlyph === 'function') {
                window.LongswordVisuals.drawLongswordGlyph(this.ctx, cx, cy, size);
                return;
            }
            if (kind === 'shield' && typeof window.ShieldVisuals.drawShieldGlyph === 'function') {
                window.ShieldVisuals.drawShieldGlyph(this.ctx, cx, cy, size);
                return;
            }
            if (kind === 'dagger' && typeof window.MiniSwordVisuals.drawMiniSwordGlyph === 'function') {
                window.MiniSwordVisuals.drawMiniSwordGlyph(this.ctx, cx, cy, size);
                return;
            }
        }

        const ctx = this.ctx;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.strokeStyle = '#111';
        ctx.fillStyle = '#111';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (kind === 'arrow') {
            ctx.beginPath();
            ctx.moveTo(-size * 0.38, size * 0.18);
            ctx.lineTo(size * 0.35, -size * 0.18);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(size * 0.35, -size * 0.18);
            ctx.lineTo(size * 0.16, -size * 0.22);
            ctx.lineTo(size * 0.23, -size * 0.03);
            ctx.closePath();
            ctx.fill();
        } else if (kind === 'longsword') {
            ctx.beginPath();
            ctx.moveTo(0, size * 0.34);
            ctx.lineTo(0, -size * 0.36);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-size * 0.2, size * 0.1);
            ctx.lineTo(size * 0.2, size * 0.1);
            ctx.stroke();
        } else if (kind === 'shield') {
            ctx.beginPath();
            ctx.moveTo(0, -size * 0.33);
            ctx.lineTo(size * 0.28, -size * 0.07);
            ctx.lineTo(size * 0.2, size * 0.33);
            ctx.lineTo(-size * 0.2, size * 0.33);
            ctx.lineTo(-size * 0.28, -size * 0.07);
            ctx.closePath();
            ctx.stroke();
        } else if (kind === 'dagger') {
            ctx.beginPath();
            ctx.moveTo(0, size * 0.34);
            ctx.lineTo(0, -size * 0.25);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-size * 0.14, size * 0.12);
            ctx.lineTo(size * 0.14, size * 0.12);
            ctx.stroke();
        }
        ctx.restore();
    }
    
    drawArrow(arrow) {
        if (window.ArrowVisuals && typeof window.ArrowVisuals.drawArrow === 'function') {
            window.ArrowVisuals.drawArrow(this.ctx, {
                scaleX: (v) => this.scaleX(v),
                scaleY: (v) => this.scaleY(v),
                scaleLengthX: (v) => this.scaleLengthX(v),
            }, arrow);
            return;
        }

        const x = this.scaleX(arrow.x);
        const y = this.scaleY(arrow.y);
        this.ctx.save();
        this.ctx.fillStyle = '#b99367';
        this.ctx.fillRect(x - 16, y - 2, 32, 4);
        this.ctx.restore();
    }

    drawEmbeddedProjectile(projectileLike, options = {}) {
        const worldX = Number(projectileLike && projectileLike.x);
        const worldY = Number(projectileLike && projectileLike.y);
        if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return;
        const angle = Number.isFinite(Number(projectileLike.angle)) ? Number(projectileLike.angle) : 0;
        const depth = Math.max(10, Number(projectileLike.depth || 20));
        const alpha = Math.max(0, Math.min(1, Number(options.alpha != null ? options.alpha : 1)));
        if (alpha <= 0.001) return;

        const x = this.scaleX(worldX);
        const y = this.scaleY(worldY);
        const len = this.scaleLengthX(depth + 14);
        const shaftW = Math.max(1.1, this.scaleLengthX(2.6));
        const source = String(projectileLike.source || 'arrow');
        const tint = source === 'ballista' ? '185, 185, 185' : '185, 132, 82';
        const featherTint = source === 'ballista' ? '222, 222, 222' : '232, 196, 142';
        const bloodTint = source === 'ballista' ? '120, 24, 24' : '164, 18, 16';

        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        this.ctx.globalAlpha = alpha;

        this.ctx.strokeStyle = `rgba(${bloodTint}, ${0.58 * alpha})`;
        this.ctx.lineWidth = Math.max(1.6, shaftW * 1.9);
        this.ctx.beginPath();
        this.ctx.moveTo(-len * 0.12, 0);
        this.ctx.lineTo(-len * 0.35, 0);
        this.ctx.stroke();

        this.ctx.strokeStyle = `rgba(${tint}, ${0.95 * alpha})`;
        this.ctx.lineWidth = shaftW;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(-len, 0);
        this.ctx.stroke();

        this.ctx.fillStyle = `rgba(${featherTint}, ${0.86 * alpha})`;
        this.ctx.beginPath();
        this.ctx.moveTo(-len, 0);
        this.ctx.lineTo(-len - this.scaleLengthX(5.5), -this.scaleLengthY(2.6));
        this.ctx.lineTo(-len - this.scaleLengthX(2.2), -this.scaleLengthY(0.8));
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.moveTo(-len, 0);
        this.ctx.lineTo(-len - this.scaleLengthX(5.5), this.scaleLengthY(2.6));
        this.ctx.lineTo(-len - this.scaleLengthX(2.2), this.scaleLengthY(0.8));
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();
    }

    drawBloodStain(worldX, worldY, radius, alpha = 1) {
        const x = this.scaleX(worldX);
        const y = this.scaleY(worldY);
        const r = Math.max(1, this.scaleLengthX(radius));
        const a = Math.max(0, Math.min(1, Number(alpha)));
        if (a <= 0.001) return;

        this.ctx.save();
        const g = this.ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
        g.addColorStop(0, `rgba(138, 14, 14, ${0.38 * a})`);
        g.addColorStop(1, `rgba(62, 6, 6, ${0.08 * a})`);
        this.ctx.fillStyle = g;
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, r * 1.2, r * 0.65, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    drawBloodBurst(burst, alpha = 1, life = 0) {
        if (!burst || !Array.isArray(burst.droplets) || burst.droplets.length === 0) return;
        const x = this.scaleX(Number(burst.x || 0));
        const y = this.scaleY(Number(burst.y || 0));
        const a = Math.max(0, Math.min(1, Number(alpha)));
        if (a <= 0.001) return;
        const spread = Math.max(0, Math.min(1.2, Number(life)));

        this.ctx.save();
        this.ctx.fillStyle = `rgba(${burst.color || '168, 22, 22'}, ${0.92 * a})`;
        burst.droplets.forEach((drop) => {
            const drift = Number(drop.speed || 0) * spread;
            const dx = Number(drop.dx || 0) * drift;
            const dy = Number(drop.dy || 0) * drift + spread * spread * 8;
            const r = Math.max(0.8, this.scaleLengthX(Number(drop.r || 1.4)));
            this.ctx.beginPath();
            this.ctx.arc(x + this.scaleLengthX(dx), y + this.scaleLengthY(dy), r, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }
    
    drawDragLine(playerX, playerY, dragInfo) {
        const startX = this.scaleX(dragInfo.startX);
        const startY = this.scaleY(dragInfo.startY);
        const currentX = this.scaleX(dragInfo.currentX);
        const currentY = this.scaleY(dragInfo.currentY);
        
        // Calculate drag distance and power from start to current
        const dx = dragInfo.currentX - dragInfo.startX;
        const dy = dragInfo.currentY - dragInfo.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const power = Number.isFinite(dragInfo.drawPower)
            ? Math.max(0, Math.min(100, Number(dragInfo.drawPower)))
            : Math.min(distance / 2, 100);
        const powerNorm = power / 100;
        const timingScore = Math.max(0, Math.min(1, Number(dragInfo.timingScore || 0)));
        const holdMs = Math.max(0, Number(dragInfo.holdMs || 0));
        const tensionAlpha = 0.42 + powerNorm * 0.45;
        const timingGlow = timingScore * (0.35 + 0.25 * Math.sin(performance.now() * 0.018));

        // Draw rubber band from drag start to current position
        this.ctx.strokeStyle = `rgba(139, 69, 19, ${tensionAlpha})`;
        this.ctx.lineWidth = 2.8 + power / 24;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();
        
        // Draw drag start circle (pivot point)
        this.ctx.fillStyle = 'rgba(52, 152, 219, 0.6)';
        this.ctx.beginPath();
        this.ctx.arc(startX, startY, 6, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw drag handle circle at current position
        this.ctx.fillStyle = power > 78 ? '#e74c3c' : power > 42 ? '#f39c12' : '#3498db';
        this.ctx.beginPath();
        this.ctx.arc(currentX, currentY, 8 + power / 20, 0, Math.PI * 2);
        this.ctx.fill();
        if (timingGlow > 0.03) {
            this.ctx.strokeStyle = `rgba(255, 230, 140, ${timingGlow})`;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(currentX, currentY, 14 + powerNorm * 12 + timingGlow * 4, 0, Math.PI * 2);
            this.ctx.stroke();
        }
        
        // Draw projected arrow direction from start towards current
        if (distance > 20) {
            const angle = Math.atan2(dy, dx);
            const lineLength = 80 * (power / 100);
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([8, 4]);
            
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(
                startX + Math.cos(angle) * lineLength,
                startY + Math.sin(angle) * lineLength
            );
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Draw arrow head at end of trajectory line
            const headX = startX + Math.cos(angle) * lineLength;
            const headY = startY + Math.sin(angle) * lineLength;
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.beginPath();
            this.ctx.moveTo(headX, headY);
            this.ctx.lineTo(headX - Math.cos(angle - 0.3) * 12, headY - Math.sin(angle - 0.3) * 12);
            this.ctx.lineTo(headX - Math.cos(angle + 0.3) * 12, headY - Math.sin(angle + 0.3) * 12);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        // Draw power percentage text
        this.ctx.fillStyle = 'white';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${Math.round(power)}%`, currentX, currentY - 20);
        if (holdMs > 0) {
            const holdText = holdMs < 700 ? 'DRAW' : (holdMs < 980 ? 'SET' : 'OVERHOLD');
            this.ctx.fillStyle = holdMs < 980 ? 'rgba(255,255,255,0.82)' : 'rgba(243,156,18,0.95)';
            this.ctx.font = 'bold 11px Arial';
            this.ctx.fillText(holdText, currentX, currentY - 34);
        }
    }
    
    scaleX(x) {
        return (x - this.camera.x) * this.scaleXFactor;
    }
    
    scaleY(y) {
        return (y - this.camera.y) * this.scaleYFactor;
    }

    scaleLengthX(length) {
        return length * this.scaleXFactor;
    }

    scaleLengthY(length) {
        return length * this.scaleYFactor;
    }

    drawHitMarker(alpha = 1, color = '255, 255, 255') {
        const ctx = this.ctx;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        ctx.save();
        ctx.strokeStyle = `rgba(${color}, ${alpha})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 12);
        ctx.lineTo(cx - 4, cy - 4);
        ctx.moveTo(cx + 12, cy - 12);
        ctx.lineTo(cx + 4, cy - 4);
        ctx.moveTo(cx - 12, cy + 12);
        ctx.lineTo(cx - 4, cy + 4);
        ctx.moveTo(cx + 12, cy + 12);
        ctx.lineTo(cx + 4, cy + 4);
        ctx.stroke();
        ctx.restore();
    }

    drawDamageFlash(alpha = 0.25) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = `rgba(231, 76, 60, ${alpha})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
    }

    drawImpactPing(worldX, worldY, alpha = 1, color = '255,255,255', options = {}) {
        const x = this.scaleX(worldX);
        const y = this.scaleY(worldY);
        const ctx = this.ctx;
        const kind = options.kind || 'generic';
        const life = Math.max(0, Math.min(1, Number(options.life || 0)));
        const strength = Math.max(0.6, Math.min(2.2, Number(options.strength || 1)));
        ctx.save();
        if (kind === 'miss') {
            ctx.strokeStyle = `rgba(${color}, ${alpha * 0.7})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(x, y, 10 + (1 - alpha) * 18 * strength, 0, Math.PI * 2);
            ctx.stroke();

            // Small dust specks for misses into terrain.
            for (let i = 0; i < 4; i++) {
                const phase = life * 18 + i * 1.9;
                const dx = Math.cos(phase) * (7 + i * 2.5) * strength;
                const dy = Math.sin(phase * 1.2) * (4 + i * 1.6) * strength;
                ctx.fillStyle = `rgba(${color}, ${alpha * (0.28 + i * 0.08)})`;
                ctx.beginPath();
                ctx.arc(x + dx, y + dy, 1.2 + i * 0.35, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (kind === 'hit' || kind === 'blocked') {
            const spikeLen = (8 + (1 - alpha) * 18) * strength;
            ctx.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx.lineWidth = 2.2;
            for (let i = 0; i < 6; i++) {
                const a = i * (Math.PI / 3) + life * 1.4;
                const inner = 3 + life * 2;
                ctx.beginPath();
                ctx.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
                ctx.lineTo(x + Math.cos(a) * spikeLen, y + Math.sin(a) * spikeLen);
                ctx.stroke();
            }
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 4 + (1 - alpha) * 10 * strength, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 6 + (1 - alpha) * 14, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawMeleeReachIndicator(player, reach, attackType = 'slash') {
        if (!player) return;
        const phase = player.swordPhase || 'idle';
        if (phase === 'idle') return;
        const phaseTimer = Math.max(0, Number(player.swordPhaseTimer || 0));
        const phaseDuration = Math.max(0.0001, Number(player.swordPhaseDuration || 0.0001));
        const phaseProgress = Math.max(0, Math.min(1, 1 - (phaseTimer / phaseDuration)));

        const px = Number(player.x || 0) + Number(player.width || 40) / 2;
        const py = Number(player.y || 0) + Number(player.height || 80) / 2;
        const facing = Number(player.facingDir || (player.team === 'RED' ? 1 : -1)) >= 0 ? 1 : -1;
        const x = this.scaleX(px);
        const y = this.scaleY(py);
        const radius = this.scaleLengthX(Math.max(10, Number(reach || 90)));
        const arcHalf = attackType === 'pierce' ? 0.16 : 0.28;
        const anchor = facing > 0 ? 0 : Math.PI;
        const start = anchor - arcHalf;
        const end = anchor + arcHalf;
        const hitWindow = {
            slash: { start: 0.18, end: 0.72 },
            upper_slash: { start: 0.24, end: 0.74 },
            lower_slash: { start: 0.20, end: 0.70 },
            pierce: { start: 0.28, end: 0.84 },
        }[attackType] || { start: 0.2, end: 0.75 };
        const inHitWindow = phaseProgress >= hitWindow.start && phaseProgress <= hitWindow.end;

        const ctx = this.ctx;
        ctx.save();

        if (phase === 'windup') {
            const telegraphAlpha = 0.15 + phaseProgress * 0.24;
            const sweep = Math.max(0.04, arcHalf * (0.2 + phaseProgress * 0.8));
            const sweepEnd = start + sweep * 2;
            ctx.fillStyle = `rgba(255, 196, 96, ${0.07 + phaseProgress * 0.12})`;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, radius, start, sweepEnd);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = `rgba(255, 214, 130, ${telegraphAlpha})`;
            ctx.lineWidth = this.scaleLengthX(7);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(x, y, radius, start, sweepEnd);
            ctx.stroke();
        } else if (phase === 'active') {
            const activeAlpha = inHitWindow ? 0.38 : 0.2;
            ctx.strokeStyle = inHitWindow
                ? `rgba(255, 248, 220, ${activeAlpha})`
                : `rgba(220, 240, 255, ${activeAlpha})`;
            ctx.lineWidth = this.scaleLengthX(inHitWindow ? 9 : 7);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(x, y, radius, start, end);
            ctx.stroke();
        } else {
            const recoveryAlpha = Math.max(0.06, 0.2 * (1 - phaseProgress));
            ctx.strokeStyle = `rgba(180, 210, 230, ${recoveryAlpha})`;
            ctx.lineWidth = this.scaleLengthX(6);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(x, y, radius, start, end);
            ctx.stroke();
        }

        const outlineAlpha = phase === 'active'
            ? (inHitWindow ? 0.58 : 0.36)
            : (phase === 'windup' ? (0.24 + phaseProgress * 0.18) : 0.22);
        ctx.strokeStyle = `rgba(255, 255, 255, ${outlineAlpha})`;
        ctx.lineWidth = this.scaleLengthX(1.7);
        ctx.beginPath();
        ctx.arc(x, y, radius, start, end);
        ctx.stroke();

        ctx.restore();
    }

    drawCombatDebugOverlay(payload = {}) {
        const players = Array.isArray(payload.players) ? payload.players : [];
        const arrows = Array.isArray(payload.arrows) ? payload.arrows : [];
        const arrowHitRadius = Math.max(0.5, Number(payload.arrowHitRadius || 3));
        const hitboxRatios = payload.hitboxRatios || {};
        const swordHitShape = payload.swordHitShape || {};
        const swordHitWindow = payload.swordHitWindow || {};

        players.forEach((player) => {
            this._drawPlayerDebugHitboxes(player, arrowHitRadius, hitboxRatios);
        });
        arrows.forEach((arrow) => {
            this._drawArrowDebugHitbox(arrow, arrowHitRadius);
        });
        players.forEach((player) => {
            this._drawMeleeDebugEnvelope(player, swordHitShape, swordHitWindow);
        });

        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 10, 16, 0.55)';
        ctx.fillRect(14, 14, 260, 88);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.strokeRect(14, 14, 260, 88);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('DEBUG COLLISION OVERLAY (F3)', 24, 34);
        ctx.font = '11px Arial';
        ctx.fillStyle = 'rgba(255,226,120,0.98)';
        ctx.fillText('Head / Body hurtbox', 24, 52);
        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.fillText('Dashed = arrow-expanded hit test', 150, 52);
        ctx.fillStyle = 'rgba(46,204,113,0.96)';
        ctx.fillText('Arrow segment + hit radius', 24, 70);
        ctx.fillStyle = 'rgba(255,120,120,0.98)';
        ctx.fillText('Melee hit envelope + active window', 24, 88);
        ctx.restore();
    }

    _drawPlayerDebugHitboxes(player, arrowHitRadius, ratios = {}) {
        if (!player || !player.alive) return;
        const x = Number(player.x || 0);
        const y = Number(player.y || 0);
        const w = Math.max(1, Number(player.width || CONFIG.PLAYER_WIDTH || 40));
        const h = Math.max(1, Number(player.height || CONFIG.PLAYER_HEIGHT || 80));
        const headWidthRatio = Math.max(0.1, Math.min(1, Number(ratios.headWidth || 0.5)));
        const headHeightRatio = Math.max(0.1, Math.min(1, Number(ratios.headHeight || 0.28)));
        const bodyTopOffsetRatio = Math.max(0, Math.min(0.9, Number(ratios.bodyTopOffset || 0.24)));

        const headW = w * headWidthRatio;
        const headLeft = x + (w - headW) * 0.5;
        const headRect = {
            x1: headLeft,
            y1: y,
            x2: headLeft + headW,
            y2: y + h * headHeightRatio,
        };
        const bodyRect = {
            x1: x,
            y1: y + h * bodyTopOffsetRatio,
            x2: x + w,
            y2: y + h,
        };
        const expandedHead = {
            x1: headRect.x1 - arrowHitRadius,
            y1: headRect.y1 - arrowHitRadius,
            x2: headRect.x2 + arrowHitRadius,
            y2: headRect.y2 + arrowHitRadius,
        };
        const expandedBody = {
            x1: bodyRect.x1 - arrowHitRadius,
            y1: bodyRect.y1 - arrowHitRadius,
            x2: bodyRect.x2 + arrowHitRadius,
            y2: bodyRect.y2 + arrowHitRadius,
        };

        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 226, 120, 0.95)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(
            this.scaleX(headRect.x1),
            this.scaleY(headRect.y1),
            this.scaleLengthX(headRect.x2 - headRect.x1),
            this.scaleLengthY(headRect.y2 - headRect.y1)
        );
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.95)';
        ctx.strokeRect(
            this.scaleX(bodyRect.x1),
            this.scaleY(bodyRect.y1),
            this.scaleLengthX(bodyRect.x2 - bodyRect.x1),
            this.scaleLengthY(bodyRect.y2 - bodyRect.y1)
        );

        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = 'rgba(255, 243, 166, 0.75)';
        ctx.strokeRect(
            this.scaleX(expandedHead.x1),
            this.scaleY(expandedHead.y1),
            this.scaleLengthX(expandedHead.x2 - expandedHead.x1),
            this.scaleLengthY(expandedHead.y2 - expandedHead.y1)
        );
        ctx.strokeStyle = 'rgba(157, 232, 255, 0.75)';
        ctx.strokeRect(
            this.scaleX(expandedBody.x1),
            this.scaleY(expandedBody.y1),
            this.scaleLengthX(expandedBody.x2 - expandedBody.x1),
            this.scaleLengthY(expandedBody.y2 - expandedBody.y1)
        );
        ctx.setLineDash([]);
        ctx.restore();
    }

    _drawArrowDebugHitbox(arrow, hitRadius) {
        if (!arrow) return;
        const x1 = Number(arrow.x || 0);
        const y1 = Number(arrow.y || 0);
        let x0 = x1;
        let y0 = y1;
        if (Array.isArray(arrow.trailPoints) && arrow.trailPoints.length >= 2) {
            const prev = arrow.trailPoints[arrow.trailPoints.length - 2];
            x0 = Number(prev.x || x1);
            y0 = Number(prev.y || y1);
        } else {
            x0 = x1 - Number(arrow.vx || 0) * (1 / 60);
            y0 = y1 - Number(arrow.vy || 0) * (1 / 60);
        }

        const ctx = this.ctx;
        const px0 = this.scaleX(x0);
        const py0 = this.scaleY(y0);
        const px1 = this.scaleX(x1);
        const py1 = this.scaleY(y1);
        const radius = Math.max(1, this.scaleLengthX(hitRadius));

        ctx.save();
        ctx.strokeStyle = 'rgba(46, 204, 113, 0.95)';
        ctx.lineWidth = radius * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px0, py0);
        ctx.lineTo(px1, py1);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(38, 166, 91, 0.95)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(px1, py1, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    _drawMeleeDebugEnvelope(player, swordHitShape = {}, swordHitWindow = {}) {
        if (!player || !player.alive || !player.loadout || !player.loadout.longsword) return;
        const phase = player.swordPhase || 'idle';
        if (phase === 'idle') return;
        const attackType = player.swordAttack || player.swordSwingAttack || 'slash';
        const shape = swordHitShape[attackType] || swordHitShape.slash;
        if (!shape) return;

        const ax = Number(player.x || 0) + Number(player.width || 40) / 2;
        const ay = Number(player.y || 0) + Number(player.height || 80) / 2;
        const rangeX = Math.max(1, Number(shape.range_x || 90));
        const yMin = Number(shape.y_min || -55);
        const yMax = Number(shape.y_max || 55);
        const facing = Number(player.facingDir || (player.team === 'RED' ? 1 : -1)) >= 0 ? 1 : -1;

        const forwardX = ax + facing * rangeX;
        const rectX1 = Math.min(ax, forwardX);
        const rectX2 = Math.max(ax, forwardX);
        const rectY1 = ay + yMin;
        const rectY2 = ay + yMax;

        const phaseTimer = Math.max(0, Number(player.swordPhaseTimer || 0));
        const phaseDuration = Math.max(0.0001, Number(player.swordPhaseDuration || 0.0001));
        const phaseProgress = Math.max(0, Math.min(1, 1 - (phaseTimer / phaseDuration)));
        const window = swordHitWindow[attackType] || swordHitWindow.slash || { start: 0.0, end: 1.0 };
        const windowStart = Math.max(0, Math.min(1, Number(window.start || 0)));
        const windowEnd = Math.max(0, Math.min(1, Number(window.end || 1)));
        const inWindow = phase === 'active' && phaseProgress >= windowStart && phaseProgress <= windowEnd;

        let fillColor = 'rgba(255, 138, 101, 0.13)';
        let strokeColor = 'rgba(255, 138, 101, 0.85)';
        if (phase === 'windup') {
            fillColor = 'rgba(255, 214, 102, 0.1)';
            strokeColor = 'rgba(255, 214, 102, 0.8)';
        } else if (phase === 'active' && inWindow) {
            fillColor = 'rgba(255, 82, 82, 0.2)';
            strokeColor = 'rgba(255, 82, 82, 0.95)';
        } else if (phase === 'recovery') {
            fillColor = 'rgba(145, 176, 204, 0.1)';
            strokeColor = 'rgba(145, 176, 204, 0.78)';
        }

        const ctx = this.ctx;
        ctx.save();
        const sx = this.scaleX(rectX1);
        const sy = this.scaleY(rectY1);
        const sw = this.scaleLengthX(rectX2 - rectX1);
        const sh = this.scaleLengthY(rectY2 - rectY1);
        ctx.fillStyle = fillColor;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx, sy, sw, sh);

        const px = this.scaleX(ax);
        const py = this.scaleY(ay);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - 5, py);
        ctx.lineTo(px + 5, py);
        ctx.moveTo(px, py - 5);
        ctx.lineTo(px, py + 5);
        ctx.stroke();

        const arcHalf = attackType === 'pierce' ? 0.16 : 0.28;
        const anchor = facing > 0 ? 0 : Math.PI;
        const start = anchor - arcHalf;
        const end = anchor + arcHalf;
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = inWindow
            ? 'rgba(255, 82, 82, 0.9)'
            : (phase === 'windup' ? 'rgba(255, 214, 102, 0.75)' : 'rgba(170, 210, 235, 0.72)');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, this.scaleLengthX(rangeX), start, end);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    drawWorldText(worldX, worldY, text, alpha = 1, color = '255,255,255') {
        const x = this.scaleX(worldX);
        const y = this.scaleY(worldY);
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(alpha, 0.5)})`;
        ctx.font = 'bold 15px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, x + 1, y + 1);
        ctx.fillStyle = `rgba(${color}, ${alpha})`;
        ctx.fillText(text, x, y);
        ctx.restore();
    }
}

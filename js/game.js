class Game {
    constructor() {
        this.players = new Map();
        this.arrows = [];
        this.horses = [];
        this.defaultHorses = [
            { id: 'default-red-horse', x: 220, y: CONFIG.GROUND_Y - 16, width: 86, height: 62, facing: 'right', color: '#8b5a2b' },
            { id: 'default-blue-horse', x: CONFIG.GAME_WIDTH - 220, y: CONFIG.GROUND_Y - 16, width: 86, height: 62, facing: 'left', color: '#6b4a2c' },
        ];
        this.localPlayer = null;
        this.gameState = 'LOBBY';
        
        // Get from URL params / session storage (new auth flow)
        this.roomCode = sessionStorage.getItem('roomCode');
        this.gameSlug = sessionStorage.getItem('gameSlug');
        
        // Get player info from localStorage (set by dashboard)
        const roomData = JSON.parse(localStorage.getItem(`room_${this.roomCode}`) || '{}');
        this.playerId = roomData.member_id || null;
        this.team = roomData.team || null;
        this.nickname = roomData.nickname || localStorage.getItem('displayName') || 'Guest';
        this.isHost = roomData.is_host === true || localStorage.getItem('isPartyLeader') === 'true';
        
        // Load saved loadout preferences
        const savedLoadout = localStorage.getItem('loadout');
        let parsedLoadout = null;
        try {
            parsedLoadout = savedLoadout ? JSON.parse(savedLoadout) : null;
        } catch (err) {
            console.warn('Failed to parse saved loadout, using defaults', err);
        }
        this.loadout = this.normalizeSingleWeaponLoadout(parsedLoadout || {
            arrows: true,
            longsword: false,
            shield: false,
            miniSword: false
        });
        
        console.log('Game init - playerId:', this.playerId, 'team:', this.team);
        console.log('Game init - room:', this.roomCode, 'game:', this.gameSlug, 'nickname:', this.nickname);
        
        this.canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(this.canvas);
        this.input = new InputManager(this.canvas);
        this.input.setLoadout(this.loadout);
        this.ws = new WebSocketManager(this.roomCode);
        
        this.lastUpdateTime = performance.now();
        this.stateUpdateInterval = 100;
        this.lastStateUpdate = performance.now();
        this.inputTick = 0;
        this.lastAckInputTick = 0;
        this.latestInput = null;
        this.pendingShoot = false;
        this.pendingShot = null;
        this.pendingSwordAttack = null;
        this.pendingJump = false;
        this.pendingMountToggle = false;
        this.pendingSlide = false;
        this.authoritative = CONFIG.AUTHORITATIVE_MODE;
        this.arrowMap = new Map();
        this.hitMarkerUntil = 0;
        this.hitMarkerColor = '255, 255, 255';
        this.blockedMarkerUntil = 0;
        this.damageFlashUntil = 0;
        this.damageFlashStrength = 0.4;
        this.combatPopups = [];
        this.arrowImpactBursts = [];
        this.recentImpactPoints = [];
        this.bloodBursts = [];
        this.bloodStains = [];
        this.embeddedProjectiles = [];
        this.cameraShakeBursts = [];
        this.cameraShakePresets = CONFIG.CAMERA_SHAKE_PRESETS || {
            bow: { amplitude: 13, durationMs: 90, frequencyHz: 22, axisX: 1.0, axisY: 0.55 },
            sword: { amplitude: 18, durationMs: 120, frequencyHz: 24, axisX: 1.0, axisY: 0.85 },
            heavy: { amplitude: 28, durationMs: 190, frequencyHz: 18, axisX: 1.0, axisY: 1.0 },
        };
        this.comboState = {
            count: 0,
            rank: 'C',
            rankColor: '240, 240, 240',
            expiresAt: 0,
            styleText: 'No chain',
            styleUntil: 0,
            pulseUntil: 0,
        };
        this.killCount = 0;
        this.stylishKillCount = 0;
        this.stylishFeed = [];
        this.cameraMotionMode = this._loadCameraMotionMode();
        this.loopRunning = false;
        this.slowMotionEnabled = false;
        this.slowMotionScale = 1;
        this.hitStopUntil = 0;
        this.swordTimingMs = {
            slash: { windup: 120, active: 60, recovery: 170 },
            upper_slash: { windup: 150, active: 60, recovery: 210 },
            lower_slash: { windup: 110, active: 60, recovery: 170 },
            pierce: { windup: 120, active: 60, recovery: 190 },
        };
        this.swordReachPx = {
            slash: 92,
            upper_slash: 86,
            lower_slash: 88,
            pierce: 110,
        };
        this.debugCollisionOverlay = localStorage.getItem('stickman_debug_collision_overlay') === '1';
        this.swordHitShape = CONFIG.SWORD_ATTACK_HIT_SHAPE || {
            slash: { range_x: 90.0, y_min: -52.0, y_max: 52.0 },
            upper_slash: { range_x: 84.0, y_min: -112.0, y_max: -10.0 },
            lower_slash: { range_x: 86.0, y_min: 10.0, y_max: 112.0 },
            pierce: { range_x: 116.0, y_min: -26.0, y_max: 26.0 },
        };
        this.swordHitWindow = CONFIG.SWORD_ATTACK_HIT_WINDOW || {
            slash: { start: 0.18, end: 0.72 },
            upper_slash: { start: 0.24, end: 0.74 },
            lower_slash: { start: 0.20, end: 0.70 },
            pierce: { start: 0.28, end: 0.84 },
        };
        const urlParams = new URLSearchParams(window.location.search);
        this.stickmanLodEnabled = localStorage.getItem('stickman_animation_lod') !== '0';
        this.cpuProfileEnabled = urlParams.get('cpuProfile') === '1' || localStorage.getItem('stickman_cpu_profile') === '1';
        this.perfStats = {
            frameAvgMs: 0,
            updateAvgMs: 0,
            renderAvgMs: 0,
            playersRenderedAvg: 0,
            stickmanUpdatesAvg: 0,
            lod0Avg: 0,
            lod1Avg: 0,
            lod2Avg: 0,
            lastLogAt: 0,
        };
        this.lastRenderStats = {
            playersRendered: 0,
            stickmanUpdates: 0,
            lodCounts: { 0: 0, 1: 0, 2: 0 },
        };
        this.lastStickmanUpdateNow = performance.now();
        this.deathReplayWindowMs = 10000;
        this.deathReplayLeadMs = 350;
        this.deathReplayHoldMs = 1500;
        this.deathReplayBuffer = [];
        this.deathReplay = {
            active: false,
            startedAt: 0,
            windowStart: 0,
            windowEnd: 0,
            frames: [],
            tracks: new Map(),
            hitEvents: [],
        };
        this.animationAudioHooks = [];

        this.setupUI();
        this.setupMobileExperience();
        this.setupDebugToggle();
        this.setupLoadoutUI();
        this.setupWebSocket();
        this.ws.connect();
    }

    _loadoutFromRoleCategory(roleCategory) {
        const role = String(roleCategory || '').toLowerCase();
        if (role === 'longswordsman') {
            return { arrows: false, longsword: true, shield: false, miniSword: false };
        }
        if (role === 'shield+sword' || role === 'shield_sword' || role === 'sword_shield') {
            return { arrows: false, longsword: true, shield: true, miniSword: false };
        }
        return { arrows: true, longsword: false, shield: false, miniSword: false };
    }

    _resolveRoleCategory(loadout) {
        const normalized = this.normalizeSingleWeaponLoadout(loadout);
        if (normalized.longsword && normalized.shield) return 'shield+sword';
        if (normalized.longsword) return 'longswordsman';
        return 'archer';
    }

    normalizeSingleWeaponLoadout(loadout) {
        if (loadout && typeof loadout === 'object' && typeof loadout.role_category === 'string') {
            return this._loadoutFromRoleCategory(loadout.role_category);
        }

        const hasSword = !!(loadout && loadout.longsword);
        const shieldExplicit = !!(loadout && Object.prototype.hasOwnProperty.call(loadout, 'shield'));
        const hasShieldInput = !!(loadout && loadout.shield);
        const hasShield = hasSword ? (shieldExplicit ? hasShieldInput : true) : false;
        return {
            arrows: !hasSword,
            longsword: hasSword,
            shield: hasShield,
            miniSword: false
        };
    }
    
    setupUI() {
        document.getElementById('roomCodeDisplay').textContent = this.roomCode;
        document.getElementById('playerNameDisplay').textContent = this.nickname;
        
        const teamBadge = document.getElementById('teamBadge');
        if (this.team) {
            teamBadge.textContent = this.team;
            teamBadge.className = `team-badge ${this.team.toLowerCase()}`;
        }
        
        this.updateStartButton(0);
        this.updateSlowMotionButton();
        this.updateSlowMotionStatus();
        this.updateCameraMotionButton();
        this.updateCameraMotionStatus();
        this.updateStaminaBar(CONFIG.STAMINA_MAX || 100, CONFIG.STAMINA_MAX || 100);
        this.updateComboHud(performance.now());
        this.updateKillStatsHud();
    }

    setupMobileExperience() {
        this.mobileOrientationOverlay = document.getElementById('mobileOrientationOverlay');
        this.mobileTouchDevice = this.isTouchDevice();
        document.body.classList.toggle('mobile-device', this.mobileTouchDevice);

        if (!this.mobileTouchDevice) {
            if (this.input && typeof this.input.setTouchInputEnabled === 'function') {
                this.input.setTouchInputEnabled(true);
            }
            return;
        }

        this._applyMobileLayoutState();
        const updateLayout = () => {
            this._applyMobileLayoutState();
            if (this.renderer && typeof this.renderer.resize === 'function') {
                this.renderer.resize();
                setTimeout(() => this.renderer.resize(), 80);
                setTimeout(() => this.renderer.resize(), 220);
            }
        };

        window.addEventListener('resize', updateLayout);
        window.addEventListener('orientationchange', updateLayout);
        if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === 'function') {
            window.screen.orientation.addEventListener('change', updateLayout);
        }
    }

    isTouchDevice() {
        return (!!window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
            || ('ontouchstart' in window)
            || Number(navigator.maxTouchPoints || 0) > 0;
    }

    _applyMobileLayoutState() {
        if (!this.mobileTouchDevice) return;
        const isLandscape = window.innerWidth > window.innerHeight;
        const blockGameplay = !isLandscape;
        document.body.classList.toggle('mobile-landscape', isLandscape);
        document.body.classList.toggle('mobile-portrait-blocked', blockGameplay);

        if (this.mobileOrientationOverlay) {
            this.mobileOrientationOverlay.style.display = blockGameplay ? 'flex' : '';
        }
        if (this.input && typeof this.input.setTouchInputEnabled === 'function') {
            this.input.setTouchInputEnabled(!blockGameplay);
        }
    }

    setupDebugToggle() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F3') {
                this.debugCollisionOverlay = !this.debugCollisionOverlay;
                localStorage.setItem('stickman_debug_collision_overlay', this.debugCollisionOverlay ? '1' : '0');
                console.log(`Collision debug overlay ${this.debugCollisionOverlay ? 'enabled' : 'disabled'}`);
                e.preventDefault();
                return;
            }
            if (e.key === 'F4') {
                this.cpuProfileEnabled = !this.cpuProfileEnabled;
                localStorage.setItem('stickman_cpu_profile', this.cpuProfileEnabled ? '1' : '0');
                console.log(`CPU profiling ${this.cpuProfileEnabled ? 'enabled' : 'disabled'}`);
                e.preventDefault();
                return;
            }
            if (e.key === 'F6') {
                this.cycleCameraMotionMode();
                e.preventDefault();
            }
        });
    }
    
    setupLoadoutUI() {
        const loadoutPanel = document.getElementById('loadoutPanel');
        if (!loadoutPanel) return;
        this.loadoutSummary = document.getElementById('loadoutSummary');
        
        const buttons = loadoutPanel.querySelectorAll('[data-role]');
        buttons.forEach(btn => {
            const role = btn.dataset.role;
            const active = this._resolveRoleCategory(this.loadout) === role;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', active);
            
            btn.addEventListener('click', () => {
                const next = this.normalizeSingleWeaponLoadout(this._loadoutFromRoleCategory(role));
                this.loadout = next;
                const activeRole = this._resolveRoleCategory(this.loadout);
                buttons.forEach((button) => {
                    const isActive = button.dataset.role === activeRole;
                    button.classList.toggle('active', isActive);
                    button.setAttribute('aria-pressed', isActive);
                });
                this.persistLoadout();
                if (this.localPlayer) {
                    this.localPlayer.setLoadout(this.loadout);
                }
                this.input.setLoadout(this.loadout);
                this.updateLoadoutSummary();
            });
        });
        
        this.updateLoadoutSummary();
    }
    
    persistLoadout() {
        localStorage.setItem('loadout', JSON.stringify(this.loadout));
    }
    
    updateLoadoutSummary() {
        if (!this.loadoutSummary) return;
        const role = this._resolveRoleCategory(this.loadout);
        if (role === 'longswordsman') {
            this.loadoutSummary.textContent = 'Longswordsman';
            return;
        }
        if (role === 'shield+sword') {
            this.loadoutSummary.textContent = 'Shield + Sword';
            return;
        }
        this.loadoutSummary.textContent = 'Archer';
    }
    
    setupWebSocket() {
        this.ws.on('connected', () => {
            console.log('Connected to game room');
            document.getElementById('connectionStatus').textContent = 'Connected';
            document.getElementById('connectionStatus').className = 'status-connected';
            
            // Send join with player info including host status
            console.log('Sending join - nickname:', this.nickname, 'playerId:', this.playerId, 'isHost:', this.isHost);
            this.ws.sendJoin(this.nickname, this.playerId, this.isHost);
        });
        
        this.ws.on('disconnected', () => {
            document.getElementById('connectionStatus').textContent = 'Disconnected';
            document.getElementById('connectionStatus').className = 'status-disconnected';
        });
        
        this.ws.on('error', (data) => {
            console.error('WebSocket error:', data);
            alert('Connection error: ' + (data.message || 'Unknown error'));
        });
        
        this.ws.on('lobby_update', (data) => {
            this.handleLobbyUpdate(data);
        });
        
        this.ws.on('player_left', (data) => {
            this.handlePlayerLeft(data);
        });
        
        this.ws.on('game_start', (data) => {
            this.startGame(data);
        });
        
        this.ws.on('player_state', (data) => {
            this.updatePlayerState(data);
        });
        
        this.ws.on('arrow_shot', (data) => {
            this.spawnArrow(data);
        });
        
        this.ws.on('player_hit', (data) => {
            this.handlePlayerHit(data);
        });

        this.ws.on('snapshot', (data) => {
            this.handleSnapshot(data);
        });

        this.ws.on('slow_motion_state', (data) => {
            this.slowMotionEnabled = !!data.enabled;
            this.slowMotionScale = Number(data.scale || 1);
            this.updateSlowMotionButton();
            this.updateSlowMotionStatus();
        });

        setInterval(() => {
            if (this.ws.connected) {
                this.ws.sendPing();
            }
        }, 5000);

        setInterval(() => {
            if (this.ws.connected) {
                this.sendInputSnapshot();
            }
        }, CONFIG.INPUT_SEND_MS);
    }
    
    handleLobbyUpdate(data) {
        const lobbyState = data.lobby_state;
        if (!lobbyState) return;
        
        console.log('Lobby update:', lobbyState);
        
        document.getElementById('playerCount').textContent = lobbyState.player_count;
        document.getElementById('maxPlayers').textContent = lobbyState.max_players;
        
        this.updateTeamLists(lobbyState);
        
        if (lobbyState.host_id !== undefined && lobbyState.host_id !== null && this.playerId !== null) {
            this.isHost = Number(lobbyState.host_id) === Number(this.playerId);
        }
        this.updateStartButton(lobbyState.player_count || 0);
        this.updateSlowMotionButton();
        
        if (lobbyState.status === 'PLAYING') {
            this.startGame({ lobby_state: lobbyState });
        }
    }
    
    handlePlayerLeft(data) {
        console.log('Player left:', data.nickname);
        this.handleLobbyUpdate(data);
    }
    
    requestStartGame() {
        this.ws.sendStartGame();
    }

    updateStartButton(playerCount) {
        const startBtn = document.getElementById('startGameBtn');
        if (!startBtn) return;

        if (!this.isHost) {
            startBtn.style.display = 'none';
            return;
        }

        startBtn.style.display = 'block';
        startBtn.textContent = playerCount >= 1 ? 'Start Game' : 'Waiting for Players';
        startBtn.disabled = playerCount < 1;
        startBtn.style.opacity = '1';
        startBtn.onclick = () => this.requestStartGame();
    }

    toggleSlowMotion() {
        if (!this.isHost || this.gameState !== 'PLAYING') return;
        this.ws.sendToggleSlowMotion(!this.slowMotionEnabled);
    }

    updateSlowMotionButton() {
        const btn = document.getElementById('slowMotionBtn');
        if (!btn) return;
        if (!this.isHost || this.gameState !== 'PLAYING') {
            btn.style.display = 'none';
            return;
        }
        btn.style.display = 'block';
        btn.textContent = this.slowMotionEnabled ? 'Disable Slow Motion' : 'Enable Slow Motion';
        btn.onclick = () => this.toggleSlowMotion();
    }

    updateSlowMotionStatus() {
        const el = document.getElementById('slowMotionStatus');
        if (!el) return;
        el.textContent = this.slowMotionEnabled ? `Slow Motion ${Math.round(this.slowMotionScale * 100)}%` : 'Normal Speed';
    }

    _loadCameraMotionMode() {
        const savedMode = String(localStorage.getItem('stickman_camera_motion') || '').toLowerCase();
        if (savedMode === 'full' || savedMode === 'reduced' || savedMode === 'minimal' || savedMode === 'off') {
            return savedMode;
        }
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return 'reduced';
            }
        } catch (err) {
            console.warn('Unable to resolve prefers-reduced-motion:', err);
        }
        return 'full';
    }

    _cameraMotionScale(mode = this.cameraMotionMode) {
        const normalized = String(mode || 'full').toLowerCase();
        if (normalized === 'off') return 0;
        if (normalized === 'minimal') return 0.2;
        if (normalized === 'reduced') return 0.5;
        return 1;
    }

    _cameraMotionLabel(mode = this.cameraMotionMode) {
        const normalized = String(mode || 'full').toLowerCase();
        if (normalized === 'off') return 'Camera Motion: Off';
        if (normalized === 'minimal') return 'Camera Motion: Minimal';
        if (normalized === 'reduced') return 'Camera Motion: Reduced';
        return 'Camera Motion: Full';
    }

    setCameraMotionMode(mode, options = {}) {
        const normalized = String(mode || '').toLowerCase();
        const allowed = ['full', 'reduced', 'minimal', 'off'];
        this.cameraMotionMode = allowed.includes(normalized) ? normalized : 'full';
        if (options.persist !== false) {
            localStorage.setItem('stickman_camera_motion', this.cameraMotionMode);
        }
        this.updateCameraMotionButton();
        this.updateCameraMotionStatus();
    }

    cycleCameraMotionMode() {
        const order = ['full', 'reduced', 'minimal', 'off'];
        const currentIndex = order.indexOf(String(this.cameraMotionMode || 'full').toLowerCase());
        const nextMode = order[(currentIndex + 1 + order.length) % order.length];
        this.setCameraMotionMode(nextMode);
    }

    updateCameraMotionButton() {
        const btn = document.getElementById('cameraMotionBtn');
        if (!btn) return;
        btn.textContent = this._cameraMotionLabel(this.cameraMotionMode);
        btn.onclick = () => this.cycleCameraMotionMode();
    }

    updateCameraMotionStatus() {
        const el = document.getElementById('cameraMotionStatus');
        if (!el) return;
        el.textContent = this._cameraMotionLabel(this.cameraMotionMode);
    }

    _queueWeaponCameraShake(kind, intensity = 1, options = {}) {
        const presets = this.cameraShakePresets || {
            bow: { amplitude: 13, durationMs: 90, frequencyHz: 22, axisX: 1.0, axisY: 0.55 },
            sword: { amplitude: 18, durationMs: 120, frequencyHz: 24, axisX: 1.0, axisY: 0.85 },
            heavy: { amplitude: 28, durationMs: 190, frequencyHz: 18, axisX: 1.0, axisY: 1.0 },
        };
        const preset = presets[kind] || presets.sword || null;
        if (!preset) return;

        const resolveMotionScale = (this && typeof this._cameraMotionScale === 'function')
            ? this._cameraMotionScale
            : Game.prototype._cameraMotionScale;
        const motionScale = resolveMotionScale.call(this);
        if (motionScale <= 0) return;

        const weight = Math.max(0.1, Number(options.weight || 1));
        const strength = Math.max(0.1, Math.min(1.8, Number(intensity || 1))) * weight;
        const amplitude = Number(preset.amplitude || 0) * strength * motionScale;
        if (!Number.isFinite(amplitude) || amplitude <= 0.05) return;

        const now = performance.now();
        const phaseX = Math.random() * Math.PI * 2;
        const phaseY = Math.random() * Math.PI * 2;
        const frequencyHz = Math.max(6, Number(preset.frequencyHz || 20));
        if (!Array.isArray(this.cameraShakeBursts)) {
            this.cameraShakeBursts = [];
        }
        this.cameraShakeBursts.push({
            startedAt: now,
            durationMs: Math.max(50, Number(preset.durationMs || 120)),
            amplitudeX: amplitude * Math.max(0, Number(preset.axisX || 1)),
            amplitudeY: amplitude * Math.max(0, Number(preset.axisY || 1)),
            frequencyHz,
            phaseX,
            phaseY,
        });
        if (this.cameraShakeBursts.length > 16) {
            this.cameraShakeBursts = this.cameraShakeBursts.slice(this.cameraShakeBursts.length - 16);
        }
    }

    _sampleCameraShake(now) {
        const resolveMotionScale = (this && typeof this._cameraMotionScale === 'function')
            ? this._cameraMotionScale
            : Game.prototype._cameraMotionScale;
        const motionScale = resolveMotionScale.call(this);
        if (motionScale <= 0 || !Array.isArray(this.cameraShakeBursts) || this.cameraShakeBursts.length === 0) {
            this.cameraShakeBursts = [];
            return { x: 0, y: 0 };
        }

        let offsetX = 0;
        let offsetY = 0;
        this.cameraShakeBursts = this.cameraShakeBursts.filter((burst) => {
            const durationMs = Math.max(1, Number(burst.durationMs || 1));
            const life = (now - Number(burst.startedAt || now)) / durationMs;
            if (life >= 1) return false;
            const envelope = Math.pow(Math.max(0, 1 - life), 2);
            const freq = Math.max(6, Number(burst.frequencyHz || 20));
            const waveT = life * durationMs * 0.001 * freq * Math.PI * 2;
            offsetX += Math.sin(waveT + Number(burst.phaseX || 0)) * Number(burst.amplitudeX || 0) * envelope;
            offsetY += Math.cos(waveT + Number(burst.phaseY || 0)) * Number(burst.amplitudeY || 0) * envelope;
            return true;
        });

        const maxAmplitude = 42 * motionScale;
        return {
            x: Math.max(-maxAmplitude, Math.min(maxAmplitude, offsetX)),
            y: Math.max(-maxAmplitude, Math.min(maxAmplitude, offsetY)),
        };
    }
    
    updateTeamLists(lobbyState) {
        const redTeamEl = document.getElementById('redTeamPlayers');
        const blueTeamEl = document.getElementById('blueTeamPlayers');
        
        redTeamEl.innerHTML = '';
        blueTeamEl.innerHTML = '';
        
        lobbyState.players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'player-item';
            if (player.id == this.playerId) {
                playerEl.classList.add('me');
            }
            playerEl.textContent = player.nickname;
            
            if (player.team === 'RED') {
                redTeamEl.appendChild(playerEl);
            } else {
                blueTeamEl.appendChild(playerEl);
            }
        });
    }
    
    startGame(data) {
        console.log('Starting game with data:', data);
        const wasPlaying = this.gameState === 'PLAYING';
        this.gameState = 'PLAYING';
        
        document.getElementById('lobbyOverlay').classList.add('hidden');
        
        if (data.lobby_state && data.lobby_state.players) {
            data.lobby_state.players.forEach(playerData => {
                const isMe = playerData.id == this.playerId;
                const player = new Player(
                    playerData.id,
                    playerData.nickname,
                    playerData.team,
                    isMe
                );
                
                if (isMe) {
                    player.setLoadout(this.loadout);
                    this.localPlayer = player;
                }
                
                this.players.set(playerData.id, player);
            });
        }

        if (!this.loopRunning) {
            this.loopRunning = true;
            this.gameLoop();
        } else if (wasPlaying) {
            console.log('Game loop already running; skipping duplicate start');
        }
        this.updateSlowMotionButton();
        this.updateSlowMotionStatus();
    }

    handleSnapshot(data) {
        if (!data || !data.players) return;
        if (Number.isFinite(Number(data.tick))) {
            this.lastSnapshotTick = Number(data.tick);
        }

        const seen = new Set();
        data.players.forEach(playerData => {
            seen.add(playerData.id);
            let player = this.players.get(playerData.id);
            const isMe = playerData.id == this.playerId;
            if (!player) {
                player = new Player(playerData.id, playerData.nickname, playerData.team, isMe);
                if (isMe) {
                    player.setLoadout(this.loadout);
                    this.localPlayer = player;
                }
                this.players.set(playerData.id, player);
            }
            player.serverState = {
                x: playerData.x,
                y: playerData.y,
                vx: playerData.vx,
                vy: playerData.vy,
                health: playerData.hp,
                alive: playerData.alive,
                aimAngle: playerData.aim_angle,
                bowDrawn: playerData.bow_drawn,
                drawPower: playerData.draw_power,
                loadout: playerData.loadout || player.loadout,
                mounted_horse_id: playerData.mounted_horse_id,
                facing_dir: playerData.facing_dir,
                using_ballista_side: playerData.using_ballista_side,
                sword_phase: playerData.sword_phase || 'idle',
                sword_attack: playerData.sword_attack || null,
                sword_phase_timer: Number(playerData.sword_phase_timer || 0),
                sword_phase_duration: Number(playerData.sword_phase_duration || 0),
                sword_reaction_timer: Number(playerData.sword_reaction_timer || 0),
                sword_reaction_attack: playerData.sword_reaction_attack || null,
                shield_blocking: !!playerData.shield_blocking,
                shield_block_angle: Number(playerData.shield_block_angle || playerData.aim_angle || 0),
                armor_break_stage: Number(playerData.armor_break_stage || 0),
                armor_break_ratio: Number(playerData.armor_break_ratio || 0),
                sprinting: !!playerData.sprinting,
                crouching: !!playerData.crouching,
                sliding: !!playerData.sliding,
                slide_timer: Number(playerData.slide_timer || 0),
                slide_dir: Number(playerData.slide_dir || (playerData.facing_dir >= 0 ? 1 : -1)),
                on_wall: !!playerData.on_wall,
                wall_side: Number(playerData.wall_side || 0),
                ledge_grabbed: !!playerData.ledge_grabbed,
                ledge_side: Number(playerData.ledge_side || 0),
                ledge_x: Number(playerData.ledge_x || 0),
                ledge_y: Number(playerData.ledge_y || 0),
                ledge_hang_timer: Number(playerData.ledge_hang_timer || 0),
                height: Number(playerData.height || CONFIG.PLAYER_HEIGHT || 80),
                stamina: Number(playerData.stamina || 0),
                stamina_max: Number(playerData.stamina_max || CONFIG.STAMINA_MAX || 100),
                combo_count: Number(playerData.combo_count || 0),
                combo_best: Number(playerData.combo_best || 0),
                combo_expires_in_ms: Number(playerData.combo_expires_in_ms || 0),
                combo_rank: playerData.combo_rank || 'C',
                kill_count: Number(playerData.kill_count || 0),
                stylish_kill_count: Number(playerData.stylish_kill_count || 0),
                on_ground: !!playerData.on_ground,
                last_input_tick: Number(playerData.last_input_tick || 0),
            };
            if (!player.initialized) {
                player.setState(player.serverState);
                player.initialized = true;
            } else if (playerData.loadout) {
                player.setLoadout(playerData.loadout);
            }
            if (isMe && playerData.loadout) {
                this.loadout = this.normalizeSingleWeaponLoadout(playerData.loadout);
                this.input.setLoadout(this.loadout);
            }
            if (isMe) {
                this.updateStaminaBar(player.serverState.stamina, player.serverState.stamina_max);
                this.killCount = Number(player.serverState.kill_count || 0);
                this.stylishKillCount = Number(player.serverState.stylish_kill_count || 0);
                this.updateKillStatsHud();
                if (this.comboState.count <= 0 && Number(player.serverState.combo_count || 0) > 0) {
                    this.comboState.count = Number(player.serverState.combo_count || 0);
                    this.comboState.rank = String(player.serverState.combo_rank || 'C');
                    this.comboState.expiresAt = performance.now() + Number(player.serverState.combo_expires_in_ms || 0);
                }
            }
        });

        [...this.players.keys()].forEach(id => {
            if (!seen.has(id)) {
                this.players.delete(id);
            }
        });

        if (Array.isArray(data.arrows)) {
            const snapshotNow = performance.now();
            const previousArrowMap = this.arrowMap;
            const nextMap = new Map();
            data.arrows.forEach(arrow => {
                let existing = previousArrowMap.get(arrow.id);
                const isNewArrow = !existing;
                const speed = Math.hypot(Number(arrow.vx || 0), Number(arrow.vy || 0));
                const computedAngle = speed > 0.0001
                    ? Math.atan2(arrow.vy, arrow.vx)
                    : (existing ? Number(existing.angle || 0) : 0);
                if (!existing) {
                    existing = {
                        id: arrow.id,
                        x: arrow.x,
                        y: arrow.y,
                        vx: arrow.vx,
                        vy: arrow.vy,
                        angle: computedAngle,
                        team: arrow.team,
                        length: 42,
                        owner_id: arrow.owner_id,
                        power_ratio: Number(arrow.power_ratio || 0),
                        arrow_tier: Number(arrow.arrow_tier || 1),
                        projectile_type: arrow.projectile_type || 'arrow',
                        source: arrow.source || 'arrow',
                        target: null,
                        stale: false,
                        staleSince: 0,
                        stuck: false,
                        trailPoints: [],
                        trailSampleAt: 0
                    };
                    this._appendArrowTrailPoint(existing, arrow.x, arrow.y, true);
                }
                existing.target = {
                    x: arrow.x,
                    y: arrow.y,
                    vx: arrow.vx,
                    vy: arrow.vy,
                    angle: computedAngle,
                    team: arrow.team,
                    owner_id: arrow.owner_id,
                    power_ratio: Number(arrow.power_ratio || existing.power_ratio || 0),
                    arrow_tier: Number(arrow.arrow_tier || existing.arrow_tier || 1),
                    projectile_type: arrow.projectile_type || 'arrow',
                    source: arrow.source || 'arrow'
                };
                existing.stale = false;
                existing.staleSince = 0;
                existing.stuck = false;
                if (isNewArrow) {
                    const projectileSource = arrow.source || arrow.projectile_type || 'arrow';
                    if (projectileSource === 'arrow') {
                        const estimatedPower = this._estimateReleasePowerFromArrow(arrow);
                        this._triggerShooterBowRelease(arrow.owner_id, estimatedPower, computedAngle);
                    }
                }
                nextMap.set(arrow.id, existing);
            });
            previousArrowMap.forEach((staleArrow, staleId) => {
                if (nextMap.has(staleId)) return;
                staleArrow.stale = true;
                staleArrow.staleSince = staleArrow.staleSince || snapshotNow;
                staleArrow.target = null;
                if (!staleArrow.stuck && !staleArrow._queuedStaleImpact) {
                    this._queueArrowImpact(staleArrow, { kind: 'miss' });
                    staleArrow._queuedStaleImpact = true;
                }
                nextMap.set(staleId, staleArrow);
            });
            this.arrowMap = nextMap;
            this.arrows = [...this.arrowMap.values()];
        }
        if (Array.isArray(data.horses)) {
            this.horses = data.horses;
        }
        if (data.castles && window.CastleRenderer && typeof window.CastleRenderer.applySnapshotCastles === 'function') {
            window.CastleRenderer.applySnapshotCastles(data.castles);
        }

        if (data.round) {
            this.updateRoundUI(data.round);
        }

        if (data.match) {
            this.updateMatchUI(data.match);
        }

        if (data.slow_motion) {
            this.slowMotionEnabled = !!data.slow_motion.enabled;
            this.slowMotionScale = Number(data.slow_motion.scale || 1);
            this.updateSlowMotionButton();
            this.updateSlowMotionStatus();
        }

        if (Array.isArray(data.events)) {
            const now = performance.now();
            data.events.forEach(event => {
                if (event.type === 'hit') {
                    const isAxeHit = event.source === 'sword';
                    const blockedByInvuln = !!event.blocked_by_invuln;
                    const blockedByShield = !!event.blocked_by_shield;
                    const blocked = blockedByInvuln || blockedByShield;
                    const hitPoint = event.hit_point || null;
                    const hitType = event.hit_type || 'body';
                    const finalDamage = Number(event.final_damage || event.damage || 0);
                    const targetPlayer = event.target_id != null ? this.players.get(event.target_id) : null;
                    const perfectBlock = !!event.shield_perfect_block;
                    const localShooter = Number(event.shooter_id) === Number(this.playerId);
                    const localTarget = Number(event.target_id) === Number(this.playerId);
                    const localInvolved = localShooter || localTarget;
                    const comboFeedback = (event.combo_feedback && typeof event.combo_feedback === 'object')
                        ? event.combo_feedback
                        : null;
                    const killFeedback = (event.kill_feedback && typeof event.kill_feedback === 'object')
                        ? event.kill_feedback
                        : null;
                    if ((event.source === 'arrow' || event.source === 'sword' || event.source === 'ballista') && event.target_id != null) {
                        if (targetPlayer) {
                            this._applyArmorBreakState(
                                targetPlayer,
                                event.armor_break_stage,
                                event.armor_break_ratio,
                                now,
                                !!event.armor_break_stage_changed
                            );
                            this._applyDirectionalHitReaction(targetPlayer, event, {
                                blocked,
                                blockedByShield,
                                blockedByInvuln,
                                finalDamage,
                            });
                            if (!blocked && hitPoint) {
                                this._queueBloodImpact(targetPlayer, event, {
                                    x: hitPoint.x,
                                    y: hitPoint.y,
                                    finalDamage,
                                    hitType,
                                    isAxeHit,
                                });
                            }
                            if (!blocked && hitPoint && String(event.source || 'arrow') === 'arrow') {
                                this._embedProjectileInTarget(targetPlayer, event, hitPoint);
                            }
                            if (!blocked) {
                                this._maybeSeverLimb(targetPlayer, event, {
                                    finalDamage,
                                    hitType,
                                    isAxeHit,
                                    hitPoint,
                                });
                            }
                        }
                    }
                    if (event.source === 'sword' && event.shooter_id != null) {
                        const shooter = this.players.get(event.shooter_id);
                        if (shooter) {
                            const attack = event.sword_attack || 'slash';
                            const timing = this.swordTimingMs[attack] || this.swordTimingMs.slash;
                            const total = timing.windup + timing.active + timing.recovery;
                            shooter.swordSwingAttack = attack;
                            shooter.swordSwingStarted = now;
                            shooter.swordSwingUntil = now + total;
                        }
                        if (localInvolved && !blocked) {
                            const isTarget = Number(event.target_id) === Number(this.playerId);
                            this._triggerSwordHitStop(now, { isTarget, finalDamage });
                        }
                    }

                    const heavyImpact =
                        !blocked &&
                        (event.source === 'ballista' || hitType === 'head' || finalDamage >= 24);
                    if (localInvolved && !blockedByInvuln) {
                        const queueShake = (this && typeof this._queueWeaponCameraShake === 'function')
                            ? this._queueWeaponCameraShake
                            : Game.prototype._queueWeaponCameraShake;
                        if (event.source === 'sword') {
                            const swordIntensity = Math.max(0.35, Math.min(1.4, 0.45 + finalDamage / 42));
                            queueShake.call(this, 'sword', swordIntensity, { weight: localTarget ? 1.0 : 0.75 });
                        }
                        if (heavyImpact) {
                            const heavyIntensity = Math.max(0.45, Math.min(1.8, 0.52 + finalDamage / 36));
                            queueShake.call(this, 'heavy', heavyIntensity, { weight: localTarget ? 1.2 : 0.9 });
                        }
                    }

                    if (localTarget && finalDamage > 0) {
                        const blockedScale = blockedByShield ? 0.55 : 1.0;
                        const axeBoost = isAxeHit ? 1.18 : 1.0;
                        this.damageFlashUntil = now + Math.max(140, Math.min(460, 140 + finalDamage * 4 * blockedScale * axeBoost));
                        this.damageFlashStrength = Math.max(0.16, Math.min(0.62, 0.2 + finalDamage / 120 * blockedScale * axeBoost));
                    }

                    if (localShooter) {
                        if (blocked) {
                            this.blockedMarkerUntil = now + (perfectBlock ? 220 : 160);
                        } else {
                            this.hitMarkerUntil = now + (isAxeHit ? 220 : 180);
                            this.hitMarkerColor = isAxeHit ? '255, 196, 77' : '255, 255, 255';
                        }
                        if (comboFeedback && !blocked) {
                            this.applyComboFeedback(comboFeedback, now);
                        }
                    }
                    if (killFeedback) {
                        this.applyKillFeedback(killFeedback, now, {
                            sourceEvent: event,
                            localShooter,
                            localTarget,
                        });
                    }
                    if (blockedByShield && event.target_id != null) {
                        const shieldedPlayer = this.players.get(event.target_id);
                        if (shieldedPlayer) {
                            shieldedPlayer.shieldBlockHitUntil = now + (perfectBlock ? 220 : 160);
                        }
                    }

                    if (hitPoint) {
                        this._queueArrowImpact({
                            x: hitPoint.x,
                            y: hitPoint.y,
                            team: event.shooter_team || null,
                            source: event.source || 'arrow'
                        }, {
                            kind: blocked ? 'blocked' : 'hit',
                            color: blocked
                                ? (blockedByShield ? (perfectBlock ? '124, 252, 0' : '52, 152, 219') : '243, 156, 18')
                                : (hitType === 'head' ? '231, 76, 60' : (isAxeHit ? '255, 196, 77' : '255, 255, 255')),
                            ttl: blocked ? 180 : (isAxeHit ? 270 : 240),
                            strength: blocked ? (perfectBlock ? 1.2 : 1.0) : (isAxeHit ? 1.45 : 1.2)
                        });
                        if (blocked) {
                            this.combatPopups.push({
                                x: hitPoint.x,
                                y: hitPoint.y - 12,
                                text: blockedByShield
                                    ? (perfectBlock ? 'PERFECT BLOCK' : (finalDamage > 0 ? `SHIELD BLOCK -${finalDamage}` : 'SHIELD BLOCK'))
                                    : 'BLOCKED',
                                color: blockedByShield ? (perfectBlock ? '124, 252, 0' : '52, 152, 219') : '243, 156, 18',
                                bornAt: now,
                                ttl: 520,
                                driftY: -28,
                                pingColor: blockedByShield
                                    ? (perfectBlock ? '124,252,0' : '52,152,219')
                                    : '243,156,18'
                            });
                        } else {
                            const label = hitType === 'head'
                                ? `HEADSHOT -${finalDamage}`
                                : (isAxeHit ? `AXE -${finalDamage}` : `-${finalDamage}`);
                            this.combatPopups.push({
                                x: hitPoint.x,
                                y: hitPoint.y - 12,
                                text: label,
                                color: hitType === 'head' ? '231, 76, 60' : (isAxeHit ? '255, 196, 77' : '255, 255, 255'),
                                bornAt: now,
                                ttl: isAxeHit ? 720 : 650,
                                driftY: isAxeHit ? -44 : -36,
                                pingColor: hitType === 'head'
                                    ? '231,76,60'
                                    : (isAxeHit ? '255,196,77' : '255,255,255')
                            });
                        }
                        if (event.armor_break_stage_changed) {
                            const targetPlayer = this.players.get(event.target_id);
                            const popupX = hitPoint
                                ? hitPoint.x
                                : (targetPlayer ? (targetPlayer.x + targetPlayer.width * 0.5) : 0);
                            const popupY = hitPoint
                                ? (hitPoint.y - 28)
                                : (targetPlayer ? (targetPlayer.y - 10) : 0);
                            const stageText = Number.isFinite(Number(event.armor_break_stage))
                                ? `ARMOR BREAK ${Math.max(1, Math.min(3, Number(event.armor_break_stage) | 0))}`
                                : 'ARMOR BREAK';
                            this.combatPopups.push({
                                x: popupX,
                                y: popupY,
                                text: stageText,
                                color: '255, 171, 64',
                                bornAt: now,
                                ttl: 680,
                                driftY: -34,
                                pingColor: '255,171,64'
                            });
                        }
                    }
                }
            });
            if (this.combatPopups.length > 24) {
                this.combatPopups = this.combatPopups.slice(this.combatPopups.length - 24);
            }
        }
        this._captureDeathReplaySnapshot(data);
    }

    updateRoundUI(round) {
        const stateEl = document.getElementById('roundState');
        const redScoreEl = document.getElementById('redScore');
        const blueScoreEl = document.getElementById('blueScore');
        const roundOverlay = document.getElementById('roundOverlay');
        const roundTitle = document.getElementById('roundOverlayTitle');
        const roundSubtitle = document.getElementById('roundOverlaySubtitle');
        if (!stateEl || !redScoreEl || !blueScoreEl) return;

        const scores = round.scores || { RED: 0, BLUE: 0 };
        redScoreEl.textContent = scores.RED ?? 0;
        blueScoreEl.textContent = scores.BLUE ?? 0;

        if (round.state === 'FINISHED') {
            const countdown = round.next_round_in != null ? ` Next round in ${Math.ceil(round.next_round_in)}s` : '';
            stateEl.textContent = round.winner_team ? `${round.winner_team} Wins!${countdown}` : `Round Over${countdown}`;
            stateEl.className = 'round-state round-finished';
            if (roundOverlay && roundTitle && roundSubtitle) {
                roundOverlay.classList.remove('hidden');
                roundTitle.textContent = round.winner_team ? `${round.winner_team} Wins Round ${round.number}` : 'Round Over';
                roundSubtitle.textContent = round.next_round_in != null
                    ? `Next round in ${Math.ceil(round.next_round_in)}s`
                    : 'Next round soon';
            }
        } else if (round.state === 'PRACTICE') {
            const slowText = this.slowMotionEnabled ? ' | Slow Motion Active' : '';
            stateEl.textContent = `Practice Mode: Waiting for opponent${slowText}`;
            stateEl.className = 'round-state round-waiting';
            if (roundOverlay) roundOverlay.classList.add('hidden');
        } else if (round.state === 'PLAYING') {
            const slowText = this.slowMotionEnabled ? ' | Slow Motion Active' : '';
            stateEl.textContent = `Round In Progress${slowText}`;
            stateEl.className = 'round-state round-playing';
            if (roundOverlay) roundOverlay.classList.add('hidden');
        } else {
            stateEl.textContent = 'Waiting...';
            stateEl.className = 'round-state round-waiting';
            if (roundOverlay) roundOverlay.classList.add('hidden');
        }
    }

    updateMatchUI(match) {
        const matchOverlay = document.getElementById('matchOverlay');
        const matchTitle = document.getElementById('matchOverlayTitle');
        const matchSubtitle = document.getElementById('matchOverlaySubtitle');
        if (!matchOverlay || !matchTitle || !matchSubtitle) return;

        if (match.state === 'FINISHED') {
            matchOverlay.classList.remove('hidden');
            matchTitle.textContent = match.winner_team ? `${match.winner_team} Wins the Match!` : 'Match Over';
            matchSubtitle.textContent = match.next_match_in != null
                ? `Restarting in ${Math.ceil(match.next_match_in)}s`
                : 'Restarting...';
        } else {
            matchOverlay.classList.add('hidden');
        }
    }

    _estimateReleasePowerFromArrow(arrowLike) {
        const speed = Math.hypot(Number(arrowLike.vx || 0), Number(arrowLike.vy || 0));
        const baseline = Math.max(1, Number(CONFIG.ARROW_SPEED || 900));
        return Math.max(0, Math.min(100, (speed / baseline) * 100));
    }

    _triggerShooterBowRelease(shooterId, power, angle) {
        if (shooterId == null) return;
        let shooter = this.players.get(shooterId);
        if (!shooter) {
            const numericId = Number(shooterId);
            if (Number.isFinite(numericId)) {
                shooter = this.players.get(numericId);
            }
        }
        if (!shooter || typeof shooter.triggerBowRelease !== 'function') return;
        if (typeof shooter.bowReleaseRatio === 'function' && shooter.bowReleaseRatio() > 0.45) {
            return; // Skip duplicate release pulses for the same shot.
        }
        shooter.triggerBowRelease(Number(power || 0), Number(angle || shooter.aimAngle || 0));
        const isLocalShooter = Number(shooterId) === Number(this.playerId);
        if (isLocalShooter) {
            const queueShake = (this && typeof this._queueWeaponCameraShake === 'function')
                ? this._queueWeaponCameraShake
                : Game.prototype._queueWeaponCameraShake;
            const normalizedPower = Math.max(0.2, Math.min(1.35, Number(power || 0) / 100));
            queueShake.call(this, 'bow', normalizedPower);
        }
    }

    _resolveHitImpactDirection(player, event) {
        if (!player || !event) return 1;
        const source = String(event.source || 'arrow');
        if (source === 'arrow' || source === 'ballista') {
            const vx = Number(event.projectile_vx || 0);
            if (Math.abs(vx) > 0.001) {
                return vx >= 0 ? 1 : -1;
            }
        }

        const targetCenterX = Number(player.x || 0) + Number(player.width || CONFIG.PLAYER_WIDTH || 40) * 0.5;
        const attackerCenterX = Number(event.attacker_x);
        if (Number.isFinite(attackerCenterX)) {
            const delta = targetCenterX - attackerCenterX;
            if (Math.abs(delta) > 0.001) {
                return delta >= 0 ? 1 : -1;
            }
        }
        if (event.shooter_id != null) {
            const shooter = this.players.get(event.shooter_id) || this.players.get(Number(event.shooter_id));
            if (shooter) {
                const shooterCenterX = Number(shooter.x || 0) + Number(shooter.width || CONFIG.PLAYER_WIDTH || 40) * 0.5;
                const delta = targetCenterX - shooterCenterX;
                if (Math.abs(delta) > 0.001) {
                    return delta >= 0 ? 1 : -1;
                }
            }
        }

        const facing = Number(player.facingDir || 1);
        return facing >= 0 ? -1 : 1;
    }

    _applyDirectionalHitReaction(player, event, context = {}) {
        if (!player || !event) return;
        const blocked = !!context.blocked;
        const blockedByShield = !!context.blockedByShield;
        const blockedByInvuln = !!context.blockedByInvuln;
        const finalDamage = Math.max(0, Number(context.finalDamage || event.final_damage || event.damage || 0));
        if (blockedByInvuln) return;

        const source = String(event.source || 'arrow');
        const vx = Number(event.projectile_vx || 0);
        const vy = Number(event.projectile_vy || 0);
        const speed = Math.hypot(vx, vy);
        const speedNorm = Math.max(0, Math.min(1.4, speed / Math.max(1, Number(CONFIG.ARROW_SPEED || 900))));
        const resolveImpactDir = (this && typeof this._resolveHitImpactDirection === 'function')
            ? this._resolveHitImpactDirection
            : Game.prototype._resolveHitImpactDirection;
        const dir = resolveImpactDir.call(this, player, event);
        const hitType = String(event.hit_type || 'body') === 'head' ? 'head' : 'body';
        const facing = Number(player.facingDir || 1) >= 0 ? 1 : -1;
        const hitSide = (dir * facing) < 0 ? 'front' : 'back';
        const swordAttack = String(event.sword_attack || 'slash');
        const swordImpactBoost = source === 'sword'
            ? ({ slash: 0.84, upper_slash: 1.0, lower_slash: 0.9, pierce: 1.06 }[swordAttack] || 0.88)
            : 1.0;
        const isKnockback = !blocked && (
            hitType === 'head'
            || finalDamage >= 22
            || speedNorm > 0.95
            || (source === 'sword' && swordAttack === 'pierce')
        );
        const state = isKnockback ? 'knockback' : 'stagger';
        const pose = hitType === 'head'
            ? 'head'
            : (state === 'knockback' ? 'knockback' : 'body');
        const damageNorm = Math.max(0, Math.min(1.4, finalDamage / 42));
        const baseIntensity = blocked ? (blockedByShield ? 0.32 : 0.24) : (0.48 + damageNorm * 0.62);
        const intensity = Math.max(0.15, Math.min(1.45, (baseIntensity + speedNorm * 0.24) * swordImpactBoost));
        const knockback = blocked
            ? 0.1
            : Math.max(0.12, Math.min(1.5, 0.18 + speedNorm * 0.75 + damageNorm * 0.36 + (source === 'sword' ? 0.12 : 0)));
        const durationMs = blocked ? 150 : Math.round(170 + intensity * 160);
        const staggerMs = blocked ? 90 : Math.round(95 + intensity * 80);
        const now = performance.now();
        player.arrowHitReact = {
            until: now + durationMs,
            durationMs,
            staggerUntil: now + staggerMs,
            staggerMs,
            intensity,
            dir,
            knockback,
            pose,
            state,
            hitRegion: hitType,
            hitSide,
            source,
        };

        const heavyImpact = !blocked && (
            source === 'ballista'
            || state === 'knockback'
            || finalDamage >= 22
            || speedNorm > 0.95
        );
        if (heavyImpact && typeof player.applyRagdollImpact === 'function') {
            const hitPoint = event.hit_point || null;
            player.applyRagdollImpact({
                dir,
                intensity: intensity * (state === 'knockback' ? 1.08 : 0.92),
                source,
                vx,
                vy,
                hitY: hitPoint && Number.isFinite(Number(hitPoint.y)) ? Number(hitPoint.y) : undefined,
            });
        }

        if (!blocked && source !== 'sword') {
            const kbScale = Math.max(8, 20 + knockback * 34);
            player.vx = Number(player.vx || 0) + dir * kbScale;
            if (state === 'knockback' && player.onGround) {
                player.vy = Math.min(Number(player.vy || 0), -Math.max(26, 44 * intensity));
                player.onGround = false;
            }
        }
    }

    _applyArrowHitReaction(player, event, context = {}) {
        const impl = (this && typeof this._applyDirectionalHitReaction === 'function')
            ? this._applyDirectionalHitReaction
            : Game.prototype._applyDirectionalHitReaction;
        impl.call(this, player, event, context);
    }
    
    updatePlayerState(data) {
        const player = this.players.get(data.player_id);
        if (player && !player.isMe) {
            player.setState(data.state);
        }
    }
    
    spawnArrow(data) {
        const arrow = new Arrow(
            data.x,
            data.y,
            data.angle,
            data.power,
            data.team
        );
        this.arrows.push(arrow);

        const source = data.source || data.projectile_type || 'arrow';
        if (source === 'arrow') {
            const power = Number(data.power || this._estimateReleasePowerFromArrow(data));
            this._triggerShooterBowRelease(data.shooter_id, power, Number(data.angle || 0));
        }
    }
    
    handlePlayerHit(data) {
        const player = this.players.get(data.player_id);
        if (player) {
            player.health = Math.max(0, player.health - Number(data.damage || 0));
            if (player.health <= 0) {
                player.alive = false;
                if (!player.ragdollParts) {
                    player.spawnRagdoll({
                        impact: {
                            dir: Number(player.facingDir || 1) >= 0 ? 1 : -1,
                            intensity: 0.8,
                            source: 'legacy_hit',
                            vx: Number(player.vx || 0),
                            vy: Number(player.vy || 0),
                        },
                    });
                }
            }
            
            if (player.isMe) {
                this.updateHealthBar(player.health);
            }
        }
    }
    
    updateHealthBar(health) {
        const healthBar = document.getElementById('healthBar');
        const healthText = document.getElementById('healthText');
        
        healthBar.style.width = health + '%';
        healthText.textContent = Math.max(0, Math.floor(health));
        
        if (health < 30) {
            healthBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
        } else if (health < 60) {
            healthBar.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
        }
    }

    updateStaminaBar(stamina, maxStamina = CONFIG.STAMINA_MAX || 100) {
        const staminaBar = document.getElementById('staminaBar');
        const staminaText = document.getElementById('staminaText');
        if (!staminaBar || !staminaText) return;

        const maxValue = Math.max(1, Number(maxStamina || 1));
        const value = Math.max(0, Math.min(maxValue, Number(stamina || 0)));
        const percent = (value / maxValue) * 100;
        staminaBar.style.width = `${percent}%`;
        staminaText.textContent = `${Math.round(value)}`;

        if (percent < 22) {
            staminaBar.style.background = 'linear-gradient(90deg, #e67e22, #d35400)';
        } else if (percent < 55) {
            staminaBar.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
        } else {
            staminaBar.style.background = 'linear-gradient(90deg, #1abc9c, #16a085)';
        }
    }

    applyComboFeedback(feedback, now = performance.now()) {
        if (!feedback || typeof feedback !== 'object') return;
        const count = Math.max(0, Number(feedback.count || 0));
        this.comboState.count = count;
        this.comboState.rank = String(feedback.rank || 'C');
        this.comboState.rankColor = String(feedback.rank_color || '240, 240, 240');
        this.comboState.expiresAt = now + Math.max(0, Number(feedback.expires_in_ms || 0));
        this.comboState.pulseUntil = now + 220;
        if (count <= 0) {
            this.comboState.styleText = 'No chain';
            this.comboState.styleUntil = now;
        } else {
            this.comboState.styleUntil = Math.max(this.comboState.styleUntil || 0, now + 800);
        }
        this.updateComboHud(now);
    }

    applyKillFeedback(feedback, now = performance.now(), context = {}) {
        if (!feedback || typeof feedback !== 'object') return;
        const killerId = Number(feedback.killer_id);
        const targetId = Number(feedback.target_id);
        const localShooter = !!context.localShooter || killerId === Number(this.playerId);
        const localTarget = !!context.localTarget || targetId === Number(this.playerId);
        const styleLabel = String(feedback.style_label || 'Elimination');
        const styleColor = String(feedback.style_color || '220, 220, 220');
        const comboCount = Math.max(0, Number(feedback.combo_count || 0));
        if (localShooter) {
            this.killCount = Math.max(this.killCount, Number(this.killCount || 0) + 1);
            if (feedback.is_stylish) {
                this.stylishKillCount = Math.max(this.stylishKillCount, Number(this.stylishKillCount || 0) + 1);
            }
            this.updateKillStatsHud();
            this.comboState.styleText = comboCount > 0 ? `${styleLabel} x${comboCount}` : styleLabel;
            this.comboState.styleUntil = now + 1300;
            this.comboState.pulseUntil = now + 260;
            this.updateComboHud(now);
        } else if (localTarget) {
            this.comboState.styleText = `Downed: ${styleLabel}`;
            this.comboState.styleUntil = now + 900;
            this.updateComboHud(now);
        }

        const killerPlayer = this.players.get(killerId) || this.players.get(Number(killerId));
        const targetPlayer = this.players.get(targetId) || this.players.get(Number(targetId));
        const killerName = killerPlayer ? killerPlayer.nickname : `P${killerId}`;
        const targetName = targetPlayer ? targetPlayer.nickname : `P${targetId}`;
        this.stylishFeed.push({
            bornAt: now,
            ttl: 2600,
            styleColor,
            styleLabel,
            meta: `${killerName} -> ${targetName}${comboCount > 0 ? ` | Combo x${comboCount}` : ''}`,
        });
        if (this.stylishFeed.length > 6) {
            this.stylishFeed = this.stylishFeed.slice(this.stylishFeed.length - 6);
        }
        this.renderStylishFeed(now);
    }

    updateKillStatsHud() {
        const killEl = document.getElementById('killCountText');
        const stylishEl = document.getElementById('stylishKillCountText');
        if (killEl) killEl.textContent = String(Math.max(0, Number(this.killCount || 0)));
        if (stylishEl) stylishEl.textContent = String(Math.max(0, Number(this.stylishKillCount || 0)));
    }

    updateComboHud(now = performance.now()) {
        if (this.comboState.count > 0 && now >= Number(this.comboState.expiresAt || 0)) {
            this.comboState.count = 0;
            this.comboState.rank = 'C';
            this.comboState.rankColor = '240, 240, 240';
            if (now >= Number(this.comboState.styleUntil || 0)) {
                this.comboState.styleText = 'No chain';
            }
        }

        const comboEl = document.getElementById('comboDisplay');
        const countEl = document.getElementById('comboCountText');
        const rankEl = document.getElementById('comboRankText');
        const styleEl = document.getElementById('comboStyleText');
        if (!comboEl || !countEl || !rankEl || !styleEl) return;

        if (this.comboState.count > 0) {
            comboEl.classList.add('combo-active');
            countEl.textContent = `x${this.comboState.count}`;
            rankEl.textContent = this.comboState.rank;
            rankEl.style.color = `rgba(${this.comboState.rankColor}, 0.98)`;
            if (now < Number(this.comboState.styleUntil || 0) && this.comboState.styleText) {
                styleEl.textContent = this.comboState.styleText;
            } else {
                styleEl.textContent = 'Chain alive';
            }
        } else {
            comboEl.classList.remove('combo-active');
            countEl.textContent = 'x0';
            rankEl.textContent = '-';
            rankEl.style.color = 'rgba(198, 232, 255, 0.95)';
            styleEl.textContent = (now < Number(this.comboState.styleUntil || 0) && this.comboState.styleText)
                ? this.comboState.styleText
                : 'No chain';
        }

        if (now < Number(this.comboState.pulseUntil || 0)) {
            comboEl.classList.add('combo-pulse');
        } else {
            comboEl.classList.remove('combo-pulse');
        }
    }

    renderStylishFeed(now = performance.now()) {
        const feedEl = document.getElementById('stylishFeed');
        if (!feedEl) return;
        this.stylishFeed = (this.stylishFeed || []).filter(item => (now - Number(item.bornAt || 0)) <= Number(item.ttl || 0));
        feedEl.innerHTML = '';
        this.stylishFeed.forEach((item) => {
            const node = document.createElement('div');
            node.className = 'stylish-feed-item';
            const age = Math.max(0, now - Number(item.bornAt || 0));
            const life = Math.min(1, age / Math.max(1, Number(item.ttl || 1)));
            const alpha = Math.max(0.12, 1 - life);
            node.style.opacity = String(alpha);
            const styleLine = document.createElement('div');
            styleLine.className = 'style-line';
            styleLine.style.color = `rgba(${item.styleColor || '220,220,220'}, 0.98)`;
            styleLine.textContent = item.styleLabel || 'Elimination';
            node.appendChild(styleLine);
            const metaLine = document.createElement('div');
            metaLine.className = 'meta-line';
            metaLine.textContent = item.meta || '';
            node.appendChild(metaLine);
            feedEl.appendChild(node);
        });
    }
    
    update(dt) {
        if (this.gameState !== 'PLAYING') return;
        if (performance.now() < this.hitStopUntil) return;

        this.input.setCamera(this.renderer.camera);
        if (this.localPlayer && typeof this.input.setAimAssistContext === 'function') {
            this.input.setAimAssistContext(this.localPlayer, [...this.players.values()]);
        }
        
        const input = this.localPlayer ? this.input.getInput(this.localPlayer) : null;
        let effectiveInput = input;
        if (
            this.localPlayer &&
            input &&
            CONFIG.ENABLE_LOCAL_STICKMAN_AI &&
            window.StickmanAI &&
            typeof window.StickmanAI.decideInput === 'function'
        ) {
            const aiInput = window.StickmanAI.decideInput(
                this.localPlayer,
                [...this.players.values()],
                {
                    arrows: this.arrows,
                    now: performance.now(),
                    dt,
                    config: CONFIG,
                }
            );
            effectiveInput = { ...input, ...aiInput };
        }
        this.latestInput = effectiveInput;
        if (effectiveInput && effectiveInput.jumpPressed) {
            this.pendingJump = true;
        }
        if (effectiveInput && effectiveInput.mountPressed) {
            this.pendingMountToggle = true;
        }
        if (effectiveInput && effectiveInput.slidePressed) {
            this.pendingSlide = true;
        }
        
        if (this.localPlayer && effectiveInput) {
            this.localPlayer.update(effectiveInput, dt);
            this.updateStaminaBar(this.localPlayer.stamina, this.localPlayer.maxStamina);
        }

        const onBallista = !!(this.localPlayer && this.localPlayer.usingBallistaSide);
        const canShoot = !!this.loadout.arrows || onBallista;
        if (effectiveInput && effectiveInput.shoot && canShoot) {
            this.pendingShoot = true;
            this.pendingShot = {
                angle: Number(effectiveInput.shootAngle || 0),
                power: Number(effectiveInput.shootPower || 0),
            };
            if (this.localPlayer && typeof this.localPlayer.triggerBowRelease === 'function') {
                this.localPlayer.triggerBowRelease(this.pendingShot.power, this.pendingShot.angle);
            }
            this.input.resetShoot();
        }
        if (effectiveInput && effectiveInput.swordAttack) {
            const canSpendStamina = !this.localPlayer || typeof this.localPlayer._consumeStamina !== 'function'
                ? true
                : this.localPlayer._consumeStamina(CONFIG.STAMINA_HEAVY_ATTACK_COST || 0);
            if (this.localPlayer) {
                this.updateStaminaBar(this.localPlayer.stamina, this.localPlayer.maxStamina);
            }
            if (canSpendStamina) {
                this.pendingSwordAttack = effectiveInput.swordAttack;
                if (this.localPlayer) {
                    const now = performance.now();
                    const timing = this.swordTimingMs[effectiveInput.swordAttack] || this.swordTimingMs.slash;
                    const total = timing.windup + timing.active + timing.recovery;
                    this.localPlayer.swordSwingAttack = effectiveInput.swordAttack;
                    this.localPlayer.swordSwingStarted = now;
                    this.localPlayer.swordSwingUntil = now + total;
                    this.localPlayer.swordPhase = 'windup';
                    this.localPlayer.swordAttack = effectiveInput.swordAttack;
                    this.localPlayer.swordPhaseTimer = timing.windup / 1000;
                    this.localPlayer.swordPhaseDuration = timing.windup / 1000;
                }
            }
        }

        this._refreshEnvironmentInteractionHints(effectiveInput);
        this.applySmoothing(dt);
        if (window.CastleRenderer && typeof window.CastleRenderer.update === 'function') {
            window.CastleRenderer.update(dt);
        }
        
        if (!this.authoritative && this.localPlayer && performance.now() - this.lastStateUpdate > this.stateUpdateInterval) {
            this.ws.sendPlayerState(this.localPlayer.getState());
            this.lastStateUpdate = performance.now();
        }
    }

    _clearPendingLocalActions() {
        this.pendingShoot = false;
        this.pendingShot = null;
        this.pendingSwordAttack = null;
        this.pendingJump = false;
        this.pendingMountToggle = false;
        this.pendingSlide = false;
        if (this.input && typeof this.input.resetShoot === 'function') {
            this.input.resetShoot();
        }
    }

    _applyAuthoritativePlayerState(player, serverState, options = {}) {
        if (!player || !serverState) return;
        const syncAim = options.syncAim !== false;
        const wasAlive = player.alive !== false;
        const wasMounted = player.mountedHorseId != null;

        player.health = serverState.health;
        player.alive = serverState.alive;
        if (Object.prototype.hasOwnProperty.call(serverState, 'on_ground')) {
            player.onGround = !!serverState.on_ground;
        }
        player.mountedHorseId = serverState.mounted_horse_id;
        const isMounted = player.mountedHorseId != null;
        player.usingBallistaSide = serverState.using_ballista_side;
        if (Number.isFinite(Number(serverState.facing_dir))) {
            player.facingDir = Number(serverState.facing_dir) >= 0 ? 1 : -1;
        }
        if (serverState.loadout) {
            player.setLoadout(serverState.loadout);
        }
        player.swordPhase = serverState.sword_phase || 'idle';
        player.swordAttack = serverState.sword_attack || player.swordAttack || 'slash';
        player.swordPhaseTimer = Number(serverState.sword_phase_timer || 0);
        player.swordPhaseDuration = Number(serverState.sword_phase_duration || 0);
        player.swordReactionTimer = Number(serverState.sword_reaction_timer || 0);
        player.swordReactionAttack = serverState.sword_reaction_attack || null;
        player.shieldBlocking = !!serverState.shield_blocking;
        player.shieldBlockAngle = Number(serverState.shield_block_angle || player.aimAngle || 0);
        const applyArmorBreakState = (this && typeof this._applyArmorBreakState === 'function')
            ? this._applyArmorBreakState
            : Game.prototype._applyArmorBreakState;
        applyArmorBreakState.call(
            this,
            player,
            serverState.armor_break_stage,
            serverState.armor_break_ratio
        );
        player.sprinting = !!serverState.sprinting;
        player.crouching = !!serverState.crouching;
        player.sliding = !!serverState.sliding;
        player.slideTimer = Math.max(0, Number(serverState.slide_timer || 0));
        if (Number.isFinite(Number(serverState.slide_dir))) {
            player.slideDir = Number(serverState.slide_dir) >= 0 ? 1 : -1;
        }
        player.onWall = !!serverState.on_wall;
        player.wallSide = Number.isFinite(Number(serverState.wall_side))
            ? (Number(serverState.wall_side) >= 0 ? (Number(serverState.wall_side) > 0 ? 1 : 0) : -1)
            : 0;
        player.ledgeGrabbed = !!serverState.ledge_grabbed;
        player.ledgeSide = Number.isFinite(Number(serverState.ledge_side))
            ? (Number(serverState.ledge_side) >= 0 ? (Number(serverState.ledge_side) > 0 ? 1 : 0) : -1)
            : 0;
        if (Number.isFinite(Number(serverState.ledge_x))) {
            player.ledgeX = Number(serverState.ledge_x);
        }
        if (Number.isFinite(Number(serverState.ledge_y))) {
            player.ledgeY = Number(serverState.ledge_y);
        }
        player.ledgeHangTimer = Math.max(0, Number(serverState.ledge_hang_timer || 0));
        if (Number.isFinite(Number(serverState.height))) {
            player.height = Math.max(28, Number(serverState.height));
        } else if (player.sliding || player.crouching) {
            player.height = Number(player.crouchHeight || CONFIG.CROUCH_HEIGHT || (CONFIG.PLAYER_HEIGHT * 0.7));
        } else {
            player.height = Number(player.standingHeight || CONFIG.PLAYER_HEIGHT || 80);
        }
        if (Number.isFinite(Number(serverState.stamina_max))) {
            player.maxStamina = Math.max(1, Number(serverState.stamina_max));
        }
        if (Number.isFinite(Number(serverState.stamina))) {
            player.stamina = Math.max(0, Math.min(player.maxStamina || 100, Number(serverState.stamina)));
        }
        if (player.isMe) {
            this.killCount = Number(serverState.kill_count || this.killCount || 0);
            this.stylishKillCount = Number(serverState.stylish_kill_count || this.stylishKillCount || 0);
            this.updateKillStatsHud();
            if (Number.isFinite(Number(serverState.combo_count))) {
                const comboCount = Math.max(0, Number(serverState.combo_count));
                if (comboCount > 0) {
                    this.comboState.count = comboCount;
                    this.comboState.rank = String(serverState.combo_rank || this.comboState.rank || 'C');
                    this.comboState.expiresAt = performance.now() + Number(serverState.combo_expires_in_ms || 0);
                }
            }
        }
        if (syncAim) {
            player.aimAngle = serverState.aimAngle;
            player.bowDrawn = serverState.bowDrawn;
            player.drawPower = serverState.drawPower;
        }

        if (wasMounted && !isMounted && player.alive) {
            const now = performance.now();
            const dismountDir = Number.isFinite(Number(serverState.vx)) && Math.abs(Number(serverState.vx)) > 8
                ? (Number(serverState.vx) >= 0 ? -1 : 1)
                : (Number(player.facingDir || 1) >= 0 ? -1 : 1);
            const dismountIntensity = Math.max(
                0.56,
                Math.min(
                    1.05,
                    0.58 + Math.hypot(Number(serverState.vx || 0), Number(serverState.vy || 0)) / 420
                )
            );
            const existing = player.arrowHitReact && typeof player.arrowHitReact === 'object'
                ? player.arrowHitReact
                : null;
            const existingUntil = existing ? Number(existing.until || 0) : 0;
            if (existingUntil <= now + 50 || Number(existing.intensity || 0) < dismountIntensity) {
                const durationMs = 170;
                player.arrowHitReact = {
                    ...(existing || {}),
                    until: now + durationMs,
                    durationMs,
                    staggerUntil: now + 110,
                    staggerMs: 110,
                    intensity: Math.max(dismountIntensity, Number(existing && existing.intensity || 0)),
                    dir: dismountDir,
                    knockback: Math.max(0.42, Number(existing && existing.knockback || 0)),
                    pose: 'knockback',
                    state: 'knockback',
                    hitRegion: 'body',
                    hitSide: 'front',
                    source: String(existing && existing.source || 'dismount'),
                };
            }
        }

        if (!player.alive && wasAlive && typeof player.spawnRagdoll === 'function' && !player.ragdollParts) {
            const deathDir = Number.isFinite(Number(serverState.facing_dir))
                ? (Number(serverState.facing_dir) >= 0 ? 1 : -1)
                : (Number(player.facingDir || 1) >= 0 ? 1 : -1);
            const deathIntensity = Math.max(0.65, Math.min(1.5, Math.hypot(Number(serverState.vx || 0), Number(serverState.vy || 0)) / 200));
            player.spawnRagdoll({
                impact: {
                    dir: deathDir,
                    intensity: deathIntensity,
                    source: 'death_sync',
                    vx: Number(serverState.vx || 0),
                    vy: Number(serverState.vy || 0),
                },
            });
            if (player.isMe) {
                this._startDeathReplay(performance.now());
            }
        } else if (player.alive && !wasAlive) {
            player.ragdollParts = null;
            player.ragdollLinks = null;
            player.ragdollState = null;
            player.ragdollQueuedImpact = null;
            player.ragdollSevered = null;
            player.ragdollQueuedSevers = [];
            const clearPlayerGoreState = (this && typeof this._clearPlayerGoreState === 'function')
                ? this._clearPlayerGoreState
                : Game.prototype._clearPlayerGoreState;
            clearPlayerGoreState.call(this, player.id);
            if (player.isMe) {
                this.deathReplay.active = false;
            }
        }
    }

    _captureDeathReplaySnapshot(snapshot) {
        if (!snapshot || !Array.isArray(snapshot.players)) return;
        const now = performance.now();
        const frame = {
            ts: now,
            players: snapshot.players.map((p) => ({
                id: Number(p.id),
                nickname: p.nickname || `Player ${p.id}`,
                team: p.team === 'BLUE' ? 'BLUE' : 'RED',
                x: Number(p.x || 0),
                y: Number(p.y || 0),
                vx: Number(p.vx || 0),
                vy: Number(p.vy || 0),
                hp: Number(p.hp || 0),
                alive: !!p.alive,
                aim_angle: Number(p.aim_angle || 0),
                bow_drawn: !!p.bow_drawn,
                draw_power: Number(p.draw_power || 0),
                loadout: p.loadout || null,
                mounted_horse_id: p.mounted_horse_id,
                facing_dir: Number(p.facing_dir || (p.team === 'RED' ? 1 : -1)),
                sword_phase: p.sword_phase || 'idle',
                sword_attack: p.sword_attack || null,
                sword_phase_timer: Number(p.sword_phase_timer || 0),
                sword_phase_duration: Number(p.sword_phase_duration || 0),
                sword_reaction_timer: Number(p.sword_reaction_timer || 0),
                sword_reaction_attack: p.sword_reaction_attack || null,
                shield_blocking: !!p.shield_blocking,
                shield_block_angle: Number(p.shield_block_angle || p.aim_angle || 0),
                armor_break_stage: Number(p.armor_break_stage || 0),
                armor_break_ratio: Number(p.armor_break_ratio || 0),
                sprinting: !!p.sprinting,
                crouching: !!p.crouching,
                sliding: !!p.sliding,
                slide_timer: Number(p.slide_timer || 0),
                slide_dir: Number(p.slide_dir || (p.facing_dir >= 0 ? 1 : -1)),
                on_wall: !!p.on_wall,
                wall_side: Number(p.wall_side || 0),
                ledge_grabbed: !!p.ledge_grabbed,
                ledge_side: Number(p.ledge_side || 0),
                ledge_x: Number(p.ledge_x || 0),
                ledge_y: Number(p.ledge_y || 0),
                ledge_hang_timer: Number(p.ledge_hang_timer || 0),
                height: Number(p.height || CONFIG.PLAYER_HEIGHT || 80),
                on_ground: !!p.on_ground,
            })),
            arrows: Array.isArray(snapshot.arrows)
                ? snapshot.arrows.map((a) => ({
                    id: Number(a.id),
                    x: Number(a.x || 0),
                    y: Number(a.y || 0),
                    vx: Number(a.vx || 0),
                    vy: Number(a.vy || 0),
                    team: a.team === 'BLUE' ? 'BLUE' : 'RED',
                    owner_id: Number(a.owner_id),
                    source: a.source || 'arrow',
                    projectile_type: a.projectile_type || 'arrow',
                }))
                : [],
            horses: Array.isArray(snapshot.horses) ? snapshot.horses.map((h) => ({ ...h })) : [],
            events: Array.isArray(snapshot.events)
                ? snapshot.events
                    .filter((e) => e && e.type === 'hit')
                    .map((e) => ({
                        type: 'hit',
                        source: e.source || 'arrow',
                        hit_type: e.hit_type || 'body',
                        shooter_id: Number(e.shooter_id),
                        target_id: Number(e.target_id),
                        final_damage: Number(e.final_damage || e.damage || 0),
                        blocked_by_invuln: !!e.blocked_by_invuln,
                        blocked_by_shield: !!e.blocked_by_shield,
                        shield_perfect_block: !!e.shield_perfect_block,
                        hit_point: e.hit_point ? { x: Number(e.hit_point.x || 0), y: Number(e.hit_point.y || 0) } : null,
                    }))
                : [],
        };
        this.deathReplayBuffer.push(frame);
        const keepAfter = now - (this.deathReplayWindowMs + this.deathReplayLeadMs + 2200);
        while (this.deathReplayBuffer.length > 0 && this.deathReplayBuffer[0].ts < keepAfter) {
            this.deathReplayBuffer.shift();
        }
    }

    _startDeathReplay(nowMs = performance.now()) {
        if (this.deathReplay.active) return;
        if (!Array.isArray(this.deathReplayBuffer) || this.deathReplayBuffer.length < 2) return;
        const windowStart = nowMs - this.deathReplayWindowMs;
        const frames = this.deathReplayBuffer.filter((f) => f.ts >= windowStart && f.ts <= nowMs + this.deathReplayLeadMs);
        if (frames.length < 2) return;

        const tracks = new Map();
        frames.forEach((frame) => {
            frame.arrows.forEach((arrow) => {
                if (!tracks.has(arrow.id)) tracks.set(arrow.id, []);
                tracks.get(arrow.id).push({
                    ts: frame.ts,
                    x: Number(arrow.x || 0),
                    y: Number(arrow.y || 0),
                    vx: Number(arrow.vx || 0),
                    vy: Number(arrow.vy || 0),
                    team: arrow.team || 'RED',
                    source: arrow.source || 'arrow',
                    projectile_type: arrow.projectile_type || 'arrow',
                });
            });
        });

        const hitEvents = [];
        frames.forEach((frame) => {
            frame.events.forEach((event) => {
                if (!event.hit_point) return;
                hitEvents.push({ ...event, ts: frame.ts });
            });
        });

        this.deathReplay = {
            active: true,
            startedAt: nowMs,
            windowStart: frames[0].ts,
            windowEnd: frames[frames.length - 1].ts,
            frames,
            tracks,
            hitEvents,
        };
    }

    _resolveReplayFrameAt(ts) {
        const replay = this.deathReplay;
        if (!replay || !Array.isArray(replay.frames) || replay.frames.length === 0) return null;
        let chosen = replay.frames[0];
        for (let i = 1; i < replay.frames.length; i++) {
            if (replay.frames[i].ts <= ts) {
                chosen = replay.frames[i];
                continue;
            }
            break;
        }
        return chosen;
    }

    _toReplayRenderablePlayer(snapshotPlayer) {
        const playerId = Number(snapshotPlayer.id);
        const live = this.players.get(playerId);
        const loadout = snapshotPlayer.loadout || (live ? live.loadout : { arrows: true, longsword: false, shield: false, miniSword: false });
        return {
            id: playerId,
            nickname: snapshotPlayer.nickname || (live ? live.nickname : `Player ${playerId}`),
            team: snapshotPlayer.team === 'BLUE' ? 'BLUE' : 'RED',
            isMe: playerId === Number(this.playerId),
            x: Number(snapshotPlayer.x || 0),
            y: Number(snapshotPlayer.y || 0),
            width: Number(CONFIG.PLAYER_WIDTH || 40),
            height: Number(snapshotPlayer.height || CONFIG.PLAYER_HEIGHT || 80),
            standingHeight: Number(CONFIG.PLAYER_HEIGHT || 80),
            crouchHeight: Number(CONFIG.CROUCH_HEIGHT || 56),
            vx: Number(snapshotPlayer.vx || 0),
            vy: Number(snapshotPlayer.vy || 0),
            onGround: !!snapshotPlayer.on_ground,
            health: Number(snapshotPlayer.hp || 0),
            maxHealth: 100,
            alive: !!snapshotPlayer.alive,
            aimAngle: Number(snapshotPlayer.aim_angle || 0),
            bowDrawn: !!snapshotPlayer.bow_drawn,
            drawPower: Number(snapshotPlayer.draw_power || 0),
            loadout,
            mountedHorseId: snapshotPlayer.mounted_horse_id,
            facingDir: Number(snapshotPlayer.facing_dir || (snapshotPlayer.team === 'RED' ? 1 : -1)) >= 0 ? 1 : -1,
            swordPhase: snapshotPlayer.sword_phase || 'idle',
            swordAttack: snapshotPlayer.sword_attack || null,
            swordSwingAttack: snapshotPlayer.sword_attack || null,
            swordPhaseTimer: Number(snapshotPlayer.sword_phase_timer || 0),
            swordPhaseDuration: Number(snapshotPlayer.sword_phase_duration || 0),
            swordReactionTimer: Number(snapshotPlayer.sword_reaction_timer || 0),
            swordReactionAttack: snapshotPlayer.sword_reaction_attack || null,
            shieldBlocking: !!snapshotPlayer.shield_blocking,
            shieldBlockAngle: Number(snapshotPlayer.shield_block_angle || snapshotPlayer.aim_angle || 0),
            armorBreakStage: Number(snapshotPlayer.armor_break_stage || 0),
            armorBreakRatio: Number(snapshotPlayer.armor_break_ratio || 0),
            sprinting: !!snapshotPlayer.sprinting,
            crouching: !!snapshotPlayer.crouching,
            sliding: !!snapshotPlayer.sliding,
            slideTimer: Number(snapshotPlayer.slide_timer || 0),
            slideDir: Number(snapshotPlayer.slide_dir || 1) >= 0 ? 1 : -1,
            onWall: !!snapshotPlayer.on_wall,
            wallSide: Number(snapshotPlayer.wall_side || 0),
            ledgeGrabbed: !!snapshotPlayer.ledge_grabbed,
            ledgeSide: Number(snapshotPlayer.ledge_side || 0),
            ledgeX: Number(snapshotPlayer.ledge_x || 0),
            ledgeY: Number(snapshotPlayer.ledge_y || 0),
            ledgeHangTimer: Number(snapshotPlayer.ledge_hang_timer || 0),
            color: snapshotPlayer.team === 'BLUE' ? '#3498db' : '#e74c3c',
        };
    }

    _drawReplayArrowTracks(frameTs) {
        const replay = this.deathReplay;
        if (!replay || !replay.tracks) return;
        const ctx = this.renderer.ctx;
        replay.tracks.forEach((points) => {
            if (!Array.isArray(points) || points.length < 2) return;
            const visible = points.filter((p) => p.ts <= frameTs);
            if (visible.length < 2) return;
            const last = visible[visible.length - 1];
            const alpha = 0.22;
            ctx.save();
            ctx.strokeStyle = last.team === 'BLUE' ? `rgba(52, 152, 219, ${alpha})` : `rgba(231, 76, 60, ${alpha})`;
            ctx.lineWidth = 2.2;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(this.renderer.scaleX(visible[0].x), this.renderer.scaleY(visible[0].y));
            for (let i = 1; i < visible.length; i++) {
                ctx.lineTo(this.renderer.scaleX(visible[i].x), this.renderer.scaleY(visible[i].y));
            }
            ctx.stroke();
            ctx.restore();
        });
    }

    _drawReplayHitEvents(frameTs) {
        const replay = this.deathReplay;
        if (!replay || !Array.isArray(replay.hitEvents)) return;
        replay.hitEvents.forEach((event) => {
            const age = frameTs - Number(event.ts || 0);
            if (age < 0 || age > 280) return;
            if (!event.hit_point) return;
            const blocked = !!event.blocked_by_invuln || !!event.blocked_by_shield;
            const alpha = Math.max(0, 1 - (age / 280));
            const color = blocked
                ? (event.shield_perfect_block ? '124, 252, 0' : '243, 156, 18')
                : (event.hit_type === 'head' ? '231, 76, 60' : '255, 255, 255');
            this.renderer.drawImpactPing(
                Number(event.hit_point.x || 0),
                Number(event.hit_point.y || 0),
                alpha,
                color,
                { kind: blocked ? 'blocked' : 'hit', life: age / 280, strength: blocked ? 1.0 : 1.22 }
            );
        });
    }

    _renderDeathReplay(now) {
        const replay = this.deathReplay;
        if (!replay || !replay.active) return false;
        const totalMs = (replay.windowEnd - replay.windowStart) + this.deathReplayHoldMs;
        const elapsed = now - replay.startedAt;
        if (elapsed > totalMs) {
            this.deathReplay.active = false;
            return false;
        }

        const frameTs = Math.min(replay.windowEnd, replay.windowStart + elapsed);
        const frame = this._resolveReplayFrameAt(frameTs);
        if (!frame) {
            this.deathReplay.active = false;
            return false;
        }

        const trackedPlayer = frame.players.find((p) => Number(p.id) === Number(this.playerId)) || frame.players[0];
        if (trackedPlayer) {
            this.renderer.setCamera(
                Number(trackedPlayer.x || 0) + Number(CONFIG.PLAYER_WIDTH || 40) * 0.5,
                Number(trackedPlayer.y || 0) + Number(trackedPlayer.height || CONFIG.PLAYER_HEIGHT || 80) * 0.5
            );
        }

        this.renderer.clear();
        this.renderer.drawGround();
        const horsesToRender = (Array.isArray(frame.horses) && frame.horses.length > 0)
            ? frame.horses
            : this.defaultHorses;
        this.renderer.drawHorses(horsesToRender);

        frame.players.forEach((snapshotPlayer) => {
            const player = this._toReplayRenderablePlayer(snapshotPlayer);
            this.renderer.drawPlayer(player, { stickmanLod: 0 });
        });

        this._drawReplayArrowTracks(frameTs);
        frame.arrows.forEach((arrow) => {
            this.renderer.drawArrow({
                id: arrow.id,
                x: Number(arrow.x || 0),
                y: Number(arrow.y || 0),
                vx: Number(arrow.vx || 0),
                vy: Number(arrow.vy || 0),
                team: arrow.team === 'BLUE' ? 'BLUE' : 'RED',
                owner_id: arrow.owner_id,
                source: arrow.source || 'arrow',
                projectile_type: arrow.projectile_type || 'arrow',
                trailPoints: [],
            });
        });
        this._drawReplayHitEvents(frameTs);

        const ctx = this.renderer.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(12, 12, 18, 0.58)';
        ctx.fillRect(18, 18, 340, 68);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = 1;
        ctx.strokeRect(18, 18, 340, 68);
        ctx.fillStyle = 'rgba(255, 241, 198, 0.98)';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Death Replay (last 10s)', 30, 46);
        const seconds = Math.max(0, (replay.windowEnd - frameTs) / 1000);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.font = '13px Arial';
        ctx.fillText(`Rewinding: ${seconds.toFixed(1)}s to death`, 30, 68);
        ctx.restore();
        return true;
    }

    _reconcileLocalPlayer(player, alpha) {
        if (!player || !player.serverState) return;
        const serverState = player.serverState;
        const dx = Number(serverState.x) - Number(player.x);
        const dy = Number(serverState.y) - Number(player.y);
        const distance = Math.hypot(dx, dy);

        if (distance > 120) {
            player.x = Number(serverState.x);
            player.y = Number(serverState.y);
        } else if (distance > 2) {
            const correctionAlpha = Math.max(alpha, 0.35);
            player.x += dx * correctionAlpha;
            player.y += dy * correctionAlpha;
        }

        player.vx = serverState.vx;
        player.vy = serverState.vy;
        if (Math.abs(player.vx) > 6) {
            player.facingDir = player.vx > 0 ? 1 : -1;
        }

        const shouldSyncAim = !this.latestInput || !this.latestInput.bowDrawn;
        this._applyAuthoritativePlayerState(player, serverState, { syncAim: shouldSyncAim });
        if (!player.alive) {
            this._clearPendingLocalActions();
        }
        this.updateHealthBar(player.health);
        this.updateStaminaBar(player.stamina, player.maxStamina);

        const ackTick = Number(serverState.last_input_tick || 0);
        if (Number.isFinite(ackTick)) {
            this.lastAckInputTick = Math.max(this.lastAckInputTick, ackTick);
        }
    }

    _reconcileRemotePlayer(player, alpha) {
        if (!player || !player.serverState) return;
        const serverState = player.serverState;
        player.x += (serverState.x - player.x) * alpha;
        player.y += (serverState.y - player.y) * alpha;
        player.vx = serverState.vx;
        player.vy = serverState.vy;
        if (Math.abs(player.vx) > 6) {
            player.facingDir = player.vx > 0 ? 1 : -1;
        }
        this._applyAuthoritativePlayerState(player, serverState, { syncAim: true });
    }

    applySmoothing(dt) {
        const alpha = 1 - Math.exp(-CONFIG.SNAPSHOT_SMOOTH_RATE * dt);

        this.players.forEach(player => {
            if (!player.serverState) return;

            if (player.isMe) {
                this._reconcileLocalPlayer(player, alpha);
            } else {
                this._reconcileRemotePlayer(player, alpha);
            }
        });

        this.arrowMap.forEach(arrow => {
            if (arrow.target) {
                arrow.x += (arrow.target.x - arrow.x) * alpha;
                arrow.y += (arrow.target.y - arrow.y) * alpha;
                arrow.vx = arrow.target.vx;
                arrow.vy = arrow.target.vy;
                arrow.angle = arrow.target.angle;
                arrow.power_ratio = arrow.target.power_ratio;
                arrow.arrow_tier = arrow.target.arrow_tier;
                this._appendArrowTrailPoint(arrow, arrow.x, arrow.y);
                return;
            }
            this._advanceStaleArrow(arrow, dt);
        });
    }

    _advanceStaleArrow(arrow, dt) {
        if (!arrow || arrow.target || arrow.stuck) return;
        const step = Math.max(0, Number(dt || 0));
        const gravity = Number(CONFIG.ARROW_GRAVITY || 1200);
        const prevX = Number(arrow.x || 0);
        const prevY = Number(arrow.y || 0);
        const vx = Number(arrow.vx || 0);
        const vy = Number(arrow.vy || 0) + gravity * step;
        arrow.vx = vx;
        arrow.vy = vy;
        arrow.x = prevX + vx * step;
        arrow.y = prevY + vy * step;
        const hasTravel = Math.hypot(vx, vy) > 0.0001;
        const travelAngle = hasTravel ? Math.atan2(vy, vx) : Number(arrow.angle || 0);
        if (hasTravel) {
            arrow.angle = travelAngle;
        }
        this._anchorArrowIfHitWorld(arrow, prevX, prevY, travelAngle);
        this._appendArrowTrailPoint(arrow, arrow.x, arrow.y);
    }

    _anchorArrowIfHitWorld(arrow, prevX, prevY, impactAngle = null) {
        if (!arrow) return false;
        const startX = Number.isFinite(Number(prevX)) ? Number(prevX) : Number(arrow.x || 0);
        const startY = Number.isFinite(Number(prevY)) ? Number(prevY) : Number(arrow.y || 0);
        const endX = Number(arrow.x || 0);
        const endY = Number(arrow.y || 0);
        const lockAngle = Number.isFinite(Number(impactAngle)) ? Number(impactAngle) : Number(arrow.angle || 0);

        const entityHit = this._attachArrowToEntity(arrow, startX, startY);
        if (entityHit) {
            this._stickArrowAtImpact(arrow, entityHit.x, entityHit.y, lockAngle);
            return true;
        }

        const worldMinX = 0;
        const worldMaxX = Math.max(worldMinX, Number(CONFIG.GAME_WIDTH || 0));
        if (endX <= worldMinX) {
            const wallT = (endX - startX) !== 0 ? (worldMinX - startX) / (endX - startX) : 0;
            const t = Math.max(0, Math.min(1, wallT));
            const hitY = startY + (endY - startY) * t;
            this._stickArrowAtImpact(arrow, worldMinX, hitY, lockAngle);
            return true;
        }
        if (endX >= worldMaxX) {
            const wallT = (endX - startX) !== 0 ? (worldMaxX - startX) / (endX - startX) : 0;
            const t = Math.max(0, Math.min(1, wallT));
            const hitY = startY + (endY - startY) * t;
            this._stickArrowAtImpact(arrow, worldMaxX, hitY, lockAngle);
            return true;
        }

        const floors = Array.isArray(CONFIG.FLOORS) ? CONFIG.FLOORS : [];
        let floorHit = null;
        const dy = endY - startY;
        floors.forEach((floor) => {
            const floorY = Number(floor.y);
            if (!Number.isFinite(floorY)) return;
            const x1 = Number(floor.x1);
            const x2 = Number(floor.x2);
            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return;
            if (Math.abs(dy) <= 0.0001) return;
            if (startY <= floorY && endY >= floorY) {
                const t = (floorY - startY) / dy;
                if (t < 0 || t > 1) return;
                const hitX = startX + (endX - startX) * t;
                if (hitX < minX || hitX > maxX) return;
                if (!floorHit || t < floorHit.t) {
                    floorHit = { x: hitX, y: floorY, t };
                }
            }
        });
        if (floorHit) {
            this._stickArrowAtImpact(arrow, floorHit.x, floorHit.y, lockAngle);
            return true;
        }

        const groundY = Number(CONFIG.GROUND_Y || 0);
        if (Number.isFinite(groundY) && Math.abs(endY - startY) > 0.0001 && startY <= groundY && endY >= groundY) {
            const t = (groundY - startY) / (endY - startY);
            const clampedT = Math.max(0, Math.min(1, t));
            const hitX = startX + (endX - startX) * clampedT;
            this._stickArrowAtImpact(arrow, hitX, groundY, lockAngle);
            return true;
        }
        return false;
    }

    _stickArrowAtImpact(arrow, hitX, hitY, hitAngle = null) {
        if (!arrow) return;
        if (Number.isFinite(Number(hitX))) arrow.x = Number(hitX);
        if (Number.isFinite(Number(hitY))) arrow.y = Number(hitY);
        if (Number.isFinite(Number(hitAngle))) {
            arrow.angle = Number(hitAngle);
        }
        arrow.vx = 0;
        arrow.vy = 0;
        arrow.target = null;
        arrow.stuck = true;
    }

    _segmentRectHit(startX, startY, endX, endY, left, right, top, bottom) {
        const x0 = Number(startX);
        const y0 = Number(startY);
        const x1 = Number(endX);
        const y1 = Number(endY);
        const minX = Math.min(Number(left), Number(right));
        const maxX = Math.max(Number(left), Number(right));
        const minY = Math.min(Number(top), Number(bottom));
        const maxY = Math.max(Number(top), Number(bottom));
        if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) return null;
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return null;

        const dx = x1 - x0;
        const dy = y1 - y0;
        let tMin = 0;
        let tMax = 1;

        const solveAxis = (origin, delta, minV, maxV) => {
            if (Math.abs(delta) <= 1e-7) {
                return origin >= minV && origin <= maxV ? [tMin, tMax] : null;
            }
            const inv = 1 / delta;
            let t1 = (minV - origin) * inv;
            let t2 = (maxV - origin) * inv;
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

        const axisX = solveAxis(x0, dx, minX, maxX);
        if (!axisX) return null;
        tMin = axisX[0];
        tMax = axisX[1];
        const axisY = solveAxis(y0, dy, minY, maxY);
        if (!axisY) return null;
        tMin = axisY[0];
        tMax = axisY[1];

        if (tMin < 0 || tMin > 1) return null;
        return {
            t: tMin,
            x: x0 + dx * tMin,
            y: y0 + dy * tMin,
        };
    }

    _attachArrowToEntity(arrow, prevX, prevY) {
        if (!arrow) return false;
        const x = Number(arrow.x || 0);
        const y = Number(arrow.y || 0);
        const startX = Number.isFinite(Number(prevX)) ? Number(prevX) : x;
        const startY = Number.isFinite(Number(prevY)) ? Number(prevY) : y;
        const margin = 3;
        let bestHit = null;
        const considerRect = (left, right, top, bottom) => {
            const hit = this._segmentRectHit(
                startX,
                startY,
                x,
                y,
                Number(left) - margin,
                Number(right) + margin,
                Number(top) - margin,
                Number(bottom) + margin
            );
            if (!hit) return;
            if (!bestHit || hit.t < bestHit.t) {
                bestHit = hit;
            }
        };

        const horses = (Array.isArray(this.horses) && this.horses.length > 0)
            ? this.horses
            : this.defaultHorses;
        for (let i = 0; i < horses.length; i += 1) {
            const horse = horses[i];
            const hw = Number(horse.width || 86);
            const hh = Number(horse.height || 62);
            const left = Number(horse.x || 0) - hw * 0.5;
            const right = Number(horse.x || 0) + hw * 0.5;
            const top = Number(horse.y || 0) - hh * 0.92;
            const bottom = Number(horse.y || 0) + hh * 0.95;
            considerRect(left, right, top, bottom);
        }

        const players = this.players ? [...this.players.values()] : [];
        for (let i = 0; i < players.length; i += 1) {
            const player = players[i];
            if (!player || !player.alive) continue;
            const left = Number(player.x || 0);
            const top = Number(player.y || 0);
            const right = left + Number(player.width || 0);
            const bottom = top + Number(player.height || 0);
            considerRect(left, right, top, bottom);
        }
        return bestHit;
    }

    _appendArrowTrailPoint(arrow, x, y, force = false) {
        if (!arrow || !Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return;
        if (!Array.isArray(arrow.trailPoints)) {
            arrow.trailPoints = [];
        }
        const now = performance.now();
        const speed = Math.hypot(Number(arrow.vx || 0), Number(arrow.vy || 0));
        const speedNorm = Math.max(0, Math.min(1.4, speed / Math.max(1, Number(CONFIG.ARROW_SPEED || 900))));
        const minIntervalMs = Math.max(8, 20 - speedNorm * 10);
        if (!force && arrow.trailSampleAt && (now - arrow.trailSampleAt) < minIntervalMs) return;

        const last = arrow.trailPoints.length > 0 ? arrow.trailPoints[arrow.trailPoints.length - 1] : null;
        const nextX = Number(x);
        const nextY = Number(y);
        if (last) {
            const jump = Math.hypot(nextX - last.x, nextY - last.y);
            if (jump > 240) {
                arrow.trailPoints.length = 0;
            }
        }
        arrow.trailPoints.push({ x: nextX, y: nextY });
        if (arrow.trailPoints.length > 18) {
            arrow.trailPoints.splice(0, arrow.trailPoints.length - 18);
        }
        arrow.trailSampleAt = now;
    }

    _rememberImpactPoint(x, y, bornAt) {
        this.recentImpactPoints.push({ x, y, bornAt });
        if (this.recentImpactPoints.length > 40) {
            this.recentImpactPoints = this.recentImpactPoints.slice(this.recentImpactPoints.length - 40);
        }
    }

    _hasRecentNearbyImpact(x, y, now, maxAgeMs = 160, maxDistance = 44) {
        this.recentImpactPoints = this.recentImpactPoints.filter((p) => (now - p.bornAt) <= 600);
        return this.recentImpactPoints.some((p) => {
            if ((now - p.bornAt) > maxAgeMs) return false;
            return Math.hypot(p.x - x, p.y - y) <= maxDistance;
        });
    }

    _queueArrowImpact(arrowLike, options = {}) {
        const x = Number(arrowLike && arrowLike.x);
        const y = Number(arrowLike && arrowLike.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const now = performance.now();
        const source = (arrowLike && arrowLike.source) || (arrowLike && arrowLike.projectile_type) || 'arrow';
        const isBallista = source === 'ballista' || source === 'ballista_bolt';
        const kind = options.kind || 'generic';
        if (kind === 'miss' && typeof this._hasRecentNearbyImpact === 'function' && this._hasRecentNearbyImpact(x, y, now)) {
            return;
        }
        this.arrowImpactBursts.push({
            x,
            y,
            bornAt: now,
            ttl: Number(options.ttl || (isBallista ? 300 : 220)),
            color: options.color || (isBallista ? '210, 210, 210' : '255, 255, 255'),
            strength: Number(options.strength || (isBallista ? 1.35 : 1.0)),
            kind,
        });
        if (kind !== 'miss' && typeof this._rememberImpactPoint === 'function') {
            this._rememberImpactPoint(x, y, now);
        }
        if (this.arrowImpactBursts.length > 24) {
            this.arrowImpactBursts = this.arrowImpactBursts.slice(this.arrowImpactBursts.length - 24);
        }
    }

    _queueBloodImpact(targetPlayer, event, payload = {}) {
        const x = Number(payload.x);
        const y = Number(payload.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const now = performance.now();
        const source = String(event && event.source || 'arrow');
        const damage = Math.max(0, Number(payload.finalDamage || event.final_damage || event.damage || 0));
        const hitType = String(payload.hitType || event.hit_type || 'body');
        const isAxeHit = !!payload.isAxeHit || source === 'sword';
        const baseIntensity = Math.max(0.45, Math.min(1.8, 0.45 + damage / 34 + (hitType === 'head' ? 0.28 : 0)));
        const droplets = [];
        const dropletCount = Math.max(5, Math.min(20, Math.round(5 + baseIntensity * 6 + (isAxeHit ? 3 : 0))));
        for (let i = 0; i < dropletCount; i += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.25 + Math.random() * (0.8 + baseIntensity * 0.75);
            droplets.push({
                dx: Math.cos(angle) * (8 + Math.random() * (18 + baseIntensity * 26)),
                dy: Math.sin(angle) * (5 + Math.random() * (14 + baseIntensity * 20)),
                r: 0.8 + Math.random() * 2.6,
                speed,
            });
        }
        this.bloodBursts.push({
            x,
            y,
            bornAt: now,
            ttl: Math.round(580 + baseIntensity * 420),
            color: (hitType === 'head' || isAxeHit) ? '176, 20, 20' : '154, 18, 18',
            droplets,
        });

        const stainRadius = Math.max(3.2, Math.min(14, 3.8 + baseIntensity * 5.2));
        const stainY = Math.min(Number(CONFIG.GROUND_Y || 700) - 2, y + Math.max(0, Number(targetPlayer && targetPlayer.height || 80) * 0.2));
        this.bloodStains.push({
            x: x + (Math.random() - 0.5) * 9,
            y: stainY,
            radius: stainRadius,
            bornAt: now,
            ttl: 18000 + Math.round(Math.random() * 7000),
        });

        if (this.bloodBursts.length > 48) {
            this.bloodBursts = this.bloodBursts.slice(this.bloodBursts.length - 48);
        }
        if (this.bloodStains.length > 72) {
            this.bloodStains = this.bloodStains.slice(this.bloodStains.length - 72);
        }
    }

    _embedProjectileInTarget(targetPlayer, event, hitPoint) {
        if (!targetPlayer || !hitPoint) return;
        const projectileSource = String(event && event.source || 'arrow');
        if (projectileSource !== 'arrow' && projectileSource !== 'ballista') return;
        const x = Number(hitPoint.x);
        const y = Number(hitPoint.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const centerX = Number(targetPlayer.x || 0) + Number(targetPlayer.width || CONFIG.PLAYER_WIDTH || 40) * 0.5;
        const centerY = Number(targetPlayer.y || 0) + Number(targetPlayer.height || CONFIG.PLAYER_HEIGHT || 80) * 0.5;
        const vx = Number(event.projectile_vx || 0);
        const vy = Number(event.projectile_vy || 0);
        const angle = (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01)
            ? Math.atan2(vy, vx)
            : Math.atan2(y - centerY, x - centerX);
        const depth = Math.max(14, Math.min(34, 16 + Number(event.final_damage || event.damage || 0) * 0.45));
        const embed = {
            id: `${targetPlayer.id}-${performance.now().toFixed(3)}-${Math.random().toString(16).slice(2, 7)}`,
            playerId: Number(targetPlayer.id),
            bornAt: performance.now(),
            ttl: projectileSource === 'ballista' ? 15000 : 12000,
            source: projectileSource,
            angle,
            depth,
            localX: x - centerX,
            localY: y - centerY,
            worldX: x,
            worldY: y,
            partType: null,
            partOffsetX: 0,
            partOffsetY: 0,
        };

        if (Array.isArray(targetPlayer.ragdollParts) && targetPlayer.ragdollParts.length > 0) {
            let nearest = null;
            targetPlayer.ragdollParts.forEach((part) => {
                if (!part) return;
                const dx = x - Number(part.x || 0);
                const dy = y - Number(part.y || 0);
                const d2 = dx * dx + dy * dy;
                if (!nearest || d2 < nearest.d2) {
                    nearest = { part, d2, dx, dy };
                }
            });
            if (nearest && nearest.part && nearest.part.type) {
                embed.partType = String(nearest.part.type);
                embed.partOffsetX = nearest.dx;
                embed.partOffsetY = nearest.dy;
            }
        }

        this.embeddedProjectiles.push(embed);
        const maxPerPlayer = 5;
        const samePlayer = this.embeddedProjectiles.filter((p) => p.playerId === embed.playerId);
        if (samePlayer.length > maxPerPlayer) {
            const overflow = samePlayer.length - maxPerPlayer;
            let removed = 0;
            this.embeddedProjectiles = this.embeddedProjectiles.filter((p) => {
                if (p.playerId !== embed.playerId) return true;
                if (removed < overflow && p.id !== embed.id) {
                    removed += 1;
                    return false;
                }
                return true;
            });
        }
        if (this.embeddedProjectiles.length > 40) {
            this.embeddedProjectiles = this.embeddedProjectiles.slice(this.embeddedProjectiles.length - 40);
        }
    }

    _resolveEmbeddedProjectileWorld(embed) {
        if (!embed) return null;
        const player = this.players.get(embed.playerId);
        if (!player) {
            return Number.isFinite(Number(embed.worldX)) && Number.isFinite(Number(embed.worldY))
                ? { x: Number(embed.worldX), y: Number(embed.worldY) }
                : null;
        }

        if (Array.isArray(player.ragdollParts) && embed.partType) {
            const match = player.ragdollParts.find((part) => part && part.type === embed.partType);
            if (match) {
                const x = Number(match.x || 0) + Number(embed.partOffsetX || 0);
                const y = Number(match.y || 0) + Number(embed.partOffsetY || 0);
                embed.worldX = x;
                embed.worldY = y;
                return { x, y };
            }
        }

        const centerX = Number(player.x || 0) + Number(player.width || CONFIG.PLAYER_WIDTH || 40) * 0.5;
        const centerY = Number(player.y || 0) + Number(player.height || CONFIG.PLAYER_HEIGHT || 80) * 0.5;
        const x = centerX + Number(embed.localX || 0);
        const y = centerY + Number(embed.localY || 0);
        embed.worldX = x;
        embed.worldY = y;
        return { x, y };
    }

    _pickSeverLimb(targetPlayer, event, context = {}) {
        const hitPoint = context.hitPoint && typeof context.hitPoint === 'object' ? context.hitPoint : null;
        const attack = String(event && event.sword_attack || 'slash');
        const source = String(event && event.source || 'arrow');
        const forceLeg = attack === 'lower_slash' || source === 'ballista';
        const forceArm = attack === 'upper_slash' || attack === 'pierce';
        let side = 'r';
        if (hitPoint && targetPlayer) {
            const centerX = Number(targetPlayer.x || 0) + Number(targetPlayer.width || CONFIG.PLAYER_WIDTH || 40) * 0.5;
            side = Number(hitPoint.x || 0) < centerX ? 'l' : 'r';
        } else {
            const dir = (this && typeof this._resolveHitImpactDirection === 'function')
                ? this._resolveHitImpactDirection(targetPlayer, event)
                : Game.prototype._resolveHitImpactDirection.call(this, targetPlayer, event);
            side = dir >= 0 ? 'r' : 'l';
        }
        if (forceLeg) return `${side}Leg`;
        if (forceArm) return `${side}Arm`;
        return (Math.random() < 0.58) ? `${side}Arm` : `${side}Leg`;
    }

    _maybeSeverLimb(targetPlayer, event, context = {}) {
        if (!targetPlayer || typeof targetPlayer.severRagdollLimb !== 'function') return;
        const source = String(event && event.source || 'arrow');
        const finalDamage = Math.max(0, Number(context.finalDamage || event.final_damage || event.damage || 0));
        const hitType = String(context.hitType || event.hit_type || 'body');
        
        // Enable arrow severing for active ragdoll mode
        const isArrow = source === 'arrow';
        const isSword = source === 'sword';
        const isBallista = source === 'ballista';
        const ragdollMode = CONFIG.RAGDOLL_ALWAYS_ACTIVE || false;
        
        // Determine sever thresholds based on source
        let minDamage = 28;
        let requiresForce = true;
        
        if (isArrow && ragdollMode) {
            minDamage = Number(CONFIG.ARROW_SEVER_DAMAGE_MIN || 35);
            requiresForce = true;
        } else if (isSword || isBallista) {
            minDamage = 28;
            requiresForce = true;
        } else {
            return; // Non-arrow, non-sword, non-ballista sources don't sever
        }
        
        if (finalDamage < minDamage && hitType !== 'head') return;

        const healthBeforeHit = Math.max(1, Number(targetPlayer.health || 100));
        const likelyLethal = finalDamage >= healthBeforeHit * 0.78;
        const forceful = finalDamage >= (minDamage + 6) || hitType === 'head' || isBallista;
        
        if (requiresForce && !likelyLethal && !forceful) return;

        // For arrows in ragdoll mode, try to use hit part from collision
        let limb = null;
        if (isArrow && ragdollMode && event.hitPart) {
            limb = this._mapHitPartToLimb(event.hitPart);
        }
        
        // Fallback to random selection
        if (!limb) {
            limb = this._pickSeverLimb(targetPlayer, event, context);
        }
        
        if (!limb) return;
        
        const dir = (this && typeof this._resolveHitImpactDirection === 'function')
            ? this._resolveHitImpactDirection(targetPlayer, event)
            : Game.prototype._resolveHitImpactDirection.call(this, targetPlayer, event);
        targetPlayer.severRagdollLimb(limb, {
            dir,
            intensity: Math.max(0.9, Math.min(2.2, 0.7 + finalDamage / 28)),
            hitY: context.hitPoint && Number.isFinite(Number(context.hitPoint.y))
                ? Number(context.hitPoint.y)
                : undefined,
        });
    }

    _mapHitPartToLimb(partType) {
        // Map ragdoll part types to severable limbs
        const partToLimb = {
            'lUpperArm': 'lArm',
            'lLowerArm': 'lArm',
            'rUpperArm': 'rArm',
            'rLowerArm': 'rArm',
            'lUpperLeg': 'lLeg',
            'lLowerLeg': 'lLeg',
            'rUpperLeg': 'rLeg',
            'rLowerLeg': 'rLeg',
        };
        return partToLimb[partType] || null;
    }

    _clearPlayerGoreState(playerId) {
        const pid = Number(playerId);
        const embeds = Array.isArray(this.embeddedProjectiles) ? this.embeddedProjectiles : [];
        this.embeddedProjectiles = embeds.filter((embed) => Number(embed.playerId) !== pid);
    }

    _triggerSwordHitStop(now, context = {}) {
        const isTarget = !!context.isTarget;
        const damage = Math.max(0, Number(context.finalDamage || 0));
        const baseMs = isTarget ? 52 : 36;
        const bonusMs = Math.min(30, damage * 0.7);
        this.hitStopUntil = Math.max(this.hitStopUntil, now + baseMs + bonusMs);
    }

    _applyArmorBreakState(player, stageRaw, ratioRaw, nowMs = performance.now(), changed = false) {
        if (!player) return;
        const prevStage = Math.max(0, Math.min(3, Number(player.armorBreakStage || 0) | 0));
        const stage = Number.isFinite(Number(stageRaw))
            ? Math.max(0, Math.min(3, Number(stageRaw) | 0))
            : prevStage;
        let ratio = Number.isFinite(Number(ratioRaw))
            ? Math.max(0, Math.min(1, Number(ratioRaw)))
            : Math.max(0, Math.min(1, stage / 3));
        ratio = Math.max(ratio, Math.max(0, Math.min(1, stage / 3)));
        player.armorBreakStage = stage;
        player.armorBreakRatio = ratio;
        if (changed || stage > prevStage) {
            player.armorBreakPulseUntil = Math.max(Number(player.armorBreakPulseUntil || 0), Number(nowMs || 0) + 260);
        }
    }

    _resolveShotForInputSnapshot() {
        const input = this.latestInput || {};
        const localAim = this.localPlayer ? Number(this.localPlayer.aimAngle || 0) : 0;
        const hasPending = !!this.pendingShoot;
        const pendingShot = this.pendingShot || {};

        const rawPendingAngle = Number(pendingShot.angle);
        const rawPendingPower = Number(pendingShot.power);
        const fallbackShotAngle = Number(input.shootAngle || 0);
        const fallbackShotPower = Number(input.shootPower || 0);
        const pendingAngle = Number.isFinite(rawPendingAngle) ? rawPendingAngle : fallbackShotAngle;
        const pendingPower = Number.isFinite(rawPendingPower) ? rawPendingPower : fallbackShotPower;

        if (input.bowDrawn) {
            return {
                aimAngle: Number(input.aimAngle || 0),
                aimPower: Number(input.drawPower || 0),
            };
        }

        if (hasPending) {
            return {
                aimAngle: pendingAngle,
                aimPower: Math.max(0, pendingPower),
            };
        }

        return {
            aimAngle: localAim,
            aimPower: 0,
        };
    }

    sendInputSnapshot() {
        if (!this.latestInput || !this.localPlayer) return;

        const moveX = (this.latestInput.left ? -1 : 0) + (this.latestInput.right ? 1 : 0);
        const drawPowerMultiplier = 1.0;
        const onBallista = !!(this.localPlayer && this.localPlayer.usingBallistaSide);
        const canShootArrows = !!this.loadout.arrows || onBallista;
        const canBlockWithShield = !!(this.loadout.shield && !onBallista);
        const resolvedShot = this._resolveShotForInputSnapshot();
        const aimAngle = resolvedShot.aimAngle;
        const aimPower = resolvedShot.aimPower * drawPowerMultiplier;

        this.ws.sendInput({
            player_id: this.playerId,
            tick: this.inputTick++,
            move_x: moveX,
            jump: this.pendingJump || false,
            mount_toggle: this.pendingMountToggle || false,
            aim_angle: aimAngle || 0,
            aim_power: aimPower || 0,
            shoot: canShootArrows && (this.pendingShoot || false),
            bow_drawn: canShootArrows && (this.latestInput.bowDrawn || false),
            sword_attack: this.pendingSwordAttack,
            sprint: !!this.latestInput.sprint,
            crouch: !!this.latestInput.crouch,
            slide: this.pendingSlide || false,
            shield_block: canBlockWithShield && !!this.latestInput.shieldBlock,
            shield_block_angle: Number(this.latestInput.shieldBlockAngle || aimAngle || 0),
            loadout: this.loadout
        });
        this.pendingShoot = false;
        this.pendingShot = null;
        this.pendingSwordAttack = null;
        this.pendingJump = false;
        this.pendingMountToggle = false;
        this.pendingSlide = false;
    }

    _setInteractionHint(player, kind, ttlMs = 200, nowMs = performance.now()) {
        if (!player) return;
        const kindText = String(kind || '').toLowerCase();
        if (!kindText) return;
        const now = Number(nowMs || 0);
        const ttl = Math.max(80, Number(ttlMs || 0));
        const until = now + ttl;
        const prevUntil = Number(player.interactionHintUntil || 0);
        if (player.interactionHint !== kindText || prevUntil < now) {
            player.interactionHintStartedAt = now;
        }
        player.interactionHint = kindText;
        player.interactionHintUntil = Math.max(prevUntil, until);
        player.interactionHintInterruptUntil = Math.max(
            Number(player.interactionHintInterruptUntil || 0),
            now + 140
        );
    }

    _clearExpiredInteractionHint(player, nowMs = performance.now()) {
        if (!player) return;
        const now = Number(nowMs || 0);
        if (Number(player.interactionHintUntil || 0) <= now) {
            player.interactionHint = null;
        }
        if (Number(player.interactionHintInterruptUntil || 0) <= now) {
            player.interactionInterrupted = false;
        }
    }

    _resolveCastleAnchor(team) {
        const side = team === 'RED' ? 'RED' : 'BLUE';
        const castleX = window.CastleRenderer && typeof window.CastleRenderer.getCastleWorldX === 'function'
            ? Number(window.CastleRenderer.getCastleWorldX(side, CONFIG))
            : (side === 'RED' ? 130 : Number(CONFIG.GAME_WIDTH || 0) - 130);
        const dir = side === 'RED' ? 1 : -1;
        return { side, castleX, dir };
    }

    _predictInteractionFromWorld(player, input) {
        if (!player) return null;
        const anchor = this._resolveCastleAnchor(player.team);
        const px = Number(player.x || 0) + Number(player.width || CONFIG.PLAYER_WIDTH || 40) * 0.5;
        const py = Number(player.y || 0) + Number(player.height || CONFIG.PLAYER_HEIGHT || 80);
        const gateDist = Math.hypot(px - anchor.castleX, py - Number(CONFIG.GROUND_Y || 700));
        const ballistaX = anchor.castleX + anchor.dir * 55;
        const ballistaY = Number(CONFIG.GROUND_Y || 700) - 250;
        const ballistaDist = Math.hypot(px - ballistaX, py - ballistaY);
        const nearCastleWall = Math.abs(px - anchor.castleX) < 210;

        if (player.usingBallistaSide) {
            return { kind: 'ballista', ttlMs: 280 };
        }
        if (input && input.mountPressed) {
            if (ballistaDist <= 150) {
                return { kind: 'ballista', ttlMs: 320 };
            }
            if (gateDist <= 185) {
                return { kind: 'gate', ttlMs: 340 };
            }
        }
        if (nearCastleWall && (player.onWall || player.ledgeGrabbed)) {
            return { kind: 'ladder', ttlMs: 220 };
        }
        return null;
    }

    _inferGateActors(nowMs = performance.now()) {
        const now = Number(nowMs || 0);
        const actors = new Set();
        if (!window.CastleRenderer || !window.CastleRenderer.gateState) return actors;
        ['RED', 'BLUE'].forEach((side) => {
            const state = window.CastleRenderer.gateState[side];
            if (!state) return;
            const target = state.open ? 1 : 0;
            const anim = Number(state.anim || 0);
            const animating = Math.abs(target - anim) > 0.025;
            if (!animating) return;
            const castleX = Number(window.CastleRenderer.getCastleWorldX(side, CONFIG));
            const gateY = Number(CONFIG.GROUND_Y || 700);
            let best = null;
            this.players.forEach((player) => {
                if (!player || player.team !== side || player.alive === false) return;
                if (player.usingBallistaSide) return;
                const px = Number(player.x || 0) + Number(player.width || CONFIG.PLAYER_WIDTH || 40) * 0.5;
                const py = Number(player.y || 0) + Number(player.height || CONFIG.PLAYER_HEIGHT || 80);
                const dist = Math.hypot(px - castleX, py - gateY);
                if (dist > 200) return;
                if (!best || dist < best.dist) {
                    best = { id: player.id, dist };
                }
            });
            if (best && best.id != null) {
                actors.add(best.id);
            }
        });
        return actors;
    }

    _refreshEnvironmentInteractionHints(localInput) {
        if (!this.players || this.players.size === 0) return;
        const now = performance.now();
        const gateActors = this._inferGateActors(now);
        this.players.forEach((player) => {
            if (!player) return;
            this._clearExpiredInteractionHint(player, now);
            const predicted = this._predictInteractionFromWorld(
                player,
                player.isMe ? localInput : null
            );
            if (predicted) {
                this._setInteractionHint(player, predicted.kind, predicted.ttlMs, now);
            }
            if (gateActors.has(player.id)) {
                this._setInteractionHint(player, 'gate', 260, now);
            }
            const interrupted =
                player.alive === false
                || !!player.sliding
                || !!player.bowDrawn
                || (!!player.swordPhase && player.swordPhase !== 'idle')
                || Number(player.swordReactionTimer || 0) > 0;
            player.interactionInterrupted = interrupted;
            if (interrupted) {
                player.interactionHintInterruptUntil = Math.max(
                    Number(player.interactionHintInterruptUntil || 0),
                    now + 200
                );
            }
        });
    }

    _hasActiveCombatAnimation(player) {
        if (!player) return false;
        if (player.bowDrawn || Number(player.drawPower || 0) > 0) return true;
        if (player.shieldBlocking) return true;
        if (player.swordPhase && player.swordPhase !== 'idle') return true;
        if (Number(player.swordReactionTimer || 0) > 0) return true;
        if (player.onWall || player.ledgeGrabbed) return true;
        if (player.usingBallistaSide) return true;
        if (player.interactionHint && Number(player.interactionHintUntil || 0) > performance.now() - 16) return true;
        return false;
    }

    _lodTierForPlayer(player, cameraCenterX, cameraCenterY, playerCount) {
        if (!player) return 2;
        if (player.isMe) return 0;
        if (!this.stickmanLodEnabled) return 0;
        const px = Number(player.x || 0) + Number(player.width || CONFIG.PLAYER_WIDTH || 40) * 0.5;
        const py = Number(player.y || 0) + Number(player.height || CONFIG.PLAYER_HEIGHT || 80) * 0.5;
        const dx = px - cameraCenterX;
        const dy = py - cameraCenterY;
        const distance = Math.hypot(dx, dy);
        const activeCombat = this._hasActiveCombatAnimation(player);
        const lowCount = playerCount <= 8;
        const highCount = playerCount >= 14;
        const nearThreshold = lowCount ? 1080 : 920;
        const farThreshold = highCount ? 1460 : 1650;
        if (activeCombat && distance < farThreshold) {
            return distance <= nearThreshold ? 0 : 1;
        }
        if (distance <= nearThreshold) return 0;
        if (distance <= farThreshold) return 1;
        return 2;
    }

    _animationIntervalMs(player, lodTier, playerCount) {
        if (!player || player.isMe) return 0;
        if (!this.stickmanLodEnabled) return 16;
        const inCombat = this._hasActiveCombatAnimation(player);
        if (inCombat && lodTier <= 1) return 20;

        let interval = lodTier === 0 ? 24 : (lodTier === 1 ? 42 : 76);
        if (playerCount >= 16) {
            interval += lodTier === 2 ? 18 : 10;
        } else if (playerCount >= 12) {
            interval += lodTier === 2 ? 10 : 6;
        }
        return interval;
    }

    _dispatchAnimationAudioHook(player, hook, now) {
        if (!player || !hook || typeof hook !== 'object') return;
        const type = String(hook.type || '').trim();
        if (!type) return;
        const event = {
            type,
            at: Number(hook.at || now || performance.now()),
            seq: Number(hook.seq || 0),
            player_id: Number(player.id),
            team: player.team === 'BLUE' ? 'BLUE' : 'RED',
            is_local: Number(player.id) === Number(this.playerId),
        };
        if (type === 'footstep') {
            event.foot = String(hook.foot || 'right') === 'left' ? 'left' : 'right';
            event.intensity = Math.max(0, Number(hook.intensity || 0));
        } else if (type === 'bow_release') {
            event.draw_power = Math.max(0, Number(hook.drawPower || 0));
            event.angle = Number(hook.angle || player.aimAngle || 0);
            event.intensity = Math.max(0, Number(hook.intensity || 0));
        } else if (type === 'blade_impact') {
            event.attack = String(hook.attack || player.swordAttack || player.swordSwingAttack || 'slash');
            event.phase_progress = Math.max(0, Math.min(1, Number(hook.phaseProgress || 0)));
            event.intensity = Math.max(0, Number(hook.intensity || 0));
        } else if (type === 'body_hit') {
            event.source = String(hook.source || 'arrow');
            event.region = String(hook.region || 'body');
            event.side = String(hook.side || 'front');
            event.state = String(hook.state || 'stagger');
            event.intensity = Math.max(0, Number(hook.intensity || 0));
        }

        this.animationAudioHooks.push(event);
        if (this.animationAudioHooks.length > 80) {
            this.animationAudioHooks = this.animationAudioHooks.slice(this.animationAudioHooks.length - 80);
        }
        if (typeof this.onAnimationAudioHook === 'function') {
            try {
                this.onAnimationAudioHook(event);
            } catch (err) {
                console.warn('onAnimationAudioHook callback failed', err);
            }
        }
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
            window.dispatchEvent(new window.CustomEvent('stickman-audio-hook', { detail: event }));
        }
    }

    _consumeAnimationAudioHooks(player, now) {
        if (!player || !window.Stickman || typeof window.Stickman.consumeAudioHooks !== 'function') return;
        const hooks = window.Stickman.consumeAudioHooks(player, 12);
        if (!Array.isArray(hooks) || hooks.length === 0) return;
        hooks.forEach((hook) => this._dispatchAnimationAudioHook(player, hook, now));
    }

    _updateStickmanAnimationBudget(now, cameraCenterX, cameraCenterY, dt) {
        const plan = [];
        const lodCounts = { 0: 0, 1: 0, 2: 0 };
        let stickmanUpdates = 0;
        const hasStickman = window.Stickman && typeof window.Stickman.update === 'function';
        const playerCount = this.players.size;
        this.players.forEach((player) => {
            if (!player) return;
            const lodTier = this._lodTierForPlayer(player, cameraCenterX, cameraCenterY, playerCount);
            lodCounts[lodTier] += 1;
            plan.push({ player, lodTier });
            if (!hasStickman || !player.alive || player.ragdollParts) return;

            const updateIntervalMs = this._animationIntervalMs(player, lodTier, playerCount);
            const lastAnimTs = Number(player._stickmanLastAnimTs || 0);
            const elapsedMs = now - lastAnimTs;
            const shouldTick = updateIntervalMs <= 0 || elapsedMs >= updateIntervalMs || !player._stickmanAnim;
            if (!shouldTick) return;

            const updateDt = updateIntervalMs <= 0
                ? dt
                : Math.max(1 / 240, Math.min(0.09, Math.max(dt, elapsedMs / 1000)));
            window.Stickman.update(player, updateDt);
            this._consumeAnimationAudioHooks(player, now);
            player._stickmanLastAnimTs = now;
            stickmanUpdates += 1;
        });
        return { plan, lodCounts, stickmanUpdates };
    }

    _recordFrameProfile(frameMs, updateMs, renderMs, renderStats) {
        const alpha = 0.14;
        const smooth = (current, next) => current > 0 ? (current + (next - current) * alpha) : next;
        this.perfStats.frameAvgMs = smooth(this.perfStats.frameAvgMs, frameMs);
        this.perfStats.updateAvgMs = smooth(this.perfStats.updateAvgMs, updateMs);
        this.perfStats.renderAvgMs = smooth(this.perfStats.renderAvgMs, renderMs);
        this.perfStats.playersRenderedAvg = smooth(this.perfStats.playersRenderedAvg, Number(renderStats.playersRendered || 0));
        this.perfStats.stickmanUpdatesAvg = smooth(this.perfStats.stickmanUpdatesAvg, Number(renderStats.stickmanUpdates || 0));
        this.perfStats.lod0Avg = smooth(this.perfStats.lod0Avg, Number((renderStats.lodCounts && renderStats.lodCounts[0]) || 0));
        this.perfStats.lod1Avg = smooth(this.perfStats.lod1Avg, Number((renderStats.lodCounts && renderStats.lodCounts[1]) || 0));
        this.perfStats.lod2Avg = smooth(this.perfStats.lod2Avg, Number((renderStats.lodCounts && renderStats.lodCounts[2]) || 0));

        if (!this.cpuProfileEnabled) return;
        const now = performance.now();
        if ((now - this.perfStats.lastLogAt) < 2500) return;
        this.perfStats.lastLogAt = now;
        console.log(
            `[CPU] frame=${this.perfStats.frameAvgMs.toFixed(2)}ms update=${this.perfStats.updateAvgMs.toFixed(2)}ms ` +
            `render=${this.perfStats.renderAvgMs.toFixed(2)}ms players=${this.perfStats.playersRenderedAvg.toFixed(1)} ` +
            `stickmanUpdates=${this.perfStats.stickmanUpdatesAvg.toFixed(1)} lod(near/mid/far)=` +
            `${this.perfStats.lod0Avg.toFixed(1)}/${this.perfStats.lod1Avg.toFixed(1)}/${this.perfStats.lod2Avg.toFixed(1)}`
        );
    }

    render(frameCtx = {}) {
        const now = Number.isFinite(Number(frameCtx.nowMs)) ? Number(frameCtx.nowMs) : performance.now();
        const dt = Math.max(1 / 240, Math.min(0.05, Number(frameCtx.deltaSec || ((now - this.lastStickmanUpdateNow) / 1000))));
        this.lastStickmanUpdateNow = now;
        if (this._renderDeathReplay(now)) {
            return;
        }
        const cameraShake = this._sampleCameraShake(now);
        if (this.localPlayer) {
            this.renderer.setCamera(
                this.localPlayer.x + this.localPlayer.width / 2,
                this.localPlayer.y + this.localPlayer.height / 2,
                {
                    offsetX: cameraShake.x,
                    offsetY: cameraShake.y,
                }
            );
        }
        this.renderer.clear();
        this.renderer.drawGround();
        const horsesToRender = (Array.isArray(this.horses) && this.horses.length > 0)
            ? this.horses
            : this.defaultHorses;
        this.renderer.drawHorses(horsesToRender);

        const cameraCenterX = this.renderer.camera.x + Number(CONFIG.CAMERA_VIEW_WIDTH || 1600) * 0.5;
        const cameraCenterY = this.renderer.camera.y + Number(CONFIG.CAMERA_VIEW_HEIGHT || 900) * 0.5;
        const renderBudget = this._updateStickmanAnimationBudget(now, cameraCenterX, cameraCenterY, dt);

        renderBudget.plan.forEach((entry) => {
            const player = entry.player;
            const lodTier = entry.lodTier;
            this.renderer.drawPlayer(player, { stickmanLod: lodTier });
            if (!player || !player.alive || !player.loadout || !player.loadout.longsword) return;
            if (!player.swordPhase || player.swordPhase === 'idle') return;
            if (lodTier >= 2 && !player.isMe) return;
            const attack = player.swordAttack || player.swordSwingAttack || 'slash';
            const reach = Number(this.swordReachPx[attack] || this.swordReachPx.slash);
            this.renderer.drawMeleeReachIndicator(player, reach, attack);
        });
        
        this.arrows.forEach(arrow => {
            this.renderer.drawArrow(arrow);
        });

        if (this.debugCollisionOverlay) {
            this.renderer.drawCombatDebugOverlay({
                players: [...this.players.values()],
                arrows: this.arrows,
                arrowHitRadius: Number(CONFIG.ARROW_HIT_RADIUS || 3),
                hitboxRatios: {
                    headWidth: Number(CONFIG.HEAD_WIDTH_RATIO || 0.5),
                    headHeight: Number(CONFIG.HEAD_HEIGHT_RATIO || 0.28),
                    bodyTopOffset: Number(CONFIG.BODY_TOP_OFFSET_RATIO || 0.24),
                },
                swordHitShape: this.swordHitShape,
                swordHitWindow: this.swordHitWindow,
            });
        }

        this.arrowImpactBursts = this.arrowImpactBursts.filter(p => (now - p.bornAt) <= p.ttl);
        this.arrowImpactBursts.forEach(p => {
            const life = (now - p.bornAt) / p.ttl;
            const alpha = Math.max(0, 1 - life);
            this.renderer.drawImpactPing(
                p.x,
                p.y,
                alpha * p.strength,
                p.color,
                {
                    kind: p.kind || 'generic',
                    life,
                    strength: p.strength,
                }
            );
        });

        this.bloodStains = this.bloodStains.filter((stain) => (now - stain.bornAt) <= stain.ttl);
        this.bloodStains.forEach((stain) => {
            const life = (now - stain.bornAt) / stain.ttl;
            const alpha = Math.max(0, 1 - Math.max(0, life - 0.78) / 0.22);
            this.renderer.drawBloodStain(stain.x, stain.y, stain.radius, alpha);
        });

        this.bloodBursts = this.bloodBursts.filter((burst) => (now - burst.bornAt) <= burst.ttl);
        this.bloodBursts.forEach((burst) => {
            const life = (now - burst.bornAt) / burst.ttl;
            const alpha = Math.max(0, 1 - life);
            this.renderer.drawBloodBurst(burst, alpha, life);
        });

        this.embeddedProjectiles = this.embeddedProjectiles.filter((embed) => (now - embed.bornAt) <= embed.ttl);
        this.embeddedProjectiles.forEach((embed) => {
            const resolved = this._resolveEmbeddedProjectileWorld(embed);
            if (!resolved) return;
            const life = (now - embed.bornAt) / embed.ttl;
            const alpha = Math.max(0.35, Math.min(1, 1 - Math.max(0, life - 0.82) / 0.18));
            this.renderer.drawEmbeddedProjectile({
                x: resolved.x,
                y: resolved.y,
                angle: embed.angle,
                depth: embed.depth,
                source: embed.source,
            }, { alpha });
        });

        // Draw drag line (slingshot rubber band effect)
        const dragInfo = this.input.getDragInfo(this.localPlayer);
        if (dragInfo && this.localPlayer) {
            this.renderer.drawDragLine(
                this.localPlayer.x + this.localPlayer.width / 2,
                this.localPlayer.y + this.localPlayer.height / 2,
                dragInfo
            );
        }

        this.combatPopups = this.combatPopups.filter(p => (now - p.bornAt) <= p.ttl);
        this.combatPopups.forEach(p => {
            const life = (now - p.bornAt) / p.ttl;
            const alpha = Math.max(0, 1 - life);
            const y = p.y + p.driftY * life;
            this.renderer.drawImpactPing(p.x, y + 10, alpha, p.pingColor);
            this.renderer.drawWorldText(p.x, y, p.text, alpha, p.color);
        });

        if (this.damageFlashUntil > now) {
            const alpha = Math.min(this.damageFlashStrength, (this.damageFlashUntil - now) / 250 * this.damageFlashStrength);
            this.renderer.drawDamageFlash(alpha);
        }
        if (this.hitMarkerUntil > now) {
            const alpha = Math.min(1, (this.hitMarkerUntil - now) / 180);
            this.renderer.drawHitMarker(alpha, this.hitMarkerColor);
        }
        if (this.blockedMarkerUntil > now) {
            const alpha = Math.min(1, (this.blockedMarkerUntil - now) / 150);
            this.renderer.drawHitMarker(alpha, '243, 156, 18');
        }
        this.updateComboHud(now);
        this.renderStylishFeed(now);

        this.lastRenderStats = {
            playersRendered: renderBudget.plan.length,
            stickmanUpdates: renderBudget.stickmanUpdates,
            lodCounts: renderBudget.lodCounts,
        };
    }
    
    requestPlayerRespawn(playerId) {
        // Client-side request to respawn player
        // In authoritative mode, this would send a request to the server
        // For now, handle it locally for testing
        if (CONFIG.AUTHORITATIVE_MODE && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'request_respawn',
                player_id: playerId
            }));
        } else {
            // Local mode: handle respawn immediately
            const player = this.players.get(playerId);
            if (player) {
                this._handleLocalRespawn(player);
            }
        }
    }
    
    _handleLocalRespawn(player) {
        // Reset player to spawn position
        const center = CONFIG.GAME_WIDTH / 2;
        player.x = player.team === 'RED' ? center - 280 : center + 240;
        player.y = CONFIG.GROUND_Y - CONFIG.PLAYER_HEIGHT;
        player.vx = 0;
        player.vy = 0;
        player.health = 100;
        player.alive = true;
        player.ragdollMotorsEnabled = CONFIG.RAGDOLL_ALWAYS_ACTIVE || false;
        player.ragdollInactiveTimer = 0;
        player.canWalk = true;
        player.canUseWeapon = { left: true, right: true };
        
        // Respawn ragdoll clean
        if (player.ragdollParts) {
            player.spawnRagdoll({ skipInitialImpulse: true });
        }
    }
    
    gameLoop() {
        const frameStart = performance.now();
        const delta = Math.min((frameStart - this.lastUpdateTime) / 1000, 0.05);
        const updateStart = performance.now();
        this.update(delta);
        const updateMs = performance.now() - updateStart;
        this.lastUpdateTime = frameStart;

        const renderStart = performance.now();
        this.render({ nowMs: performance.now(), deltaSec: delta });
        const renderMs = performance.now() - renderStart;
        const frameMs = performance.now() - frameStart;
        this._recordFrameProfile(frameMs, updateMs, renderMs, this.lastRenderStats || {});
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

function leaveRoom() {
    const roomCode = sessionStorage.getItem('roomCode');
    if (roomCode) {
        localStorage.removeItem(`room_${roomCode}`);
    }
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('gameSlug');

    const returnPartyCode = localStorage.getItem('returnPartyCode');
    if (returnPartyCode) {
        window.location.href = `dashboard.html?party=${returnPartyCode}`;
    } else {
        window.location.href = 'dashboard.html';
    }
}


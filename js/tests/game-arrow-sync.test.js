const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const sandbox = {
    window: {},
    CONFIG: {
        ARROW_SPEED: 900,
        ARROW_GRAVITY: 1200,
        GROUND_Y: 700,
        GAME_WIDTH: 6000,
        FLOORS: [{ y: 700, x1: 0, x2: 6000, height: 40 }],
    },
    performance: { now: () => 1000 },
    Math,
    Number,
};
sandbox.window = sandbox;

vm.createContext(sandbox);
const gameScriptPath = ['RGF/js/game.js', 'frontend/js/game.js', 'js/game.js']
    .find((candidate) => fs.existsSync(candidate));
if (!gameScriptPath) {
    throw new Error('Unable to locate game.js for tests');
}
vm.runInContext(
    `${fs.readFileSync(gameScriptPath, 'utf8')}\nthis.__GameRef = Game;`,
    sandbox
);

const GameRef = sandbox.__GameRef;
assert.ok(GameRef, 'Game should be defined');
assert.strictEqual(typeof GameRef.prototype._resolveShotForInputSnapshot, 'function');
assert.strictEqual(typeof GameRef.prototype._applyArmorBreakState, 'function');
assert.strictEqual(typeof GameRef.prototype._dispatchAnimationAudioHook, 'function');
assert.strictEqual(typeof GameRef.prototype._consumeAnimationAudioHooks, 'function');
assert.strictEqual(typeof GameRef.prototype._advanceStaleArrow, 'function');
assert.strictEqual(typeof GameRef.prototype._queueBloodImpact, 'function');
assert.strictEqual(typeof GameRef.prototype._embedProjectileInTarget, 'function');
assert.strictEqual(typeof GameRef.prototype._resolveEmbeddedProjectileWorld, 'function');
assert.strictEqual(typeof GameRef.prototype._maybeSeverLimb, 'function');

const resolveShot = GameRef.prototype._resolveShotForInputSnapshot;

const pendingResolved = resolveShot.call({
    latestInput: { bowDrawn: false, shootAngle: 0, shootPower: 0 },
    localPlayer: { aimAngle: 1.35 },
    pendingShoot: true,
    pendingShot: { angle: 0.82, power: 74 },
});
assert.strictEqual(pendingResolved.aimAngle, 0.82, 'Pending shot angle should be used');
assert.strictEqual(pendingResolved.aimPower, 74, 'Pending shot power should be used');

const drawResolved = resolveShot.call({
    latestInput: { bowDrawn: true, aimAngle: 0.44, drawPower: 58, shootAngle: 1.4, shootPower: 99 },
    localPlayer: { aimAngle: 1.35 },
    pendingShoot: true,
    pendingShot: { angle: 0.82, power: 74 },
});
assert.strictEqual(drawResolved.aimAngle, 0.44, 'While drawing, live aim angle should be used');
assert.strictEqual(drawResolved.aimPower, 58, 'While drawing, live draw power should be used');

let sentPayload = null;
const gameLike = {
    latestInput: {
        left: false,
        right: true,
        bowDrawn: false,
        shootAngle: 0,
        shootPower: 0,
    },
    localPlayer: {
        aimAngle: 1.1,
        usingBallistaSide: null,
    },
    pendingShoot: true,
    pendingShot: { angle: 0.93, power: 66 },
    pendingSwordAttack: null,
    pendingJump: false,
    pendingMountToggle: false,
    loadout: { arrows: true, longsword: false },
    ws: { sendInput: (payload) => { sentPayload = payload; } },
    playerId: 7,
    inputTick: 4,
    _resolveShotForInputSnapshot: GameRef.prototype._resolveShotForInputSnapshot,
};

GameRef.prototype.sendInputSnapshot.call(gameLike);
assert.ok(sentPayload, 'sendInput should be called');
assert.strictEqual(sentPayload.aim_angle, 0.93, 'Network payload should preserve released shot angle');
assert.strictEqual(sentPayload.aim_power, 66, 'Network payload should preserve released shot power');
assert.strictEqual(gameLike.pendingShoot, false, 'pendingShoot should reset after send');
assert.strictEqual(gameLike.pendingShot, null, 'pendingShot should reset after send');

let triggerCount = 0;
const shooter = {
    id: 7,
    triggerBowRelease: (power, angle) => {
        triggerCount += 1;
        shooter.lastPower = power;
        shooter.lastAngle = angle;
    },
    bowReleaseRatio: () => 0,
    setLoadout: () => {},
};

GameRef.prototype._triggerShooterBowRelease.call({
    players: new Map([[7, shooter]]),
}, '7', 52, 1.2);

assert.strictEqual(triggerCount, 1, 'Release should trigger for string player id');
assert.strictEqual(shooter.lastPower, 52);
assert.strictEqual(shooter.lastAngle, 1.2);

shooter.bowReleaseRatio = () => 0.7;
GameRef.prototype._triggerShooterBowRelease.call({
    players: new Map([[7, shooter]]),
}, 7, 62, 1.4);
assert.strictEqual(triggerCount, 1, 'Release should not duplicate during active pulse');

let replicatedRelease = 0;
const remoteShooter = {
    id: 22,
    initialized: true,
    setState: () => {},
    setLoadout: () => {},
    triggerBowRelease: () => { replicatedRelease += 1; },
    bowReleaseRatio: () => 0,
};
const gameSnapshotLike = {
    players: new Map([[22, remoteShooter]]),
    playerId: 999,
    loadout: { arrows: true, longsword: false },
    input: { setLoadout: () => {} },
    arrowMap: new Map(),
    arrows: [],
    horses: [],
    normalizeSingleWeaponLoadout: (l) => l,
    _estimateReleasePowerFromArrow: GameRef.prototype._estimateReleasePowerFromArrow,
    _triggerShooterBowRelease: GameRef.prototype._triggerShooterBowRelease,
    _appendArrowTrailPoint: GameRef.prototype._appendArrowTrailPoint,
    _queueArrowImpact: GameRef.prototype._queueArrowImpact,
    _captureDeathReplaySnapshot: () => {},
    updateRoundUI: () => {},
    updateMatchUI: () => {},
    updateSlowMotionButton: () => {},
    updateSlowMotionStatus: () => {},
};
GameRef.prototype.handleSnapshot.call(gameSnapshotLike, {
    players: [{
        id: 22,
        nickname: 'Remote',
        team: 'RED',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        hp: 100,
        alive: true,
        aim_angle: 0.2,
        bow_drawn: false,
        draw_power: 0,
        loadout: { arrows: true, longsword: false },
        mounted_horse_id: null,
        facing_dir: 1,
        using_ballista_side: null,
    }],
    arrows: [{
        id: 101,
        x: 150,
        y: 120,
        vx: 900,
        vy: 0,
        team: 'RED',
        owner_id: 22,
        source: 'arrow',
        projectile_type: 'arrow',
    }],
});
assert.strictEqual(replicatedRelease, 1, 'New authoritative arrow should trigger remote bow release');

const trailArrow = {
    trailPoints: [],
    trailSampleAt: 0,
};
GameRef.prototype._appendArrowTrailPoint.call({}, trailArrow, 100, 200, true);
GameRef.prototype._appendArrowTrailPoint.call({}, trailArrow, 112, 208, true);
assert.strictEqual(trailArrow.trailPoints.length, 2, 'Trail points should be appended');

const burstHolder = {
    arrowImpactBursts: [],
};
GameRef.prototype._queueArrowImpact.call(burstHolder, { x: 300, y: 400, source: 'arrow' });
assert.strictEqual(burstHolder.arrowImpactBursts.length, 1, 'Impact burst should be queued');

const bloodCtx = {
    bloodBursts: [],
    bloodStains: [],
};
GameRef.prototype._queueBloodImpact.call(
    bloodCtx,
    { id: 2, x: 200, y: 300, width: 40, height: 80 },
    { source: 'arrow', final_damage: 22, hit_type: 'body' },
    { x: 220, y: 310, finalDamage: 22, hitType: 'body' }
);
assert.strictEqual(bloodCtx.bloodBursts.length, 1, 'Blood burst should be queued for unblocked hit');
assert.strictEqual(bloodCtx.bloodStains.length, 1, 'Blood stain should be queued for unblocked hit');

const embedCtx = {
    embeddedProjectiles: [],
};
const embeddedTarget = {
    id: 9,
    x: 120,
    y: 180,
    width: 40,
    height: 80,
    ragdollParts: null,
};
GameRef.prototype._embedProjectileInTarget.call(
    embedCtx,
    embeddedTarget,
    { source: 'arrow', projectile_vx: 500, projectile_vy: -20, final_damage: 18 },
    { x: 140, y: 210 }
);
assert.strictEqual(embedCtx.embeddedProjectiles.length, 1, 'Arrow hit should embed one projectile');

const embeddedResolveCtx = {
    players: new Map([[9, { id: 9, x: 120, y: 180, width: 40, height: 80 }]]),
    renderer: { camera: { x: 0, y: 0 } },
};
const embeddedRef = embedCtx.embeddedProjectiles[0];
const embeddedBeforeCameraMove = GameRef.prototype._resolveEmbeddedProjectileWorld.call(embeddedResolveCtx, embeddedRef);
embeddedResolveCtx.renderer.camera.x = 900;
embeddedResolveCtx.renderer.camera.y = 450;
const embeddedAfterCameraMove = GameRef.prototype._resolveEmbeddedProjectileWorld.call(embeddedResolveCtx, embeddedRef);
assert.ok(embeddedBeforeCameraMove && embeddedAfterCameraMove, 'Embedded projectile world position should resolve before and after camera movement');
assert.strictEqual(embeddedAfterCameraMove.x, embeddedBeforeCameraMove.x, 'Embedded projectile x should persist across camera movement');
assert.strictEqual(embeddedAfterCameraMove.y, embeddedBeforeCameraMove.y, 'Embedded projectile y should persist across camera movement');

const severCalls = [];
GameRef.prototype._maybeSeverLimb.call({
    _pickSeverLimb: () => 'rArm',
    _resolveHitImpactDirection: () => 1,
}, {
    health: 24,
    severRagdollLimb: (limb, options) => severCalls.push({ limb, options }),
}, {
    source: 'sword',
    final_damage: 38,
    hit_type: 'body',
    sword_attack: 'slash',
}, {
    finalDamage: 38,
    hitType: 'body',
    hitPoint: { x: 200, y: 300 },
});
assert.strictEqual(severCalls.length, 1, 'Strong sword hits should attempt limb sever');
assert.strictEqual(severCalls[0].limb, 'rArm');

const staleShooter = {
    id: 99,
    initialized: true,
    setState: () => {},
    setLoadout: () => {},
    triggerBowRelease: () => {},
    bowReleaseRatio: () => 0,
};
const staleGameLike = {
    players: new Map([[99, staleShooter]]),
    playerId: 1,
    loadout: { arrows: true, longsword: false },
    input: { setLoadout: () => {} },
    arrowMap: new Map([[55, { id: 55, x: 333, y: 444, source: 'arrow' }]]),
    arrows: [],
    horses: [],
    arrowImpactBursts: [],
    normalizeSingleWeaponLoadout: (l) => l,
    _estimateReleasePowerFromArrow: GameRef.prototype._estimateReleasePowerFromArrow,
    _triggerShooterBowRelease: GameRef.prototype._triggerShooterBowRelease,
    _queueArrowImpact: GameRef.prototype._queueArrowImpact,
    _appendArrowTrailPoint: GameRef.prototype._appendArrowTrailPoint,
    _captureDeathReplaySnapshot: () => {},
    updateRoundUI: () => {},
    updateMatchUI: () => {},
    updateSlowMotionButton: () => {},
    updateSlowMotionStatus: () => {},
};
GameRef.prototype.handleSnapshot.call(staleGameLike, {
    players: [{
        id: 99,
        nickname: 'Remote',
        team: 'RED',
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        hp: 100,
        alive: true,
        aim_angle: 0,
        bow_drawn: false,
        draw_power: 0,
        loadout: { arrows: true, longsword: false },
        mounted_horse_id: null,
        facing_dir: 1,
        using_ballista_side: null,
    }],
    arrows: [],
});
assert.strictEqual(staleGameLike.arrowImpactBursts.length, 1, 'Removed arrows should queue impact feedback');
assert.strictEqual(staleGameLike.arrowMap.has(55), true, 'Removed arrows should remain in authoritative map');
assert.strictEqual(staleGameLike.arrows.length, 1, 'Removed arrows should remain renderable');
assert.strictEqual(staleGameLike.arrowMap.get(55).stale, true, 'Removed arrows should be marked stale');

const staleAdvanceCtx = {
    players: new Map(),
    horses: [],
    defaultHorses: [],
    _appendArrowTrailPoint: GameRef.prototype._appendArrowTrailPoint,
    _attachArrowToEntity: GameRef.prototype._attachArrowToEntity,
    _anchorArrowIfHitWorld: GameRef.prototype._anchorArrowIfHitWorld,
    _stickArrowAtImpact: GameRef.prototype._stickArrowAtImpact,
    _segmentRectHit: GameRef.prototype._segmentRectHit,
};
const staleAirArrow = {
    id: 501,
    x: 240,
    y: 690,
    vx: 0,
    vy: 220,
    angle: Math.PI / 2,
    trailPoints: [],
    trailSampleAt: 0,
    target: null,
    stuck: false,
};
GameRef.prototype._advanceStaleArrow.call(staleAdvanceCtx, staleAirArrow, 0.1);
assert.strictEqual(staleAirArrow.stuck, true, 'Stale arrows should stick when they hit world geometry');
assert.strictEqual(staleAirArrow.y, sandbox.CONFIG.GROUND_Y, 'Stale arrows should anchor to ground instead of disappearing');
assert.strictEqual(staleAirArrow.vx, 0, 'Anchored stale arrows should stop horizontal motion');
assert.strictEqual(staleAirArrow.vy, 0, 'Anchored stale arrows should stop vertical motion');

const staleGroundPreciseCtx = {
    players: new Map(),
    horses: [],
    defaultHorses: [],
    _appendArrowTrailPoint: GameRef.prototype._appendArrowTrailPoint,
    _attachArrowToEntity: GameRef.prototype._attachArrowToEntity,
    _anchorArrowIfHitWorld: GameRef.prototype._anchorArrowIfHitWorld,
    _stickArrowAtImpact: GameRef.prototype._stickArrowAtImpact,
    _segmentRectHit: GameRef.prototype._segmentRectHit,
};
const staleGroundArrow = {
    id: 701,
    x: 100,
    y: 680,
    vx: 200,
    vy: 100,
    angle: 0,
    trailPoints: [],
    trailSampleAt: 0,
    target: null,
    stuck: false,
};
GameRef.prototype._advanceStaleArrow.call(staleGroundPreciseCtx, staleGroundArrow, 0.2);
assert.strictEqual(staleGroundArrow.stuck, true, 'Ground impact should stick stale arrows');
assert.ok(Math.abs(staleGroundArrow.x - 111.76) < 0.25, 'Ground impact should preserve precise x impact point');
assert.strictEqual(staleGroundArrow.y, sandbox.CONFIG.GROUND_Y, 'Ground impact should clamp exactly to ground y');
assert.ok(Math.abs(staleGroundArrow.angle - Math.atan2(340, 200)) < 0.001, 'Ground impact should preserve travel angle at impact');

const originalFloors = sandbox.CONFIG.FLOORS;
sandbox.CONFIG.FLOORS = [
    { y: 520, x1: 140, x2: 1460, height: 22 },
    { y: sandbox.CONFIG.GROUND_Y, x1: 0, x2: sandbox.CONFIG.GAME_WIDTH, height: 40 },
];
const staleFloorArrow = {
    id: 703,
    x: 200,
    y: 480,
    vx: 100,
    vy: 200,
    angle: 0,
    trailPoints: [],
    trailSampleAt: 0,
    target: null,
    stuck: false,
};
GameRef.prototype._advanceStaleArrow.call(staleGroundPreciseCtx, staleFloorArrow, 0.2);
assert.strictEqual(staleFloorArrow.stuck, true, 'Platform impact should stick stale arrows');
assert.ok(Math.abs(staleFloorArrow.x - 209.09) < 0.3, 'Platform impact should lock precise x impact point');
assert.strictEqual(staleFloorArrow.y, 520, 'Platform impact should clamp exactly to platform y');
sandbox.CONFIG.FLOORS = originalFloors;

const staleLeftWallArrow = {
    id: 704,
    x: 5,
    y: 400,
    vx: -200,
    vy: 0,
    angle: Math.PI,
    trailPoints: [],
    trailSampleAt: 0,
    target: null,
    stuck: false,
};
GameRef.prototype._advanceStaleArrow.call(staleGroundPreciseCtx, staleLeftWallArrow, 0.1);
assert.strictEqual(staleLeftWallArrow.stuck, true, 'Left world boundary impact should stick stale arrows');
assert.strictEqual(staleLeftWallArrow.x, 0, 'Left wall impact should lock arrow on boundary x');
assert.ok(Math.abs(staleLeftWallArrow.y - 403) < 0.2, 'Left wall impact should interpolate exact impact y');
assert.ok(Math.abs(staleLeftWallArrow.angle - Math.atan2(120, -200)) < 0.001, 'Left wall impact should preserve incoming travel angle');

const staleWallArrow = {
    id: 702,
    x: sandbox.CONFIG.GAME_WIDTH - 5,
    y: 400,
    vx: 200,
    vy: 0,
    angle: 0,
    trailPoints: [],
    trailSampleAt: 0,
    target: null,
    stuck: false,
};
GameRef.prototype._advanceStaleArrow.call(staleGroundPreciseCtx, staleWallArrow, 0.1);
assert.strictEqual(staleWallArrow.stuck, true, 'World boundary impact should stick stale arrows');
assert.strictEqual(staleWallArrow.x, sandbox.CONFIG.GAME_WIDTH, 'Wall impact should lock arrow on boundary x');
assert.ok(Math.abs(staleWallArrow.y - 403) < 0.2, 'Wall impact should interpolate exact impact y');
assert.ok(Math.abs(staleWallArrow.angle - Math.atan2(120, 200)) < 0.001, 'Wall impact should preserve incoming travel angle');

const entityStickCtx = {
    players: new Map([[5, { id: 5, alive: true, x: 200, y: 200, width: 40, height: 80 }]]),
    horses: [],
    defaultHorses: [],
    _attachArrowToEntity: GameRef.prototype._attachArrowToEntity,
    _anchorArrowIfHitWorld: GameRef.prototype._anchorArrowIfHitWorld,
    _stickArrowAtImpact: GameRef.prototype._stickArrowAtImpact,
    _segmentRectHit: GameRef.prototype._segmentRectHit,
};
const entityArrow = {
    x: 250,
    y: 220,
    vx: 900,
    vy: 0,
    angle: 0,
    target: null,
    stuck: false,
};
const didStickEntity = GameRef.prototype._anchorArrowIfHitWorld.call(entityStickCtx, entityArrow, 150, 220, 0);
assert.strictEqual(didStickEntity, true, 'Character collision should stick arrow');
assert.strictEqual(entityArrow.stuck, true, 'Character collision should mark arrow as stuck');
assert.ok(Math.abs(entityArrow.x - 197) < 0.2, 'Character collision should freeze at entry impact point');
assert.strictEqual(entityArrow.y, 220, 'Character collision should preserve line impact y');
assert.strictEqual(entityArrow.angle, 0, 'Character collision should preserve provided impact angle');

const activeHorseStickCtx = {
    players: new Map(),
    horses: [{ id: 'h-active', x: 300, y: 650, width: 86, height: 62 }],
    defaultHorses: [],
    _attachArrowToEntity: GameRef.prototype._attachArrowToEntity,
    _anchorArrowIfHitWorld: GameRef.prototype._anchorArrowIfHitWorld,
    _stickArrowAtImpact: GameRef.prototype._stickArrowAtImpact,
    _segmentRectHit: GameRef.prototype._segmentRectHit,
};
const activeHorseArrow = {
    x: 330,
    y: 620,
    vx: 900,
    vy: 0,
    angle: 0,
    target: null,
    stuck: false,
};
const didStickActiveHorse = GameRef.prototype._anchorArrowIfHitWorld.call(activeHorseStickCtx, activeHorseArrow, 240, 620, 0);
assert.strictEqual(didStickActiveHorse, true, 'Active horse collision should stick arrow');
assert.strictEqual(activeHorseArrow.stuck, true, 'Active horse collision should mark arrow as stuck');
assert.ok(activeHorseArrow.x >= 250 && activeHorseArrow.x <= 260, 'Active horse collision should freeze near horse front edge');

const defaultHorseStickCtx = {
    players: new Map(),
    horses: [],
    defaultHorses: [{ id: 'h-default', x: 360, y: 640, width: 86, height: 62 }],
    _attachArrowToEntity: GameRef.prototype._attachArrowToEntity,
    _anchorArrowIfHitWorld: GameRef.prototype._anchorArrowIfHitWorld,
    _stickArrowAtImpact: GameRef.prototype._stickArrowAtImpact,
    _segmentRectHit: GameRef.prototype._segmentRectHit,
};
const defaultHorseArrow = {
    x: 390,
    y: 620,
    vx: 700,
    vy: 0,
    angle: 0,
    target: null,
    stuck: false,
};
const didStickDefaultHorse = GameRef.prototype._anchorArrowIfHitWorld.call(defaultHorseStickCtx, defaultHorseArrow, 300, 620, 0);
assert.strictEqual(didStickDefaultHorse, true, 'Default horse collision should stick arrow');
assert.strictEqual(defaultHorseArrow.stuck, true, 'Default horse collision should mark arrow as stuck');
assert.ok(defaultHorseArrow.x >= 310 && defaultHorseArrow.x <= 320, 'Default horse collision should freeze near horse front edge');

const horseHeightRegressionCtx = {
    players: new Map(),
    horses: [{ id: 'h-height', x: 420, y: 650, width: 86, height: 62 }],
    defaultHorses: [],
    _attachArrowToEntity: GameRef.prototype._attachArrowToEntity,
    _anchorArrowIfHitWorld: GameRef.prototype._anchorArrowIfHitWorld,
    _stickArrowAtImpact: GameRef.prototype._stickArrowAtImpact,
    _segmentRectHit: GameRef.prototype._segmentRectHit,
};
const lowHorseArrow = {
    x: 470,
    y: 742,
    vx: 900,
    vy: 0,
    angle: 0,
    target: null,
    stuck: false,
};
const lowHorseHit = GameRef.prototype._anchorArrowIfHitWorld.call(horseHeightRegressionCtx, lowHorseArrow, 330, 742, 0);
assert.strictEqual(lowHorseHit, false, 'Arrow should miss before horse height increase');
assert.strictEqual(lowHorseArrow.stuck, false, 'Arrow should remain unstuck when horse hitbox is shorter');
horseHeightRegressionCtx.horses[0].height = 120;
const tallHorseArrow = {
    x: 470,
    y: 742,
    vx: 900,
    vy: 0,
    angle: 0,
    target: null,
    stuck: false,
};
const tallHorseHit = GameRef.prototype._anchorArrowIfHitWorld.call(horseHeightRegressionCtx, tallHorseArrow, 330, 742, 0);
assert.strictEqual(tallHorseHit, true, 'Arrow should collide after horse height increase');
assert.strictEqual(tallHorseArrow.stuck, true, 'Arrow should stick once horse height-expanded hitbox is active');

const riderHitboxRegressionCtx = {
    players: new Map([[12, { id: 12, alive: true, x: 220, y: 300, width: 40, height: 80 }]]),
    horses: [],
    defaultHorses: [],
    _attachArrowToEntity: GameRef.prototype._attachArrowToEntity,
    _anchorArrowIfHitWorld: GameRef.prototype._anchorArrowIfHitWorld,
    _stickArrowAtImpact: GameRef.prototype._stickArrowAtImpact,
    _segmentRectHit: GameRef.prototype._segmentRectHit,
};
const shortRiderArrow = {
    x: 280,
    y: 402,
    vx: 900,
    vy: 0,
    angle: 0,
    target: null,
    stuck: false,
};
const shortRiderHit = GameRef.prototype._anchorArrowIfHitWorld.call(riderHitboxRegressionCtx, shortRiderArrow, 160, 402, 0);
assert.strictEqual(shortRiderHit, false, 'Arrow should miss rider body before height increase');
riderHitboxRegressionCtx.players.get(12).height = 126;
const tallRiderArrow = {
    x: 280,
    y: 402,
    vx: 900,
    vy: 0,
    angle: 0,
    target: null,
    stuck: false,
};
const tallRiderHit = GameRef.prototype._anchorArrowIfHitWorld.call(riderHitboxRegressionCtx, tallRiderArrow, 160, 402, 0);
assert.strictEqual(tallRiderHit, true, 'Arrow should collide once rider hitbox reflects increased mounted height');
assert.strictEqual(tallRiderArrow.stuck, true, 'Mounted rider collision should stick arrow after height update');

const riderPositionRegressionPlayer = {
    id: 77,
    x: 500,
    y: 540,
    width: 40,
    height: 80,
    mountedHorseId: 'horse-regression',
};
const riderPositionRegressionCtx = {
    players: new Map([[77, riderPositionRegressionPlayer]]),
    renderer: { camera: { x: 0, y: 0 } },
};
const riderEmbed = {
    id: 'embed-rider-height',
    playerId: 77,
    localX: 0,
    localY: -20,
};
const riderPosBeforeHeight = GameRef.prototype._resolveEmbeddedProjectileWorld.call(riderPositionRegressionCtx, riderEmbed);
riderPositionRegressionPlayer.height = 126;
const riderPosAfterHeight = GameRef.prototype._resolveEmbeddedProjectileWorld.call(riderPositionRegressionCtx, riderEmbed);
assert.ok(riderPosBeforeHeight && riderPosAfterHeight, 'Rider position should resolve before and after mounted height update');
assert.ok(
    Math.abs((riderPosAfterHeight.y - riderPosBeforeHeight.y) - 23) < 0.001,
    'Rider center position should update from current height to keep mounted offsets accurate'
);

assert.strictEqual(typeof GameRef.prototype._applyArrowHitReaction, 'function', 'Arrow hit reaction helper should exist');
const arrowReactTarget = { vx: 0, vy: 0, onGround: true };
GameRef.prototype._applyArrowHitReaction.call({}, arrowReactTarget, {
    source: 'arrow',
    projectile_vx: 900,
    projectile_vy: 0,
    hit_type: 'head',
    final_damage: 36,
}, {
    blocked: false,
    blockedByShield: false,
    blockedByInvuln: false,
    finalDamage: 36,
});
assert.ok(arrowReactTarget.arrowHitReact, 'Arrow hit reaction payload should be attached to player');
assert.strictEqual(arrowReactTarget.arrowHitReact.pose, 'head', 'Head arrow hits should select head impact pose');
assert.ok(arrowReactTarget.vx > 0, 'Arrow hit reaction should apply knockback direction from projectile velocity');
assert.strictEqual(arrowReactTarget.arrowHitReact.hitRegion, 'head', 'Head arrow hit should classify head region');
assert.strictEqual(arrowReactTarget.arrowHitReact.hitSide, 'back', 'Projectile moving with facing direction should be classified as back hit');

const frontHitTarget = { x: 250, width: 40, facingDir: 1, vx: 0, vy: 0, onGround: true };
GameRef.prototype._applyDirectionalHitReaction.call({
    players: new Map(),
    _resolveHitImpactDirection: GameRef.prototype._resolveHitImpactDirection,
}, frontHitTarget, {
    source: 'sword',
    hit_type: 'body',
    final_damage: 16,
    sword_attack: 'slash',
    attacker_x: 330,
}, {
    blocked: false,
    blockedByShield: false,
    blockedByInvuln: false,
    finalDamage: 16,
});
assert.ok(frontHitTarget.arrowHitReact, 'Melee hit should produce directional reaction payload');
assert.strictEqual(frontHitTarget.arrowHitReact.hitSide, 'front', 'Attacker in front should classify as front hit');
assert.strictEqual(frontHitTarget.arrowHitReact.hitRegion, 'body', 'Body hit should classify body region');
assert.strictEqual(frontHitTarget.arrowHitReact.state, 'stagger', 'Moderate body hit should use short stagger state');

let ragdollImpactPayload = null;
const heavyHitTarget = {
    x: 180,
    width: 40,
    facingDir: 1,
    vx: 0,
    vy: 0,
    onGround: true,
    applyRagdollImpact: (payload) => { ragdollImpactPayload = payload; },
};
GameRef.prototype._applyDirectionalHitReaction.call({
    players: new Map(),
    _resolveHitImpactDirection: GameRef.prototype._resolveHitImpactDirection,
}, heavyHitTarget, {
    source: 'ballista',
    hit_type: 'body',
    final_damage: 42,
    projectile_vx: 1200,
    projectile_vy: -40,
    hit_point: { x: 200, y: 320 },
}, {
    blocked: false,
    blockedByShield: false,
    blockedByInvuln: false,
    finalDamage: 42,
});
assert.ok(ragdollImpactPayload, 'Heavy impacts should feed ragdoll impulse payload');
assert.strictEqual(ragdollImpactPayload.source, 'ballista', 'Ragdoll impact should preserve hit source');
assert.ok(ragdollImpactPayload.intensity > 0.5, 'Heavy impacts should carry non-trivial intensity');

let pendingClears = 0;
let healthBarValue = null;
const localPlayer = {
    x: 20,
    y: 25,
    vx: 0,
    vy: 0,
    health: 100,
    alive: true,
    aimAngle: 0,
    bowDrawn: true,
    drawPower: 50,
    onGround: true,
    swordAttack: null,
    setLoadout: () => {},
    spawnRagdoll: () => {
        localPlayer.ragdollParts = [{ x: 0, y: 0 }];
        localPlayer.ragdollLinks = [];
    },
    serverState: {
        x: 340,
        y: 420,
        vx: -18,
        vy: 4,
        health: 0,
        alive: false,
        aimAngle: 0.7,
        bowDrawn: false,
        drawPower: 0,
        on_ground: false,
        loadout: { arrows: false, longsword: true },
        mounted_horse_id: null,
        facing_dir: -1,
        using_ballista_side: null,
        sword_phase: 'idle',
        sword_attack: null,
        sword_phase_timer: 0,
        sword_phase_duration: 0,
        sword_reaction_timer: 0,
        sword_reaction_attack: null,
        shield_blocking: false,
        shield_block_angle: 0,
        armor_break_stage: 2,
        armor_break_ratio: 0.66,
        on_wall: true,
        wall_side: 1,
        ledge_grabbed: false,
        ledge_side: 0,
        ledge_x: 0,
        ledge_y: 0,
        ledge_hang_timer: 0,
        last_input_tick: 12,
    },
};
const localReconcileCtx = {
    latestInput: { bowDrawn: false },
    lastAckInputTick: 0,
    _clearPendingLocalActions: () => { pendingClears += 1; },
    updateHealthBar: (value) => { healthBarValue = value; },
    updateStaminaBar: () => {},
    _applyAuthoritativePlayerState: GameRef.prototype._applyAuthoritativePlayerState,
};
GameRef.prototype._reconcileLocalPlayer.call(localReconcileCtx, localPlayer, 0.2);
assert.strictEqual(localPlayer.x, 340, 'Large local/server drift should snap to authoritative x');
assert.strictEqual(localPlayer.y, 420, 'Large local/server drift should snap to authoritative y');
assert.strictEqual(localPlayer.alive, false, 'Authoritative death should apply immediately');
assert.strictEqual(localPlayer.onGround, false, 'Authoritative on_ground should reconcile');
assert.strictEqual(localPlayer.onWall, true, 'Authoritative on_wall should reconcile');
assert.strictEqual(localPlayer.wallSide, 1, 'Authoritative wall_side should reconcile');
assert.strictEqual(localPlayer.armorBreakStage, 2, 'Authoritative armor break stage should reconcile');
assert.ok(localPlayer.armorBreakRatio > 0.6, 'Authoritative armor break ratio should reconcile');
assert.strictEqual(pendingClears, 1, 'Pending local actions should clear after authoritative death');
assert.strictEqual(healthBarValue, 0, 'Health UI should update from authoritative health');
assert.strictEqual(localReconcileCtx.lastAckInputTick, 12, 'Last acknowledged input tick should track snapshot ack');
assert.ok(localPlayer.ragdollParts, 'Authoritative death should spawn ragdoll once');

const recoveringPlayer = {
    alive: false,
    health: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    onGround: false,
    swordAttack: null,
    ragdollParts: [{ x: 1 }],
    ragdollLinks: [{ a: 0, b: 0 }],
    setLoadout: () => {},
    spawnRagdoll: () => {},
};
GameRef.prototype._applyAuthoritativePlayerState.call({}, recoveringPlayer, {
    health: 80,
    alive: true,
    on_ground: true,
    aimAngle: 0.2,
    bowDrawn: false,
    drawPower: 0,
    loadout: { arrows: true, longsword: false },
    mounted_horse_id: null,
    facing_dir: 1,
    using_ballista_side: null,
    sword_phase: 'idle',
    sword_attack: null,
    sword_phase_timer: 0,
    sword_phase_duration: 0,
    sword_reaction_timer: 0,
    sword_reaction_attack: null,
    shield_blocking: false,
    shield_block_angle: 0,
    armor_break_stage: 1,
    armor_break_ratio: 0.35,
    on_wall: false,
    wall_side: 0,
    ledge_grabbed: true,
    ledge_side: -1,
    ledge_x: 180,
    ledge_y: 240,
    ledge_hang_timer: 0.5,
}, { syncAim: true });
assert.strictEqual(recoveringPlayer.alive, true, 'Authoritative revive should be applied');
assert.strictEqual(recoveringPlayer.ragdollParts, null, 'Revive should clear stale ragdoll state');
assert.strictEqual(recoveringPlayer.onGround, true, 'Revive should apply authoritative on_ground');
assert.strictEqual(recoveringPlayer.ledgeGrabbed, true, 'Revive should preserve authoritative ledge state');
assert.strictEqual(recoveringPlayer.armorBreakStage, 1, 'Revive should preserve authoritative armor break stage');

assert.strictEqual(GameRef.prototype._cameraMotionScale.call({ cameraMotionMode: 'full' }), 1, 'Full mode should keep camera shake at full intensity');
assert.strictEqual(GameRef.prototype._cameraMotionScale.call({ cameraMotionMode: 'reduced' }), 0.5, 'Reduced mode should scale down camera shake');
assert.strictEqual(GameRef.prototype._cameraMotionScale.call({ cameraMotionMode: 'minimal' }), 0.2, 'Minimal mode should strongly reduce camera shake');
assert.strictEqual(GameRef.prototype._cameraMotionScale.call({ cameraMotionMode: 'off' }), 0, 'Off mode should disable camera shake');

const shakeCtx = {
    cameraMotionMode: 'full',
    cameraShakeBursts: [],
    cameraShakePresets: {
        bow: { amplitude: 10, durationMs: 80, frequencyHz: 20, axisX: 1, axisY: 0.6 },
        sword: { amplitude: 16, durationMs: 110, frequencyHz: 22, axisX: 1, axisY: 0.8 },
        heavy: { amplitude: 24, durationMs: 180, frequencyHz: 17, axisX: 1, axisY: 1 },
    },
    _cameraMotionScale: GameRef.prototype._cameraMotionScale,
};
GameRef.prototype._queueWeaponCameraShake.call(shakeCtx, 'bow', 1);
assert.strictEqual(shakeCtx.cameraShakeBursts.length, 1, 'Queueing shake in full mode should add a burst');
shakeCtx.cameraMotionMode = 'off';
GameRef.prototype._queueWeaponCameraShake.call(shakeCtx, 'heavy', 1.4);
assert.strictEqual(shakeCtx.cameraShakeBursts.length, 1, 'Off mode should suppress new camera shake bursts');

const sampleCtx = {
    cameraMotionMode: 'full',
    cameraShakeBursts: [{
        startedAt: 1000,
        durationMs: 120,
        amplitudeX: 10,
        amplitudeY: 6,
        frequencyHz: 20,
        phaseX: 0.4,
        phaseY: 1.2,
    }],
    _cameraMotionScale: GameRef.prototype._cameraMotionScale,
};
const sampled = GameRef.prototype._sampleCameraShake.call(sampleCtx, 1030);
assert.ok(Math.hypot(sampled.x, sampled.y) > 0.1, 'Active camera shake should produce non-zero offsets');
const expired = GameRef.prototype._sampleCameraShake.call(sampleCtx, 1300);
assert.strictEqual(Math.round(expired.x), 0, 'Expired camera shake should clear X offset');
assert.strictEqual(Math.round(expired.y), 0, 'Expired camera shake should clear Y offset');
assert.strictEqual(sampleCtx.cameraShakeBursts.length, 0, 'Expired camera bursts should be pruned');

let localBowShakeBursts = [];
const localBowShooter = {
    triggerBowRelease: () => {},
    bowReleaseRatio: () => 0,
};
GameRef.prototype._triggerShooterBowRelease.call({
    players: new Map([[7, localBowShooter]]),
    playerId: 7,
    cameraMotionMode: 'full',
    cameraShakeBursts: localBowShakeBursts,
    cameraShakePresets: {
        bow: { amplitude: 12, durationMs: 90, frequencyHz: 22, axisX: 1, axisY: 0.6 },
        sword: { amplitude: 16, durationMs: 110, frequencyHz: 22, axisX: 1, axisY: 0.8 },
        heavy: { amplitude: 24, durationMs: 180, frequencyHz: 17, axisX: 1, axisY: 1 },
    },
    _cameraMotionScale: GameRef.prototype._cameraMotionScale,
    _queueWeaponCameraShake: GameRef.prototype._queueWeaponCameraShake,
}, 7, 72, 0.8);
assert.strictEqual(localBowShakeBursts.length, 1, 'Local bow release should queue bow camera shake');

const emittedHooks = [];
sandbox.window.Stickman = {
    consumeAudioHooks: () => ([
        { type: 'footstep', foot: 'left', intensity: 0.72, seq: 4, at: 1234 },
        { type: 'bow_release', drawPower: 68, intensity: 0.88, angle: 0.42, seq: 5, at: 1235 },
    ]),
};
const hookCtx = {
    playerId: 7,
    animationAudioHooks: [],
    onAnimationAudioHook: (event) => emittedHooks.push(event),
    _dispatchAnimationAudioHook: GameRef.prototype._dispatchAnimationAudioHook,
};
GameRef.prototype._consumeAnimationAudioHooks.call(hookCtx, { id: 7, team: 'RED', aimAngle: 0.5 }, 1400);
assert.strictEqual(hookCtx.animationAudioHooks.length, 2, 'Consuming stickman hooks should append normalized audio events');
assert.strictEqual(emittedHooks.length, 2, 'Audio hook callback should run for each emitted hook');
assert.strictEqual(hookCtx.animationAudioHooks[0].type, 'footstep', 'First emitted hook should preserve type');
assert.strictEqual(hookCtx.animationAudioHooks[0].is_local, true, 'Local player hook should be tagged local');
assert.strictEqual(hookCtx.animationAudioHooks[1].draw_power, 68, 'Bow release hook should include draw power payload');

const budgetEvents = [];
let consumedCount = 0;
sandbox.window.Stickman = {
    update: () => {},
    consumeAudioHooks: () => {
        consumedCount += 1;
        return [{ type: 'blade_impact', attack: 'slash', phaseProgress: 0.5, intensity: 1 }];
    },
};
const budgetCtx = {
    players: new Map([[11, { id: 11, team: 'BLUE', alive: true, ragdollParts: null }]]),
    stickmanLodEnabled: true,
    playerId: 99,
    animationAudioHooks: [],
    _lodTierForPlayer: () => 0,
    _animationIntervalMs: () => 0,
    _dispatchAnimationAudioHook: (player, hook, now) => budgetEvents.push({ player, hook, now }),
    _consumeAnimationAudioHooks: GameRef.prototype._consumeAnimationAudioHooks,
};
GameRef.prototype._updateStickmanAnimationBudget.call(budgetCtx, 1600, 0, 0, 1 / 60);
assert.strictEqual(consumedCount, 1, 'Animation budget update should drain one batch of audio hooks per ticked player');
assert.strictEqual(budgetEvents.length, 1, 'Drained animation hook should be dispatched');
assert.strictEqual(budgetEvents[0].hook.type, 'blade_impact', 'Dispatched hook should preserve original hook type');

console.log('game arrow sync tests passed');

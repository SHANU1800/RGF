const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function resolveScript(...candidates) {
    const path = candidates.find((candidate) => fs.existsSync(candidate));
    if (!path) {
        throw new Error(`Unable to locate script. Tried: ${candidates.join(', ')}`);
    }
    return path;
}

const noopCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    moveTo() {},
    lineTo() {},
};

const sandbox = {
    window: {},
    performance: { now: () => 1000 },
    Date,
    Math,
    Number,
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(
    fs.readFileSync(resolveScript('RGF/js/stickman.js', 'frontend/js/stickman.js', 'js/stickman.js'), 'utf8'),
    sandbox
);

function createRecordingCtx() {
    let path = [];
    const segments = [];
    return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        lineCap: '',
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        beginPath() {
            path = [];
        },
        moveTo(x, y) {
            path = [{ x, y }];
        },
        lineTo(x, y) {
            if (path.length > 0) {
                const from = path[path.length - 1];
                segments.push({
                    x1: from.x,
                    y1: from.y,
                    x2: x,
                    y2: y,
                    strokeStyle: this.strokeStyle,
                    lineWidth: this.lineWidth,
                });
            }
            path.push({ x, y });
        },
        arc() {},
        fill() {},
        stroke() {},
        _segments: segments,
    };
}

function captureTorsoSegment(player, dataOverrides) {
    const ctx = createRecordingCtx();
    sandbox.Stickman.draw(ctx, {
        player,
        w: 40,
        h: 80,
        color: '#3498db',
        vx: player.vx || 0,
        vy: player.vy || 0,
        onGround: !!player.onGround,
        aimAngle: Number(player.aimAngle || 0),
        loadout: player.loadout || {},
        healthRatio: 1,
        ...dataOverrides,
    });
    assert.ok(ctx._segments.length > 0, 'Expected at least one line segment from draw');
    return ctx._segments[0];
}

function captureSegments(player, dataOverrides) {
    const ctx = createRecordingCtx();
    sandbox.Stickman.draw(ctx, {
        player,
        w: 40,
        h: 80,
        color: '#3498db',
        vx: player.vx || 0,
        vy: player.vy || 0,
        onGround: !!player.onGround,
        aimAngle: Number(player.aimAngle || 0),
        drawPower: Number(player.drawPower || 0),
        bowDrawn: !!player.bowDrawn,
        shieldBlocking: !!player.shieldBlocking,
        shieldBlockAngle: Number(player.shieldBlockAngle || 0),
        loadout: player.loadout || {},
        healthRatio: 1,
        ...dataOverrides,
    });
    return ctx._segments;
}

function captureRightLeg(player, dataOverrides) {
    const seg = captureSegments(player, dataOverrides);
    assert.ok(seg.length >= 9, 'Expected left/right leg segments to be present');
    return {
        upper: seg[7],
        lower: seg[8],
    };
}

assert.ok(sandbox.Stickman, 'Stickman should exist');
assert.strictEqual(typeof sandbox.Stickman.draw, 'function');
assert.strictEqual(typeof sandbox.Stickman.drawRagdoll, 'function');

sandbox.Stickman.draw(noopCtx, {
    player: {
        onGround: true,
        vx: 120,
        vy: 0,
        aimAngle: 0,
        bowDrawn: false,
        drawPower: 0,
    },
    w: 40,
    h: 80,
    color: '#3498db',
    vx: 120,
    vy: 0,
    onGround: true,
    aimAngle: 0,
    loadout: { arrows: true, longsword: false },
    healthRatio: 1,
});

sandbox.Stickman.update({
    onGround: false,
    vx: 0,
    vy: -450,
    aimAngle: -0.8,
    bowDrawn: true,
    drawPower: 72,
}, 1 / 60);

sandbox.Stickman.update({
    onGround: true,
    vx: 200,
    vy: 310,
    aimAngle: 0.35,
    bowDrawn: false,
    drawPower: 0,
    swordSwingStarted: 980,
    swordSwingUntil: 1160,
    swordSwingAttack: 'slash',
}, 1 / 60);

sandbox.Stickman.drawRagdoll(noopCtx, {
    head: { x: 0, y: 0, radius: 5 },
    chest: { x: 0, y: 10, radius: 5 },
    pelvis: { x: 0, y: 20, radius: 5 },
    lUpperArm: { x: -4, y: 12, radius: 3 },
    lLowerArm: { x: -8, y: 15, radius: 3 },
    rUpperArm: { x: 4, y: 12, radius: 3 },
    rLowerArm: { x: 8, y: 15, radius: 3 },
    lUpperLeg: { x: -3, y: 24, radius: 3 },
    lLowerLeg: { x: -3, y: 30, radius: 3 },
    rUpperLeg: { x: 3, y: 24, radius: 3 },
    rLowerLeg: { x: 3, y: 30, radius: 3 },
}, '#e74c3c');

const twistingUp = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: -1.05,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
const twistingDown = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 1.05,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
for (let i = 0; i < 20; i++) {
    sandbox.Stickman.update(twistingUp, 1 / 60);
    sandbox.Stickman.update(twistingDown, 1 / 60);
}
const torsoUp = captureTorsoSegment(twistingUp);
const torsoDown = captureTorsoSegment(twistingDown);
const twistDxUp = torsoUp.x1 - torsoUp.x2;
const twistDxDown = torsoDown.x1 - torsoDown.x2;
assert.ok(Math.sign(twistDxUp) !== Math.sign(twistDxDown), 'Torso twist should change direction with aim angle');

const breathingPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
let minShoulderY = Infinity;
let maxShoulderY = -Infinity;
for (let i = 0; i < 120; i++) {
    sandbox.Stickman.update(breathingPlayer, 1 / 60);
    const torso = captureTorsoSegment(breathingPlayer);
    minShoulderY = Math.min(minShoulderY, torso.y1);
    maxShoulderY = Math.max(maxShoulderY, torso.y1);
}
assert.ok((maxShoulderY - minShoulderY) > 0.2, 'Idle torso breathing should shift shoulder height over time');

const impactPlayer = {
    onGround: true,
    vx: 140,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 10; i++) {
    sandbox.Stickman.update(impactPlayer, 1 / 60);
}
const torsoBeforeImpact = captureTorsoSegment(impactPlayer);
impactPlayer.health = 70;
sandbox.Stickman.update(impactPlayer, 1 / 60);
const torsoAfterImpact = captureTorsoSegment(impactPlayer);
assert.ok(
    torsoAfterImpact.x1 < torsoBeforeImpact.x1 - 0.35,
    'Damage should push torso shoulder backward as impact response'
);

const leftAimUp = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: -1.0,
    bowDrawn: true,
    drawPower: 85,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
const leftAimDown = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 1.0,
    bowDrawn: true,
    drawPower: 85,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
for (let i = 0; i < 24; i++) {
    sandbox.Stickman.update(leftAimUp, 1 / 60);
    sandbox.Stickman.update(leftAimDown, 1 / 60);
}
const upSegments = captureSegments(leftAimUp);
const downSegments = captureSegments(leftAimDown);
assert.ok(upSegments.length >= 5 && downSegments.length >= 5, 'Expected arm segments to be present');
const leftUpperUp = upSegments[3];
const leftUpperDown = downSegments[3];
assert.ok(
    leftUpperUp.y2 < leftUpperDown.y2 - 4,
    'Left arm should track aim direction for bow support'
);

const leftShieldDown = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    shieldBlocking: true,
    shieldBlockAngle: 0.9,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: false, longsword: true, shield: true },
};
const leftShieldUp = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    shieldBlocking: true,
    shieldBlockAngle: -0.9,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: false, longsword: true, shield: true },
};
for (let i = 0; i < 24; i++) {
    sandbox.Stickman.update(leftShieldDown, 1 / 60);
    sandbox.Stickman.update(leftShieldUp, 1 / 60);
}
const shieldDownArm = captureSegments(leftShieldDown)[3];
const shieldUpArm = captureSegments(leftShieldUp)[3];
assert.ok(
    shieldDownArm.y2 > shieldUpArm.y2 + 6,
    'Left arm should follow shield block angle while handling shield'
);

const armorFreshPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    shieldBlocking: true,
    shieldBlockAngle: -0.2,
    armorBreakStage: 0,
    armorBreakRatio: 0,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: false, longsword: true, shield: true },
};
const armorBrokenPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    shieldBlocking: true,
    shieldBlockAngle: -0.2,
    armorBreakStage: 3,
    armorBreakRatio: 1,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: false, longsword: true, shield: true },
};
for (let i = 0; i < 30; i++) {
    sandbox.Stickman.update(armorFreshPlayer, 1 / 60);
    sandbox.Stickman.update(armorBrokenPlayer, 1 / 60);
}
const armorFreshSegs = captureSegments(armorFreshPlayer);
const armorBrokenSegs = captureSegments(armorBrokenPlayer);
const armorFreshTorso = armorFreshSegs[0];
const armorBrokenTorso = armorBrokenSegs[0];
const armorFreshArm = armorFreshSegs[3];
const armorBrokenArm = armorBrokenSegs[3];
assert.ok(
    armorBrokenTorso.y1 > armorFreshTorso.y1 + 1.5,
    'Armor break should hunch posture downward'
);
assert.ok(
    armorBrokenArm.y2 > armorFreshArm.y2 + 1.5,
    'Armor break should lower shield-side arm guard'
);

const leftReactPlayer = {
    onGround: true,
    vx: 80,
    vy: 0,
    aimAngle: 0,
    bowDrawn: true,
    drawPower: 78,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
for (let i = 0; i < 16; i++) {
    sandbox.Stickman.update(leftReactPlayer, 1 / 60);
}
const beforeReact = captureSegments(leftReactPlayer);
const beforeUpper = beforeReact[3];
const beforeLower = beforeReact[4];
const beforeReach = Math.hypot(beforeLower.x2 - beforeUpper.x1, beforeLower.y2 - beforeUpper.y1);
leftReactPlayer.health = 68;
sandbox.Stickman.update(leftReactPlayer, 1 / 60);
const afterReact = captureSegments(leftReactPlayer);
const afterUpper = afterReact[3];
const afterLower = afterReact[4];
const afterReach = Math.hypot(afterLower.x2 - afterUpper.x1, afterLower.y2 - afterUpper.y1);
assert.ok(
    afterReach < beforeReach - 1,
    'Left arm should pull in after hit reaction'
);

const rightGaitPlayer = {
    onGround: true,
    vx: 260,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
let minRightFootY = Infinity;
let maxRightFootY = -Infinity;
for (let i = 0; i < 60; i++) {
    sandbox.Stickman.update(rightGaitPlayer, 1 / 60);
    const rightLeg = captureRightLeg(rightGaitPlayer);
    minRightFootY = Math.min(minRightFootY, rightLeg.lower.y2);
    maxRightFootY = Math.max(maxRightFootY, rightLeg.lower.y2);
}
assert.ok(
    (maxRightFootY - minRightFootY) > 3.2,
    'Right leg gait should show noticeable foot lift cycle while moving'
);

const rightJumpPlayer = {
    onGround: true,
    vx: 220,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 8; i++) {
    sandbox.Stickman.update(rightJumpPlayer, 1 / 60);
}
const rightBeforeTakeoff = captureRightLeg(rightJumpPlayer);
rightJumpPlayer.onGround = false;
rightJumpPlayer.vy = -460;
sandbox.Stickman.update(rightJumpPlayer, 1 / 60);
const rightAfterTakeoff = captureRightLeg(rightJumpPlayer);
assert.ok(
    rightAfterTakeoff.lower.y2 < rightBeforeTakeoff.lower.y2 - 1.2,
    'Right leg should extend/lift during jump takeoff'
);

rightJumpPlayer.onGround = false;
rightJumpPlayer.vy = 520;
sandbox.Stickman.update(rightJumpPlayer, 1 / 60);
const rightAirborne = captureRightLeg(rightJumpPlayer);
rightJumpPlayer.onGround = true;
rightJumpPlayer.vy = 0;
sandbox.Stickman.update(rightJumpPlayer, 1 / 60);
const rightAfterLanding = captureRightLeg(rightJumpPlayer);
assert.ok(
    rightAfterLanding.upper.y2 > rightAirborne.upper.y2 + 1.6,
    'Right knee should compress on landing impact'
);

const crouchPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    crouching: false,
    sliding: false,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 24; i++) {
    sandbox.Stickman.update(crouchPlayer, 1 / 60);
}
const torsoStanding = captureTorsoSegment(crouchPlayer);
crouchPlayer.crouching = true;
for (let i = 0; i < 24; i++) {
    sandbox.Stickman.update(crouchPlayer, 1 / 60);
}
const torsoCrouched = captureTorsoSegment(crouchPlayer);
assert.ok(
    torsoCrouched.y1 > torsoStanding.y1 + 2.5,
    'Crouch should lower stickman torso pose'
);

const slidePlayer = {
    onGround: true,
    vx: 420,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    crouching: true,
    sliding: false,
    slideDir: 1,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 12; i++) {
    sandbox.Stickman.update(slidePlayer, 1 / 60);
}
const rightBeforeSlide = captureRightLeg(slidePlayer);
slidePlayer.sliding = true;
for (let i = 0; i < 14; i++) {
    sandbox.Stickman.update(slidePlayer, 1 / 60);
}
const rightDuringSlide = captureRightLeg(slidePlayer);
const slideShift = Math.hypot(
    rightDuringSlide.lower.x2 - rightBeforeSlide.lower.x2,
    rightDuringSlide.lower.y2 - rightBeforeSlide.lower.y2
);
assert.ok(
    slideShift > 2.5,
    'Slide should produce a distinct right-leg transition pose'
);

const rightStaggerPlayer = {
    onGround: true,
    vx: 180,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 10; i++) {
    sandbox.Stickman.update(rightStaggerPlayer, 1 / 60);
}
const rightBeforeStagger = captureRightLeg(rightStaggerPlayer);
rightStaggerPlayer.arrowHitReact = {
    until: 1120,
    durationMs: 240,
    intensity: 1,
    dir: -1,
    knockback: 0.9,
    pose: 'body',
};
sandbox.Stickman.update(rightStaggerPlayer, 1 / 60);
const rightAfterStagger = captureRightLeg(rightStaggerPlayer);
assert.ok(
    rightAfterStagger.lower.x2 < rightBeforeStagger.lower.x2 - 1,
    'Right leg should shift into a stagger pose during arrow hit reaction'
);

const rightHeadImpactPlayer = {
    onGround: true,
    vx: 120,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 10; i++) {
    sandbox.Stickman.update(rightHeadImpactPlayer, 1 / 60);
}
const rightBeforeHeadImpact = captureRightLeg(rightHeadImpactPlayer);
rightHeadImpactPlayer.arrowHitReact = {
    until: 1140,
    durationMs: 220,
    intensity: 1.1,
    dir: -1,
    knockback: 1.0,
    pose: 'head',
};
sandbox.Stickman.update(rightHeadImpactPlayer, 1 / 60);
const rightAfterHeadImpact = captureRightLeg(rightHeadImpactPlayer);
assert.ok(
    rightAfterHeadImpact.lower.y2 < rightBeforeHeadImpact.lower.y2 - 0.4,
    'Right leg should move into a head-impact pose during arrow hit reactions'
);

const directionalFrontPlayer = {
    onGround: true,
    vx: 120,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    facingDir: 1,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
const directionalBackPlayer = {
    onGround: true,
    vx: 120,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    facingDir: 1,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 10; i++) {
    sandbox.Stickman.update(directionalFrontPlayer, 1 / 60);
    sandbox.Stickman.update(directionalBackPlayer, 1 / 60);
}
directionalFrontPlayer.arrowHitReact = {
    until: 1160,
    durationMs: 220,
    staggerUntil: 1080,
    staggerMs: 120,
    intensity: 1.0,
    dir: -1,
    knockback: 0.8,
    pose: 'body',
    state: 'stagger',
    hitRegion: 'body',
    hitSide: 'front',
};
directionalBackPlayer.arrowHitReact = {
    until: 1160,
    durationMs: 220,
    staggerUntil: 1080,
    staggerMs: 120,
    intensity: 1.0,
    dir: 1,
    knockback: 0.8,
    pose: 'body',
    state: 'stagger',
    hitRegion: 'body',
    hitSide: 'back',
};
sandbox.Stickman.update(directionalFrontPlayer, 1 / 60);
sandbox.Stickman.update(directionalBackPlayer, 1 / 60);
const frontDirectionalLeg = captureRightLeg(directionalFrontPlayer);
const backDirectionalLeg = captureRightLeg(directionalBackPlayer);
assert.ok(
    frontDirectionalLeg.lower.x2 < backDirectionalLeg.lower.x2 - 1.2,
    'Front and back hits should create distinct directional leg reactions'
);

const mountedAimPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: true,
    drawPower: 60,
    mountedHorseId: null,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
const mountedAimHorsePlayer = {
    ...mountedAimPlayer,
    mountedHorseId: 'horse-red-1',
};
for (let i = 0; i < 30; i++) {
    sandbox.Stickman.update(mountedAimPlayer, 1 / 60);
    sandbox.Stickman.update(mountedAimHorsePlayer, 1 / 60);
}
const mountedAimGroundSeg = captureSegments(mountedAimPlayer);
const mountedAimHorseSeg = captureSegments(mountedAimHorsePlayer);
const mountedAimGroundDeltaY = mountedAimGroundSeg[1].y2 - mountedAimGroundSeg[1].y1;
const mountedAimHorseDeltaY = mountedAimHorseSeg[1].y2 - mountedAimHorseSeg[1].y1;
assert.ok(
    mountedAimHorseDeltaY < mountedAimGroundDeltaY - 0.8,
    'Mounted aiming should raise lead-arm angle with horseback offset'
);

const mountedAttackGround = {
    onGround: true,
    vx: 40,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    mountedHorseId: null,
    swordPhase: 'active',
    swordAttack: 'slash',
    swordPhaseTimer: 0.04,
    swordPhaseDuration: 0.1,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: false, longsword: true, shield: false },
};
const mountedAttackHorse = {
    ...mountedAttackGround,
    mountedHorseId: 'horse-blue-2',
};
for (let i = 0; i < 24; i++) {
    sandbox.Stickman.update(mountedAttackGround, 1 / 60);
    sandbox.Stickman.update(mountedAttackHorse, 1 / 60);
}
const mountedAttackGroundLead = captureSegments(mountedAttackGround)[2];
const mountedAttackGroundUpper = captureSegments(mountedAttackGround)[1];
const mountedAttackHorseLead = captureSegments(mountedAttackHorse)[2];
const mountedAttackHorseUpper = captureSegments(mountedAttackHorse)[1];
const mountedAttackGroundSweep = mountedAttackGroundLead.y2 - mountedAttackGroundUpper.y1;
const mountedAttackHorseSweep = mountedAttackHorseLead.y2 - mountedAttackHorseUpper.y1;
const mountedAttackPoseDelta = Math.hypot(
    mountedAttackHorseLead.x2 - mountedAttackGroundLead.x2,
    mountedAttackHorseLead.y2 - mountedAttackGroundLead.y2
);
assert.ok(
    mountedAttackPoseDelta > 1.1 && Math.abs(mountedAttackHorseSweep - mountedAttackGroundSweep) > 0.45,
    'Mounted melee attacks should sweep through a wider horseback arc'
);

const dismountReactPlayer = {
    onGround: true,
    vx: 90,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    facingDir: 1,
    mountedHorseId: 'horse-red-3',
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 20; i++) {
    sandbox.Stickman.update(dismountReactPlayer, 1 / 60);
}
const dismountBefore = captureRightLeg(dismountReactPlayer);
dismountReactPlayer.mountedHorseId = null;
dismountReactPlayer.health = 78;
sandbox.Stickman.update(dismountReactPlayer, 1 / 60);
const dismountAfter = captureRightLeg(dismountReactPlayer);
assert.ok(
    dismountAfter.lower.x2 < dismountBefore.lower.x2 - 1.0,
    'Dismount after impact should trigger a backward right-leg hit reaction'
);

const wallSlidePlayer = {
    onGround: false,
    onWall: true,
    wallSide: 1,
    vx: 0,
    vy: 190,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
const freeFallPlayer = {
    onGround: false,
    onWall: false,
    wallSide: 0,
    vx: 0,
    vy: 190,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 18; i++) {
    sandbox.Stickman.update(wallSlidePlayer, 1 / 60);
    sandbox.Stickman.update(freeFallPlayer, 1 / 60);
}
const wallSlideLeg = captureRightLeg(wallSlidePlayer);
const freeFallLeg = captureRightLeg(freeFallPlayer);
const wallSlideDelta = Math.hypot(
    wallSlideLeg.lower.x2 - freeFallLeg.lower.x2,
    wallSlideLeg.lower.y2 - freeFallLeg.lower.y2
);
assert.ok(
    wallSlideDelta > 1.2,
    'Wall-slide state should produce a distinct right-leg pose from freefall'
);

const ledgePlayer = {
    onGround: false,
    onWall: false,
    ledgeGrabbed: true,
    ledgeSide: 1,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 20; i++) {
    sandbox.Stickman.update(ledgePlayer, 1 / 60);
}
const ledgeSeg = captureSegments(ledgePlayer);
assert.ok(ledgeSeg.length >= 5, 'Expected arm segments while ledge grabbing');
const rightArmUpper = ledgeSeg[1];
const leftArmUpper = ledgeSeg[3];
assert.ok(
    rightArmUpper.y2 < -2 && leftArmUpper.y2 < -2,
    'Ledge-grab state should raise both arms into a hanging grip pose'
);

const ladderNeutralPlayer = {
    onGround: true,
    onWall: false,
    ledgeGrabbed: false,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
const ladderInteractPlayer = {
    ...ladderNeutralPlayer,
    interactionHint: 'ladder',
    interactionHintUntil: 999999,
};
for (let i = 0; i < 24; i++) {
    sandbox.Stickman.update(ladderNeutralPlayer, 1 / 60);
    sandbox.Stickman.update(ladderInteractPlayer, 1 / 60);
}
const ladderNeutralSeg = captureSegments(ladderNeutralPlayer);
const ladderInteractSeg = captureSegments(ladderInteractPlayer);
assert.ok(
    ladderInteractSeg[1].y2 < ladderNeutralSeg[1].y2 - 2.5,
    'Ladder interaction should raise lead arm into climb posture'
);
assert.ok(
    ladderInteractSeg[8].y2 < ladderNeutralSeg[8].y2 - 1.0,
    'Ladder interaction should lift right foot into climb step'
);

const gateNeutralPlayer = {
    onGround: true,
    vx: 40,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
const gateInteractPlayer = {
    ...gateNeutralPlayer,
    interactionHint: 'gate',
    interactionHintUntil: 999999,
};
for (let i = 0; i < 24; i++) {
    sandbox.Stickman.update(gateNeutralPlayer, 1 / 60);
    sandbox.Stickman.update(gateInteractPlayer, 1 / 60);
}
const gateNeutralSeg = captureSegments(gateNeutralPlayer);
const gateInteractSeg = captureSegments(gateInteractPlayer);
const gateLeadDelta = Math.hypot(
    gateInteractSeg[2].x2 - gateNeutralSeg[2].x2,
    gateInteractSeg[2].y2 - gateNeutralSeg[2].y2
);
assert.ok(
    gateLeadDelta > 1.5,
    'Gate interaction should shift lead hand into a distinct push posture'
);
assert.ok(
    gateInteractSeg[8].x2 > gateNeutralSeg[8].x2 + 1.0,
    'Gate interaction should widen right-foot brace stance'
);

const ballistaNeutralPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
const ballistaInteractPlayer = {
    ...ballistaNeutralPlayer,
    usingBallistaSide: 'RED',
};
for (let i = 0; i < 24; i++) {
    sandbox.Stickman.update(ballistaNeutralPlayer, 1 / 60);
    sandbox.Stickman.update(ballistaInteractPlayer, 1 / 60);
}
const ballistaNeutralSeg = captureSegments(ballistaNeutralPlayer);
const ballistaInteractSeg = captureSegments(ballistaInteractPlayer);
const ballistaOffArmDelta = Math.hypot(
    ballistaInteractSeg[3].x2 - ballistaNeutralSeg[3].x2,
    ballistaInteractSeg[3].y2 - ballistaNeutralSeg[3].y2
);
assert.ok(
    ballistaOffArmDelta > 1.8,
    'Ballista interaction should pull off-arm into a distinct crank-ready pose'
);
assert.ok(
    ballistaInteractSeg[8].x2 > ballistaNeutralSeg[8].x2 + 1.0,
    'Ballista interaction should plant right foot for heavy recoil control'
);

const interruptTransitionPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    usingBallistaSide: 'BLUE',
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
const interruptNeutralPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
for (let i = 0; i < 26; i++) {
    sandbox.Stickman.update(interruptTransitionPlayer, 1 / 60);
    sandbox.Stickman.update(interruptNeutralPlayer, 1 / 60);
}
const interruptBefore = captureSegments(interruptTransitionPlayer)[2];
const interruptNeutral = captureSegments(interruptNeutralPlayer)[2];
const interruptDistance = (a, b) => Math.hypot(a.x2 - b.x2, a.y2 - b.y2);
const beforeDelta = interruptDistance(interruptBefore, interruptNeutral);

interruptTransitionPlayer.usingBallistaSide = null;
interruptTransitionPlayer.interactionInterrupted = true;
interruptTransitionPlayer.swordPhase = 'active';
interruptTransitionPlayer.swordPhaseTimer = 0.04;
interruptTransitionPlayer.swordPhaseDuration = 0.1;
interruptTransitionPlayer.loadout = { arrows: false, longsword: true, shield: false };
sandbox.Stickman.update(interruptTransitionPlayer, 1 / 60);
const interruptAfterOne = captureSegments(interruptTransitionPlayer)[2];
const afterOneDelta = interruptDistance(interruptAfterOne, interruptNeutral);
const afterOneBlend = Number(interruptTransitionPlayer._stickmanAnim && interruptTransitionPlayer._stickmanAnim.interactionBallista || 0);
for (let i = 0; i < 28; i++) {
    sandbox.Stickman.update(interruptTransitionPlayer, 1 / 60);
}
const interruptAfterSettle = captureSegments(interruptTransitionPlayer)[2];
const afterSettleDelta = interruptDistance(interruptAfterSettle, interruptNeutral);
const afterSettleBlend = Number(interruptTransitionPlayer._stickmanAnim && interruptTransitionPlayer._stickmanAnim.interactionBallista || 0);
assert.ok(beforeDelta > 1.6, 'Expected visible ballista interaction offset before interruption');
assert.ok(
    afterOneDelta > beforeDelta * 0.42,
    'Interaction interrupt should blend out over time instead of snapping in one frame'
);
assert.ok(
    afterSettleBlend < afterOneBlend,
    'Interrupted interaction should continue settling toward combat pose'
);

assert.strictEqual(typeof sandbox.Stickman.consumeAudioHooks, 'function', 'Stickman should expose audio hook consumer');

const footstepPlayer = {
    onGround: true,
    vx: 240,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 100,
    maxHealth: 100,
    loadout: {},
};
for (let i = 0; i < 80; i++) {
    sandbox.Stickman.update(footstepPlayer, 1 / 60);
}
const footstepHooks = sandbox.Stickman.consumeAudioHooks(footstepPlayer);
const footsteps = footstepHooks.filter((hook) => hook.type === 'footstep');
assert.ok(footsteps.length >= 2, 'Ground locomotion should emit multiple footstep hooks');
assert.ok(footsteps.some((hook) => hook.foot === 'left'), 'Footstep hooks should include left foot contacts');
assert.ok(footsteps.some((hook) => hook.foot === 'right'), 'Footstep hooks should include right foot contacts');

const bowReleasePlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0.25,
    bowDrawn: true,
    drawPower: 74,
    bowReleasePower: 0.9,
    bowReleaseAngle: 0.25,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: true },
};
sandbox.Stickman.update(bowReleasePlayer, 1 / 60);
bowReleasePlayer.bowDrawn = false;
bowReleasePlayer.drawPower = 0;
sandbox.Stickman.update(bowReleasePlayer, 1 / 60);
const bowHooks = sandbox.Stickman.consumeAudioHooks(bowReleasePlayer);
assert.ok(
    bowHooks.some((hook) => hook.type === 'bow_release'),
    'Releasing a drawn bow should emit bow release hook'
);

const bladePlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    swordPhase: 'active',
    swordAttack: 'slash',
    swordPhaseTimer: 0.16,
    swordPhaseDuration: 0.2,
    health: 100,
    maxHealth: 100,
    loadout: { arrows: false, longsword: true },
};
sandbox.Stickman.update(bladePlayer, 1 / 60);
bladePlayer.swordPhaseTimer = 0.1;
sandbox.Stickman.update(bladePlayer, 1 / 60);
const bladeHooks = sandbox.Stickman.consumeAudioHooks(bladePlayer);
assert.ok(
    bladeHooks.some((hook) => hook.type === 'blade_impact'),
    'Active sword phase crossing key moment should emit blade impact hook'
);

const bodyHitPlayer = {
    onGround: true,
    vx: 0,
    vy: 0,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    health: 80,
    maxHealth: 100,
    loadout: {},
    arrowHitReact: {
        until: 1250,
        durationMs: 220,
        staggerUntil: 1180,
        staggerMs: 140,
        intensity: 0.8,
        dir: -1,
        knockback: 0.6,
        pose: 'body',
        state: 'stagger',
        hitRegion: 'body',
        hitSide: 'front',
        source: 'arrow',
    },
};
sandbox.Stickman.update(bodyHitPlayer, 1 / 60);
const bodyHooks = sandbox.Stickman.consumeAudioHooks(bodyHitPlayer);
assert.ok(
    bodyHooks.some((hook) => hook.type === 'body_hit'),
    'New hit reaction should emit body hit hook'
);

console.log('stickman module tests passed');

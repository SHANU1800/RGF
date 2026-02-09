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

let now = 1000;
const sandbox = {
    window: {},
    CONFIG: {
        GAME_WIDTH: 6000,
        GROUND_Y: 700,
        PLAYER_WIDTH: 40,
        PLAYER_HEIGHT: 80,
        MOVE_ACCEL: 2400,
        MOVE_DECEL: 3200,
        AIR_CONTROL: 0.55,
        MOVE_SPEED: 380,
        COYOTE_TIME_MS: 120,
        JUMP_BUFFER_MS: 120,
        JUMP_FORCE: -900,
        GRAVITY: 2800,
        MAX_FALL_SPEED: 1400,
        ARROW_GRAVITY: 1200,
        FLOORS: [
            { y: 700, x1: 0, x2: 6000 },
            { y: 520, height: 22, x1: 140, x2: 1460 },
        ],
    },
    performance: {
        now: () => now,
    },
    Math,
    Number,
    Date,
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(
    `${fs.readFileSync(resolveScript('RGF/js/player.js', 'frontend/js/player.js', 'js/player.js'), 'utf8')}\nthis.__PlayerRef = Player;\nthis.__ArrowRef = Arrow;`,
    sandbox
);

const PlayerRef = sandbox.__PlayerRef;
const ArrowRef = sandbox.__ArrowRef;
assert.ok(PlayerRef, 'Player should be defined');
assert.ok(ArrowRef, 'Arrow should be defined');

const player = new PlayerRef(1, 'Archer', 'RED', true);
player.onGround = true;
player.update({
    left: false,
    right: false,
    jumpPressed: false,
    aimAngle: 0.3,
    bowDrawn: true,
    drawPower: 80,
}, 0.016);

now += 16;
player.update({
    left: false,
    right: false,
    jumpPressed: false,
    aimAngle: 0.3,
    bowDrawn: false,
    drawPower: 0,
}, 0.016);

assert.ok(player.bowReleaseUntil > now, 'Bow release should activate after draw release');
assert.ok(player.bowReleasePower > 0.7, 'Release power should track draw charge');

const midTime = now + player.bowReleaseDurationMs / 2;
const ratio = player.bowReleaseRatio(midTime);
assert.ok(ratio > 0 && ratio < 1, 'Release ratio should decay over release duration');

const ragdollPlayer = new PlayerRef(2, 'Knight', 'BLUE', false);
ragdollPlayer.alive = false;
ragdollPlayer.applyRagdollImpact({
    dir: -1,
    intensity: 1.1,
    source: 'ballista',
    vx: -940,
    vy: -120,
});
assert.ok(ragdollPlayer.ragdollQueuedImpact, 'Impact should queue before ragdoll spawn');

ragdollPlayer.spawnRagdoll();
assert.ok(Array.isArray(ragdollPlayer.ragdollParts), 'Spawn should initialize ragdoll parts');
assert.ok(Array.isArray(ragdollPlayer.ragdollLinks), 'Spawn should initialize ragdoll links');
assert.ok(ragdollPlayer.ragdollLinks.length >= 15, 'Ragdoll should include stabilization links');
assert.strictEqual(ragdollPlayer.ragdollQueuedImpact, null, 'Queued impact should be consumed on spawn');
assert.ok(ragdollPlayer.ragdollState, 'Ragdoll state should initialize');

const firstPartBefore = {
    prevX: ragdollPlayer.ragdollParts[0].prevX,
    prevY: ragdollPlayer.ragdollParts[0].prevY,
};
ragdollPlayer.applyRagdollImpact({
    dir: 1,
    intensity: 1.2,
    source: 'sword',
    vx: 480,
    vy: -40,
    hitY: ragdollPlayer.y + ragdollPlayer.height * 0.45,
});
const firstPartAfter = ragdollPlayer.ragdollParts[0];
assert.ok(
    Math.abs(firstPartAfter.prevX - firstPartBefore.prevX) > 0.1 || Math.abs(firstPartAfter.prevY - firstPartBefore.prevY) > 0.1,
    'Applying ragdoll impact should change verlet history'
);

ragdollPlayer.updateRagdoll(1 / 60);
const hasNaN = ragdollPlayer.ragdollParts.some((part) => !Number.isFinite(part.x) || !Number.isFinite(part.y));
assert.strictEqual(hasNaN, false, 'Ragdoll update should keep finite part positions');

const climber = new PlayerRef(3, 'Climber', 'RED', true);
climber.onGround = false;
climber.onWall = true;
climber.wallSide = 1;
climber.jumpBufferMs = sandbox.CONFIG.JUMP_BUFFER_MS;
climber.update({
    left: false,
    right: true,
    jumpPressed: true,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
}, 1 / 60);
assert.ok(climber.vx < 0, 'Wall jump should push player away from wall');
assert.ok(climber.vy < 0, 'Wall jump should apply upward impulse');
assert.strictEqual(climber.onWall, false, 'Wall jump should detach from wall');

const ledgeGrabber = new PlayerRef(4, 'Grabber', 'RED', true);
ledgeGrabber.x = 100;
ledgeGrabber.y = 495;
ledgeGrabber.vx = 120;
ledgeGrabber.vy = 260;
ledgeGrabber.onGround = false;
ledgeGrabber.wallJumpLock = 0.25;
ledgeGrabber.update({
    left: false,
    right: true,
    jumpPressed: false,
    aimAngle: 0,
    bowDrawn: false,
    drawPower: 0,
    crouch: false,
}, 1 / 60);
assert.strictEqual(ledgeGrabber.ledgeGrabbed, true, 'Falling near an edge should trigger ledge grab state');
assert.strictEqual(ledgeGrabber.onGround, false, 'Ledge grab should keep player airborne');

const tunnelTarget = { alive: true, x: 100, y: 200, width: 40, height: 80 };
const fastArrow = new ArrowRef(40, 240, 0, 1200, 'RED');
fastArrow.update(0.1);
assert.strictEqual(fastArrow.checkCollision(tunnelTarget), true, 'Fast arrows should collide through swept segment, not just endpoint');

const insideArrow = new ArrowRef(120, 240, 0, 0, 'RED');
assert.strictEqual(insideArrow.checkCollision(tunnelTarget), true, 'Arrow already inside target bounds should collide');

console.log('player bow release tests passed');

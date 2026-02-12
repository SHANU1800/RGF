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

let clockMs = 1000;
const sandbox = {
    window: {},
    Math,
    Number,
    Date,
    performance: {
        now: () => clockMs,
    },
    CONFIG: {
        FLOORS: [
            { y: 700, x1: 0, x2: 6000 },
            { y: 520, x1: 140, x2: 1460 },
            { y: 380, x1: 360, x2: 1240 },
        ],
    },
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(
    fs.readFileSync(resolveScript('RGF/js/stickman_ai.js', 'frontend/js/stickman_ai.js', 'js/stickman_ai.js'), 'utf8'),
    sandbox
);

assert.ok(sandbox.StickmanAI, 'StickmanAI should be defined');
assert.strictEqual(typeof sandbox.StickmanAI.decideInput, 'function', 'decideInput should exist');

function makePlayer(overrides = {}) {
    return {
        id: 'self',
        team: 'RED',
        x: 200,
        y: 620,
        width: 40,
        height: 80,
        onGround: true,
        alive: true,
        health: 100,
        stamina: 100,
        aimAngle: 0,
        loadout: { arrows: true, longsword: false, shield: false },
        ...overrides,
    };
}

function decide(selfPlayer, players, extra = {}) {
    return sandbox.StickmanAI.decideInput(selfPlayer, players, {
        now: clockMs,
        dt: 1 / 60,
        config: sandbox.CONFIG,
        arrows: [],
        ...extra,
    });
}

const selfArcher = makePlayer({ id: 'archer-target-self' });
const closeEnemy = makePlayer({
    id: 'enemy-close',
    team: 'BLUE',
    x: 560,
    loadout: { arrows: false, longsword: false, shield: false },
});
const farEnemy = makePlayer({
    id: 'enemy-far',
    team: 'BLUE',
    x: 900,
    loadout: { arrows: false, longsword: true, shield: true },
});
let input = decide(selfArcher, [selfArcher, closeEnemy, farEnemy]);
assert.ok(input.aimAngle > -0.4 && input.aimAngle < 0.4, 'AI should target nearest enemy lane first');

const selfArcherDraw = makePlayer({ id: 'archer-draw-self' });
clockMs += 1;
input = decide(selfArcherDraw, [selfArcherDraw, closeEnemy], { arrows: [] });
assert.strictEqual(input.bowDrawn, true, 'Archer should start drawing bow in range');
assert.strictEqual(input.shoot, false, 'Archer should not instantly fire before draw delay');
clockMs += 900;
input = decide(selfArcherDraw, [selfArcherDraw, closeEnemy], { arrows: [] });
assert.strictEqual(input.shoot, true, 'Archer should release shot after holding draw');
assert.ok(input.shootPower > 20, 'Released shot should have useful power');

const selfSword = makePlayer({
    id: 'sword-self',
    x: 500,
    loadout: { arrows: false, longsword: true, shield: true },
});
const swordEnemy = makePlayer({
    id: 'sword-enemy',
    team: 'BLUE',
    x: 700,
    loadout: { arrows: true, longsword: false, shield: false },
});
clockMs += 10;
input = decide(selfSword, [selfSword, swordEnemy], {
    arrows: [{ id: 'a1', x: 640, y: 650, vx: -760, vy: 0, team: 'BLUE' }],
});
assert.strictEqual(input.shieldBlock, true, 'Sword AI should raise shield against incoming arrows');
assert.strictEqual(input.right, true, 'AI should dodge away from incoming horizontal arrow');
assert.strictEqual(input.jumpPressed, true, 'AI should jump when fast horizontal arrow threatens center mass');
assert.ok(Math.abs(input.shieldBlockAngle) < 0.15, 'Shield block angle should face incoming projectile direction');

const stuckSelf = makePlayer({
    id: 'stuck-self',
    x: 120,
    loadout: { arrows: false, longsword: true, shield: true },
});
const stuckEnemy = makePlayer({
    id: 'stuck-enemy',
    team: 'BLUE',
    x: 700,
    loadout: { arrows: false, longsword: false, shield: false },
});
let sawUnstuck = false;
for (let i = 0; i < 6; i++) {
    clockMs += 220;
    input = decide(stuckSelf, [stuckSelf, stuckEnemy], { dt: 0.22 });
    if (input.left && input.jumpPressed && input.sprint) {
        sawUnstuck = true;
        break;
    }
}
assert.strictEqual(sawUnstuck, true, 'AI should trigger anti-stuck recovery when movement intent does not progress');

const meleeSelf = makePlayer({
    id: 'melee-self',
    x: 360,
    y: 620,
    loadout: { arrows: false, longsword: true, shield: true },
});
const elevatedEnemy = makePlayer({
    id: 'melee-enemy',
    team: 'BLUE',
    x: 430,
    y: 540,
    loadout: { arrows: false, longsword: false, shield: false },
});
clockMs += 50;
input = decide(meleeSelf, [meleeSelf, elevatedEnemy], { arrows: [] });
assert.strictEqual(input.swordAttack, 'upper_slash', 'Sword AI should pick upper slash when target is above');

const exhaustedSword = makePlayer({
    id: 'exhausted-sword',
    x: 360,
    y: 620,
    stamina: 8,
    loadout: { arrows: false, longsword: true, shield: true },
});
clockMs += 50;
input = decide(exhaustedSword, [exhaustedSword, elevatedEnemy], { arrows: [] });
assert.strictEqual(input.swordAttack, null, 'Sword AI should avoid heavy attack when stamina is too low');

const predictiveSelf = makePlayer({
    id: 'predictive-self',
    x: 200,
    y: 620,
    loadout: { arrows: true, longsword: false, shield: false },
});
const movingEnemy = makePlayer({
    id: 'predictive-enemy',
    team: 'BLUE',
    x: 610,
    y: 620,
    loadout: { arrows: false, longsword: false, shield: false },
});
clockMs += 10;
input = decide(predictiveSelf, [predictiveSelf, movingEnemy], { arrows: [] });
assert.strictEqual(input.bowDrawn, true, 'Predictive case should begin drawing');
clockMs += 140;
movingEnemy.x = 670;
movingEnemy.y = 570;
input = decide(predictiveSelf, [predictiveSelf, movingEnemy], { arrows: [] });
clockMs += 920;
movingEnemy.x = 720;
movingEnemy.y = 520;
input = decide(predictiveSelf, [predictiveSelf, movingEnemy], { arrows: [] });
assert.strictEqual(input.shoot, true, 'Predictive case should release shot');
const selfCenterY = predictiveSelf.y + predictiveSelf.height / 2;
const enemyCenterY = movingEnemy.y + movingEnemy.height / 2;
const selfCenterX = predictiveSelf.x + predictiveSelf.width / 2;
const enemyCenterX = movingEnemy.x + movingEnemy.width / 2;
const directAimAngle = Math.atan2(enemyCenterY - selfCenterY, enemyCenterX - selfCenterX);
assert.ok(input.shootAngle < directAimAngle, 'Predictive shooting should lead upward against rising targets');

console.log('stickman AI tests passed');

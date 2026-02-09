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

const sandbox = {
    window: {},
    CONFIG: {
        CAMERA_VIEW_WIDTH: 1600,
        CAMERA_VIEW_HEIGHT: 900,
    },
    Math,
    Number,
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(
    fs.readFileSync(resolveScript('RGF/js/controller.js', 'frontend/js/controller.js', 'js/controller.js'), 'utf8'),
    sandbox
);

assert.ok(sandbox.ControllerUtils, 'ControllerUtils should be defined');

const shot = sandbox.ControllerUtils.calculateDragShot({ x: 100, y: 100 }, { x: 40, y: 70 }, 20);
assert.strictEqual(shot.canShoot, true, 'Drag over min distance should allow shooting');
assert.ok(shot.power > 0, 'Power should be positive');

const blockedShot = sandbox.ControllerUtils.calculateDragShot({ x: 100, y: 100 }, { x: 95, y: 97 }, 20);
assert.strictEqual(blockedShot.canShoot, false, 'Short drag should not shoot');

const joystick = sandbox.ControllerUtils.calculateJoystickVector(
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    80,
    0.1
);
assert.ok(joystick.normalizedX > 0, 'Joystick right movement should have +X');
assert.ok(joystick.strength > 0, 'Joystick strength should be positive');

const noAssist = sandbox.ControllerUtils.applyBowAimAssist(
    { x: 0, y: 0 },
    0,
    [{ id: 'wide', x: 200, y: 200 }],
    { assistConeRad: 0.12, maxRange: 600, maxCorrectionRad: 0.2, strength: 1 }
);
assert.strictEqual(noAssist.assisted, false, 'Target outside assist cone should not be corrected');

const limitedAssist = sandbox.ControllerUtils.applyBowAimAssist(
    { x: 0, y: 0 },
    0,
    [{ id: 'close', x: 320, y: 20 }],
    { assistConeRad: 0.3, maxRange: 700, maxCorrectionRad: 0.05, strength: 1 }
);
assert.strictEqual(limitedAssist.assisted, true, 'Target in cone should receive some assist');
assert.ok(Math.abs(limitedAssist.correctionRad) <= 0.050001, 'Assist correction must stay within max correction cap');

const rangeLimited = sandbox.ControllerUtils.applyBowAimAssist(
    { x: 0, y: 0 },
    0,
    [{ id: 'far', x: 900, y: 0 }],
    { assistConeRad: 0.3, maxRange: 700, maxCorrectionRad: 0.1, strength: 1 }
);
assert.strictEqual(rangeLimited.assisted, false, 'Targets beyond max range should not be corrected');

const bestTarget = sandbox.ControllerUtils.applyBowAimAssist(
    { x: 0, y: 0 },
    0.15,
    [
        { id: 'near-aligned', x: 260, y: 42 },
        { id: 'less-aligned', x: 200, y: 105 },
    ],
    { assistConeRad: 0.35, maxRange: 700, maxCorrectionRad: 0.12, strength: 1 }
);
assert.strictEqual(bestTarget.targetId, 'near-aligned', 'Assist should favor the best-scoring eligible target');

console.log('controller utils tests passed');

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
        CAMERA_VIEW_WIDTH: 1600,
        CAMERA_VIEW_HEIGHT: 900,
        PLAYER_WIDTH: 40,
        PLAYER_HEIGHT: 80,
    },
    performance: {
        now: () => now,
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
vm.runInContext(
    fs.readFileSync(resolveScript('RGF/js/controller_archer.js', 'frontend/js/controller_archer.js', 'js/controller_archer.js'), 'utf8'),
    sandbox
);

const ArcherController = sandbox.ArcherController;
assert.ok(ArcherController, 'ArcherController should be defined');

function createInputStub(targets) {
    return {
        activeWeapon: 'arrows',
        playerCenter: { x: 0, y: 0 },
        mouse: { x: 0, y: 0 },
        _screenToWorld: (e) => ({ x: Number(e.clientX || 0), y: Number(e.clientY || 0) }),
        getAimAssistCandidates: () => targets,
    };
}

const inputWithTarget = createInputStub([{ id: 'enemy', x: 320, y: 28 }]);
const touchController = new ArcherController(inputWithTarget);
touchController.beginDrag({ x: -220, y: 0 }, 'touch');
const rawTouchShot = sandbox.ControllerUtils.calculateDragShot(
    inputWithTarget.playerCenter,
    touchController.dragCurrent,
    0
);
const assistedTouchShot = touchController._calculateCurrentShot(0);
assert.ok(assistedTouchShot.canShoot, 'Touch drag should produce a valid shot');
assert.ok(
    Math.abs(assistedTouchShot.angle - rawTouchShot.angle) > 0.0001,
    'Touch input should receive bounded assist when a target is in cone'
);
assert.ok(
    Math.abs(assistedTouchShot.angle - rawTouchShot.angle) < 0.13,
    'Assist should remain bounded and not fully snap aim'
);

const mouseController = new ArcherController(inputWithTarget);
mouseController.beginDrag({ x: -220, y: 0 }, 'mouse');
const rawMouseShot = sandbox.ControllerUtils.calculateDragShot(
    inputWithTarget.playerCenter,
    mouseController.dragCurrent,
    0
);
const mouseShot = mouseController._calculateCurrentShot(0);
assert.ok(
    Math.abs(mouseShot.angle - rawMouseShot.angle) < 0.000001,
    'Mouse input should remain unassisted for precision'
);

const inputOutsideCone = createInputStub([{ id: 'enemy-wide', x: 120, y: 220 }]);
const outsideConeController = new ArcherController(inputOutsideCone);
outsideConeController.beginDrag({ x: -220, y: 0 }, 'touch');
const rawOutside = sandbox.ControllerUtils.calculateDragShot(
    inputOutsideCone.playerCenter,
    outsideConeController.dragCurrent,
    0
);
const outsideShot = outsideConeController._calculateCurrentShot(0);
assert.ok(
    Math.abs(outsideShot.angle - rawOutside.angle) < 0.000001,
    'Touch assist should not apply for targets outside cone'
);

console.log('archer aim assist tests passed');

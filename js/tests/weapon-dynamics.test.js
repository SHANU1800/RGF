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
    Math,
    Number,
};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInContext(
    fs.readFileSync(resolveScript('RGF/js/weapon_dynamics.js', 'frontend/js/weapon_dynamics.js', 'js/weapon_dynamics.js'), 'utf8'),
    sandbox
);

assert.ok(sandbox.WeaponDynamics, 'WeaponDynamics should be defined');
assert.strictEqual(typeof sandbox.WeaponDynamics.aggregateModifiers, 'function', 'aggregateModifiers should exist');

const archer = sandbox.WeaponDynamics.aggregateModifiers({ role_category: 'archer' });
assert.strictEqual(archer.canShootArrows, true, 'Archer role should retain arrows');
assert.ok(Math.abs(archer.drawPowerMultiplier - 1.05) < 0.001, 'Archer should gain draw power bonus');
assert.ok(Math.abs(archer.arrowSpeedMultiplier - 1.03) < 0.001, 'Archer should gain arrow speed bonus');

const longsword = sandbox.WeaponDynamics.aggregateModifiers({ role_category: 'longswordsman' });
assert.strictEqual(longsword.canShootArrows, false, 'Longswordsman should not shoot arrows');
assert.ok(Math.abs(longsword.moveSpeedMultiplier - 0.97) < 0.001, 'Longsword should slightly reduce movement speed');
assert.ok(Math.abs(longsword.outgoingDamageMultiplier - 1.08) < 0.001, 'Longsword should increase outgoing damage');

const shieldSword = sandbox.WeaponDynamics.aggregateModifiers({ role_category: 'shield+sword' });
assert.ok(Math.abs(shieldSword.moveSpeedMultiplier - 0.8924) < 0.001, 'Shield+sword should stack speed penalties');
assert.ok(Math.abs(shieldSword.incomingDamageMultiplier - 0.90) < 0.001, 'Shield should reduce incoming damage');
assert.ok(Math.abs(shieldSword.outgoingDamageMultiplier - 1.0476) < 0.001, 'Shield should slightly dampen sword damage bonus');

const miniSword = sandbox.WeaponDynamics.aggregateModifiers({ arrows: true, longsword: false, shield: false, miniSword: true });
assert.ok(miniSword.moveSpeedMultiplier > 1.0, 'Mini sword should increase mobility');
assert.ok(miniSword.drawPowerMultiplier < archer.drawPowerMultiplier, 'Mini sword should trade some draw power');

console.log('weapon dynamics tests passed');

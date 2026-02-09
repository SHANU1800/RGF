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
    fs.readFileSync(resolveScript('RGF/js/arrow-visuals.js', 'frontend/js/arrow-visuals.js', 'js/arrow-visuals.js'), 'utf8'),
    sandbox
);

const modernVisuals = sandbox.window.ArrowVisuals;
assert.ok(modernVisuals, 'Modern ArrowVisuals should be defined');

vm.runInContext(
    fs.readFileSync(resolveScript('RGF/js/arrows.js', 'frontend/js/arrows.js', 'js/arrows.js'), 'utf8'),
    sandbox
);

assert.strictEqual(
    sandbox.window.ArrowVisuals,
    modernVisuals,
    'Legacy arrows.js must not overwrite modern ArrowVisuals'
);
assert.ok(sandbox.window.LegacyArrowVisuals, 'Legacy ArrowVisuals should be exposed for fallback/debugging');
assert.strictEqual(typeof sandbox.window.LegacyArrowVisuals.drawArrow, 'function');
assert.strictEqual(typeof sandbox.window.LegacyArrowVisuals.drawNockedArrowPreview, 'function');

console.log('arrow visuals compatibility tests passed');

(function () {
    class SwordController {
        constructor(inputManager) {
            this.input = inputManager;
            this.pendingAttack = null;
            this.keyToAttack = {
                '1': 'slash',
                '2': 'upper_slash',
                '3': 'lower_slash',
                '4': 'pierce',
            };
            this.codeToAttack = {
                Numpad1: 'slash',
                Numpad2: 'upper_slash',
                Numpad3: 'lower_slash',
                Numpad4: 'pierce',
            };
        }

        isActive() {
            return this.input.activeWeapon === 'longsword';
        }

        handleKeyDown(e) {
            if (!this.isActive() || e.repeat) return;
            const attack = this.keyToAttack[e.key] || this.codeToAttack[e.code];
            if (!attack) return;
            this.pendingAttack = attack;
            e.preventDefault();
        }

        consumeAttack() {
            if (!this.isActive()) return null;
            const attack = this.pendingAttack;
            this.pendingAttack = null;
            return attack;
        }

        getInputPayload() {
            return {
                swordAttack: this.consumeAttack(),
            };
        }
    }

    window.SwordController = SwordController;
})();

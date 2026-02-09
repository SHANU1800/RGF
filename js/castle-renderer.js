/**
 * Castle Renderer Module
 * Coordinates rendering of both left and right castles
 */

const CastleRenderer = {
    gateState: {
        RED: { open: false, anim: 0, ballistaUser: null },
        BLUE: { open: false, anim: 0, ballistaUser: null },
    },

    getCastleWorldX(side, config) {
        if (side === 'RED') return 130;
        return Number(config && config.GAME_WIDTH ? config.GAME_WIDTH : CONFIG.GAME_WIDTH) - 130;
    },

    getBallistaUser(side) {
        const state = this.gateState[side];
        return state ? state.ballistaUser : null;
    },

    applySnapshotCastles(castles) {
        if (!castles || typeof castles !== 'object') return;
        ['RED', 'BLUE'].forEach((side) => {
            const source = castles[side];
            const state = this.gateState[side];
            if (!source || !state) return;
            state.open = !!source.gate_open;
            state.ballistaUser = source.ballista_user_id != null ? source.ballista_user_id : null;
            if (Number.isFinite(Number(source.gate_anim))) {
                const anim = Math.max(0, Math.min(1, Number(source.gate_anim)));
                state.anim = anim;
            }
        });
    },

    update(dt) {
        const step = Math.max(0, Number(dt || 0));
        ['RED', 'BLUE'].forEach((side) => {
            const state = this.gateState[side];
            if (!state) return;
            const target = state.open ? 1 : 0;
            const speed = 3.2;
            state.anim += (target - state.anim) * Math.min(1, speed * step);
            if (Math.abs(state.anim - target) < 0.01) {
                state.anim = target;
            }
        });
    },

    toggleGate(side) {
        const state = this.gateState[side];
        if (!state) return;
        state.open = !state.open;
    },

    toggleBallista(side, playerId) {
        const state = this.gateState[side];
        if (!state) return;
        if (state.ballistaUser === playerId) {
            state.ballistaUser = null;
            return;
        }
        state.ballistaUser = playerId;
    },

    tryInteract(player, config, groundY) {
        if (!player || !player.team) return false;
        const side = player.team === 'RED' ? 'RED' : 'BLUE';
        const castleX = this.getCastleWorldX(side, config);
        const px = Number(player.x || 0) + Number(player.width || 0) * 0.5;
        const py = Number(player.y || 0) + Number(player.height || 0);
        const dir = side === 'RED' ? 1 : -1;
        const baseY = Number(groundY || CONFIG.GROUND_Y);
        const ballistaX = castleX + dir * 55;
        const ballistaY = baseY - 250;
        const distToBallista = Math.hypot(px - ballistaX, py - ballistaY);
        if (distToBallista <= 220) {
            this.toggleBallista(side, player.id);
            return true;
        }

        const distToGate = Math.hypot(px - castleX, py - baseY);
        if (distToGate <= 170) {
            this.toggleGate(side);
            return true;
        }
        return false;
    },

    /**
     * Draws a castle at the specified position
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleX - Function to scale X coordinates
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {Function} scaleLengthX - Function to scale X lengths
     * @param {Function} scaleLengthY - Function to scale Y lengths
     * @param {number} worldX - World X position
     * @param {number} groundY - Ground Y position
     * @param {string} side - Castle side ('RED' or 'BLUE')
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    drawCastle(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, worldX, groundY, side, canvasWidth, canvasHeight) {
        const state = this.gateState[side];
        const gateOpenAnim = state ? state.anim : 0;
        if (side === 'RED') {
            if (window.LeftCastleRenderer) {
                window.LeftCastleRenderer.render(
                    ctx,
                    scaleX,
                    scaleY,
                    scaleLengthX,
                    scaleLengthY,
                    worldX,
                    groundY,
                    canvasWidth,
                    canvasHeight,
                    gateOpenAnim
                );
            }
        } else if (side === 'BLUE') {
            if (window.RightCastleRenderer) {
                window.RightCastleRenderer.render(
                    ctx,
                    scaleX,
                    scaleY,
                    scaleLengthX,
                    scaleLengthY,
                    worldX,
                    groundY,
                    canvasWidth,
                    canvasHeight,
                    gateOpenAnim
                );
            }
        }
    },

    /**
     * Renders both castles
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Function} scaleX - Function to scale X coordinates
     * @param {Function} scaleY - Function to scale Y coordinates
     * @param {Function} scaleLengthX - Function to scale X lengths
     * @param {Function} scaleLengthY - Function to scale Y lengths
     * @param {number} groundY - Ground Y position
     * @param {object} config - Game configuration
     * @param {number} canvasWidth - Canvas width
     * @param {number} canvasHeight - Canvas height
     */
    renderCastles(ctx, scaleX, scaleY, scaleLengthX, scaleLengthY, groundY, config, canvasWidth, canvasHeight) {
        // Draw left (RED) castle
        this.drawCastle(
            ctx,
            scaleX,
            scaleY,
            scaleLengthX,
            scaleLengthY,
            this.getCastleWorldX('RED', config),
            groundY,
            'RED',
            canvasWidth,
            canvasHeight
        );
        
        // Draw right (BLUE) castle
        this.drawCastle(
            ctx,
            scaleX,
            scaleY,
            scaleLengthX,
            scaleLengthY,
            this.getCastleWorldX('BLUE', config),
            groundY,
            'BLUE',
            canvasWidth,
            canvasHeight
        );
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.CastleRenderer = CastleRenderer;
}

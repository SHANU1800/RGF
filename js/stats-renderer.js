/**
 * Stats Renderer Module
 * Handles rendering of player stats, health bars, and loadout badges
 */

const StatsRenderer = {
    /**
     * Draws player health bar
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} w - Player width
     */
    drawHealthBar(ctx, player, x, y, w) {
        const healthBarWidth = w;
        const healthBarHeight = 5;
        const healthPercent = player.health / player.maxHealth;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y - 20, healthBarWidth, healthBarHeight);
        
        // Health bar (color changes based on health percentage)
        ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
        ctx.fillRect(x, y - 20, healthBarWidth * healthPercent, healthBarHeight);
    },

    drawStaminaBar(ctx, player, x, y, w) {
        const staminaMax = Math.max(1, Number(player.maxStamina || 100));
        const staminaValue = Math.max(0, Math.min(staminaMax, Number(player.stamina || staminaMax)));
        const staminaPercent = staminaValue / staminaMax;
        const staminaBarWidth = w;
        const staminaBarHeight = 4;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(x, y - 14, staminaBarWidth, staminaBarHeight);
        ctx.fillStyle = staminaPercent > 0.45 ? '#1abc9c' : staminaPercent > 0.2 ? '#f1c40f' : '#e67e22';
        ctx.fillRect(x, y - 14, staminaBarWidth * staminaPercent, staminaBarHeight);
    },

    /**
     * Draws player nickname
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} w - Player width
     */
    drawNickname(ctx, player, x, y, w) {
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.nickname, x + w / 2, y - 10);
    },

    /**
     * Draws loadout badges showing equipped items
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} w - Player width
     * @param {Function} drawWeaponGlyph - Function to draw weapon glyphs
     */
    drawLoadoutBadges(ctx, player, x, y, w, drawWeaponGlyph) {
        if (!player.loadout) return;
        
        const items = [];
        if (player.loadout.arrows) items.push({ kind: 'arrow', color: '#f1c40f', title: 'Arrows' });
        if (player.loadout.longsword) items.push({ kind: 'longsword', color: '#bdc3c7', title: 'Axe' });
        if (player.loadout.shield) items.push({ kind: 'shield', color: '#3498db', title: 'Shield' });
        if (player.loadout.miniSword) items.push({ kind: 'dagger', color: '#9b59b6', title: 'Mini Sword' });
        
        if (items.length === 0) return;
        
        const size = 18;
        const padding = 4;
        const totalWidth = items.length * size + (items.length - 1) * padding;
        const startX = x + w / 2 - totalWidth / 2;
        const badgeY = y - 34;
        
        items.forEach((item, idx) => {
            const bx = startX + idx * (size + padding);
            
            // Badge background
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(bx - 2, badgeY - 2, size + 4, size + 4);
            
            // Badge colored box
            ctx.fillStyle = item.color;
            ctx.fillRect(bx, badgeY, size, size);

            // Draw weapon icon
            if (drawWeaponGlyph) {
                drawWeaponGlyph(item.kind, bx + size / 2, badgeY + size / 2, size * 0.7);
            }
        });
    },

    /**
     * Renders all player stats
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {object} player - Player object
     * @param {number} x - Screen X position
     * @param {number} y - Screen Y position
     * @param {number} w - Player width
     * @param {Function} drawWeaponGlyph - Function to draw weapon glyphs
     */
    render(ctx, player, x, y, w, drawWeaponGlyph) {
        this.drawNickname(ctx, player, x, y, w);
        this.drawHealthBar(ctx, player, x, y, w);
        this.drawStaminaBar(ctx, player, x, y, w);
        this.drawLoadoutBadges(ctx, player, x, y, w, drawWeaponGlyph);
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.StatsRenderer = StatsRenderer;
}

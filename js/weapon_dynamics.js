(function () {
    const ROLE_CATEGORIES = {
        archer: { arrows: true, longsword: false, shield: false, miniSword: false },
        longswordsman: { arrows: false, longsword: true, shield: false, miniSword: false },
        'shield+sword': { arrows: false, longsword: true, shield: true, miniSword: false },
    };

    function normalizeLoadout(loadout) {
        if (loadout && typeof loadout.role_category === 'string') {
            const key = loadout.role_category.trim().toLowerCase();
            if (ROLE_CATEGORIES[key]) {
                return { ...ROLE_CATEGORIES[key] };
            }
        }
        const hasSword = !!(loadout && loadout.longsword);
        const hasShield = !!(loadout && loadout.shield);
        const hasMiniSword = !!(loadout && loadout.miniSword);
        return {
            arrows: !hasSword,
            longsword: hasSword,
            shield: hasSword ? hasShield : false,
            miniSword: hasMiniSword && !hasSword,
        };
    }

    function aggregateModifiers(loadout) {
        const l = normalizeLoadout(loadout);
        const mods = {
            moveSpeedMultiplier: 1.0,
            incomingDamageMultiplier: 1.0,
            outgoingDamageMultiplier: 1.0,
            drawPowerMultiplier: 1.0,
            arrowSpeedMultiplier: 1.0,
            canShootArrows: l.arrows,
        };

        if (l.arrows) {
            mods.drawPowerMultiplier *= 1.05;
            mods.arrowSpeedMultiplier *= 1.03;
        }
        if (l.longsword) {
            mods.moveSpeedMultiplier *= 0.97;
            mods.outgoingDamageMultiplier *= 1.08;
        }
        if (l.shield) {
            mods.moveSpeedMultiplier *= 0.92;
            mods.incomingDamageMultiplier *= 0.90;
            mods.outgoingDamageMultiplier *= 0.97;
        }
        if (l.miniSword) {
            mods.moveSpeedMultiplier *= 1.04;
            mods.outgoingDamageMultiplier *= 1.04;
            mods.drawPowerMultiplier *= 0.96;
        }

        const arrowProfile = window.ArrowWeaponVisuals && typeof window.ArrowWeaponVisuals.getArrowCombatProfile === 'function'
            ? window.ArrowWeaponVisuals.getArrowCombatProfile(l)
            : { canShoot: l.arrows, baseSpeedMultiplier: 1.0 };
        const longswordProfile = window.LongswordVisuals && typeof window.LongswordVisuals.getLongswordCombatProfile === 'function'
            ? window.LongswordVisuals.getLongswordCombatProfile(l)
            : { active: l.longsword, moveSpeedMultiplier: 1.0, outgoingDamageMultiplier: 1.0, arrowSpeedMultiplier: 1.0 };
        const shieldProfile = window.ShieldVisuals && typeof window.ShieldVisuals.getShieldCombatProfile === 'function'
            ? window.ShieldVisuals.getShieldCombatProfile(l)
            : { active: false, moveSpeedMultiplier: 1.0, incomingDamageMultiplier: 1.0 };
        const miniSwordProfile = window.MiniSwordVisuals && typeof window.MiniSwordVisuals.getMiniSwordCombatProfile === 'function'
            ? window.MiniSwordVisuals.getMiniSwordCombatProfile(l)
            : { active: false, moveSpeedMultiplier: 1.0, drawPowerMultiplier: 1.0, outgoingDamageMultiplier: 1.0 };

        mods.canShootArrows = !!arrowProfile.canShoot;
        mods.arrowSpeedMultiplier *= Number(arrowProfile.baseSpeedMultiplier || 1.0);
        mods.moveSpeedMultiplier *= Number(longswordProfile.moveSpeedMultiplier || 1.0);
        mods.outgoingDamageMultiplier *= Number(longswordProfile.outgoingDamageMultiplier || 1.0);
        mods.arrowSpeedMultiplier *= Number(longswordProfile.arrowSpeedMultiplier || 1.0);
        mods.moveSpeedMultiplier *= Number(shieldProfile.moveSpeedMultiplier || 1.0);
        mods.incomingDamageMultiplier *= Number(shieldProfile.incomingDamageMultiplier || 1.0);
        mods.moveSpeedMultiplier *= Number(miniSwordProfile.moveSpeedMultiplier || 1.0);
        mods.drawPowerMultiplier *= Number(miniSwordProfile.drawPowerMultiplier || 1.0);
        mods.outgoingDamageMultiplier *= Number(miniSwordProfile.outgoingDamageMultiplier || 1.0);

        mods.moveSpeedMultiplier = Math.max(0.65, Math.min(1.25, mods.moveSpeedMultiplier));
        mods.incomingDamageMultiplier = Math.max(0.45, Math.min(1.0, mods.incomingDamageMultiplier));
        mods.outgoingDamageMultiplier = Math.max(0.85, Math.min(1.35, mods.outgoingDamageMultiplier));
        mods.drawPowerMultiplier = Math.max(0.85, Math.min(1.35, mods.drawPowerMultiplier));
        mods.arrowSpeedMultiplier = Math.max(0.85, Math.min(1.25, mods.arrowSpeedMultiplier));
        return mods;
    }

    window.WeaponDynamics = {
        normalizeLoadout,
        aggregateModifiers,
    };
})();

(function () {
    // Collision sampling utilities for tile-based levels
    function isSolidAt(env, px, py) {
        if (!env || typeof env.isSolidAt !== 'function') return false;
        return !!env.isSolidAt(px, py);
    }

    // Sample across an X range at fixed Y. Returns true if any sample hits solid.
    function sampleXRange(env, y, xMin, xMax, sampleCount) {
        if (xMax < xMin) return false;
        var count = typeof sampleCount === 'number' && sampleCount > 0 ? sampleCount : Math.max(1, Math.ceil((xMax - xMin) / (env.tileSize || 32)));
        if (count === 1) {
            var mx = (xMin + xMax) * 0.5;
            return isSolidAt(env, mx, y);
        }
        for (var i = 0; i < count; i++) {
            var t = (count === 1) ? 0.5 : (i / (count - 1));
            var sx = xMin + (xMax - xMin) * t;
            if (isSolidAt(env, sx, y)) return true;
        }
        return false;
    }

    // Sample across a Y range at fixed X. Returns true if any sample hits solid.
    function sampleYRange(env, x, yMin, yMax, sampleCount) {
        if (yMax < yMin) return false;
        var count = typeof sampleCount === 'number' && sampleCount > 0 ? sampleCount : Math.max(1, Math.ceil((yMax - yMin) / (env.tileSize || 32)));
        if (count === 1) {
            var my = (yMin + yMax) * 0.5;
            return isSolidAt(env, x, my);
        }
        for (var i = 0; i < count; i++) {
            var t = (count === 1) ? 0.5 : (i / (count - 1));
            var sy = yMin + (yMax - yMin) * t;
            if (isSolidAt(env, x, sy)) return true;
        }
        return false;
    }

    // Helper: snap player horizontally to tile column after hitting wall
    function snapPlayerToLeftOfTile(player, px, ts) {
        var tileX = Math.floor(px / ts);
        player.x = (tileX + 1) * ts + (player.size / 2) + 0.001;
    }
    function snapPlayerToRightOfTile(player, px, ts) {
        var tileX = Math.floor(px / ts);
        player.x = tileX * ts - (player.size / 2) - 0.001;
    }

    // tile index helpers
    function tileIndexX(px, ts) { return Math.floor(px / ts); }
    function tileIndexY(py, ts) { return Math.floor(py / ts); }

    window.Collision = {
        isSolidAt: isSolidAt,
        sampleXRange: sampleXRange,
        sampleYRange: sampleYRange,
        snapPlayerToLeftOfTile: snapPlayerToLeftOfTile,
        snapPlayerToRightOfTile: snapPlayerToRightOfTile,
        tileIndexX: tileIndexX,
        tileIndexY: tileIndexY
    };

    // Player-specific collision helpers
    function checkExplosionCollision(player, enemies) {
        if (!player || !enemies || !Array.isArray(enemies)) return null;
        for (var ei = enemies.length - 1; ei >= 0; ei--) {
            var en = enemies[ei];
            if (!en || en.state !== 'explode') continue;
            var t = Math.min(1, en._explosionTimer / (en.explosionTime || 0.0001));
            var maxR = Math.max(en.size || 0, 48);
            var r = 4 + t * maxR;
            var dx = player.x - en.x; var dy = player.y - en.y;
            var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
            var hitDist = r + (player.size || 0) * 0.5;
            if (d <= hitDist) {
                try {
                    var pcol = (player && player.trail && player.trail.col) ? player.trail.col : '0,255,240';
                    if (typeof window.spawnParticleBurst === 'function') window.spawnParticleBurst(player.x, player.y, { color: pcol });
                } catch (e) { console.warn('spawnParticleBurst failed', e); }
                // play player explosion sound if available
                try {
                    if (window.AudioManager && typeof window.AudioManager.play === 'function') {
                        window.AudioManager.play('player_explode');
                    }
                } catch (e) { console.warn('AudioManager.play failed', e); }
                return { killed: true };
            }
        }
        return null;
    }

    window.PlayerCollision = {
        checkExplosionCollision: checkExplosionCollision
    };
})();

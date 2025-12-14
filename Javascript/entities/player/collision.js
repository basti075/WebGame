// Collision sampling utilities for tile-based levels
export function isSolidAt(env, px, py) {
    if (!env || typeof env.isSolidAt !== 'function') return false;
    return !!env.isSolidAt(px, py);
}

export function sampleXRange(env, y, xMin, xMax, sampleCount) {
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

export function sampleYRange(env, x, yMin, yMax, sampleCount) {
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

export function snapPlayerToLeftOfTile(player, px, ts) {
    var tileX = Math.floor(px / ts);
    player.x = (tileX + 1) * ts + (player.size / 2) + 0.001;
}

export function snapPlayerToRightOfTile(player, px, ts) {
    var tileX = Math.floor(px / ts);
    player.x = tileX * ts - (player.size / 2) - 0.001;
}

export function tileIndexX(px, ts) { return Math.floor(px / ts); }
export function tileIndexY(py, ts) { return Math.floor(py / ts); }

function getExplosionMetrics(enemy) {
    if (!enemy) return null;
    var timer = (typeof enemy.explosionTimer === 'number') ? enemy.explosionTimer : (enemy._explosionTimer || 0);
    var duration = (typeof enemy.explosionDuration === 'number') ? enemy.explosionDuration : (enemy.explosionTime || 0.0001);
    var progress = duration > 0 ? Math.min(1, timer / duration) : 1;
    var radius = Math.max(enemy.size || 0, 48);
    return { progress: progress, radius: radius };
}

export function checkExplosionCollision(player, enemies, services) {
    if (!player || !enemies || !Array.isArray(enemies)) return null;
    services = services || {};
    var particleSystem = services.particleSystem;
    var audio = services.audio;
    for (var ei = enemies.length - 1; ei >= 0; ei--) {
        var en = enemies[ei];
        if (!en || en.state !== 'explode') continue;
        var metrics = getExplosionMetrics(en);
        if (!metrics) continue;
        var r = 4 + metrics.progress * metrics.radius;
        var dx = player.x - en.x;
        var dy = player.y - en.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        var hitDist = r + (player.size || 0) * 0.5;
        if (d <= hitDist) {
            if (particleSystem && typeof particleSystem.spawnBurst === 'function') {
                var pcol = (player && player.trail && player.trail.col) ? player.trail.col : '0,255,240';
                particleSystem.spawnBurst(player.x, player.y, { color: pcol });
            }
            if (audio && typeof audio.play === 'function') {
                audio.play('player_explode');
            }
            return { killed: true };
        }
    }
    return null;
}

if (typeof window !== 'undefined') {
    var collisionAPI = {
        isSolidAt: isSolidAt,
        sampleXRange: sampleXRange,
        sampleYRange: sampleYRange,
        snapPlayerToLeftOfTile: snapPlayerToLeftOfTile,
        snapPlayerToRightOfTile: snapPlayerToRightOfTile,
        checkExplosionCollision: checkExplosionCollision
    };
    window.PlayerCollision = collisionAPI;
    window.Collision = Object.assign(window.Collision || {}, collisionAPI);
}

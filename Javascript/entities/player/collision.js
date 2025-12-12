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
})();

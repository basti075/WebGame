(function () {
    'use strict';

    window.Pathfinding = window.Pathfinding || {};

    window.Pathfinding.findPath = function (level, startPx, endPx, entitySize) {
        if (!level || typeof level.tileSize !== 'number' || typeof level.tileIndex !== 'function') return null;
        var ts = level.tileSize;
        var start = { x: Math.floor(startPx.x / ts), y: Math.floor(startPx.y / ts) };
        var goal = { x: Math.floor(endPx.x / ts), y: Math.floor(endPx.y / ts) };
        var halfSize = (typeof entitySize === 'number' && entitySize > 0) ? (entitySize * 0.5) : ts * 0.5;

        var inBounds = function (n) { return n.x >= 0 && n.y >= 0 && n.x < level.width && n.y < level.height; };
        var isWalkable = function (n) {
            if (!inBounds(n)) return false;
            var cx = (n.x + 0.5) * ts;
            var cy = (n.y + 0.5) * ts;
            var left = cx - halfSize;
            var right = cx + halfSize;
            var top = cy - halfSize;
            var bottom = cy + halfSize;
            if (window.Collision && window.Collision.sampleXRange) {
                if (window.Collision.sampleXRange(level, top, left, right, 3)) return false;
                if (window.Collision.sampleXRange(level, bottom, left, right, 3)) return false;
            } else {
                if (level.isSolidAt(left, top) || level.isSolidAt(right, top)) return false;
                if (level.isSolidAt(left, bottom) || level.isSolidAt(right, bottom)) return false;
            }

            if (window.Collision && window.Collision.sampleYRange) {
                if (window.Collision.sampleYRange(level, left, top, bottom, 3)) return false;
                if (window.Collision.sampleYRange(level, right, top, bottom, 3)) return false;
            } else {
                if (level.isSolidAt(left, top) || level.isSolidAt(left, bottom)) return false;
                if (level.isSolidAt(right, top) || level.isSolidAt(right, bottom)) return false;
            }
            return true;
        };

        var nearestWalkable = function (node) {
            if (isWalkable(node)) return node;
            var q = [node];
            var seen = {}; seen[node.x + ',' + node.y] = true;
            while (q.length) {
                var cur = q.shift();
                var nbrs = [{ x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y }, { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 }];
                for (var i = 0; i < nbrs.length; i++) {
                    var nb = nbrs[i];
                    var k = nb.x + ',' + nb.y;
                    if (seen[k]) continue; seen[k] = true;
                    if (!inBounds(nb)) continue;
                    if (isWalkable(nb)) return nb;
                    q.push(nb);
                }
            }
            return null;
        };

        start = nearestWalkable(start);
        goal = nearestWalkable(goal);
        if (!start || !goal) return null;

        var key = function (n) { return n.x + ',' + n.y; };
        var h = function (a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); };

        var reconstruct = function (came, endK) {
            var raw = [];
            var ck = endK;
            while (ck) {
                var parts = ck.split(',');
                var cx = parseInt(parts[0], 10), cy = parseInt(parts[1], 10);
                raw.push({ x: cx * ts + ts / 2, y: cy * ts + ts / 2 });
                ck = came[ck];
            }
            raw.reverse();
            return raw;
        };

        var hasLineOfSight = function (from, to) {
            var steps = Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / ts);
            if (steps < 2) return true;
            for (var i = 1; i < steps; i++) {
                var t = i / steps;
                var sx = from.x + (to.x - from.x) * t;
                var sy = from.y + (to.y - from.y) * t;
                if (level.isSolidAt(sx - halfSize, sy) || level.isSolidAt(sx + halfSize, sy) ||
                    level.isSolidAt(sx, sy - halfSize) || level.isSolidAt(sx, sy + halfSize)) {
                    return false;
                }
            }
            return true;
        };

        var smoothPath = function (path) {
            if (!path || path.length <= 2) return path;
            var smoothed = [path[0]];
            var anchor = 0;
            for (var i = 2; i < path.length; i++) {
                if (!hasLineOfSight(path[anchor], path[i])) {
                    smoothed.push(path[i - 1]);
                    anchor = i - 1;
                }
            }
            smoothed.push(path[path.length - 1]);
            return smoothed;
        };

        var runAStar = function () {
            var open = [];
            var closed = {};
            var cameFrom = {};
            var g = {};
            var push = function (n, f) { open.push({ n: n, f: f }); };
            g[key(start)] = 0;
            push(start, h(start, goal));
            while (open.length) {
                open.sort(function (a, b) { return a.f - b.f; });
                var cur = open.shift().n;
                var curK = key(cur);
                if (closed[curK]) continue;
                closed[curK] = true;
                if (cur.x === goal.x && cur.y === goal.y) return reconstruct(cameFrom, curK);

                var nbrs = [
                    { x: cur.x + 1, y: cur.y, cost: 1 },
                    { x: cur.x - 1, y: cur.y, cost: 1 },
                    { x: cur.x, y: cur.y + 1, cost: 1 },
                    { x: cur.x, y: cur.y - 1, cost: 1 }
                ];

                for (var i = 0; i < nbrs.length; i++) {
                    var nb = nbrs[i];
                    var nbK = key(nb);
                    if (closed[nbK]) continue;
                    if (!isWalkable(nb)) continue;
                    var tentativeG = (g[curK] || Infinity) + nb.cost;
                    if (tentativeG < (g[nbK] || Infinity)) {
                        cameFrom[nbK] = curK;
                        g[nbK] = tentativeG;
                        var f = tentativeG + h(nb, goal);
                        push(nb, f);
                    }
                }
            }
            return null;
        };

        var runBFS = function () {
            var q = [start];
            var came = {}; came[key(start)] = null;
            var visited = {}; visited[key(start)] = true;
            while (q.length) {
                var cur = q.shift();
                var curK = key(cur);
                if (cur.x === goal.x && cur.y === goal.y) return reconstruct(came, curK);
                var nbrs = [{ x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y }, { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 }];
                for (var i = 0; i < nbrs.length; i++) {
                    var nb = nbrs[i];
                    var nbK = key(nb);
                    if (visited[nbK]) continue;
                    if (!isWalkable(nb)) continue;
                    visited[nbK] = true;
                    came[nbK] = curK;
                    q.push(nb);
                }
            }
            return null;
        };

        var result = runAStar() || runBFS();
        return smoothPath(result);
    };
})();

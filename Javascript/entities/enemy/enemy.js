(function () {
    'use strict';

    function Enemy(opts) {
        opts = opts || {};
        this.x = typeof opts.x === 'number' ? opts.x : 0;
        this.y = typeof opts.y === 'number' ? opts.y : 0;
        this.size = typeof opts.size === 'number' ? opts.size : 24;
        this.speed = typeof opts.speed === 'number' ? opts.speed : 125;
        this.chaseDuration = typeof opts.chaseDuration === 'number' ? opts.chaseDuration : 5.0;

        // color for trail and particles as 'r,g,b'
        this.colorRGB = typeof opts.colorRGB === 'string' ? opts.colorRGB : '255,60,60';

        this._timer = 0;
        this.state = 'chase';
        this.explosionTime = 0.6;
        this._explosionTimer = 0;
        this.path = null;
        this.pathIndex = 0;
        this._recalcTimer = 0;
        // optional neon trail (uses shared Trail helper if present)
        this.trail = null;
        this.trailMax = typeof opts.trailMax === 'number' ? opts.trailMax : 30;
        this.trailSpawnInterval = typeof opts.trailSpawnInterval === 'number' ? opts.trailSpawnInterval : 0.01;
    }
    Enemy.prototype.update = function (dt, player, level) {
        if (this.state === 'dead') return;
        // lazy-create trail helper
        if (!this.trail) {
            if (typeof window.Trail === 'function') this.trail = new window.Trail(this.trailMax, this.trailSpawnInterval, this.colorRGB);
            else this.trail = { update: function () { }, draw: function () { } };
        }
        // update trail with current position (use angle 0)
        if (this.trail && typeof this.trail.update === 'function') this.trail.update(dt, this.x, this.y, 0, this.size);
        this._timer += dt;
        if (this.state === 'chase') {
            var haveLevel = !!(level && typeof level.isSolidAt === 'function');
            if (haveLevel && player && typeof player.x === 'number' && typeof player.y === 'number') {
                this._recalcTimer -= dt;
                if (this._recalcTimer <= 0) {
                    var newPath = Enemy.findPath(level, { x: this.x, y: this.y }, { x: player.x, y: player.y }, this.size);
                    if (newPath && newPath.length > 1) {
                        var nearestIdx = 1;
                        var bestDist = Infinity;
                        for (var pi = 1; pi < newPath.length; pi++) {
                            var dxp = newPath[pi].x - this.x;
                            var dyp = newPath[pi].y - this.y;
                            var d2 = dxp * dxp + dyp * dyp;
                            if (d2 < bestDist) { bestDist = d2; nearestIdx = pi; }
                        }
                        this.path = newPath;
                        this.pathIndex = nearestIdx;
                    }
                    this._recalcTimer = 0.10;
                }
                var ts = level.tileSize;
                var half = this.size / 2;
                var moveTowards = function (tx, ty, dt, self) {
                    var dx = tx - self.x;
                    var dy = ty - self.y;
                    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    return { vx: (dx / dist) * self.speed, vy: (dy / dist) * self.speed, dist: dist };
                };

                var moveWithCollision = function (tx, ty) {
                    var mv = moveTowards(tx, ty, dt, this);
                    if (mv.vx !== 0) {
                        this.x += mv.vx * dt;
                        var leftX = this.x - half;
                        var rightX = this.x + half;
                        var topY = this.y - half + 1;
                        var bottomY = this.y + half - 1;
                        if (window.Collision && window.Collision.sampleYRange) {
                            if (window.Collision.sampleYRange(level, leftX, topY, bottomY, 3)) {
                                window.Collision.snapPlayerToLeftOfTile(this, leftX, ts);
                            }
                            if (window.Collision.sampleYRange(level, rightX, topY, bottomY, 3)) {
                                window.Collision.snapPlayerToRightOfTile(this, rightX, ts);
                            }
                        } else {
                            if (level.isSolidAt(leftX, topY) || level.isSolidAt(leftX, bottomY)) {
                                var txi = Math.floor(leftX / ts); this.x = (txi + 1) * ts + half + 0.001;
                            }
                            if (level.isSolidAt(rightX, topY) || level.isSolidAt(rightX, bottomY)) {
                                var txi2 = Math.floor(rightX / ts); this.x = txi2 * ts - half - 0.001;
                            }
                        }
                    }
                    if (mv.vy !== 0) {
                        this.y += mv.vy * dt;
                        var leftX2 = this.x - half + 1;
                        var rightX2 = this.x + half - 1;
                        var bottomY2 = this.y + half;
                        var topY2 = this.y - half;
                        if (window.Collision && window.Collision.sampleXRange) {
                            if (window.Collision.sampleXRange(level, bottomY2, leftX2, rightX2, 3)) {
                                var rowB = Math.floor(bottomY2 / ts); this.y = rowB * ts - half - 0.001;
                            } else if (window.Collision.sampleXRange(level, topY2, leftX2, rightX2, 3)) {
                                var rowT = Math.floor(topY2 / ts); this.y = (rowT + 1) * ts + half + 0.001;
                            }
                        } else {
                            if (level.isSolidAt((leftX2 + rightX2) * 0.5, bottomY2)) {
                                var rowB2 = Math.floor(bottomY2 / ts); this.y = rowB2 * ts - half - 0.001;
                            } else if (level.isSolidAt((leftX2 + rightX2) * 0.5, topY2)) {
                                var rowT2 = Math.floor(topY2 / ts); this.y = (rowT2 + 1) * ts + half + 0.001;
                            }
                        }
                    }
                }.bind(this);

                if (this.path && this.path.length > 1 && this.pathIndex < this.path.length) {
                    var wp = this.path[this.pathIndex];
                    var mvinfo = moveTowards(wp.x, wp.y, dt, this);
                    var step = Math.max(Math.abs(mvinfo.vx * dt), Math.abs(mvinfo.vy * dt));
                    if (mvinfo.dist <= step * 1.5 + 0.5) {
                        this.x = wp.x; this.y = wp.y; this.pathIndex++;
                    } else {
                        moveWithCollision(wp.x, wp.y);
                    }
                } else {
                    moveWithCollision(player.x, player.y);
                    this._recalcTimer = Math.min(this._recalcTimer, 0.10);
                }
                // check collision with player (simple circle overlap)
                if (player && typeof player.x === 'number' && typeof player.y === 'number' && typeof player.size === 'number') {
                    var ddxC = player.x - this.x; var ddyC = player.y - this.y;
                    var distC = Math.sqrt(ddxC * ddxC + ddyC * ddyC) || 1;
                    var minDist = (player.size + this.size) * 0.5;
                    if (distC <= minDist) {
                        this.state = 'explode'; this._explosionTimer = 0; this.onExplode();
                    }
                }
            } else if (player && typeof player.x === 'number' && typeof player.y === 'number') {
                var ddx = player.x - this.x; var ddy = player.y - this.y; var dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                this.x += (ddx / dd) * this.speed * dt; this.y += (ddy / dd) * this.speed * dt;
            }

            if (this._timer >= this.chaseDuration) {
                this.state = 'explode'; this._explosionTimer = 0; this.onExplode();
            }
        } else if (this.state === 'explode') {
            this._explosionTimer += dt;
            if (this._explosionTimer >= this.explosionTime) this.state = 'dead';
        }
    };

    Enemy.prototype.draw = function (ctx) {
        if (!ctx) return;
        if (this.state === 'dead') return;
        // draw trail first
        if (this.trail && typeof this.trail.draw === 'function') this.trail.draw(ctx);

        if (this.state === 'chase') {
            ctx.save();
            ctx.fillStyle = '#c33';
            var s = this.size;
            ctx.fillRect(this.x - s / 2, this.y - s / 2, s, s);
            ctx.restore();
        } else if (this.state === 'explode') {
            // explosion visual removed; particles represent the explosion now
            // keep updating timers only
        }
    };

    Enemy.prototype.onExplode = function () {
        // spawn particle burst matching the enemy's color and approximate size
        try {
            if (typeof window.spawnParticleBurst === 'function') {
                var maxR = Math.max(this.size || 24, 48);
                var count = Math.max(12, Math.round(maxR * 0.6));
                window.spawnParticleBurst(this.x, this.y, { count: count, color: this.colorRGB, life: this.explosionTime });
            }
        } catch (e) { console.warn('spawnParticleBurst failed', e); }
        if (typeof window.onEnemyExplode === 'function') {
            try { window.onEnemyExplode(this); } catch (e) { console.error(e); }
        }
    };

    Enemy.prototype.isAlive = function () { return this.state !== 'dead'; };

    Enemy.findPath = function (level, startPx, endPx, entitySize) {
        return window.Pathfinding && typeof window.Pathfinding.findPath === 'function'
            ? window.Pathfinding.findPath(level, startPx, endPx, entitySize)
            : null;
    };
    window.Enemy = Enemy;
})();

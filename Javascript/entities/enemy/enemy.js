import { Entity } from '../entity.js';
import { Trail } from '../trail.js';
import { particleSystem as defaultParticleSystem } from '../particles.js';
import { sampleXRange, sampleYRange, snapPlayerToLeftOfTile, snapPlayerToRightOfTile } from '../player/collision.js';
import { findPath as computeEnemyPath } from './pathfinding.js';

var EnemyState = {
    CHASE: 'chase',
    EXPLODE: 'explode',
    DEAD: 'dead'
};

export class Enemy extends Entity {
    constructor(opts, services) {
        opts = opts || {};
        services = services || {};
        super({
            x: typeof opts.x === 'number' ? opts.x : 0,
            y: typeof opts.y === 'number' ? opts.y : 0,
            size: typeof opts.size === 'number' ? opts.size : 24
        });
        this.speed = typeof opts.speed === 'number' ? opts.speed : 165;
        this.chaseDuration = typeof opts.chaseDuration === 'number' ? opts.chaseDuration : 5;
        this.colorRGB = typeof opts.colorRGB === 'string' ? opts.colorRGB : '255,60,60';
        this.explosionDuration = typeof opts.explosionTime === 'number' ? opts.explosionTime : 0.6;
        this.state = EnemyState.CHASE;
        this.timer = 0;
        this.explosionTimer = 0;
        this.path = null;
        this.pathIndex = 0;
        this.recalcInterval = typeof opts.recalcInterval === 'number' ? opts.recalcInterval : 0.01;
        this._recalcTimer = 0;
        this.trail = new Trail(
            typeof opts.trailMax === 'number' ? opts.trailMax : 30,
            typeof opts.trailSpawnInterval === 'number' ? opts.trailSpawnInterval : 0.01,
            this.colorRGB
        );
        this.services = {
            particles: services.particles || defaultParticleSystem,
            audio: services.audio || null,
            pathfinder: services.pathfinder || null
        };
    }

    update(dt, contextOrPlayer, maybeLevel) {
        if (!dt || this.state === EnemyState.DEAD) return;
        var context = this._normalizeContext(contextOrPlayer, maybeLevel);
        this.trail.update(dt, this.x, this.y, 0, this.size);
        this.timer += dt;
        switch (this.state) {
            case EnemyState.CHASE:
                this._updateChase(dt, context);
                break;
            case EnemyState.EXPLODE:
                this._updateExplosion(dt);
                break;
            default:
                break;
        }
    }

    draw(ctx) {
        if (!ctx || this.state === EnemyState.DEAD) return;
        this.trail.draw(ctx);
        if (this.state === EnemyState.CHASE) {
            ctx.save();
            ctx.fillStyle = '#c33';
            var half = this.size / 2;
            ctx.fillRect(this.x - half, this.y - half, this.size, this.size);
            ctx.restore();
        }
    }

    onExplode(context) {
        this._emitParticles(context);
        this._playAudio(context);
        this._notifyGlobalHook();
    }

    static findPath(level, startPx, endPx, entitySize, pathfinder) {
        var service = (pathfinder && typeof pathfinder.findPath === 'function') ? pathfinder : Enemy._getGlobalPathfinding();
        if (service && typeof service.findPath === 'function') {
            return service.findPath(level, startPx, endPx, entitySize);
        }
        return computeEnemyPath(level, startPx, endPx, entitySize);
    }

    _updateChase(dt, context) {
        var player = context.player;
        var level = context.level;
        if (player && level && this._isLevel(level)) {
            this._recalcTimer -= dt;
            if (this._recalcTimer <= 0) {
                this._recalculatePath(level, player, context.pathfinder);
                this._recalcTimer = this.recalcInterval;
            }
            if (!this._followPath(dt, level) && player) {
                this._moveWithCollisionTowards(player.x, player.y, level, dt);
            }
        } else if (player) {
            this._moveDirectTowards(player.x, player.y, dt);
        }
        if (player) this._checkPlayerCollision(player, context);
        if (this.timer >= this.chaseDuration) this._enterExplosion(context);
    }

    _updateExplosion(dt) {
        this.explosionTimer += dt;
        if (this.explosionTimer >= this.explosionDuration) {
            this.state = EnemyState.DEAD;
            this.destroy();
        }
    }

    _followPath(dt, level) {
        if (!this.path || this.path.length <= 1 || this.pathIndex >= this.path.length) return false;
        var waypoint = this.path[this.pathIndex];
        var movement = this._computeVelocity(waypoint.x, waypoint.y);
        var step = this.speed * dt;
        if (movement.distance <= step * 1.5 + 0.5) {
            this.x = waypoint.x;
            this.y = waypoint.y;
            this.pathIndex++;
            return this._followPath(dt, level);
        }
        this._moveWithCollisionTowards(waypoint.x, waypoint.y, level, dt);
        return true;
    }

    _moveWithCollisionTowards(tx, ty, level, dt) {
        if (!level) return this._moveDirectTowards(tx, ty, dt);
        var movement = this._computeVelocity(tx, ty);
        this.x += movement.vx * dt;
        this._resolveHorizontal(level);
        this.y += movement.vy * dt;
        this._resolveVertical(level);
    }

    _moveDirectTowards(tx, ty, dt) {
        var movement = this._computeVelocity(tx, ty);
        this.x += movement.vx * dt;
        this.y += movement.vy * dt;
    }

    _resolveHorizontal(level) {
        var half = this.size / 2;
        var topY = this.y - half + 1;
        var bottomY = this.y + half - 1;
        var leftX = this.x - half;
        var rightX = this.x + half;
        if (sampleYRange(level, leftX, topY, bottomY, 3)) {
            snapPlayerToLeftOfTile(this, leftX, level.tileSize);
        }
        if (sampleYRange(level, rightX, topY, bottomY, 3)) {
            snapPlayerToRightOfTile(this, rightX, level.tileSize);
        }
    }

    _resolveVertical(level) {
        var half = this.size / 2;
        var leftX = this.x - half + 1;
        var rightX = this.x + half - 1;
        var bottomY = this.y + half;
        var topY = this.y - half;
        if (sampleXRange(level, bottomY, leftX, rightX, 3)) {
            var bottomRow = Math.floor(bottomY / level.tileSize);
            this.y = bottomRow * level.tileSize - half - 0.001;
        } else if (sampleXRange(level, topY, leftX, rightX, 3)) {
            var topRow = Math.floor(topY / level.tileSize);
            this.y = (topRow + 1) * level.tileSize + half + 0.001;
        }
    }

    _computeVelocity(targetX, targetY) {
        var dx = targetX - this.x;
        var dy = targetY - this.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return {
            vx: (dx / dist) * this.speed,
            vy: (dy / dist) * this.speed,
            distance: dist
        };
    }

    _checkPlayerCollision(player, context) {
        var dx = player.x - this.x;
        var dy = player.y - this.y;
        var minDist = (player.size + this.size) * 0.5;
        if ((dx * dx + dy * dy) <= minDist * minDist) {
            this._enterExplosion(context);
        }
    }

    _enterExplosion(context) {
        if (this.state === EnemyState.EXPLODE || this.state === EnemyState.DEAD) return;
        this.state = EnemyState.EXPLODE;
        this.explosionTimer = 0;
        this.onExplode(context);
    }

    _emitParticles(context) {
        var emitter = context.particleSystem || this.services.particles || this._getGlobalParticles();
        if (emitter && typeof emitter.spawnBurst === 'function') {
            var maxR = Math.max(this.size || 24, 48);
            var count = Math.max(12, Math.round(maxR * 0.6));
            emitter.spawnBurst(this.x, this.y, { count: count, color: this.colorRGB, life: this.explosionDuration });
        } else if (typeof window !== 'undefined' && typeof window.spawnParticleBurst === 'function') {
            window.spawnParticleBurst(this.x, this.y, { color: this.colorRGB, life: this.explosionDuration });
        }
    }

    _playAudio(context) {
        var audio = context.audio || this.services.audio || this._getGlobalAudio();
        if (audio && typeof audio.play === 'function') {
            audio.play('enemy_explode');
        }
    }

    _notifyGlobalHook() {
        if (typeof window !== 'undefined' && typeof window.onEnemyExplode === 'function') {
            try { window.onEnemyExplode(this); } catch (err) { console.error(err); }
        }
    }

    _recalculatePath(level, player, pathfinder) {
        var path = Enemy.findPath(level, { x: this.x, y: this.y }, { x: player.x, y: player.y }, this.size, pathfinder || this.services.pathfinder);
        if (!path || path.length <= 1) {
            this.path = null;
            this.pathIndex = 0;
            return;
        }
        var nearestIdx = 1;
        var bestDist = Infinity;
        for (var i = 1; i < path.length; i++) {
            var dx = path[i].x - this.x;
            var dy = path[i].y - this.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < bestDist) {
                bestDist = d2;
                nearestIdx = i;
            }
        }
        this.path = path;
        this.pathIndex = nearestIdx;
    }

    _normalizeContext(target, maybeLevel) {
        if (target && typeof target === 'object' && (target.player || target.level || target.bounds)) {
            return {
                player: target.player || null,
                level: target.level || null,
                bounds: target.bounds || null,
                particleSystem: target.particleSystem || this.services.particles || this._getGlobalParticles(),
                audio: target.audio || this.services.audio || this._getGlobalAudio(),
                pathfinder: target.pathfinder || this.services.pathfinder || this._getGlobalPathfinder()
            };
        }
        var level = this._isLevel(maybeLevel) ? maybeLevel : null;
        return {
            player: target || null,
            level: level,
            bounds: level ? null : maybeLevel || null,
            particleSystem: this.services.particles || this._getGlobalParticles(),
            audio: this.services.audio || this._getGlobalAudio(),
            pathfinder: this.services.pathfinder || this._getGlobalPathfinder()
        };
    }

    _isLevel(candidate) {
        return candidate && typeof candidate.isSolidAt === 'function' && typeof candidate.tileSize === 'number';
    }

    _getGlobalParticles() {
        if (typeof window !== 'undefined' && window.ParticleSystem && typeof window.ParticleSystem.spawnBurst === 'function') {
            return window.ParticleSystem;
        }
        return defaultParticleSystem;
    }

    _getGlobalAudio() {
        if (typeof window !== 'undefined' && window.AudioManager) return window.AudioManager;
        return null;
    }

    _getGlobalPathfinder() {
        if (typeof window !== 'undefined' && window.Pathfinding && typeof window.Pathfinding.findPath === 'function') {
            return window.Pathfinding;
        }
        if (this.services.pathfinder && typeof this.services.pathfinder.findPath === 'function') {
            return this.services.pathfinder;
        }
        return { findPath: computeEnemyPath };
    }

    static _getGlobalPathfinding() {
        if (typeof window !== 'undefined' && window.Pathfinding && typeof window.Pathfinding.findPath === 'function') {
            return window.Pathfinding;
        }
        return { findPath: computeEnemyPath };
    }
}

if (typeof window !== 'undefined') {
    window.Enemy = Enemy;
}

// Particle system rendered into the main game canvas
export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    spawnBurst(x, y, opts) {
        opts = opts || {};
        var count = typeof opts.count === 'number' ? opts.count : 36;
        var color = opts.color || '0,255,240';
        var speedMin = opts.speedMin || 80;
        var speedMax = opts.speedMax || 320;
        var life = opts.life || 0.9;
        for (var i = 0; i < count; i++) {
            var a = Math.random() * Math.PI * 2;
            var s = speedMin + Math.random() * (speedMax - speedMin);
            this.particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.9, r: 2 + Math.random() * 3, t: 0, life: life, color: color });
        }
    }

    update(dt) {
        if (!dt) return;
        for (var i = this.particles.length - 1; i >= 0; i--) {
            var p = this.particles[i];
            p.t += dt;
            if (p.t >= p.life) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }

    draw(ctx) {
        if (!ctx) return;
        for (var i = 0; i < this.particles.length; i++) {
            var p = this.particles[i];
            var lifeRatio = 1 - (p.t / p.life);
            ctx.beginPath();
            ctx.fillStyle = 'rgba(' + p.color + ',' + (0.95 * lifeRatio) + ')';
            ctx.arc(p.x, p.y, p.r * lifeRatio, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

export const particleSystem = new ParticleSystem();
export function spawnParticleBurst(x, y, opts) {
    particleSystem.spawnBurst(x, y, opts);
}

if (typeof window !== 'undefined') {
    window.ParticleSystem = particleSystem;
    window.spawnParticleBurst = spawnParticleBurst;
}

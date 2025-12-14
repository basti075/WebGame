import { Entity } from '../entity.js';
import { Trail } from '../trail.js';
import { PlayerPhysicsController } from './playerPhysics.js';

const PlayerConfig = {
    START_X: 100,
    START_Y: 100,
    SIZE: 32,
    SPEED: 200,
    GRAVITY: 900,
    JUMP_SPEED: 500,
    TERMINAL: 1200,
    JUMP_BUFFER_TIME: 0.12,
    COYOTE_TIME: 0.2,
    WALL_SLIDE_SPEED: 100,
    WALL_JUMP_HORIZONTAL: 300,
    WALL_JUMP_TIME: 0.18
};

export class Player extends Entity {
    constructor({ x, y, size, speed, input, trailColor = '0,255,240' } = {}) {
        super({ x: (typeof x === 'number' ? x : PlayerConfig.START_X), y: (typeof y === 'number' ? y : PlayerConfig.START_Y), size: (typeof size === 'number' ? size : PlayerConfig.SIZE) });
        this.speed = (typeof speed === 'number') ? speed : PlayerConfig.SPEED;
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.lastJumpKeyDown = false;
        this.gravity = PlayerConfig.GRAVITY;
        this.terminal = PlayerConfig.TERMINAL;
        this.jumpSpeed = PlayerConfig.JUMP_SPEED;
        this.wallSlideSpeed = PlayerConfig.WALL_SLIDE_SPEED;
        this.wallJumpHorizontal = PlayerConfig.WALL_JUMP_HORIZONTAL;
        this.wallJumpTimer = 0;
        this.wallJumpTime = PlayerConfig.WALL_JUMP_TIME;
        this.jumpBufferTime = PlayerConfig.JUMP_BUFFER_TIME;
        this.jumpBufferTimer = 0;
        this.coyoteTime = PlayerConfig.COYOTE_TIME;
        this.coyoteTimer = 0;
        this.angle = 0;
        this.angVel = 0;
        this.maxAngVel = Math.PI * 6;
        this.spinAccel = 20;
        this.spinDamping = 6;
        this.jumpSpinDuration = 1.5;
        this.jumpSpinSpeed = (2 * Math.PI) / this.jumpSpinDuration;
        this.jumpSpinActive = false;
        this.doubleJumpUsed = false;
        this.dashSpeed = 520;
        this.dashDuration = 0.18;
        this.dashTimer = 0;
        this.dashVx = 0;
        this.stepInterval = 0.24;
        this.stepDuration = 0.18;
        this.stepAngle = Math.PI / 2;
        this.stepTimer = 0;
        this.stepAnimTimer = 0;
        this.stepAnimRate = 0;
        this.hopHeight = 6;
        this.visualYOffset = 0;
        this.trail = new Trail(20, 0.001, trailColor, 0.5);
        this.physicsController = new PlayerPhysicsController(input);
    }

    update(dt, context, fallbackEnv) {
        var env = null;
        if (context && context.level) {
            env = context.level;
        } else if (typeof fallbackEnv !== 'undefined' && fallbackEnv !== null) {
            env = fallbackEnv;
        } else if (context && context.bounds) {
            env = context.bounds;
        }
        env = env || (context && context.bounds) || null;
        this.trail.update(dt, this.x, this.y - this.visualYOffset, this.angle, this.size);
        this.physicsController.update(this, dt, env);
    }

    draw(ctx) {
        if (!ctx) return;
        this.trail.draw(ctx);
        ctx.save();
        ctx.translate(this.x, this.y - this.visualYOffset);
        ctx.rotate(this.angle || 0);
        var half = this.size / 2;
        ctx.fillStyle = '#041917';
        ctx.fillRect(-half, -half, this.size, this.size);

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var coreGrad = ctx.createLinearGradient(-half, -half, half, half);
        coreGrad.addColorStop(0, 'rgba(0,220,200,1)');
        coreGrad.addColorStop(0.5, 'rgba(0,255,240,1)');
        coreGrad.addColorStop(1, 'rgba(0,220,200,1)');
        ctx.lineWidth = Math.max(2, this.size * 0.16);
        ctx.lineJoin = 'miter';
        ctx.strokeStyle = coreGrad;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(0,255,240,0.95)';
        var inset = ctx.lineWidth / 2;
        ctx.strokeRect(-half + inset, -half + inset, this.size - inset * 2, this.size - inset * 2);
        ctx.restore();

        ctx.save();
        ctx.lineWidth = Math.max(1, this.size * 0.06);
        ctx.strokeStyle = 'rgba(180,255,240,0.95)';
        ctx.shadowBlur = 0;
        ctx.strokeRect(-half + 1.5, -half + 1.5, this.size - 3, this.size - 3);
        ctx.restore();

        ctx.restore();
    }
}

if (typeof window !== 'undefined') {
    window.Player = Player;
}

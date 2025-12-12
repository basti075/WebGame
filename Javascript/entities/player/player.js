(function () {
    // Configurable player defaults
    var PlayerConfig = {
        START_X: 100,
        START_Y: 100,
        SIZE: 32,
        SPEED: 200, // px/s horizontal move speed
        GRAVITY: 900, // px/s^2
        JUMP_SPEED: 500, // px/s initial jump velocity
        TERMINAL: 1200, // max fall speed px/s
        JUMP_BUFFER_TIME: 0.12, // seconds to queue jump input before landing
        COYOTE_TIME: 0.13, // seconds allowed to jump after leaving ground
        WALL_SLIDE_SPEED: 100, // px/s max sliding down a wall
        WALL_JUMP_HORIZONTAL: 300, // px/s horizontal impulse when wall-jumping
        WALL_JUMP_TIME: 0.18 // seconds of forced horizontal after wall-jump
    };

    function Player(x, y, size, speed, jumpSpeed) {
        this.x = (typeof x === 'number') ? x : PlayerConfig.START_X;
        this.y = (typeof y === 'number') ? y : PlayerConfig.START_Y;
        this.size = (typeof size === 'number') ? size : PlayerConfig.SIZE;
        this.speed = (typeof speed === 'number') ? speed : PlayerConfig.SPEED; // px/s
        // physics state
        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.lastJumpKeyDown = false;
        // physics config (exposed per-instance)
        this.gravity = PlayerConfig.GRAVITY;
        this.terminal = PlayerConfig.TERMINAL;
        this.jumpSpeed = (typeof jumpSpeed === 'number') ? jumpSpeed : PlayerConfig.JUMP_SPEED;
        // wall-jump config
        this.wallSlideSpeed = PlayerConfig.WALL_SLIDE_SPEED; // px/s max sliding down a wall
        this.wallJumpHorizontal = PlayerConfig.WALL_JUMP_HORIZONTAL; // px/s horizontal impulse when wall-jumping
        this.wallJumpTimer = 0; // time remaining where horizontal input is ignored and forced vx applies
        this.wallJumpTime = PlayerConfig.WALL_JUMP_TIME;
        // jump buffering (queue jump pressed in air for short time)
        this.jumpBufferTime = PlayerConfig.JUMP_BUFFER_TIME;
        this.jumpBufferTimer = 0;
        // coyote time (allow jump shortly after leaving ground)
        this.coyoteTime = PlayerConfig.COYOTE_TIME;
        this.coyoteTimer = 0;
        // rotation for visual effect (flat-heroes style)
        this.angle = 0; // radians
        this.angVel = 0; // radians per second
        this.maxAngVel = Math.PI * 6; // cap angular velocity
        this.spinAccel = 20; // responsiveness to input
        this.spinDamping = 6; // damping when stopping
        // jump spin: try to do a full 360 during a jump; continues until landing or interrupted by wall
        this.jumpSpinDuration = 1.5; // seconds for one full 360 if jump completes on time
        this.jumpSpinSpeed = (2 * Math.PI) / this.jumpSpinDuration; // radians per second
        this.jumpSpinActive = false; // set true when a jump starts
        // double-jump dash
        this.doubleJumpUsed = false; // whether the extra jump/dash has been consumed
        this.dashSpeed = 520; // horizontal dash velocity for double-jump
        this.dashDuration = 0.18; // how long the dash lasts
        this.dashTimer = 0;
        this.dashVx = 0;
        // ground stepping / small-hop visual
        // tuned for slightly slower step rolls
        this.stepInterval = 0.24; // seconds between steps while running (was 0.18)
        this.stepDuration = 0.18; // animation time for each quarter spin/hop (was 0.12)
        this.stepAngle = Math.PI / 2; // quarter turn per step
        this.stepTimer = 0; // time until next step available
        this.stepAnimTimer = 0; // remaining time for current step animation
        this.stepAnimRate = 0; // angular velocity for current step
        this.hopHeight = 6; // visual hop pixels
        this.visualYOffset = 0; // rendered vertical offset for hop
        // neon trail (extracted to reusable Trail helper)
        this.trail = null; // lazily created if Trail available
        this.trailMax = 20;
        this.trailSpawnInterval = 0.001; // seconds between trail samples

    }

    // env: either bounds {width,height} or a Level instance with isSolidAt(px,py) and tileSize
    Player.prototype.update = function (dt, input, env) {
        // lazy-create trail helper and update it here, then delegate the physics and collision
        if (!this.trail) {
            if (typeof window.Trail === 'function') this.trail = new window.Trail(this.trailMax, this.trailSpawnInterval, '0,255,240', 0.5);
            else this.trail = { update: function () { }, draw: function () { } };
        }
        this.trail.update(dt, this.x, this.y - (this.visualYOffset || 0), this.angle, this.size);

        if (window.PlayerPhysics && typeof window.PlayerPhysics.update === 'function') {
            window.PlayerPhysics.update(this, dt, input, env);
        }
    };

    Player.prototype.draw = function (ctx) {
        if (!ctx) return;
        // draw reusable trail if available
        if (this.trail && typeof this.trail.draw === 'function') this.trail.draw(ctx);

        // draw neon square with layered halo and inset core stroke
        ctx.save();
        ctx.translate(this.x, this.y - (this.visualYOffset || 0));
        ctx.rotate(this.angle || 0);

        var hs = this.size / 2;
        // dark center so neon stroke stands out
        ctx.fillStyle = '#041917';
        ctx.fillRect(-hs, -hs, this.size, this.size);

        // outer soft halo removed (kept inner neon core only)

        // bright neon core stroke
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var coreGrad = ctx.createLinearGradient(-hs, -hs, hs, hs);
        coreGrad.addColorStop(0, 'rgba(0,220,200,1)');
        coreGrad.addColorStop(0.5, 'rgba(0,255,240,1)');
        coreGrad.addColorStop(1, 'rgba(0,220,200,1)');
        ctx.lineWidth = Math.max(2, this.size * 0.16);
        ctx.lineJoin = 'miter';
        ctx.strokeStyle = coreGrad;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(0,255,240,0.95)';
        var insetCore = ctx.lineWidth / 2;
        ctx.strokeRect(-hs + insetCore, -hs + insetCore, this.size - insetCore * 2, this.size - insetCore * 2);
        ctx.restore();



        // thin inner crisp inset
        ctx.save();
        ctx.lineWidth = Math.max(1, this.size * 0.06);
        ctx.strokeStyle = 'rgba(180,255,240,0.95)';
        ctx.shadowBlur = 0;
        ctx.strokeRect(-hs + 1.5, -hs + 1.5, this.size - 3, this.size - 3);
        ctx.restore();

        ctx.restore();
    };

    window.Player = Player;
})();

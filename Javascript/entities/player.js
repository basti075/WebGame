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
    }

    // env: either bounds {width,height} or a Level instance with isSolidAt(px,py) and tileSize
    Player.prototype.update = function (dt, input, env) {
        var half = this.size / 2;

        // determine if env is a level
        var isLevel = !!(env && typeof env.isSolidAt === 'function');
        var ts = isLevel ? env.tileSize : null;

        // horizontal input
        var dir = 0;
        if (input.isDown('ArrowLeft') || input.isDown('KeyA')) dir -= 1;
        if (input.isDown('ArrowRight') || input.isDown('KeyD')) dir += 1;

        // jump input
        var jumpKeyDown = input.isDown('Space') || input.isDown('ArrowUp') || input.isDown('KeyW');
        var jumpEdge = jumpKeyDown && !this.lastJumpKeyDown;
        // decrement jump buffer
        if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
        if (jumpEdge && !this.onGround) this.jumpBufferTimer = this.jumpBufferTime;

        // horizontal velocity
        if (this.wallJumpTimer > 0) {
            // forced vx already stored in this.vx from wall-jump
            this.wallJumpTimer -= dt;
            if (this.wallJumpTimer <= 0) this.vx = 0;
        } else {
            this.vx = dir * this.speed;
        }

        // move horizontally and resolve tile collisions if level provided
        this.x += this.vx * dt;
        var touchingLeft = false, touchingRight = false;
        if (isLevel && ts) {
            var topY = this.y - half + 1;
            var bottomY = this.y + half - 1;
            var leftX = this.x - half;
            if (env.isSolidAt(leftX, topY) || env.isSolidAt(leftX, bottomY)) {
                // collided with left tile; push to right
                var tileX = Math.floor(leftX / ts);
                this.x = (tileX + 1) * ts + half + 0.001;
                touchingLeft = true;
                this.vx = 0;
            }
            var rightX = this.x + half;
            if (env.isSolidAt(rightX, topY) || env.isSolidAt(rightX, bottomY)) {
                var tileX2 = Math.floor(rightX / ts);
                this.x = tileX2 * ts - half - 0.001;
                touchingRight = true;
                this.vx = 0;
            }
        }

        // ensure vertical velocity exists
        if (this.vy === undefined) this.vy = 0;

        // apply gravity
        this.vy += this.gravity * dt;
        if (this.vy > this.terminal) this.vy = this.terminal;

        // move vertically and resolve collisions
        this.y += this.vy * dt;
        if (isLevel && ts) {
            var leftX2 = this.x - half + 1;
            var rightX2 = this.x + half - 1;
            var bottomY2 = this.y + half;
            var topY2 = this.y - half;
            var landed = false;

            var eps = 0.001;
            var spanLeft = this.x - half + eps;
            var spanRight = this.x + half - eps;
            var txMin = Math.floor(spanLeft / ts);
            var txMax = Math.floor(spanRight / ts);

            // bottom / landing check
            var tileRowBottom = Math.floor(bottomY2 / ts);
            var foundBottom = false;
            for (var tx = txMin; tx <= txMax; tx++) {
                var sampleX = (tx + 0.5) * ts;
                if (env.isSolidAt(sampleX, bottomY2)) { foundBottom = true; break; }
            }
            if (foundBottom) {
                this.y = tileRowBottom * ts - half - 0.001;
                this.vy = 0;
                this.onGround = true;
                this.coyoteTimer = this.coyoteTime; // reset coyote when we land
                landed = true;
            } else {
                // ceiling check
                var tileRowTop = Math.floor(topY2 / ts);
                var foundTop = false;
                for (var tx2 = txMin; tx2 <= txMax; tx2++) {
                    var sampleX2 = (tx2 + 0.5) * ts;
                    if (env.isSolidAt(sampleX2, topY2)) { foundTop = true; break; }
                }
                if (foundTop) {
                    this.y = (tileRowTop + 1) * ts + half + 0.001;
                    this.vy = 0;
                } else {
                    if (!landed) this.onGround = false;
                }
            }

            // decrement coyote timer when not on ground
            if (!this.onGround) this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

            // wall-stick / wall-slide detection
            var pressingLeft = input.isDown('ArrowLeft') || input.isDown('KeyA');
            var pressingRight = input.isDown('ArrowRight') || input.isDown('KeyD');
            var wallStick = false;
            if (!this.onGround) {
                if (touchingLeft && pressingLeft) wallStick = 'left';
                else if (touchingRight && pressingRight) wallStick = 'right';
            }

            if (wallStick) {
                if (this.vy > this.wallSlideSpeed) this.vy = this.wallSlideSpeed;
                if (jumpEdge) {
                    this.vy = -this.jumpSpeed;
                    this.vx = (wallStick === 'left') ? this.wallJumpHorizontal : -this.wallJumpHorizontal;
                    this.wallJumpTimer = this.wallJumpTime;
                    this.onGround = false;
                    this.jumpBufferTimer = 0;
                }
            } else {
                // allow jump if on ground or within coyote time
                var canJumpNow = this.onGround || this.coyoteTimer > 0;
                if ((jumpEdge && canJumpNow) || (canJumpNow && this.jumpBufferTimer > 0)) {
                    this.vy = -this.jumpSpeed;
                    this.onGround = false;
                    this.coyoteTimer = 0; // consume coyote
                    this.jumpBufferTimer = 0;
                }
            }

            // if we just landed and had a buffered jump, trigger it
            if ((this.onGround || this.coyoteTimer > 0) && this.jumpBufferTimer > 0) {
                this.vy = -this.jumpSpeed;
                this.onGround = false;
                this.coyoteTimer = 0;
                this.jumpBufferTimer = 0;
            }

            this.lastJumpKeyDown = jumpKeyDown;
        } else {
            // fallback: use bounds-like object if provided
            var bounds = env;
            if (bounds && typeof bounds.width === 'number' && typeof bounds.height === 'number') {
                var minX = half;
                var maxX = Math.max(minX, bounds.width - half);
                var minY = half;
                var maxY = Math.max(minY, bounds.height - half);

                if (this.x < minX) { this.x = minX; touchingLeft = true; }
                if (this.x > maxX) { this.x = maxX; touchingRight = true; }

                if (this.y > maxY) {
                    this.y = maxY; this.vy = 0; this.onGround = true; this.coyoteTimer = this.coyoteTime;
                } else if (this.y < minY) {
                    this.y = minY; this.vy = 0;
                } else {
                    if (this.y < maxY - 0.001) this.onGround = false;
                }

                // decrement coyote timer when not on ground (bounds fallback)
                if (!this.onGround) this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

                var pressingLeft = input.isDown('ArrowLeft') || input.isDown('KeyA');
                var pressingRight = input.isDown('ArrowRight') || input.isDown('KeyD');
                var wallStick = false;
                if (!this.onGround) {
                    if (touchingLeft && pressingLeft) wallStick = 'left';
                    else if (touchingRight && pressingRight) wallStick = 'right';
                }

                if (wallStick) {
                    if (this.vy > this.wallSlideSpeed) this.vy = this.wallSlideSpeed;
                    if (jumpEdge) {
                        this.vy = -this.jumpSpeed;
                        this.vx = (wallStick === 'left') ? this.wallJumpHorizontal : -this.wallJumpHorizontal;
                        this.wallJumpTimer = this.wallJumpTime;
                        this.onGround = false;
                        this.jumpBufferTimer = 0;
                    }
                } else {
                    var canJumpNow2 = this.onGround || this.coyoteTimer > 0;
                    if ((jumpEdge && canJumpNow2) || (canJumpNow2 && this.jumpBufferTimer > 0)) {
                        this.vy = -this.jumpSpeed;
                        this.onGround = false;
                        this.coyoteTimer = 0;
                        this.jumpBufferTimer = 0;
                    }
                }

                if ((this.onGround || this.coyoteTimer > 0) && this.jumpBufferTimer > 0) {
                    this.vy = -this.jumpSpeed; this.onGround = false; this.coyoteTimer = 0; this.jumpBufferTimer = 0;
                }

                this.lastJumpKeyDown = jumpKeyDown;
            }
        }
    };

    Player.prototype.draw = function (ctx) {
        ctx.fillStyle = '#0af';
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    };

    window.Player = Player;
})();

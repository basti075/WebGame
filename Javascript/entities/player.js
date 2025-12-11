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
            // if we hit a wall, ensure a flat side is aligned with it and stop jump-spin
            if (touchingLeft || touchingRight) {
                var qWall = Math.round(this.angle / (Math.PI / 2));
                this.angle = qWall * (Math.PI / 2);
                // cancel jump-spin if we hit a wall mid-air
                this.jumpSpinActive = false;
                this.angVel = 0;
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
                var wasGround = this.onGround;
                this.y = tileRowBottom * ts - half - 0.001;
                this.vy = 0;
                this.onGround = true;
                this.coyoteTimer = this.coyoteTime; // reset coyote when we land
                landed = true;
                // stop any jump-spin when we land
                this.jumpSpinActive = false;
                this.angVel = 0;
                // if we just landed this frame, snap angle to nearest quarter to ensure flat side
                if (!wasGround) {
                    var quarter = Math.round(this.angle / (Math.PI / 2));
                    this.angle = quarter * (Math.PI / 2);
                }
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
            // wall-stick / wall-slide detection

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
                    // start jump-spin on wall-jump
                    this.jumpSpinActive = true;
                    var spinSign = (this.vx >= 0) ? 1 : -1;
                    this.angVel = spinSign * this.jumpSpinSpeed;
                }
            } else {
                // allow jump if on ground or within coyote time
                var canJumpNow = this.onGround || this.coyoteTimer > 0;
                if ((jumpEdge && canJumpNow) || (canJumpNow && this.jumpBufferTimer > 0)) {
                    this.vy = -this.jumpSpeed;
                    this.onGround = false;
                    this.coyoteTimer = 0; // consume coyote
                    this.jumpBufferTimer = 0;
                    // start jump-spin on normal jump
                    this.jumpSpinActive = true;
                    var spinSign2 = (this.vx >= 0) ? 1 : -1;
                    this.angVel = spinSign2 * this.jumpSpinSpeed;
                    // start leaving ground: nothing special (no big flip)
                }
            }

            // if we just landed and had a buffered jump, trigger it
            if ((this.onGround || this.coyoteTimer > 0) && this.jumpBufferTimer > 0) {
                this.vy = -this.jumpSpeed;
                this.onGround = false;
                this.coyoteTimer = 0;
                this.jumpBufferTimer = 0;
                // start jump-spin on buffered jump
                this.jumpSpinActive = true;
                var spinSign3 = (this.vx >= 0) ? 1 : -1;
                this.angVel = spinSign3 * this.jumpSpinSpeed;
            }

            // ground behavior: stepping and rolling
            if (this.onGround) {
                // decrement step timer
                this.stepTimer = Math.max(0, this.stepTimer - dt);
                var moving = Math.abs(this.vx) > 1e-3;
                if (moving) {
                    // when ready, trigger a step: animate quarter-turn and hop
                    if (this.stepTimer <= 0 && this.stepAnimTimer <= 0) {
                        var dirSign = (this.vx > 0) ? 1 : -1;
                        this.stepAnimRate = dirSign * (this.stepAngle / this.stepDuration);
                        this.stepAnimTimer = this.stepDuration;
                        this.stepTimer = this.stepInterval;
                    }
                } else {
                    // not moving: slowly snap to nearest flat side
                    var target = Math.round(this.angle / (Math.PI / 2)) * (Math.PI / 2);
                    var snapLerp = 1 - Math.exp(-10 * dt);
                    this.angle += (target - this.angle) * snapLerp;
                }

                // step animation
                if (this.stepAnimTimer > 0) {
                    this.angle += this.stepAnimRate * dt;
                    // visual hop: use sine progress for smooth up/down
                    var t = 1 - (this.stepAnimTimer / this.stepDuration);
                    this.visualYOffset = Math.sin(t * Math.PI) * this.hopHeight;
                    this.stepAnimTimer = Math.max(0, this.stepAnimTimer - dt);
                    if (this.stepAnimTimer <= 0) {
                        this.stepAnimRate = 0;
                        this.visualYOffset = 0;
                        // ensure angle snapped to quarter after step for flat landing
                        var q = Math.round(this.angle / (Math.PI / 2));
                        this.angle = q * (Math.PI / 2);
                    }
                }
            } else {
                // airborne: if a jump-spin is active, keep that constant spin until landing or interruption
                if (this.jumpSpinActive) {
                    this.angle += this.angVel * dt;
                } else {
                    // simple rolling proportional to horizontal speed
                    var desiredAng = (this.vx > 0 ? 1 : -1) * Math.min(this.maxAngVel, Math.abs(this.vx) / this.size * 2);
                    var spinLerp = 1 - Math.exp(-this.spinAccel * dt);
                    this.angVel += (desiredAng - this.angVel) * spinLerp;
                    this.angVel *= Math.max(0, 1 - this.spinDamping * dt);
                    if (this.angVel > this.maxAngVel) this.angVel = this.maxAngVel;
                    if (this.angVel < -this.maxAngVel) this.angVel = -this.maxAngVel;
                    this.angle += this.angVel * dt;
                }
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
                // if we contacted bounds walls, snap to nearest quarter so a flat side aligns
                if (touchingLeft || touchingRight) {
                    var qWallB = Math.round(this.angle / (Math.PI / 2));
                    this.angle = qWallB * (Math.PI / 2);
                    // cancel jump-spin if hitting a bounds wall mid-air
                    this.jumpSpinActive = false;
                    this.angVel = 0;
                }

                var wasGroundB = this.onGround;
                if (this.y > maxY) {
                    this.y = maxY; this.vy = 0; this.onGround = true; this.coyoteTimer = this.coyoteTime;
                    if (!wasGroundB) {
                        this.flipRate += this.flipOnLandAngle / this.flipDuration;
                        this.flipTimer = Math.max(this.flipTimer, this.flipDuration);
                    }
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
                        // start jump-spin on wall-jump (bounds)
                        this.jumpSpinActive = true;
                        var spinSignW = (this.vx >= 0) ? 1 : -1;
                        this.angVel = spinSignW * this.jumpSpinSpeed;
                    }
                } else {
                    var canJumpNow2 = this.onGround || this.coyoteTimer > 0;
                    if ((jumpEdge && canJumpNow2) || (canJumpNow2 && this.jumpBufferTimer > 0)) {
                        this.vy = -this.jumpSpeed;
                        this.onGround = false;
                        this.coyoteTimer = 0;
                        this.jumpBufferTimer = 0;
                        // flip on jump (bounds)
                        this.flipRate += this.flipOnJumpAngle / this.flipDuration;
                        this.flipTimer = Math.max(this.flipTimer, this.flipDuration);
                        // start jump-spin on bounds jump
                        this.jumpSpinActive = true;
                        var spinSignB = (this.vx >= 0) ? 1 : -1;
                        this.angVel = spinSignB * this.jumpSpinSpeed;
                    }
                }

                if ((this.onGround || this.coyoteTimer > 0) && this.jumpBufferTimer > 0) {
                    this.vy = -this.jumpSpeed; this.onGround = false; this.coyoteTimer = 0; this.jumpBufferTimer = 0;
                    // flip on buffered jump
                    this.flipRate += this.flipOnJumpAngle / this.flipDuration;
                    this.flipTimer = Math.max(this.flipTimer, this.flipDuration);
                    // start jump-spin on buffered bounds jump
                    this.jumpSpinActive = true;
                    var spinSignBB = (this.vx >= 0) ? 1 : -1;
                    this.angVel = spinSignBB * this.jumpSpinSpeed;
                }

                // apply rolling + flip updates (same as level branch)
                if (this.jumpSpinActive) {
                    // maintain jump spin until landing
                    this.angle += this.angVel * dt;
                } else {
                    var desiredAngB = -2 * this.vx / this.size;
                    var spinLerpB = 1 - Math.exp(-this.spinAccel * dt);
                    this.angVel += (desiredAngB - this.angVel) * spinLerpB;
                    this.angVel *= Math.max(0, 1 - this.spinDamping * dt);
                    if (this.angVel > this.maxAngVel) this.angVel = this.maxAngVel;
                    if (this.angVel < -this.maxAngVel) this.angVel = -this.maxAngVel;
                    if (this.flipTimer > 0) {
                        this.angle += this.flipRate * dt;
                        this.flipTimer = Math.max(0, this.flipTimer - dt);
                        if (this.flipTimer <= 0) this.flipRate = 0;
                    }
                    this.angle += this.angVel * dt;
                }

                this.lastJumpKeyDown = jumpKeyDown;
            }
        }
    };

    Player.prototype.draw = function (ctx) {
        if (!ctx) return;
        ctx.save();
        // apply visual Y offset for small hop during step animation
        ctx.translate(this.x, this.y - (this.visualYOffset || 0));
        ctx.rotate(this.angle || 0);
        ctx.fillStyle = '#0af';
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    };

    window.Player = Player;
})();

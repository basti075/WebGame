// Minimal player entity: a controllable square
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
    }

    // bounds: optional { width, height }
    Player.prototype.update = function (dt, input, bounds) {
        // horizontal input
        var vx = 0;
        if (input.isDown('ArrowLeft') || input.isDown('KeyA')) vx -= 1;
        if (input.isDown('ArrowRight') || input.isDown('KeyD')) vx += 1;

        // horizontal movement: if we are in a wall-jump forced period, apply forced vx
        if (this.wallJumpTimer > 0) {
            this.x += this.vx * dt;
            this.wallJumpTimer -= dt;
            if (this.wallJumpTimer <= 0) this.vx = 0;
        } else {
            this.x += vx * this.speed * dt;
        }

        // ensure vertical velocity exists
        if (this.vy === undefined) this.vy = 0;

        // apply gravity
        this.vy += this.gravity * dt;
        if (this.vy > this.terminal) this.vy = this.terminal;

        // jump (edge-detect) - we'll handle normal jump and wall-jump below after wall detection
        var jumpKeyDown = input.isDown('Space') || input.isDown('ArrowUp') || input.isDown('KeyW');

        // integrate vertical
        this.y += this.vy * dt;

        // clamp to bounds if provided (keep player fully inside)
        if (bounds && typeof bounds.width === 'number' && typeof bounds.height === 'number') {
            var half = this.size / 2;
            var minX = half;
            var maxX = Math.max(minX, bounds.width - half);
            var minY = half;
            var maxY = Math.max(minY, bounds.height - half);

            // horizontal clamp and wall detection
            var touchingLeft = false, touchingRight = false;
            if (this.x < minX) { this.x = minX; touchingLeft = true; }
            if (this.x > maxX) { this.x = maxX; touchingRight = true; }

            // vertical clamp + ground detection
            if (this.y > maxY) {
                // landed on ground
                this.y = maxY;
                this.vy = 0;
                this.onGround = true;
            } else if (this.y < minY) {
                // ceiling
                this.y = minY;
                this.vy = 0;
            } else {
                // in air
                if (this.y < maxY - 0.001) this.onGround = false;
            }

            // wall-stick / wall-slide detection: require touching side and pressing into it while airborne
            var pressingLeft = input.isDown('ArrowLeft') || input.isDown('KeyA');
            var pressingRight = input.isDown('ArrowRight') || input.isDown('KeyD');
            var wallStick = false;
            if (!this.onGround) {
                if (touchingLeft && pressingLeft) wallStick = 'left';
                else if (touchingRight && pressingRight) wallStick = 'right';
            }

            // if wall-sticking, limit downward speed (slide) and allow wall-jump
            if (wallStick) {
                if (this.vy > this.wallSlideSpeed) this.vy = this.wallSlideSpeed;
                // wall-jump when jump key is pressed (edge-detect)
                if (jumpKeyDown && !this.lastJumpKeyDown) {
                    // perform wall-jump away from wall
                    this.vy = -this.jumpSpeed;
                    // horizontal impulse away from wall
                    this.vx = (wallStick === 'left') ? this.wallJumpHorizontal : -this.wallJumpHorizontal;
                    this.wallJumpTimer = this.wallJumpTime; // small period where forced vx applies
                    this.onGround = false;
                }
            } else {
                // normal jump from ground
                if (jumpKeyDown && !this.lastJumpKeyDown && this.onGround) {
                    this.vy = -this.jumpSpeed;
                    this.onGround = false;
                }
            }

            this.lastJumpKeyDown = jumpKeyDown;
        }
    };

    Player.prototype.draw = function (ctx) {
        ctx.fillStyle = '#0af';
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    };

    window.Player = Player;
})();

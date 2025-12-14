import { sampleYRange, sampleXRange, snapPlayerToLeftOfTile, snapPlayerToRightOfTile } from './collision.js';
import { PlayerAnimation } from './animation.js';

export class PlayerPhysicsController {
    constructor(inputManager) {
        this.input = inputManager;
    }

    update(player, dt, env) {
        var half = player.size / 2;
        var level = env && typeof env.isSolidAt === 'function' ? env : null;
        var tileSize = level ? level.tileSize : null;
        var dir = this._readHorizontalInput();
        var jumpState = this._readJumpState(player, dt);

        this._updateDash(player, dt);
        this._applyHorizontalVelocity(player, dir, dt);
        var wallContacts = level ? this._resolveHorizontal(level, player, half, tileSize) : this._clampToBounds(player, env, half);

        this._applyGravity(player, dt);
        level ? this._resolveVertical(level, player, half, tileSize, dt) : this._resolveBoundsVertical(player, env, half, dt);

        this._handleWallSlideAndJumps(player, dir, jumpState, wallContacts);
        this._consumeJumpBufferOnLanding(player);
        PlayerAnimation.update(player, dt, dir);
        player.lastJumpKeyDown = jumpState.isHeld;
    }

    _readHorizontalInput() {
        var dir = 0;
        if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA')) dir -= 1;
        if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD')) dir += 1;
        return dir;
    }

    _readJumpState(player, dt) {
        var isHeld = this.input.isDown('Space') || this.input.isDown('ArrowUp') || this.input.isDown('KeyW');
        var edge = isHeld && !player.lastJumpKeyDown;
        if (player.jumpBufferTimer > 0) player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
        if (edge && !player.onGround) player.jumpBufferTimer = player.jumpBufferTime;
        return { isHeld: isHeld, edge: edge };
    }

    _updateDash(player, dt) {
        if (player.dashTimer > 0) {
            player.dashTimer = Math.max(0, player.dashTimer - dt);
            if (player.dashTimer <= 0) {
                player.dashVx = 0;
            }
        }
    }

    _applyHorizontalVelocity(player, dir, dt) {
        if (player.wallJumpTimer > 0) {
            player.wallJumpTimer -= dt;
            if (player.wallJumpTimer <= 0) player.vx = 0;
        } else if (player.dashTimer > 0) {
            player.vx = player.dashVx;
        } else {
            player.vx = dir * player.speed;
        }
        player.x += player.vx * dt;
    }

    _resolveHorizontal(level, player, half, tileSize) {
        var topY = player.y - half + 1;
        var bottomY = player.y + half - 1;
        var touching = { left: false, right: false };

        var leftX = player.x - half;
        if (sampleYRange(level, leftX, topY + 0.001, bottomY - 0.001, 5)) {
            snapPlayerToLeftOfTile(player, leftX, tileSize);
            touching.left = true;
            player.vx = 0;
        }

        var rightX = player.x + half;
        if (sampleYRange(level, rightX, topY + 0.001, bottomY - 0.001, 5)) {
            snapPlayerToRightOfTile(player, rightX, tileSize);
            touching.right = true;
            player.vx = 0;
        }

        if (touching.left || touching.right) {
            this._snapRotationToQuarter(player);
            this._cancelAerialEffects(player);
        }

        return touching;
    }

    _clampToBounds(player, bounds, half) {
        var touching = { left: false, right: false };
        if (!bounds) return touching;
        var minX = half;
        var maxX = Math.max(minX, bounds.width - half);
        if (player.x < minX) { player.x = minX; touching.left = true; }
        if (player.x > maxX) { player.x = maxX; touching.right = true; }
        if (touching.left || touching.right) {
            this._snapRotationToQuarter(player);
            this._cancelAerialEffects(player);
        }
        return touching;
    }

    _applyGravity(player, dt) {
        player.vy = (player.vy || 0) + player.gravity * dt;
        if (player.vy > player.terminal) player.vy = player.terminal;
        player.y += player.vy * dt;
    }

    _resolveVertical(level, player, half, tileSize, dt) {
        var spanLeft = player.x - half + 0.001;
        var spanRight = player.x + half - 0.001;
        var sampleCount = Math.max(1, Math.floor((spanRight - spanLeft) / tileSize) + 1);
        var bottomY = player.y + half;
        var topY = player.y - half;
        var landing = false;

        if (sampleXRange(level, bottomY, spanLeft, spanRight, sampleCount)) {
            var tileRowBottom = Math.floor(bottomY / tileSize);
            player.y = tileRowBottom * tileSize - half - 0.001;
            player.vy = 0;
            landing = true;
            this._onLanding(player);
        } else if (sampleXRange(level, topY, spanLeft, spanRight, sampleCount)) {
            var tileRowTop = Math.floor(topY / tileSize);
            player.y = (tileRowTop + 1) * tileSize + half + 0.001;
            player.vy = 0;
            player.onGround = false;
        } else {
            player.onGround = false;
            player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
        }
        return { landing: landing };
    }

    _resolveBoundsVertical(player, bounds, half, dt) {
        if (!bounds) return { landing: false };
        var minY = half;
        var maxY = Math.max(minY, bounds.height - half);
        if (player.y > maxY) {
            player.y = maxY;
            player.vy = 0;
            this._onLanding(player);
            return { landing: true };
        }
        if (player.y < minY) {
            player.y = minY;
            player.vy = 0;
        } else {
            player.onGround = false;
            player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
        }
        return { landing: false };
    }

    _handleWallSlideAndJumps(player, dir, jumpState, wallContacts) {
        var pressingLeft = this.input.isDown('ArrowLeft') || this.input.isDown('KeyA');
        var pressingRight = this.input.isDown('ArrowRight') || this.input.isDown('KeyD');
        var wallStick = null;
        if (!player.onGround) {
            if (wallContacts.left && pressingLeft) wallStick = 'left';
            if (wallContacts.right && pressingRight) wallStick = 'right';
        }

        if (wallStick) {
            if (player.vy > player.wallSlideSpeed) player.vy = player.wallSlideSpeed;
            if (jumpState.edge) {
                player.vy = -player.jumpSpeed;
                player.vx = (wallStick === 'left') ? player.wallJumpHorizontal : -player.wallJumpHorizontal;
                player.wallJumpTimer = player.wallJumpTime;
                player.onGround = false;
                player.jumpBufferTimer = 0;
                player.doubleJumpUsed = false;
                this._startJumpSpin(player, player.vx >= 0 ? 1 : -1);
            }
            return;
        }

        var canJump = player.onGround || player.coyoteTimer > 0;
        if ((jumpState.edge && canJump) || (canJump && player.jumpBufferTimer > 0)) {
            player.vy = -player.jumpSpeed;
            player.onGround = false;
            player.coyoteTimer = 0;
            player.jumpBufferTimer = 0;
            player.doubleJumpUsed = false;
            this._startJumpSpin(player, player.vx >= 0 ? 1 : -1);
            return;
        }

        if (jumpState.edge && !canJump && !player.doubleJumpUsed) {
            var dashDir = dir !== 0 ? dir : (player.vx >= 0 ? 1 : -1);
            player.dashTimer = player.dashDuration;
            player.dashVx = dashDir * player.dashSpeed;
            player.vx = player.dashVx;
            player.vy = -player.jumpSpeed * 0.62;
            player.doubleJumpUsed = true;
            this._startJumpSpin(player, dashDir >= 0 ? 1 : -1);
        }
    }

    _consumeJumpBufferOnLanding(player) {
        if ((player.onGround || player.coyoteTimer > 0) && player.jumpBufferTimer > 0) {
            player.vy = -player.jumpSpeed;
            player.onGround = false;
            player.coyoteTimer = 0;
            player.jumpBufferTimer = 0;
            this._startJumpSpin(player, player.vx >= 0 ? 1 : -1);
        }
    }

    _onLanding(player) {
        var wasGround = player.onGround;
        player.vy = 0;
        player.onGround = true;
        player.coyoteTimer = player.coyoteTime;
        player.doubleJumpUsed = false;
        player.dashTimer = 0;
        player.dashVx = 0;
        player.jumpSpinActive = false;
        player.angVel = 0;
        if (!wasGround) this._snapRotationToQuarter(player);
    }

    _snapRotationToQuarter(player) {
        var quarter = Math.round(player.angle / (Math.PI / 2));
        player.angle = quarter * (Math.PI / 2);
    }

    _cancelAerialEffects(player) {
        player.jumpSpinActive = false;
        player.angVel = 0;
        player.dashTimer = 0;
        player.dashVx = 0;
        player.doubleJumpUsed = true;
    }

    _startJumpSpin(player, direction) {
        player.jumpSpinActive = true;
        player.angVel = direction * player.jumpSpinSpeed;
    }
}

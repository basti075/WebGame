(function () {
    // PlayerPhysics.update(player, dt, input, env)
    var PlayerPhysics = {};

    PlayerPhysics.update = function (player, dt, input, env) {
        var half = player.size / 2;

        // determine if env is a level
        var isLevel = !!(env && typeof env.isSolidAt === 'function');
        var ts = isLevel ? env.tileSize : null;

        // horizontal input
        var dir = 0;
        if (input.isDown('ArrowLeft') || input.isDown('KeyA')) dir -= 1;
        if (input.isDown('ArrowRight') || input.isDown('KeyD')) dir += 1;

        // jump input
        var jumpKeyDown = input.isDown('Space') || input.isDown('ArrowUp') || input.isDown('KeyW');
        var jumpEdge = jumpKeyDown && !player.lastJumpKeyDown;
        // decrement jump buffer
        if (player.jumpBufferTimer > 0) player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);
        if (jumpEdge && !player.onGround) player.jumpBufferTimer = player.jumpBufferTime;

        // decrement dash timer
        if (player.dashTimer > 0) {
            player.dashTimer = Math.max(0, player.dashTimer - dt);
            if (player.dashTimer <= 0) {
                player.dashVx = 0;
            }
        }

        // horizontal velocity
        if (player.wallJumpTimer > 0) {
            // forced vx already stored in player.vx from wall-jump
            player.wallJumpTimer -= dt;
            if (player.wallJumpTimer <= 0) player.vx = 0;
        } else if (player.dashTimer > 0) {
            // keep dash velocity while active
            player.vx = player.dashVx;
        } else {
            player.vx = dir * player.speed;
        }

        // move horizontally and resolve tile collisions if level provided
        player.x += player.vx * dt;
        var touchingLeft = false, touchingRight = false;
        if (isLevel && ts) {
            var topY = player.y - half + 1;
            var bottomY = player.y + half - 1;
            var leftX = player.x - half;
            // use collision helper to sample Y range on both sides
            var sampleCountY = 5;
            var foundLeft = false;
            if (window.Collision && typeof window.Collision.sampleYRange === 'function') {
                foundLeft = window.Collision.sampleYRange(env, leftX, topY + 0.001, bottomY - 0.001, sampleCountY);
            } else {
                // fallback to single tests
                if (env.isSolidAt(leftX, topY) || env.isSolidAt(leftX, bottomY)) foundLeft = true;
            }
            if (foundLeft) {
                if (window.Collision && window.Collision.snapPlayerToLeftOfTile) window.Collision.snapPlayerToLeftOfTile(player, leftX, ts);
                else {
                    var tileX = Math.floor(leftX / ts);
                    player.x = (tileX + 1) * ts + half + 0.001;
                }
                touchingLeft = true;
                player.vx = 0;
            }

            var rightX = player.x + half;
            var foundRight = false;
            if (window.Collision && typeof window.Collision.sampleYRange === 'function') {
                foundRight = window.Collision.sampleYRange(env, rightX, topY + 0.001, bottomY - 0.001, sampleCountY);
            } else {
                if (env.isSolidAt(rightX, topY) || env.isSolidAt(rightX, bottomY)) foundRight = true;
            }
            if (foundRight) {
                if (window.Collision && window.Collision.snapPlayerToRightOfTile) window.Collision.snapPlayerToRightOfTile(player, rightX, ts);
                else {
                    var tileX2 = Math.floor(rightX / ts);
                    player.x = tileX2 * ts - half - 0.001;
                }
                touchingRight = true;
                player.vx = 0;
            }
            // if we hit a wall, ensure a flat side is aligned with it and stop jump-spin/dash
            if (touchingLeft || touchingRight) {
                var qWall = Math.round(player.angle / (Math.PI / 2));
                player.angle = qWall * (Math.PI / 2);
                // cancel jump-spin if we hit a wall mid-air
                player.jumpSpinActive = false;
                player.angVel = 0;
                // cancel any active dash and mark double-jump consumed
                player.dashTimer = 0;
                player.dashVx = 0;
                player.doubleJumpUsed = true;
            }
        }

        // ensure vertical velocity exists
        if (player.vy === undefined) player.vy = 0;

        // apply gravity
        player.vy += player.gravity * dt;
        if (player.vy > player.terminal) player.vy = player.terminal;

        // move vertically and resolve collisions
        player.y += player.vy * dt;
        if (isLevel && ts) {
            var leftX2 = player.x - half + 1;
            var rightX2 = player.x + half - 1;
            var bottomY2 = player.y + half;
            var topY2 = player.y - half;
            var landed = false;

            var eps = 0.001;
            var spanLeft = player.x - half + eps;
            var spanRight = player.x + half - eps;
            var txMin = Math.floor(spanLeft / ts);
            var txMax = Math.floor(spanRight / ts);

            // bottom / landing check (sample across X span)
            var tileRowBottom = Math.floor(bottomY2 / ts);
            var spanLeft = player.x - half + eps;
            var spanRight = player.x + half - eps;
            var sampleCountX = Math.max(1, txMax - txMin + 1);
            var foundBottom = false;
            if (window.Collision && typeof window.Collision.sampleXRange === 'function') {
                foundBottom = window.Collision.sampleXRange(env, bottomY2, spanLeft, spanRight, sampleCountX);
            } else {
                for (var tx = txMin; tx <= txMax; tx++) {
                    var sampleX = (tx + 0.5) * ts;
                    if (env.isSolidAt(sampleX, bottomY2)) { foundBottom = true; break; }
                }
            }
            if (foundBottom) {
                var wasGround = player.onGround;
                player.y = tileRowBottom * ts - half - 0.001;
                player.vy = 0;
                player.onGround = true;
                player.coyoteTimer = player.coyoteTime; // reset coyote when we land
                landed = true;
                // stop any jump-spin when we land
                player.jumpSpinActive = false;
                player.angVel = 0;
                // reset double-jump/dash availability and cancel any dash
                player.doubleJumpUsed = false;
                player.dashTimer = 0;
                player.dashVx = 0;
                // if we just landed this frame, snap angle to nearest quarter to ensure flat side
                if (!wasGround) {
                    var quarter = Math.round(player.angle / (Math.PI / 2));
                    player.angle = quarter * (Math.PI / 2);
                }
            } else {
                // ceiling check
                var tileRowTop = Math.floor(topY2 / ts);
                var sampleCountTop = Math.max(1, txMax - txMin + 1);
                var foundTop = false;
                if (window.Collision && typeof window.Collision.sampleXRange === 'function') {
                    foundTop = window.Collision.sampleXRange(env, topY2, spanLeft, spanRight, sampleCountTop);
                } else {
                    for (var tx2 = txMin; tx2 <= txMax; tx2++) {
                        var sampleX2 = (tx2 + 0.5) * ts;
                        if (env.isSolidAt(sampleX2, topY2)) { foundTop = true; break; }
                    }
                }
                if (foundTop) {
                    player.y = (tileRowTop + 1) * ts + half + 0.001;
                    player.vy = 0;
                } else {
                    if (!landed) player.onGround = false;
                }
            }
            // wall-stick / wall-slide detection

            // wall-stick / wall-slide detection
            var pressingLeft = input.isDown('ArrowLeft') || input.isDown('KeyA');
            var pressingRight = input.isDown('ArrowRight') || input.isDown('KeyD');
            var wallStick = false;
            if (!player.onGround) {
                if (touchingLeft && pressingLeft) wallStick = 'left';
                else if (touchingRight && pressingRight) wallStick = 'right';
            }

            if (wallStick) {
                if (player.vy > player.wallSlideSpeed) player.vy = player.wallSlideSpeed;
                if (jumpEdge) {
                    player.vy = -player.jumpSpeed;
                    player.vx = (wallStick === 'left') ? player.wallJumpHorizontal : -player.wallJumpHorizontal;
                    player.wallJumpTimer = player.wallJumpTime;
                    player.onGround = false;
                    player.jumpBufferTimer = 0;
                    // allow a fresh dash after wall-jump
                    player.doubleJumpUsed = false;
                    // start jump-spin on wall-jump
                    player.jumpSpinActive = true;
                    var spinSign = (player.vx >= 0) ? 1 : -1;
                    player.angVel = spinSign * player.jumpSpinSpeed;
                }
            } else {
                // allow jump if on ground or within coyote time
                var canJumpNow = player.onGround || player.coyoteTimer > 0;
                if ((jumpEdge && canJumpNow) || (canJumpNow && player.jumpBufferTimer > 0)) {
                    player.vy = -player.jumpSpeed;
                    player.onGround = false;
                    player.coyoteTimer = 0; // consume coyote
                    player.jumpBufferTimer = 0;
                    // reset double-jump availability for this jump (allow one extra dash)
                    player.doubleJumpUsed = false;
                    // start jump-spin on normal jump
                    player.jumpSpinActive = true;
                    var spinSign2 = (player.vx >= 0) ? 1 : -1;
                    player.angVel = spinSign2 * player.jumpSpinSpeed;
                    // start leaving ground: nothing special (no big flip)
                } else if (jumpEdge && !canJumpNow && !player.doubleJumpUsed) {
                    // perform double-jump dash in direction pressed
                    var dashDir = dir;
                    if (dashDir === 0) dashDir = (player.vx >= 0) ? 1 : -1;
                    player.dashTimer = player.dashDuration;
                    player.dashVx = dashDir * player.dashSpeed;
                    player.vx = player.dashVx;
                    // give a smaller upward boost for the double-jump
                    player.vy = -player.jumpSpeed * 0.62;
                    player.doubleJumpUsed = true;
                    // start jump-spin on double jump
                    player.jumpSpinActive = true;
                    player.angVel = (dashDir >= 0 ? 1 : -1) * player.jumpSpinSpeed;
                }
            }

            // if we just landed and had a buffered jump, trigger it
            if ((player.onGround || player.coyoteTimer > 0) && player.jumpBufferTimer > 0) {
                player.vy = -player.jumpSpeed;
                player.onGround = false;
                player.coyoteTimer = 0;
                player.jumpBufferTimer = 0;
                // start jump-spin on buffered jump
                player.jumpSpinActive = true;
                var spinSign3 = (player.vx >= 0) ? 1 : -1;
                player.angVel = spinSign3 * player.jumpSpinSpeed;
            }

            // animation updated by helper
            if (window.Animation && typeof window.Animation.update === 'function') {
                window.Animation.update(player, dt, dir);
            }

            // trail sampling already handled above; update last key state
            player.lastJumpKeyDown = jumpKeyDown;
        } else {
            // fallback: use bounds-like object if provided
            var bounds = env;
            if (bounds && typeof bounds.width === 'number' && typeof bounds.height === 'number') {
                var minX = half;
                var maxX = Math.max(minX, bounds.width - half);
                var minY = half;
                var maxY = Math.max(minY, bounds.height - half);

                if (player.x < minX) { player.x = minX; touchingLeft = true; }
                if (player.x > maxX) { player.x = maxX; touchingRight = true; }
                // if we contacted bounds walls, snap to nearest quarter so a flat side aligns
                if (touchingLeft || touchingRight) {
                    var qWallB = Math.round(player.angle / (Math.PI / 2));
                    player.angle = qWallB * (Math.PI / 2);
                    // cancel jump-spin if hitting a bounds wall mid-air
                    player.jumpSpinActive = false;
                    player.angVel = 0;
                    // cancel any active dash and mark double-jump consumed
                    player.dashTimer = 0;
                    player.dashVx = 0;
                    player.doubleJumpUsed = true;
                }

                var wasGroundB = player.onGround;
                if (player.y > maxY) {
                    player.y = maxY; player.vy = 0; player.onGround = true; player.coyoteTimer = player.coyoteTime;
                    // reset double-jump/dash availability and cancel any dash
                    player.doubleJumpUsed = false;
                    player.dashTimer = 0;
                    player.dashVx = 0;
                    if (!wasGroundB) {/* Lines 283-285 omitted */ }
                } else if (player.y < minY) {/* Lines 287-288 omitted */ } else {/* Lines 289-290 omitted */ }

                // decrement coyote timer when not on ground (bounds fallback)
                if (!player.onGround) player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);

                var pressingLeft = input.isDown('ArrowLeft') || input.isDown('KeyA');
                var pressingRight = input.isDown('ArrowRight') || input.isDown('KeyD');
                var wallStick = false;
                if (!player.onGround) {
                    if (touchingLeft && pressingLeft) wallStick = 'left';
                    else if (touchingRight && pressingRight) wallStick = 'right';
                }

                if (wallStick) {
                    if (player.vy > player.wallSlideSpeed) player.vy = player.wallSlideSpeed;
                    if (jumpEdge) {
                        player.vy = -player.jumpSpeed;
                        player.vx = (wallStick === 'left') ? player.wallJumpHorizontal : -player.wallJumpHorizontal;
                        player.wallJumpTimer = player.wallJumpTime;
                        player.onGround = false;
                        player.jumpBufferTimer = 0;
                        // allow a fresh dash after wall-jump
                        player.doubleJumpUsed = false;
                        // start jump-spin on wall-jump (bounds)
                        player.jumpSpinActive = true;
                        var spinSignW = (player.vx >= 0) ? 1 : -1;
                        player.angVel = spinSignW * player.jumpSpinSpeed;
                    }
                } else {
                    var canJumpNow2 = player.onGround || player.coyoteTimer > 0;
                    if ((jumpEdge && canJumpNow2) || (canJumpNow2 && player.jumpBufferTimer > 0)) {
                        player.vy = -player.jumpSpeed;
                        player.onGround = false;
                        player.coyoteTimer = 0;
                        player.jumpBufferTimer = 0;
                        // reset double-jump availability for this jump
                        player.doubleJumpUsed = false;
                        // start jump-spin on bounds jump
                        player.jumpSpinActive = true;
                        var spinSignB = (player.vx >= 0) ? 1 : -1;
                        player.angVel = spinSignB * player.jumpSpinSpeed;
                    } else if (jumpEdge && !canJumpNow2 && !player.doubleJumpUsed) {
                        // bounds double-jump dash
                        var dashDirB = (input.isDown('ArrowLeft') || input.isDown('KeyA')) ? -1 : ((input.isDown('ArrowRight') || input.isDown('KeyD')) ? 1 : (player.vx >= 0 ? 1 : -1));
                        player.dashTimer = player.dashDuration;
                        player.dashVx = dashDirB * player.dashSpeed;
                        player.vx = player.dashVx;
                        player.vy = -player.jumpSpeed * 0.62;
                        player.doubleJumpUsed = true;
                        player.jumpSpinActive = true;
                        player.angVel = (dashDirB >= 0 ? 1 : -1) * player.jumpSpinSpeed;
                    }
                }

                if ((player.onGround || player.coyoteTimer > 0) && player.jumpBufferTimer > 0) {/* Lines 346-354 omitted */ }

                // animation updated by helper
                if (window.Animation && typeof window.Animation.update === 'function') {/* Lines 358-359 omitted */ }

                player.lastJumpKeyDown = jumpKeyDown;
            }
        }
    };

    window.PlayerPhysics = PlayerPhysics;
})();

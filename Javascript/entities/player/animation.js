// Animation helper for Player: step/hop and airborne spin/rolling
export class PlayerAnimation {
    static update(player, dt, dir) {
        if (player.onGround) {
            player.stepTimer = Math.max(0, player.stepTimer - dt);
            var moving = (Math.abs(player.vx) > 1e-3) || (dir !== 0);
            if (moving) {
                if (player.stepTimer <= 0 && player.stepAnimTimer <= 0) {
                    var dirSign = (player.vx > 0) ? 1 : -1;
                    player.stepAnimRate = dirSign * (player.stepAngle / player.stepDuration);
                    player.stepAnimTimer = player.stepDuration;
                    player.stepTimer = player.stepInterval;
                }
            } else {
                var target = Math.round(player.angle / (Math.PI / 2)) * (Math.PI / 2);
                var snapLerp = 1 - Math.exp(-10 * dt);
                player.angle += (target - player.angle) * snapLerp;
            }

            if (player.stepAnimTimer > 0) {
                player.angle += player.stepAnimRate * dt;
                var t = 1 - (player.stepAnimTimer / player.stepDuration);
                player.visualYOffset = Math.sin(t * Math.PI) * player.hopHeight;
                player.stepAnimTimer = Math.max(0, player.stepAnimTimer - dt);
                if (player.stepAnimTimer <= 0) {
                    player.stepAnimRate = 0;
                    player.visualYOffset = 0;
                    var q = Math.round(player.angle / (Math.PI / 2));
                    player.angle = q * (Math.PI / 2);
                }
            }
        } else {
            if (player.jumpSpinActive) {
                player.angle += player.angVel * dt;
            } else {
                var desiredAng = (player.vx > 0 ? 1 : -1) * Math.min(player.maxAngVel, Math.abs(player.vx) / player.size * 2);
                var spinLerp = 1 - Math.exp(-player.spinAccel * dt);
                player.angVel += (desiredAng - player.angVel) * spinLerp;
                player.angVel *= Math.max(0, 1 - player.spinDamping * dt);
                if (player.angVel > player.maxAngVel) player.angVel = player.maxAngVel;
                if (player.angVel < -player.maxAngVel) player.angVel = -player.maxAngVel;
                player.angle += player.angVel * dt;
            }
        }
    }
}

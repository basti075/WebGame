(function () {
    // Trail helper for entities (player, enemies, etc.)
    // Usage: var t = new Trail(maxSamples, spawnInterval); t.update(dt, x,y,angle,size); t.draw(ctx);
    function Trail(maxSamples, spawnInterval) {
        this.samples = [];
        this.maxSamples = typeof maxSamples === 'number' ? maxSamples : 40;
        this.spawnInterval = typeof spawnInterval === 'number' ? spawnInterval : 0.005;
        this.timer = 0;
    }

    Trail.prototype.update = function (dt, x, y, angle, size) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = this.spawnInterval;
            this.samples.push({ x: x, y: y, angle: angle, size: size });
            if (this.samples.length > this.maxSamples) this.samples.shift();
        }
    };

    Trail.prototype.draw = function (ctx) {
        if (!ctx) return;
        if (!this.samples || this.samples.length <= 1) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (var i = 0; i < this.samples.length - 1; i++) {
            var a = this.samples[i];
            var b = this.samples[i + 1];
            var t = (i + 1) / this.samples.length;
            var alpha = Math.min(1, Math.pow(t, 0.9) * 0.7);
            var grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, 'rgba(0,255,220,' + (Math.min(1, alpha * 0.75)) + ')');
            grad.addColorStop(1, 'rgba(0,255,220,0)');
            ctx.strokeStyle = grad;
            ctx.shadowBlur = 12 * t;
            ctx.shadowColor = 'rgba(0,230,210,' + (0.55 * t) + ')';
            ctx.lineWidth = Math.max(1, a.size * (0.4 + 0.6 * t));
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        ctx.restore();
    };

    window.Trail = Trail;
})();

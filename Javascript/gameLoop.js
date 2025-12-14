export class GameLoop {
    constructor(fixedDeltaMs) {
        this.callbacks = { update: null, render: null };
        this.running = false;
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedDeltaMs = typeof fixedDeltaMs === 'number' ? fixedDeltaMs : (1000 / 60);
        this._loop = this._loop.bind(this);
    }

    start(callbacks) {
        this.callbacks = callbacks || {};
        this.running = true;
        this.lastTime = performance.now();
        this.accumulator = 0;
        requestAnimationFrame(this._loop);
    }

    stop() {
        this.running = false;
    }

    _loop(time) {
        if (!this.running) return;
        var frameMs = time - this.lastTime;
        if (frameMs > 250) frameMs = 250;
        this.lastTime = time;
        this.accumulator += frameMs;
        try {
            while (this.accumulator >= this.fixedDeltaMs) {
                if (typeof this.callbacks.update === 'function') {
                    this.callbacks.update(this.fixedDeltaMs / 1000);
                }
                this.accumulator -= this.fixedDeltaMs;
            }
            if (typeof this.callbacks.render === 'function') {
                this.callbacks.render();
            }
        } catch (e) {
            console.error('GameLoop callback error:', e);
            this.stop();
            return;
        }
        requestAnimationFrame(this._loop);
    }
}

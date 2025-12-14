import { getRuntimeServices } from '../services/runtimeServices.js';

export class GameTimer {
    constructor(options) {
        options = options || {};
        this.state = null;
        this.audio = options.audio || resolveRuntimeAudio();
        this.onTimerComplete = typeof options.onTimerComplete === 'function' ? options.onTimerComplete : fallbackWinScreen;
    }

    bindState(state) {
        this.state = state;
    }

    init(durationSeconds) {
        if (!this.state) throw new Error('GameTimer.init requires a bound state object');
        this.state.timer = typeof durationSeconds === 'number' ? durationSeconds : 0;
        this.state.timerRunning = true;
        this.state._timerFlashTime = 0;
        this.state._timerFlashTotal = 0;
        this.state._timerFlashColor = null;
        this.state._lastTimerCeil = Math.ceil(this.state.timer);
    }

    update(dt) {
        if (!this.state || typeof this.state.timer !== 'number') return;
        if (typeof this.state.timerRunning === 'undefined') this.state.timerRunning = true;
        if (!this.state.timerRunning) {
            this._tickFlash(dt);
            return;
        }
        var prev = this.state.timer;
        this.state.timer = Math.max(0, this.state.timer - dt);
        var prevCeil = Math.ceil(prev);
        var newCeil = Math.ceil(this.state.timer);

        if (this.state.timer <= 3 && newCeil < prevCeil && newCeil > 0) {
            this._flash('red', 0.18);
        }

        if (newCeil < prevCeil) {
            this._playTickSound(newCeil);
        }

        if (prev > 0 && this.state.timer === 0) {
            this.state.timerRunning = false;
            this._flash('green', 0.6);
            this._handleTimerComplete();
        }

        this._tickFlash(dt);
    }

    render(ctx, canvasSize) {
        if (!ctx || !this.state || typeof this.state.timer !== 'number') return;
        try {
            ctx.save();
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            var txt = Math.ceil(this.state.timer) + 's';
            var w = ctx.measureText(txt).width + 16;
            var x = canvasSize.width / 2 - w / 2;

            if (this._isFlashing()) {
                var pO = 1 - (this.state._timerFlashTime / this.state._timerFlashTotal);
                var easeO = 0.5 - 0.5 * Math.cos(Math.PI * pO);
                var outlineCol = this.state._timerFlashColor === 'red' ? '255,50,50' : '50,255,100';
                ctx.save();
                ctx.strokeStyle = 'rgba(' + outlineCol + ',1)';
                ctx.lineWidth = 8 + easeO * 16;
                ctx.shadowColor = 'rgba(' + outlineCol + ',' + (0.85 + easeO * 0.15) + ')';
                ctx.shadowBlur = 20 + easeO * 60;
                ctx.strokeRect(3, 3, canvasSize.width - 6, canvasSize.height - 6);
                ctx.restore();
            }

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x, 8, w, 28);

            var cx = canvasSize.width / 2;
            var cy = 12;
            if (this._isFlashing()) {
                var p = 1 - (this.state._timerFlashTime / this.state._timerFlashTotal);
                var ease = 0.5 - 0.5 * Math.cos(Math.PI * p);
                var glow = 18 + ease * 44;
                var scale = 1 + 0.10 * ease;
                var col = this.state._timerFlashColor === 'red' ? '255,50,50' : '50,255,100';

                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(scale, scale);
                ctx.shadowColor = 'rgba(' + col + ',0.98)';
                ctx.shadowBlur = glow;
                ctx.fillStyle = this.state._timerFlashColor === 'red' ? 'rgba(255,140,140,1)' : 'rgba(180,255,220,1)';
                ctx.fillText(txt, 0, 0);
                ctx.restore();

                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(1 + 0.05 * ease, 1 + 0.05 * ease);
                ctx.fillStyle = '#fff';
                ctx.fillText(txt, 0, 0);
                ctx.restore();
            } else {
                ctx.fillStyle = '#fff';
                ctx.fillText(txt, cx, cy);
            }
            ctx.restore();
        } catch (error) {
            console.error('GameTimer.render error', error);
        }
    }

    pause() {
        if (!this.state) return;
        this.state.timerRunning = false;
    }

    resume() {
        if (!this.state || this.state.timer <= 0) return;
        this.state.timerRunning = true;
    }

    _isFlashing() {
        return this.state && this.state._timerFlashTime > 0 && this.state._timerFlashTotal > 0 && this.state._timerFlashColor;
    }

    _flash(color, duration) {
        if (!this.state) return;
        this.state._timerFlashColor = color;
        this.state._timerFlashTime = duration;
        this.state._timerFlashTotal = duration;
    }

    _tickFlash(dt) {
        if (this._isFlashing()) {
            this.state._timerFlashTime = Math.max(0, this.state._timerFlashTime - dt);
        }
    }

    _playTickSound(remainingSeconds) {
        var soundKey = null;
        if (remainingSeconds > 3) soundKey = 'countdown';
        else if (remainingSeconds > 0) soundKey = 'final';
        if (!soundKey) return;
        this._playSound(soundKey);
    }

    _handleTimerComplete() {
        this._playSound('win');
        if (this.onTimerComplete) {
            try { this.onTimerComplete(); } catch (error) { console.error('onTimerComplete error', error); }
        } else {
            fallbackWinScreen();
        }
    }

    _playSound(key) {
        var target = this.audio || resolveRuntimeAudio();
        if (!target || typeof target.play !== 'function') return;
        try { target.play(key); } catch (error) { console.warn('GameTimer sound play failed', key, error); }
    }
}

if (typeof window !== 'undefined') {
    var legacyTimer = new GameTimer({ audio: resolveRuntimeAudio(), onTimerComplete: fallbackWinScreen });
    window.GameTimer = {
        init: function (state, duration) { legacyTimer.bindState(state); legacyTimer.init(duration); },
        update: function (state, dt) { legacyTimer.bindState(state); legacyTimer.update(dt); },
        render: function (state, ctx, canvasSize) { legacyTimer.bindState(state); legacyTimer.render(ctx, canvasSize); },
        pause: function (state) { legacyTimer.bindState(state); legacyTimer.pause(); },
        resume: function (state) { legacyTimer.bindState(state); legacyTimer.resume(); }
    };
}

function resolveRuntimeAudio() {
    var runtime = getRuntimeServices() || {};
    if (runtime.audio) return runtime.audio;
    if (typeof window !== 'undefined' && window.AudioManager) return window.AudioManager;
    return null;
}

function fallbackWinScreen() {
    var runtime = getRuntimeServices() || {};
    if (typeof runtime.showWinScreen === 'function') {
        try { runtime.showWinScreen(); return; } catch (error) { console.error('runtime showWinScreen failed', error); }
    }
    if (typeof window !== 'undefined' && typeof window.showWinScreen === 'function') {
        try { window.showWinScreen(); } catch (error) { console.error('window showWinScreen failed', error); }
    }
}

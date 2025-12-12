// Game timer module: manages a countdown and drawing in the UI folder
(function () {
    'use strict';

    var GameTimer = {};

    // Initialize the timer on a shared state object
    // state: a plain object (main uses `state`)
    // duration: seconds
    GameTimer.init = function (state, duration) {
        state.timer = typeof duration === 'number' ? duration : 0;
        state.timerRunning = true;
        state._lastTimerCeil = Math.ceil(state.timer);
        state._timerFlashTime = 0;
        state._timerFlashTotal = 0;
        state._timerFlashColor = null;
    };

    GameTimer.update = function (state, dt) {
        if (!state) return;
        if (typeof state.timerRunning === 'undefined') state.timerRunning = true;
        if (state.timerRunning && typeof state.timer === 'number') {
            var prev = state.timer;
            state.timer = Math.max(0, state.timer - dt);
            var prevCeil = Math.ceil(prev);
            var newCeil = Math.ceil(state.timer);
            if (state.timer <= 3 && newCeil < prevCeil && newCeil > 0) {
                state._timerFlashColor = 'red';
                state._timerFlashTime = 0.18;
                state._timerFlashTotal = 0.18;
            }
            if (prev > 0 && state.timer === 0) {
                state._timerFlashColor = 'green';
                state._timerFlashTime = 0.6;
                state._timerFlashTotal = 0.6;
                state.timerRunning = false;
                try { if (typeof window.showWinScreen === 'function') window.showWinScreen(); } catch (e) { console.error('showWinScreen error', e); }
            }
            if (state._timerFlashTime > 0) state._timerFlashTime = Math.max(0, state._timerFlashTime - dt);
        }
    };

    GameTimer.render = function (state, ctx, canvasSize) {
        if (!state || typeof state.timer !== 'number') return;
        try {
            ctx.save();
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            var txt = Math.ceil(state.timer) + 's';
            var w = ctx.measureText(txt).width + 16;
            var x = canvasSize.width / 2 - w / 2;

            if (state._timerFlashTime > 0 && state._timerFlashColor && state._timerFlashTotal > 0) {
                var pO = 1 - (state._timerFlashTime / state._timerFlashTotal);
                var easeO = 0.5 - 0.5 * Math.cos(Math.PI * pO);
                var outlineCol = state._timerFlashColor === 'red' ? '255,50,50' : '50,255,100';
                ctx.save();
                ctx.strokeStyle = 'rgba(' + outlineCol + ',1)';
                ctx.lineWidth = 8 + easeO * 16;
                ctx.shadowColor = 'rgba(' + outlineCol + ',' + (0.85 + easeO * 0.15) + ')';
                ctx.shadowBlur = 20 + easeO * 60;
                ctx.strokeRect(3, 3, canvasSize.width - 6, canvasSize.height - 6);
                ctx.restore();
            }

            // timer background (always same)
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(x, 8, w, 28);

            // neon pulsing text when flashing: draw colored glow then white core
            var cx = canvasSize.width / 2;
            var cy = 12;
            if (state._timerFlashTime > 0 && state._timerFlashColor && state._timerFlashTotal > 0) {
                var p = 1 - (state._timerFlashTime / state._timerFlashTotal);
                var ease = 0.5 - 0.5 * Math.cos(Math.PI * p);
                var glow = 18 + ease * 44;
                var scale = 1 + 0.10 * ease;
                var col = state._timerFlashColor === 'red' ? '255,50,50' : '50,255,100';

                ctx.save();
                ctx.translate(cx, cy);
                ctx.scale(scale, scale);
                ctx.shadowColor = 'rgba(' + col + ',0.98)';
                ctx.shadowBlur = glow;
                ctx.fillStyle = state._timerFlashColor === 'red' ? 'rgba(255,140,140,1)' : 'rgba(180,255,220,1)';
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
        } catch (e) {
            // swallow drawing errors
            console.error('GameTimer.render error', e);
        }
    };

    GameTimer.pause = function (state) {
        if (!state) return;
        state.timerRunning = false;
    };

    GameTimer.resume = function (state) {
        if (!state) return;
        state.timerRunning = true;
    };

    window.GameTimer = GameTimer;
})();

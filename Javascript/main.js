document.addEventListener('DOMContentLoaded', function () {
    // initialize renderer (if available) and get drawing context
    if (window.Renderer && typeof window.Renderer.init === 'function') {
        Renderer.init('myCanvas');
        var ctx = Renderer.getContext();
        var canvasSize = Renderer.size();
    } else {
        var canvas = document.getElementById('myCanvas');
        if (!canvas) { console.warn('Canvas #myCanvas not found.'); return; }
        var ctx = canvas.getContext('2d');
        var canvasSize = { width: canvas.width, height: canvas.height };
    }

    var state = { t: 0 };
    // 10-second game timer (seconds)
    var TIMER_DURATION = 10;
    // performance info
    state.fps = 0;
    var level = null;
    var player = null;

    function startWithLevel(lvl) {
        level = lvl;
        // choose spawn point
        var spawn = null;
        if (level && typeof level.getObjects === 'function') {
            var sp = level.getObjects('playerSpawn');
            if (sp && sp.length) spawn = sp[0];
        }
        var startX = spawn ? spawn.x : (canvasSize.width / 2);
        var startY = spawn ? spawn.y : (canvasSize.height / 2);
        player = new (window.Player || function () { })(startX, startY, 32, 220);

        function update(dt) {
            state.t += dt;
            // update smoothed FPS
            var inst = dt > 0 ? 1 / dt : 0;
            state.fps = state.fps ? (state.fps * 0.9 + inst * 0.1) : inst;
            if (window.Input) {
                if (typeof window.Input.update === 'function') window.Input.update();
                // pass level to player so it can use tile collisions
                player.update(dt, window.Input, level || canvasSize);
                // decrement game timer when running
                if (typeof state.timerRunning === 'undefined') state.timerRunning = true;
                if (state.timerRunning && typeof state.timer === 'number') {
                    state.timer = Math.max(0, state.timer - dt);
                    if (state.timer <= 0) {
                        state.timerRunning = false;
                        // show win screen
                        showWinScreen();
                    }
                }
            }
        }

        function render() {
            // draw level if available
            if (level && typeof level.draw === 'function') level.draw(ctx);
            else {
                if (window.Renderer && typeof Renderer.clear === 'function') Renderer.clear('#111');
                else ctx.fillStyle = '#111', ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
            }

            // draw player
            if (player && typeof player.draw === 'function') player.draw(ctx);

            // draw FPS (top-right)
            if (typeof state.fps === 'number' && !isNaN(state.fps)) {
                var fpsText = Math.round(state.fps) + ' FPS';
                ctx.save();
                ctx.font = '14px monospace';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                // background box for readability
                var padding = 6;
                var metrics = ctx.measureText(fpsText);
                var w = Math.max(60, metrics.width + padding * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(canvasSize.width - w - 8, 8, w, 22);
                ctx.fillStyle = '#fff';
                ctx.fillText(fpsText, canvasSize.width - 8, 10);
                ctx.restore();
            }

            // draw countdown timer (top-center)
            if (typeof state.timer === 'number') {
                ctx.save();
                ctx.font = '20px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                var txt = Math.ceil(state.timer) + 's';
                var w = ctx.measureText(txt).width + 16;
                var x = canvasSize.width / 2 - w / 2;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(x, 8, w, 28);
                ctx.fillStyle = '#fff';
                ctx.fillText(txt, canvasSize.width / 2, 12);
                ctx.restore();
            }
        }

        // initialize timer for this run
        state.timer = TIMER_DURATION;
        state.timerRunning = true;

        // expose pause/resume helpers for the current running game
        window._currentGame = {
            update: update,
            render: render,
            pause: function () {
                // pause game loop if possible
                if (window.GameLoop && typeof window.GameLoop.stop === 'function') {
                    try { window.GameLoop.stop(); } catch (e) { }
                }
                // stop countdown timer
                state.timerRunning = false;
            },
            resume: function () {
                // resume game loop if possible
                if (window.GameLoop && typeof window.GameLoop.start === 'function') {
                    window.GameLoop.start({ update: update, render: render });
                }
                // resume countdown timer
                state.timerRunning = true;
            }
        };

        if (window.GameLoop && typeof window.GameLoop.start === 'function') {
            window.GameLoop.start({ update: update, render: render });
        } else {
            var last = performance.now();
            function fallback(now) {
                var dt = (now - last) / 1000; last = now;
                update(dt); render(); requestAnimationFrame(fallback);
            }
            requestAnimationFrame(fallback);
        }
    }

    // win screen is provided by UI/winScreen.js; call window.showWinScreen when needed


    // expose starter for title screen or external callers
    window.startWithLevel = startWithLevel;

    // load level, then start
    if (window.skipAutoStart) {
        // Title screen will call startWithLevel when the player chooses a level.
        // If a title script preloaded a level into window._pendingLevel, start it now.
        if (window._pendingLevel) {
            startWithLevel(window._pendingLevel);
            window._pendingLevel = null;
        }
    } else {
        if (window.LevelManager && typeof window.LevelManager.load === 'function') {
            LevelManager.load('assets/levels/level1.json').then(function (lvl) {
                startWithLevel(lvl);
            }).catch(function (err) {
                console.error('Failed to load level:', err);
                // start without level as fallback
                startWithLevel(null);
            });
        } else {
            startWithLevel(null);
        }
    }
});


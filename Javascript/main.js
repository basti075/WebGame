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
    var enemies = [];

    function startWithLevel(lvl) {
        level = lvl;
        // choose spawn point
        var spawn = null;
        if (level && typeof level.getObjects === 'function') {
            var sp = level.getObjects('playerSpawn');
            if (sp && sp.length) spawn = sp[0];
        }
        // Load default player explosion SFX (optional file; replace path if needed)
        try {
            if (window.AudioManager && typeof window.AudioManager.load === 'function') {
                window.AudioManager.load('player_explode', 'assets/audio/player_explode.wav');
                window.AudioManager.load('enemy_explode', 'assets/audio/enemy_explode.wav');
                // countdown tick and final tick sounds
                window.AudioManager.load('countdown', 'assets/audio/countdown.wav');
                window.AudioManager.load('final', 'assets/audio/final.wav');
                // win SFX
                window.AudioManager.load('win', 'assets/audio/win.wav');
            }
        } catch (e) { console.warn('AudioManager.load failed', e); }
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
                if (player && typeof player.update === 'function') player.update(dt, window.Input, level || canvasSize);
                // update enemies
                for (var i = enemies.length - 1; i >= 0; i--) {
                    var e = enemies[i];
                    if (e && typeof e.update === 'function') e.update(dt, player, level || canvasSize);
                    if (!e || !e.isAlive || !e.isAlive()) {
                        enemies.splice(i, 1);
                    }
                }
                // update global particle system (if present)
                if (window.ParticleSystem && typeof window.ParticleSystem.update === 'function') {
                    window.ParticleSystem.update(dt);
                }
                // check explosions vs player (delegated to PlayerCollision)
                if (player && window.PlayerCollision && typeof window.PlayerCollision.checkExplosionCollision === 'function') {
                    try {
                        var cres = window.PlayerCollision.checkExplosionCollision(player, enemies);
                        if (cres && cres.killed) {
                            player = null;
                            if (!window._pendingLoseTimeout) {
                                window._pendingLoseTimeout = setTimeout(function () {
                                    try { if (window._currentGame && typeof window._currentGame.pause === 'function') window._currentGame.pause(); } catch (e) { }
                                    try { if (typeof window.showLoseScreen === 'function') window.showLoseScreen(); } catch (e) { }
                                    window._pendingLoseTimeout = null;
                                }, 1000);
                            }
                        }
                    } catch (e) { console.error('PlayerCollision.checkExplosionCollision error', e); }
                }
                // delegate timer update to GameTimer module
                window.GameTimer.update(state, dt);
            }
        }

        function render() {
            // draw level if available
            try {
                if (level && typeof level.draw === 'function') {
                    level.draw(ctx);
                } else {
                    if (window.Renderer && typeof Renderer.clear === 'function') Renderer.clear('#111');
                    else ctx.fillStyle = '#111', ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
                }
            } catch (e) {
                console.error('Level draw error, clearing canvas as fallback', e);
                ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
            }

            // draw player
            try {
                if (player && typeof player.draw === 'function') player.draw(ctx);
            } catch (e) { console.error('Player draw error', e); }

            // draw enemies
            for (var j = 0; j < enemies.length; j++) {
                try {
                    var en = enemies[j];
                    if (en && typeof en.draw === 'function') en.draw(ctx);
                } catch (e) { console.error('Enemy draw error at index ' + j, e); }
            }

            // draw particles on top of entities
            try {
                if (window.ParticleSystem && typeof window.ParticleSystem.draw === 'function') {
                    window.ParticleSystem.draw(ctx);
                }
            } catch (e) { console.error('ParticleSystem draw error', e); }

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

            // draw countdown timer via GameTimer
            window.GameTimer.render(state, ctx, canvasSize);
        }

        // initialize timer for this run via GameTimer
        window.GameTimer.init(state, TIMER_DURATION);

        // spawn enemies from level object definitions
        enemies = [];
        if (level && typeof level.getObjects === 'function') {
            var spawns = level.getObjects('enemySpawn');
            if (Array.isArray(spawns)) {
                for (var si = 0; si < spawns.length; si++) {
                    var s = spawns[si];
                    if (s && typeof s.x === 'number' && typeof s.y === 'number') {
                        enemies.push(new window.Enemy({ x: s.x, y: s.y }));
                    }
                }
            }
        }

        // expose pause/resume helpers for the current running game
        window._currentGame = {
            update: update,
            render: render,
            pause: function () {
                // pause game loop if possible
                if (window.GameLoop && typeof window.GameLoop.stop === 'function') {
                    try { window.GameLoop.stop(); } catch (e) { }
                }
                // pause countdown via GameTimer
                if (window.GameTimer && typeof window.GameTimer.pause === 'function') window.GameTimer.pause(state);
            },
            resume: function () {
                // resume game loop if possible
                if (window.GameLoop && typeof window.GameLoop.start === 'function') {
                    window.GameLoop.start({ update: update, render: render });
                }
                // resume countdown via GameTimer
                if (window.GameTimer && typeof window.GameTimer.resume === 'function') window.GameTimer.resume(state);
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


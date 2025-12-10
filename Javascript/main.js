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
            if (window.Input) {
                if (typeof window.Input.update === 'function') window.Input.update();
                // pass level to player so it can use tile collisions
                player.update(dt, window.Input, level || canvasSize);
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
        }

        // expose pause/resume helpers for the current running game
        window._currentGame = {
            update: update,
            render: render,
            pause: function () {
                if (window.GameLoop && typeof window.GameLoop.stop === 'function') {
                    try { window.GameLoop.stop(); } catch (e) { }
                }
                // if fallback loop was used, we can't control it easily — rely on GameLoop when available
            },
            resume: function () {
                if (window.GameLoop && typeof window.GameLoop.start === 'function') {
                    window.GameLoop.start({ update: update, render: render });
                }
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


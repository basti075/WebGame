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

    // create player
    var player = new (window.Player || function () { })((canvasSize.width / 2), (canvasSize.height / 2), 32, 220);

    function update(dt) {
        state.t += dt; // simple time advance
        if (window.Input) {
            if (typeof window.Input.update === 'function') window.Input.update();
            player.update(dt, window.Input, canvasSize);
        }
    }

    function render() {
        // clear using renderer helper when available
        if (window.Renderer && typeof Renderer.clear === 'function') Renderer.clear('#111');
        else ctx.fillStyle = '#111', ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

        // draw player
        player.draw(ctx);
    }

    if (window.GameLoop && typeof window.GameLoop.start === 'function') {
        window.GameLoop.start({ update: update, render: render });
    } else {
        // fallback if GameLoop not available
        var last = performance.now();
        function fallback(now) {
            var dt = (now - last) / 1000; last = now;
            update(dt); render(); requestAnimationFrame(fallback);
        }
        requestAnimationFrame(fallback);
    }
});


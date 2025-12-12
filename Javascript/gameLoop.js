(function () {
    var callbacks = { update: null, render: null };
    var running = false;
    var lastTime = 0;
    var accumulator = 0;
    // lock to 60 FPS fixed timestep
    var targetMs = 1000 / 60;

    function loop(time) {
        if (!running) return;
        var frameMs = time - lastTime;
        if (frameMs > 250) frameMs = 250;
        lastTime = time;
        accumulator += frameMs;
        try {
            while (accumulator >= targetMs) {
                if (typeof callbacks.update === 'function') callbacks.update(targetMs / 1000);
                accumulator -= targetMs;
            }
            if (typeof callbacks.render === 'function') callbacks.render();
        } catch (e) {
            console.error('GameLoop callback error:', e);
        }
        requestAnimationFrame(loop);
    }

    window.GameLoop = {
        start: function (cbs) {
            callbacks = cbs || {};
            running = true;
            lastTime = performance.now();
            accumulator = 0;
            requestAnimationFrame(loop);
        },
        stop: function () { running = false; }
    };
})();

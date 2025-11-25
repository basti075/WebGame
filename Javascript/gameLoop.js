(function () {
    var callbacks = { update: null, render: null };
    var running = false;
    var lastTime = 0;

    function loop(time) {
        if (!running) return;
        var dt = (time - lastTime) / 1000; // seconds
        lastTime = time;
        try {
            if (typeof callbacks.update === 'function') callbacks.update(dt);
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
            requestAnimationFrame(loop);
        },
        stop: function () { running = false; }
    };
})();

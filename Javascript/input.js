(function () {
    var keys = {};
    var gpKeys = {};

    function updateGamepadState() {
        gpKeys = {};
        var gps = navigator.getGamepads && navigator.getGamepads();
        if (!gps) return;
        var gp = gps[0];
        if (!gp) return;
        var ax0 = gp.axes[0] || 0;
        var ax1 = gp.axes[1] || 0;
        var thr = 0.5;
        var btn = gp.buttons || [];
        gpKeys['ArrowLeft'] = (ax0 < -thr) || (btn[14] && btn[14].pressed);
        gpKeys['ArrowRight'] = (ax0 > thr) || (btn[15] && btn[15].pressed);
        //gpKeys['ArrowUp'] = (ax1 < -thr) || (btn[12] && btn[12].pressed);
        gpKeys['ArrowDown'] = (ax1 > thr) || (btn[13] && btn[13].pressed);
        gpKeys['KeyA'] = gpKeys['ArrowLeft'];
        gpKeys['KeyD'] = gpKeys['ArrowRight'];
        gpKeys['KeyW'] = gpKeys['ArrowUp'];
        gpKeys['KeyS'] = gpKeys['ArrowDown'];
        gpKeys['Space'] = !!(btn[0] && btn[0].pressed);
    }

    window.Input = {
        isDown: function (code) { return !!keys[code] || !!gpKeys[code]; },
        onKey: function (cb) { window.addEventListener('keydown', cb); window.addEventListener('keyup', cb); },
        update: function () { updateGamepadState(); }
    };

    window.addEventListener('keydown', function (e) { keys[e.code] = true; });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });

    window.addEventListener('gamepadconnected', function (e) { console.log('Gamepad connected:', e.gamepad.id); });
    window.addEventListener('gamepaddisconnected', function (e) { console.log('Gamepad disconnected:', e.gamepad && e.gamepad.id); });
})();

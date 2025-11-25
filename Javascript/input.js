(function () {
    var keys = {};

    window.Input = {
        isDown: function (code) { return !!keys[code]; },
        // optional: subscribe to key events
        onKey: function (cb) { window.addEventListener('keydown', cb); window.addEventListener('keyup', cb); }
    };

    window.addEventListener('keydown', function (e) { keys[e.code] = true; });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
})();

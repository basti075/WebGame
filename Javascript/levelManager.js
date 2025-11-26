(function () {
    'use strict';

    var current = null;

    function load(url) {
        return fetch(url).then(function (res) {
            if (!res.ok) throw new Error('Failed to load level: ' + url + ' (' + res.status + ')');
            return res.json();
        }).then(function (data) {
            return loadFromData(data);
        });
    }

    function loadFromData(data) {
        if (!window.Level) throw new Error('Level class is not available');
        var lvl = new window.Level(data);
        current = lvl;
        return lvl;
    }

    window.LevelManager = {
        load: load,
        loadFromData: loadFromData,
        get currentLevel() { return current; }
    };
})();

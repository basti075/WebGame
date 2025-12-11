// Shared loader for assets/levels/levels.json with caching
(function () {
    'use strict';
    var cache = null;
    var pending = null;

    function getLevels() {
        if (cache) return Promise.resolve(cache);
        if (pending) return pending;
        pending = fetch('assets/levels/levels.json').then(function (r) {
            if (!r.ok) throw new Error('manifest fetch failed');
            return r.json();
        }).then(function (data) {
            cache = data;
            pending = null;
            return cache;
        }).catch(function (err) {
            pending = null;
            throw err;
        });
        return pending;
    }

    // Allow manual injection (useful for tests or other code)
    function setLevels(list) {
        cache = list || null;
    }

    window.LevelsManifest = {
        getLevels: getLevels,
        setLevels: setLevels
    };
})();

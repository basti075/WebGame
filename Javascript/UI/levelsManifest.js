// Shared loader for assets/levels/levels.json with caching
let cache = null;
let pending = null;

export function getLevels() {
    if (cache) return Promise.resolve(cache);
    if (pending) return pending;
    pending = fetch('assets/levels/levels.json')
        .then(function (response) {
            if (!response.ok) throw new Error('manifest fetch failed');
            return response.json();
        })
        .then(function (data) {
            cache = data;
            pending = null;
            return cache;
        })
        .catch(function (error) {
            pending = null;
            throw error;
        });
    return pending;
}

export function setLevels(list) {
    cache = list || null;
    pending = null;
}

if (typeof window !== 'undefined') {
    window.LevelsManifest = { getLevels: getLevels, setLevels: setLevels };
}

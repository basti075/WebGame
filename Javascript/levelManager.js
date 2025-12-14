import { Level } from './level.js';

let currentLevel = null;

export class LevelManager {
    static async load(url) {
        var res = await fetch(url);
        if (!res.ok) {
            throw new Error('Failed to load level: ' + url + ' (' + res.status + ')');
        }
        var data = await res.json();
        return LevelManager.loadFromData(data);
    }

    static loadFromData(data) {
        var lvl = new Level(data);
        currentLevel = lvl;
        return lvl;
    }

    static get current() {
        return currentLevel;
    }
}

if (typeof window !== 'undefined') {
    window.LevelManager = LevelManager;
}

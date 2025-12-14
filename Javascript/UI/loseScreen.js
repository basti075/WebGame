import { LevelManager } from '../levelManager.js';
import { getLevels } from './levelsManifest.js';
import { getRuntimeServices } from '../services/runtimeServices.js';

function normalizeOptions(opts) {
    opts = opts || {};
    var runtime = getRuntimeServices() || {};
    var defaultStart = typeof runtime.startGame === 'function'
        ? runtime.startGame
        : ((typeof window !== 'undefined' && typeof window.startWithLevel === 'function') ? window.startWithLevel.bind(window) : null);
    var defaultGetLevel = typeof runtime.getCurrentLevel === 'function'
        ? runtime.getCurrentLevel
        : function () {
            return (typeof window !== 'undefined') ? window._currentLevel : null;
        };
    var defaultPause = typeof runtime.pauseGame === 'function' ? runtime.pauseGame : null;
    var defaultResume = typeof runtime.resumeGame === 'function' ? runtime.resumeGame : null;
    var defaultShowTitle = typeof runtime.showTitle === 'function'
        ? runtime.showTitle
        : (typeof runtime.showTitleScreen === 'function'
            ? runtime.showTitleScreen
            : ((typeof window !== 'undefined' && typeof window.showTitleScreen === 'function') ? window.showTitleScreen.bind(window) : null));
    return {
        title: opts.title,
        text: opts.text,
        levels: opts.levels,
        startGame: typeof opts.startGame === 'function' ? opts.startGame : defaultStart,
        getCurrentLevel: typeof opts.getCurrentLevel === 'function' ? opts.getCurrentLevel : defaultGetLevel,
        pauseGame: typeof opts.pauseGame === 'function' ? opts.pauseGame : defaultPause,
        resumeGame: typeof opts.resumeGame === 'function' ? opts.resumeGame : defaultResume,
        showTitle: typeof opts.showTitle === 'function' ? opts.showTitle : defaultShowTitle,
        audio: opts.audio || runtime.audio || null
    };
}

function captureResumeCallback() {
    if (typeof window === 'undefined' || !window._currentGame) return null;
    var resumeCb = null;
    if (typeof window._currentGame.pause === 'function') {
        try { window._currentGame.pause(); } catch (error) { console.error('pause error', error); }
    }
    if (typeof window._currentGame.resume === 'function') {
        resumeCb = window._currentGame.resume.bind(window._currentGame);
    }
    return resumeCb;
}

function createOverlay() {
    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.background = 'rgba(0,0,0,0.75)';
    overlay.style.transition = 'opacity 260ms cubic-bezier(.2,.9,.2,1)';
    overlay.style.opacity = '0';
    overlay.style.zIndex = '9999';
    return overlay;
}

function createCard() {
    var card = document.createElement('div');
    card.style.background = '#071010';
    card.style.padding = '20px';
    card.style.borderRadius = '8px';
    card.style.color = '#fff';
    card.style.minWidth = '340px';
    card.style.textAlign = 'center';
    card.style.transition = 'transform 360ms cubic-bezier(.2,.9,.2,1), opacity 320ms ease-out';
    card.style.transform = 'scale(0.7) translateY(18px)';
    card.style.opacity = '0';
    return card;
}

function loadLevels(opts) {
    if (opts && Array.isArray(opts.levels)) return Promise.resolve(opts.levels);
    return getLevels().catch(function (error) {
        console.error('Failed to load levels for lose screen:', error);
        return [];
    });
}

function renderOverlayWithLevels(overlay, card, levels, opts, resumeCb) {
    var title = document.createElement('h2');
    title.textContent = (opts && opts.title) || 'You Lose';
    card.appendChild(title);

    var info = document.createElement('div');
    info.style.marginBottom = '12px';
    info.textContent = (opts && opts.text) || 'You were caught. Select a level to try again:';
    card.appendChild(info);

    var list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';

    if (!levels || !levels.length) {
        var msg = document.createElement('div');
        msg.textContent = 'No levels available';
        msg.style.opacity = '0.9';
        msg.style.marginBottom = '8px';
        card.appendChild(msg);
    } else {
        levels.forEach(function (entry) {
            var btn = document.createElement('button');
            btn.textContent = (entry && entry.name) ? entry.name : (entry.file || entry.path || entry);
            btn.style.padding = '8px 12px';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.onclick = function () {
                playUIClick(opts.audio);
                var path = entry.file || entry.path || entry;
                LevelManager.load(path).then(function (level) {
                    if (document.body.contains(overlay)) document.body.removeChild(overlay);
                    if (overlay.__lose_onKey) { window.removeEventListener('keydown', overlay.__lose_onKey); overlay.__lose_onKey = null; }
                    if (opts.startGame) {
                        opts.startGame(level);
                    } else if (typeof window.startWithLevel === 'function') {
                        window.startWithLevel(level);
                    } else {
                        window.location.reload();
                    }
                }).catch(function (error) {
                    alert('Failed to load ' + path + ': ' + error);
                });
            };
            list.appendChild(btn);
        });
    }

    var restart = document.createElement('button');
    restart.textContent = 'Restart Current Level';
    restart.style.marginTop = '12px';
    restart.style.padding = '8px 12px';
    restart.style.border = 'none';
    restart.style.borderRadius = '4px';
    restart.style.cursor = 'pointer';
    restart.onclick = function () {
        playUIClick(opts.audio);
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        if (overlay.__lose_onKey) { window.removeEventListener('keydown', overlay.__lose_onKey); overlay.__lose_onKey = null; }
        var current = opts.getCurrentLevel ? opts.getCurrentLevel() : null;
        try {
            if (opts.startGame && current) {
                opts.startGame(current);
            } else if (typeof window.startWithLevel === 'function' && window._currentLevel) {
                window.startWithLevel(window._currentLevel);
            } else {
                location.reload();
            }
        } catch (error) {
            location.reload();
        }
    };

    var toTitle = document.createElement('button');
    toTitle.textContent = 'Back to Title';
    toTitle.style.marginTop = '8px';
    toTitle.style.padding = '8px 12px';
    toTitle.style.border = 'none';
    toTitle.style.borderRadius = '4px';
    toTitle.style.cursor = 'pointer';
    toTitle.onclick = function () {
        playUIClick(opts.audio);
        if (typeof window !== 'undefined' && typeof window.blur === 'function') window.blur();
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        if (overlay.__lose_onKey) { window.removeEventListener('keydown', overlay.__lose_onKey); overlay.__lose_onKey = null; }
        if (opts.showTitle) {
            opts.showTitle();
        } else if (typeof window.showTitleScreen === 'function') {
            window.showTitleScreen();
        } else {
            location.reload();
        }
    };

    card.appendChild(list);
    card.appendChild(restart);
    card.appendChild(toTitle);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    overlay.__lose_onKey = function (event) {
        if (event.key === 'Escape') {
            playUIClick(opts.audio);
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
            window.removeEventListener('keydown', overlay.__lose_onKey);
            overlay.__lose_onKey = null;
            if (typeof resumeCb === 'function') {
                try { resumeCb(); } catch (error) { console.error('resume callback error', error); }
            }
        }
    };
    window.addEventListener('keydown', overlay.__lose_onKey);
    setTimeout(function () {
        overlay.style.opacity = '1';
        card.style.transform = 'scale(1) translateY(0)';
        card.style.opacity = '1';
    }, 260);
    playUIClick(opts.audio, 'error');
}

export function showLoseScreen(opts) {
    var normalized = normalizeOptions(opts);
    if (normalized.pauseGame) {
        try { normalized.pauseGame(); } catch (error) { console.error('pauseGame error', error); }
    }
    var overlay = createOverlay();
    var card = createCard();
    var resumeCb = normalized.resumeGame || captureResumeCallback();
    loadLevels(normalized).then(function (levels) {
        renderOverlayWithLevels(overlay, card, levels, normalized, resumeCb);
    });
}

if (typeof window !== 'undefined') {
    window.showLoseScreen = showLoseScreen;
}

function playUIClick(audio, cue) {
    if (!audio || typeof audio.play !== 'function') return;
    var key = cue || 'countdown';
    try { audio.play(key); } catch (error) { console.warn('UI audio play failed', error); }
}

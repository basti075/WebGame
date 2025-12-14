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
            return (typeof window !== 'undefined' && window._currentLevel) ? window._currentLevel : null;
        };
    var defaultPause = typeof runtime.pauseGame === 'function' ? runtime.pauseGame : null;
    var defaultResume = typeof runtime.resumeGame === 'function' ? runtime.resumeGame : null;
    return {
        title: opts.title,
        text: opts.text,
        levels: opts.levels,
        startGame: typeof opts.startGame === 'function' ? opts.startGame : defaultStart,
        getCurrentLevel: typeof opts.getCurrentLevel === 'function' ? opts.getCurrentLevel : defaultGetLevel,
        pauseGame: typeof opts.pauseGame === 'function' ? opts.pauseGame : defaultPause,
        resumeGame: typeof opts.resumeGame === 'function' ? opts.resumeGame : defaultResume,
        audio: opts.audio || runtime.audio || null
    };
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
    overlay.style.background = 'rgba(0,0,0,0.7)';
    overlay.style.transition = 'opacity 280ms cubic-bezier(.2,.9,.2,1)';
    overlay.style.opacity = '0';
    overlay.style.zIndex = '9999';
    return overlay;
}

function createCard() {
    var card = document.createElement('div');
    card.style.background = '#071010';
    card.style.padding = '24px';
    card.style.borderRadius = '8px';
    card.style.color = '#fff';
    card.style.minWidth = '320px';
    card.style.textAlign = 'center';
    card.style.transition = 'transform 420ms cubic-bezier(.2,.9,.2,1), opacity 360ms ease-out';
    card.style.transform = 'scale(0.6) translateY(18px)';
    card.style.opacity = '0';
    return card;
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

function loadLevels(opts) {
    if (opts && Array.isArray(opts.levels)) return Promise.resolve(opts.levels);
    return getLevels().catch(function (error) {
        console.error('Failed to load levels for win screen:', error);
        return [];
    });
}

function attachEscapeHandler(overlay, resumeCb) {
    function onKey(event) {
        if (event.key !== 'Escape') return;
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        window.removeEventListener('keydown', onKey);
        overlay.__win_onKey = null;
        if (typeof resumeCb === 'function') resumeCb();
    }
    overlay.__win_onKey = onKey;
    window.addEventListener('keydown', onKey);
}

function renderOverlayWithLevels(overlay, card, levels, opts, resumeCb) {
    var title = document.createElement('h2');
    title.textContent = (opts && opts.title) || 'You Win!';
    card.appendChild(title);

    var info = document.createElement('div');
    info.style.marginBottom = '12px';
    info.textContent = (opts && opts.text) || 'Select a level to play:';
    card.appendChild(info);

    var list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';

    if (!levels || !levels.length) {
        var msg = document.createElement('div');
        msg.textContent = 'No levels available (failed to load levels.json)';
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
                    if (overlay.__win_onKey) { window.removeEventListener('keydown', overlay.__win_onKey); overlay.__win_onKey = null; }
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
        if (overlay.__win_onKey) { window.removeEventListener('keydown', overlay.__win_onKey); overlay.__win_onKey = null; }
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

    card.appendChild(list);
    card.appendChild(restart);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    attachEscapeHandler(overlay, resumeCb);
    setTimeout(function () {
        overlay.style.opacity = '1';
        card.style.transform = 'scale(1) translateY(0)';
        card.style.opacity = '1';
    }, 1000);
    playUIClick(opts.audio, 'final');
}

export function showWinScreen(opts) {
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
    window.showWinScreen = showWinScreen;
}

function playUIClick(audio, cue) {
    if (!audio || typeof audio.play !== 'function') return;
    var key = cue || 'countdown';
    try { audio.play(key); } catch (error) { console.warn('UI audio play failed', error); }
}

// Win screen overlay module
(function () {
    'use strict';

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

    function renderOverlayWithLevels(overlay, card, levels, opts) {
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
            levels.forEach(function (p) {
                var btn = document.createElement('button');
                // show only the human-friendly level name if available
                btn.textContent = (p && p.name) ? p.name : (p.file || p.path || p);
                btn.style.padding = '8px 12px';
                btn.style.border = 'none';
                btn.style.borderRadius = '4px';
                btn.style.cursor = 'pointer';
                btn.onclick = function () {
                    var path = p.file || p.path || p;
                    if (window.LevelManager && typeof window.LevelManager.load === 'function') {
                        LevelManager.load(path).then(function (lvl) {
                            if (document.body.contains(overlay)) document.body.removeChild(overlay);
                            if (overlay.__win_onKey) { window.removeEventListener('keydown', overlay.__win_onKey); overlay.__win_onKey = null; }
                            if (typeof window.startWithLevel === 'function') window.startWithLevel(lvl);
                        }).catch(function (err) {
                            alert('Failed to load ' + path + ': ' + err);
                        });
                    } else {
                        alert('LevelManager not available to load levels.');
                    }
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
            if (document.body.contains(overlay)) document.body.removeChild(overlay);
            if (overlay.__win_onKey) { window.removeEventListener('keydown', overlay.__win_onKey); overlay.__win_onKey = null; }
            try { if (typeof window.startWithLevel === 'function' && window._currentLevel) startWithLevel(window._currentLevel); else location.reload(); } catch (e) { location.reload(); }
        };

        card.appendChild(list);
        card.appendChild(restart);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        // trigger pop-in animation from center
        // force reflow then set final styles
        /* eslint-disable no-unused-expressions */
        overlay.offsetWidth;
        /* eslint-enable no-unused-expressions */
        overlay.style.opacity = '1';
        card.style.transform = 'scale(1) translateY(0)';
        card.style.opacity = '1';
    }

    function showWinScreen(opts) {
        opts = opts || {};
        var overlay = createOverlay();
        var card = createCard();
        // pause current game if available and capture resume callback
        var resumeCb = null;
        if (window._currentGame && typeof window._currentGame.pause === 'function') {
            try { window._currentGame.pause(); } catch (e) { console.error('pause error', e); }
            if (typeof window._currentGame.resume === 'function') resumeCb = window._currentGame.resume.bind(window._currentGame);
        }
        if (opts.levels && Array.isArray(opts.levels)) {
            renderOverlayWithLevels(overlay, card, opts.levels, opts);
            return;
        }
        // use shared manifest loader if present
        if (window.LevelsManifest && typeof window.LevelsManifest.getLevels === 'function') {
            window.LevelsManifest.getLevels().then(function (data) {
                renderOverlayWithLevels(overlay, card, data, opts);
                // allow closing overlay with Escape and resume if no selection made
                (function () {
                    function onKey(e) {
                        if (e.key === 'Escape') {
                            if (document.body.contains(overlay)) document.body.removeChild(overlay);
                            window.removeEventListener('keydown', onKey);
                            overlay.__win_onKey = null;
                            if (typeof resumeCb === 'function') resumeCb();
                        }
                    }
                    overlay.__win_onKey = onKey;
                    window.addEventListener('keydown', onKey);
                })();
            }).catch(function (err) {
                console.error('Failed to load levels.json for win screen via LevelsManifest:', err);
                renderOverlayWithLevels(overlay, card, [], opts);
            });
        } else {
            fetch('assets/levels/levels.json').then(function (r) {
                if (!r.ok) throw new Error('manifest fetch failed');
                return r.json();
            }).then(function (data) {
                renderOverlayWithLevels(overlay, card, data, opts);
                (function () {
                    function onKey(e) {
                        if (e.key === 'Escape') {
                            if (document.body.contains(overlay)) document.body.removeChild(overlay);
                            window.removeEventListener('keydown', onKey);
                            overlay.__win_onKey = null;
                            if (typeof resumeCb === 'function') resumeCb();
                        }
                    }
                    overlay.__win_onKey = onKey;
                    window.addEventListener('keydown', onKey);
                })();
            }).catch(function (err) {
                console.error('Failed to load levels.json for win screen:', err);
                renderOverlayWithLevels(overlay, card, [], opts);
            });
        }
    }

    // export
    window.showWinScreen = showWinScreen;
})();

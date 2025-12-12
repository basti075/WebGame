// Lose screen and particle burst module
(function () {
    'use strict';

    // Particle bursting is handled by the shared ParticleSystem (rendered into the game canvas).

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

    function renderOverlayWithLevels(overlay, card, levels, opts) {
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
            levels.forEach(function (p) {
                var btn = document.createElement('button');
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
                            if (overlay.__lose_onKey) { window.removeEventListener('keydown', overlay.__lose_onKey); overlay.__lose_onKey = null; }
                            if (typeof window.startWithLevel === 'function') window.startWithLevel(lvl);
                        }).catch(function (err) { alert('Failed to load ' + path + ': ' + err); });
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
            if (overlay.__lose_onKey) { window.removeEventListener('keydown', overlay.__lose_onKey); overlay.__lose_onKey = null; }
            try { if (typeof window.startWithLevel === 'function' && window._currentLevel) startWithLevel(window._currentLevel); else location.reload(); } catch (e) { location.reload(); }
        };

        var toTitle = document.createElement('button');
        toTitle.textContent = 'Back to Title';
        toTitle.style.marginTop = '8px';
        toTitle.style.padding = '8px 12px';
        toTitle.style.border = 'none';
        toTitle.style.borderRadius = '4px';
        toTitle.style.cursor = 'pointer';
        toTitle.onclick = function () { location.reload(); };

        card.appendChild(list);
        card.appendChild(restart);
        card.appendChild(toTitle);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        // show with slight delay for dramatic effect
        setTimeout(function () { overlay.style.opacity = '1'; card.style.transform = 'scale(1) translateY(0)'; card.style.opacity = '1'; }, 260);
    }

    function showLoseScreen(opts) {
        opts = opts || {};
        var overlay = createOverlay();
        var card = createCard();
        // don't resume automatically from losing; keep game paused
        if (opts.levels && Array.isArray(opts.levels)) {
            renderOverlayWithLevels(overlay, card, opts.levels, opts);
            return;
        }
        if (window.LevelsManifest && typeof window.LevelsManifest.getLevels === 'function') {
            window.LevelsManifest.getLevels().then(function (data) { renderOverlayWithLevels(overlay, card, data, opts); }).catch(function () { renderOverlayWithLevels(overlay, card, [], opts); });
        } else {
            fetch('assets/levels/levels.json').then(function (r) { if (!r.ok) throw new Error('manifest fetch failed'); return r.json(); }).then(function (data) { renderOverlayWithLevels(overlay, card, data, opts); }).catch(function () { renderOverlayWithLevels(overlay, card, [], opts); });
        }
    }

    // export helpers
    window.showLoseScreen = showLoseScreen;
})();

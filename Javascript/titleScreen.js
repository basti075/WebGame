// Title screen + level selection
(function () {
    'use strict';

    // prevent main auto-start when title screen is present
    window.skipAutoStart = true;

    function createElement(tag, attrs, text) {
        var el = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
        if (text) el.textContent = text;
        return el;
    }

    function showOverlay(levels, resumeCallback) {
        var overlay = createElement('div', { id: 'title-overlay' });
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(0,0,0,0.8)';
        overlay.style.zIndex = '9999';
        overlay.style.color = '#fff';

        var panel = createElement('div', { id: 'title-panel' });
        panel.style.minWidth = '320px';
        panel.style.padding = '20px';
        panel.style.background = '#111';
        panel.style.border = '1px solid #333';
        panel.style.borderRadius = '6px';
        panel.style.textAlign = 'center';

        var h = createElement('h1', null, 'WebGame');
        h.style.margin = '0 0 12px 0';
        panel.appendChild(h);

        var subtitle = createElement('div', null, 'Select a level');
        subtitle.style.marginBottom = '12px';
        panel.appendChild(subtitle);

        var list = createElement('div', null);
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '8px';

        levels.forEach(function (lvl) {
            var btn = createElement('button', null, lvl.name || lvl.file || 'Level');
            btn.style.padding = '8px 12px';
            btn.style.cursor = 'pointer';
            btn.onclick = function () {
                // load level and start
                if (window.LevelManager && typeof window.LevelManager.load === 'function') {
                    LevelManager.load(lvl.file).then(function (level) {
                        document.body.removeChild(overlay);
                        // ensure startWithLevel is available
                        if (typeof window.startWithLevel === 'function') {
                            window.startWithLevel(level);
                        } else {
                            // fallback: set a global and let main pick it up
                            window._pendingLevel = level;
                        }
                    }).catch(function (err) {
                        console.error('Failed loading level:', err);
                    });
                } else {
                    console.error('LevelManager not available');
                }
            };
            list.appendChild(btn);
        });

        panel.appendChild(list);

        // link to level editor
        var editorWrap = createElement('div', null);
        editorWrap.style.marginTop = '10px';
        var editorBtn = createElement('button', null, 'Open Level Editor');
        editorBtn.style.padding = '8px 12px';
        editorBtn.style.cursor = 'pointer';
        editorBtn.onclick = function () {
            // open editor in a new tab so user doesn't lose the running game
            try { window.open('level-editor.html', '_blank'); } catch (e) { window.location = 'level-editor.html'; }
        };
        editorWrap.appendChild(editorBtn);
        panel.appendChild(editorWrap);

        var credit = createElement('div', null, 'Press Esc to close');
        credit.style.marginTop = '12px';
        credit.style.opacity = '0.7';
        panel.appendChild(credit);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        function onKey(e) {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                window.removeEventListener('keydown', onKey);
                // if a resume callback was provided (we paused the game), resume it
                if (typeof resumeCallback === 'function') {
                    try { resumeCallback(); } catch (err) { console.error('resume callback error', err); }
                    return;
                }
                window.skipAutoStart = false;
                // if there is a pending level from other UI, start it
                if (window._pendingLevel && typeof window.startWithLevel === 'function') {
                    window.startWithLevel(window._pendingLevel);
                    window._pendingLevel = null;
                }
            }
        }

        window.addEventListener('keydown', onKey);
    }

    // expose a global to show the title screen and optionally resume a paused game
    window.showTitleScreen = function () {
        var resumeCb = null;
        if (window._currentGame && typeof window._currentGame.pause === 'function') {
            try { window._currentGame.pause(); } catch (err) { console.error('pause error', err); }
            if (typeof window._currentGame.resume === 'function') resumeCb = window._currentGame.resume.bind(window._currentGame);
        }
        var levels = window._levelsManifest || [
            { name: 'Level 1', file: 'assets/levels/level1.json' },
            { name: 'Level 2', file: 'assets/levels/level2.json' }
        ];
        showOverlay(levels, resumeCb);
    };

    document.addEventListener('DOMContentLoaded', function () {
        // load manifest for future showTitleScreen calls
        fetch('assets/levels/levels.json').then(function (r) {
            if (!r.ok) throw new Error('manifest fetch failed');
            return r.json();
        }).then(function (data) {
            window._levelsManifest = data;
            // show title overlay on first load
            showOverlay(data);
        }).catch(function () {
            // fallback list
            var fallback = [
                { name: 'Level 1', file: 'assets/levels/level1.json' },
                { name: 'Level 2', file: 'assets/levels/level2.json' }
            ];
            window._levelsManifest = fallback;
            showOverlay(fallback);
        });
    });

    // global handler: if user presses Escape while playing, open title screen
    window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            // if overlay already open, ignore (overlay has its own handler)
            if (document.getElementById('title-overlay')) return;
            try { window.showTitleScreen(); } catch (err) { /* ignore */ }
        }
    });

})();

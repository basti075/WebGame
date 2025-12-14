import { LevelManager } from '../levelManager.js';
import { getLevels } from './levelsManifest.js';
import { getRuntimeServices } from '../services/runtimeServices.js';

function createElement(tag, attrs, text) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text) el.textContent = text;
    return el;
}

function captureResumeCallback() {
    var services = getRuntimeServices() || {};
    var resume = null;
    if (typeof services.pauseGame === 'function') {
        try { services.pauseGame(); } catch (error) { console.error('pause error', error); }
    } else if (typeof window !== 'undefined' && window._currentGame && typeof window._currentGame.pause === 'function') {
        try { window._currentGame.pause(); } catch (error2) { console.error('pause error', error2); }
    }

    if (typeof services.resumeGame === 'function') {
        resume = services.resumeGame;
    } else if (typeof window !== 'undefined' && window._currentGame && typeof window._currentGame.resume === 'function') {
        resume = window._currentGame.resume.bind(window._currentGame);
    }
    return resume;
}

export class TitleScreenController {
    constructor(options) {
        options = options || {};
        if (typeof options.startGame !== 'function') throw new Error('TitleScreenController requires a startGame function');
        this.startGame = options.startGame;
        this.audio = options.audio || (getRuntimeServices().audio || null);
        this.levels = [];
        this.overlayId = 'title-overlay';
        this.globalKeyHandler = this._handleGlobalKey.bind(this);
        window.addEventListener('keydown', this.globalKeyHandler);
        if (typeof window !== 'undefined') {
            window.showTitleScreen = this.show.bind(this);
            window.skipAutoStart = true;
        }
    }

    async preloadLevels() {
        if (this.levels.length) return this.levels;
        try {
            this.levels = await getLevels();
        } catch (error) {
            console.error('Failed to load levels.json for title screen:', error);
            this.levels = [];
        }
        return this.levels;
    }

    async show(resumeCallback) {
        if (document.getElementById(this.overlayId)) return;
        if (typeof window !== 'undefined') {
            window.skipAutoStart = true;
        }
        var resume = typeof resumeCallback === 'function' ? resumeCallback : captureResumeCallback();
        var levels = (await this.preloadLevels()).slice();
        this._renderOverlay(levels, resume);
    }

    async showOnBoot() {
        await this.preloadLevels();
        await this.show();
    }

    dispose() {
        window.removeEventListener('keydown', this.globalKeyHandler);
    }

    _renderOverlay(levels, resumeCallback) {
        var overlay = createElement('div', { id: this.overlayId });
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

        var heading = createElement('h1', null, 'WebGame');
        heading.style.margin = '0 0 12px 0';
        panel.appendChild(heading);

        var subtitle = createElement('div', null, 'Select a level');
        subtitle.style.marginBottom = '12px';
        panel.appendChild(subtitle);

        var list = createElement('div', null);
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '8px';

        if (!levels.length) {
            var empty = createElement('div', null, 'No levels available (failed to load manifest).');
            empty.style.opacity = '0.75';
            empty.style.marginBottom = '8px';
            panel.appendChild(empty);
        }

        levels.forEach(function (entry) {
            var btn = createElement('button', null, entry.name || entry.file || 'Level');
            btn.style.padding = '8px 12px';
            btn.style.cursor = 'pointer';
            btn.onclick = this._handleLevelSelect.bind(this, entry, overlay, resumeCallback);
            list.appendChild(btn);
        }.bind(this));

        panel.appendChild(list);

        var editorWrap = createElement('div', null);
        editorWrap.style.marginTop = '10px';
        var editorBtn = createElement('button', null, 'Open Level Editor');
        editorBtn.style.padding = '8px 12px';
        editorBtn.style.cursor = 'pointer';
        editorBtn.onclick = function () {
            try { window.open('level-editor.html', '_blank'); } catch (error) { window.location = 'level-editor.html'; }
        };
        editorWrap.appendChild(editorBtn);
        panel.appendChild(editorWrap);

        var hint = createElement('div', null, 'Press Esc to close');
        hint.style.marginTop = '12px';
        hint.style.opacity = '0.7';
        panel.appendChild(hint);

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        overlay.__title_onKey = this._handleOverlayKey.bind(this, overlay, resumeCallback);
        window.addEventListener('keydown', overlay.__title_onKey);
    }

    _handleLevelSelect(entry, overlay, resumeCallback) {
        var path = entry.file || entry.path || entry;
        this._playUIClick('countdown');
        LevelManager.load(path).then(function (level) {
            this._closeOverlay(overlay);
            if (typeof this.startGame === 'function') {
                this.startGame(level);
            } else if (typeof window.startWithLevel === 'function') {
                window.startWithLevel(level);
            } else {
                window._pendingLevel = level;
            }
        }.bind(this)).catch(function (error) {
            console.error('Failed loading level:', error);
        });
    }

    _handleOverlayKey(overlay, resumeCallback, event) {
        if (event.key !== 'Escape') return;
        this._closeOverlay(overlay);
        if (typeof resumeCallback === 'function') {
            try { resumeCallback(); } catch (error) { console.error('resume callback error', error); }
        } else if (window._pendingLevel && typeof window.startWithLevel === 'function') {
            window.startWithLevel(window._pendingLevel);
            window._pendingLevel = null;
        }
    }

    _closeOverlay(overlay) {
        if (!overlay) return;
        if (overlay.__title_onKey) {
            window.removeEventListener('keydown', overlay.__title_onKey);
            overlay.__title_onKey = null;
        }
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        if (typeof window !== 'undefined') window.skipAutoStart = false;
        this._playUIClick('final');
    }

    _handleGlobalKey(event) {
        if (event.key !== 'Escape') return;
        if (document.getElementById(this.overlayId)) return;
        this.show();
    }
}

TitleScreenController.prototype._playUIClick = function (cue) {
    if (!this.audio || typeof this.audio.play !== 'function') return;
    var soundKey = cue || 'countdown';
    try { this.audio.play(soundKey); } catch (error) { console.warn('TitleScreen audio play failed', error); }
};

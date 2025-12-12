(function () {
    'use strict';

    var AudioManager = {
        _sounds: {},
        _music: null,
        _muted: false,
        _pendingLoads: {},

        // preload a sound or music. `src` can be a string or array of urls.
        load: function (name, src, opts) {
            opts = opts || {};
            // If Howl isn't available yet, queue the load for later
            if (!window.Howl) {
                this._pendingLoads[name] = { src: src, opts: opts };
                console.warn('Howler not available yet: queued load for', name);
                return null;
            }
            var h = new Howl({
                src: Array.isArray(src) ? src : [src],
                volume: typeof opts.volume === 'number' ? opts.volume : 1,
                loop: !!opts.loop,
                onloaderror: function (id, err) { console.warn('Howl load error', name, err); },
                onplayerror: function (id, err) { console.warn('Howl play error', name, err); }
            });
            this._sounds[name] = h;
            return h;
        },

        // play a sound by name. returns Howl play id or null
        play: function (name, opts) {
            opts = opts || {};
            var s = this._sounds[name];
            if (!s) { console.warn('AudioManager.play: sound not found', name); return null; }
            if (this._muted) return null;
            try {
                var id = s.play();
                if (typeof opts.volume === 'number') s.volume(opts.volume, id);
                if (typeof opts.loop === 'boolean') s.loop(opts.loop, id);
                return id;
            } catch (e) { console.warn('AudioManager.play error', e); return null; }
        },

        stop: function (name) {
            var s = this._sounds[name]; if (s) try { s.stop(); } catch (e) { }
        },

        // play a music track by name (will stop previous music)
        playMusic: function (name, opts) {
            opts = opts || {};
            if (this._music && this._music !== this._sounds[name]) {
                try { this._music.stop(); } catch (e) { }
            }
            var s = this._sounds[name];
            if (!s) { console.warn('AudioManager.playMusic: sound not found', name); return null; }
            s.loop(true);
            if (typeof opts.volume === 'number') s.volume(opts.volume);
            this._music = s;
            if (!this._muted) try { s.play(); } catch (e) { console.warn('AudioManager.playMusic play error', e); }
            return s;
        },

        stopMusic: function () { if (this._music) try { this._music.stop(); } catch (e) { } this._music = null; },

        setVolume: function (name, v) { var s = this._sounds[name]; if (s) try { s.volume(v); } catch (e) { } },

        mute: function () { this._muted = true; try { Howler.mute(true); } catch (e) { } },
        unmute: function () { this._muted = false; try { Howler.mute(false); } catch (e) { } },
        isMuted: function () { return !!this._muted; },

        // convenience loader for multiple assets
        loadManifest: function (manifest) {
            if (!manifest || typeof manifest !== 'object') return;
            for (var k in manifest) if (manifest.hasOwnProperty(k)) {
                var it = manifest[k];
                if (!it) continue;
                var src = it.src || it.path || it;
                var opts = {};
                if (it.volume !== undefined) opts.volume = it.volume;
                if (it.loop !== undefined) opts.loop = it.loop;
                this.load(k, src, opts);
            }
        }
    };

    // Process any pending loads once Howler becomes available
    AudioManager._processPending = function () {
        if (!window.Howl) return;
        for (var n in this._pendingLoads) if (this._pendingLoads.hasOwnProperty(n)) {
            try {
                var p = this._pendingLoads[n];
                this.load(n, p.src, p.opts);
            } catch (e) { console.warn('Failed to process pending audio load', n, e); }
        }
        this._pendingLoads = {};
    };

    // Poll briefly for Howler in case script load ordering or CDN blocking prevents immediate availability.
    if (!window.Howl) {
        var __am_check_count = 0;
        var __am_check = setInterval(function () {
            __am_check_count++;
            if (window.Howl) {
                clearInterval(__am_check);
                try { AudioManager._processPending(); } catch (e) { }
            } else if (__am_check_count > 50) { // ~10 seconds
                clearInterval(__am_check);
            }
        }, 200);
    }

    window.AudioManager = AudioManager;
})();

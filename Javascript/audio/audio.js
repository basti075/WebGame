export class AudioService {
    constructor() {
        this.sounds = {};
        this.music = null;
        this.muted = false;
        this.pendingLoads = {};
        this._ensureHowlerAvailability();
    }

    load(name, src, opts) {
        opts = opts || {};
        if (typeof Howl === 'undefined') {
            this.pendingLoads[name] = { src: src, opts: opts };
            console.warn('Howler not available yet: queued load for', name);
            return null;
        }
        var howl = new Howl({
            src: Array.isArray(src) ? src : [src],
            volume: typeof opts.volume === 'number' ? opts.volume : 1,
            loop: !!opts.loop,
            onloaderror: function (id, err) { console.warn('Howl load error', name, err); },
            onplayerror: function (id, err) { console.warn('Howl play error', name, err); }
        });
        this.sounds[name] = howl;
        return howl;
    }

    play(name, opts) {
        opts = opts || {};
        var sound = this.sounds[name];
        if (!sound) {
            console.warn('AudioService.play: sound not found', name);
            return null;
        }
        if (this.muted) return null;
        try {
            var id = sound.play();
            if (typeof opts.volume === 'number') sound.volume(opts.volume, id);
            if (typeof opts.loop === 'boolean') sound.loop(opts.loop, id);
            return id;
        } catch (error) {
            console.warn('AudioService.play error', error);
            return null;
        }
    }

    stop(name) {
        var sound = this.sounds[name];
        if (sound) {
            try { sound.stop(); } catch (error) { console.warn(error); }
        }
    }

    playMusic(name, opts) {
        opts = opts || {};
        if (this.music && this.music !== this.sounds[name]) {
            try { this.music.stop(); } catch (error) { console.warn(error); }
        }
        var sound = this.sounds[name];
        if (!sound) {
            console.warn('AudioService.playMusic: sound not found', name);
            return null;
        }
        sound.loop(true);
        if (typeof opts.volume === 'number') sound.volume(opts.volume);
        this.music = sound;
        if (!this.muted) {
            try { sound.play(); } catch (error) { console.warn('AudioService.playMusic play error', error); }
        }
        return sound;
    }

    stopMusic() {
        if (this.music) {
            try { this.music.stop(); } catch (error) { console.warn(error); }
            this.music = null;
        }
    }

    setVolume(name, value) {
        var sound = this.sounds[name];
        if (sound) {
            try { sound.volume(value); } catch (error) { console.warn(error); }
        }
    }

    mute() {
        this.muted = true;
        try { Howler.mute(true); } catch (error) { console.warn(error); }
    }

    unmute() {
        this.muted = false;
        try { Howler.mute(false); } catch (error) { console.warn(error); }
    }

    isMuted() {
        return this.muted;
    }

    loadManifest(manifest) {
        if (!manifest || typeof manifest !== 'object') return;
        for (var key in manifest) {
            if (!manifest.hasOwnProperty(key)) continue;
            var item = manifest[key];
            if (!item) continue;
            var src = item.src || item.path || item;
            var opts = {};
            if (item.volume !== undefined) opts.volume = item.volume;
            if (item.loop !== undefined) opts.loop = item.loop;
            this.load(key, src, opts);
        }
    }

    _ensureHowlerAvailability() {
        if (typeof Howl !== 'undefined') {
            this._flushPending();
            return;
        }
        var attempts = 0;
        var intervalId = setInterval(function () {
            attempts++;
            if (typeof Howl !== 'undefined') {
                clearInterval(intervalId);
                this._flushPending();
            } else if (attempts > 50) {
                clearInterval(intervalId);
            }
        }.bind(this), 200);
    }

    _flushPending() {
        var keys = Object.keys(this.pendingLoads);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            try {
                var item = this.pendingLoads[key];
                this.load(key, item.src, item.opts);
            } catch (error) {
                console.warn('Failed to process pending audio load', key, error);
            }
        }
        this.pendingLoads = {};
    }
}

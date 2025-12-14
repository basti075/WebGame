import { GameLoop } from './gameLoop.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { LevelManager } from './levelManager.js';
import { Player } from './entities/player/player.js';
import { Enemy } from './entities/enemy/enemy.js';
import { AudioService } from './audio/audio.js';
import { particleSystem } from './entities/particles.js';
import { checkExplosionCollision } from './entities/player/collision.js';
import { GameTimer } from './UI/timer.js';
import { TitleScreenController } from './UI/titleScreen.js';
import { showWinScreen } from './UI/winScreen.js';
import { showLoseScreen } from './UI/loseScreen.js';
import { findPath as computeEnemyPath } from './entities/enemy/pathfinding.js';
import { updateRuntimeServices } from './services/runtimeServices.js';

var TIMER_DURATION = 10;

class GameEngine {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.renderer = new Renderer(canvasId);
        this.loop = new GameLoop();
        this.input = new InputManager();
        this.audio = new AudioService();
        this.particles = particleSystem;
        this.timer = new GameTimer({
            audio: this.audio,
            onTimerComplete: this._handleTimerComplete.bind(this)
        });
        this.state = { t: 0, fps: 0 };
        this.timer.bindState(this.state);
        this.pathfinder = { findPath: computeEnemyPath };
        this.player = null;
        this.enemies = [];
        this.level = null;
        this.canvasSize = { width: 0, height: 0 };
        this.ctx = null;
        this.initialized = false;
        this.audioPreloaded = false;
        this.loseTimeoutId = null;
        this.titleScreen = null;
        if (typeof window !== 'undefined') {
            window.AudioManager = this.audio;
            window.Pathfinding = window.Pathfinding || {};
            window.Pathfinding.findPath = window.Pathfinding.findPath || computeEnemyPath;
        }
        updateRuntimeServices({
            audio: this.audio,
            timer: this.timer,
            particleSystem: this.particles,
            startGame: this.startWithLevel.bind(this),
            pauseGame: this.pause.bind(this),
            resumeGame: this.resume.bind(this),
            getCurrentLevel: function () { return this.level; }.bind(this),
            getUiOptions: this._uiOptions.bind(this),
            showWinScreen: function (options) { return showWinScreen(options || this._uiOptions()); }.bind(this),
            showLoseScreen: function (options) { return showLoseScreen(options || this._uiOptions()); }.bind(this)
        });
    }

    init() {
        if (this.initialized) return;
        this.renderer.init();
        this.ctx = this.renderer.getContext();
        this.canvasSize = this.renderer.size();
        this.initialized = true;
    }

    startWithLevel(levelData) {
        this.init();
        this.level = this._coerceLevel(levelData);
        if (typeof window !== 'undefined') {
            window._currentLevel = this.level;
        }
        this._resetState();
        this._spawnPlayer();
        this._spawnEnemies();
        this._preloadAudio();
        this._startLoop();
    }

    update(dt) {
        if (!dt) return;
        this.state.t += dt;
        var inst = dt > 0 ? 1 / dt : 0;
        this.state.fps = this.state.fps ? (this.state.fps * 0.9 + inst * 0.1) : inst;
        if (typeof this.input.updateGamepadState === 'function') this.input.updateGamepadState();

        var bounds = this.canvasSize;
        if (this.player && typeof this.player.update === 'function') {
            this.player.update(dt, { level: this.level, bounds: bounds }, bounds);
        }

        var enemyContext = {
            player: this.player,
            level: this.level,
            bounds: bounds,
            particleSystem: this.particles,
            audio: this.audio,
            pathfinder: this.pathfinder
        };

        for (var i = this.enemies.length - 1; i >= 0; i--) {
            var enemy = this.enemies[i];
            if (!enemy) {
                this.enemies.splice(i, 1);
                continue;
            }
            enemy.update(dt, enemyContext);
            if (!enemy.isAlive || !enemy.isAlive()) {
                this.enemies.splice(i, 1);
            }
        }

        if (typeof this.particles.update === 'function') {
            this.particles.update(dt);
        }

        if (this.player) {
            var hit = checkExplosionCollision(this.player, this.enemies, { particleSystem: this.particles, audio: this.audio });
            if (hit && hit.killed) {
                this._handlePlayerDeath();
            }
        }

        if (this.timer) {
            this.timer.update(dt);
        }
    }

    render() {
        if (!this.ctx) return;
        try {
            if (this.level && typeof this.level.draw === 'function') {
                this.level.draw(this.ctx);
            } else {
                this.renderer.clear('#111');
            }
        } catch (err) {
            console.error('Level draw error, clearing canvas as fallback', err);
            this.renderer.clear('#111');
        }

        if (this.player && typeof this.player.draw === 'function') {
            try { this.player.draw(this.ctx); } catch (err) { console.error('Player draw error', err); }
        }

        for (var i = 0; i < this.enemies.length; i++) {
            var enemy = this.enemies[i];
            if (enemy && typeof enemy.draw === 'function') {
                try { enemy.draw(this.ctx); } catch (err) { console.error('Enemy draw error', err); }
            }
        }

        if (typeof this.particles.draw === 'function') {
            try { this.particles.draw(this.ctx); } catch (err) { console.error('Particle draw error', err); }
        }

        this._renderFPS();

        if (this.timer) {
            this.timer.render(this.ctx, this.canvasSize);
        }
    }

    pause() {
        this._stopLoop();
        if (this.timer) {
            this.timer.pause();
        }
    }

    resume() {
        if (this.loop.running) return;
        this._startLoop();
        if (this.timer) {
            this.timer.resume();
        }
    }

    _resetState() {
        this.state.t = 0;
        this.state.fps = 0;
        if (this.timer) {
            this.timer.bindState(this.state);
            this.timer.init(TIMER_DURATION);
        }
    }

    _spawnPlayer() {
        var spawn = null;
        if (this.level && typeof this.level.getObjects === 'function') {
            var spawns = this.level.getObjects('playerSpawn');
            if (spawns && spawns.length) spawn = spawns[0];
        }
        var startX = spawn ? spawn.x : (this.canvasSize.width / 2);
        var startY = spawn ? spawn.y : (this.canvasSize.height / 2);
        this.player = new Player({ x: startX, y: startY, input: this.input });
    }

    _spawnEnemies() {
        this.enemies = [];
        if (!this.level || typeof this.level.getObjects !== 'function') return;
        var spawns = this.level.getObjects('enemySpawn');
        if (!Array.isArray(spawns)) return;
        for (var i = 0; i < spawns.length; i++) {
            var s = spawns[i];
            if (!s || typeof s.x !== 'number' || typeof s.y !== 'number') continue;
            this.enemies.push(new Enemy({ x: s.x, y: s.y }, { particles: this.particles, audio: this.audio, pathfinder: this.pathfinder }));
        }
    }

    _preloadAudio() {
        if (this.audioPreloaded) return;
        var manifest = [
            { key: 'player_explode', src: 'assets/audio/player_explode.wav' },
            { key: 'enemy_explode', src: 'assets/audio/enemy_explode.wav' },
            { key: 'countdown', src: 'assets/audio/countdown.wav' },
            { key: 'final', src: 'assets/audio/final.wav' },
            { key: 'win', src: 'assets/audio/win.wav' }
        ];
        for (var i = 0; i < manifest.length; i++) {
            var item = manifest[i];
            try { this.audio.load(item.key, item.src); } catch (err) { console.warn('Audio load failed for', item.key, err); }
        }
        this.audioPreloaded = true;
    }

    _handlePlayerDeath() {
        this.player = null;
        if (this.loseTimeoutId) return;
        this.loseTimeoutId = setTimeout(function () {
            this.pause();
            try {
                showLoseScreen(this._uiOptions());
            } catch (err) {
                console.error('showLoseScreen error', err);
                if (typeof window !== 'undefined' && typeof window.showLoseScreen === 'function') {
                    window.showLoseScreen();
                }
            }
            this.loseTimeoutId = null;
        }.bind(this), 1000);
    }

    _handleTimerComplete() {
        this.pause();
        try {
            showWinScreen(this._uiOptions());
        } catch (err) {
            console.error('showWinScreen error', err);
            if (typeof window !== 'undefined' && typeof window.showWinScreen === 'function') {
                window.showWinScreen();
            }
        }
    }

    _uiOptions() {
        var self = this;
        return {
            startGame: function (level) { self.startWithLevel(level); },
            getCurrentLevel: function () { return self.level; },
            pauseGame: function () { self.pause(); },
            resumeGame: function () { self.resume(); },
            audio: self.audio,
            showTitle: self.titleScreen && typeof self.titleScreen.show === 'function'
                ? self.titleScreen.show.bind(self.titleScreen)
                : (typeof window !== 'undefined' && typeof window.showTitleScreen === 'function' ? window.showTitleScreen : null)
        };
    }

    _startLoop() {
        this._stopLoop();
        this.loop.start({ update: this.update.bind(this), render: this.render.bind(this) });
        if (typeof window !== 'undefined') {
            window._currentGame = {
                pause: this.pause.bind(this),
                resume: this.resume.bind(this)
            };
        }
    }

    _stopLoop() {
        if (this.loop && this.loop.running) {
            this.loop.stop();
        }
    }

    _renderFPS() {
        if (!this.ctx || !this.state || typeof this.state.fps !== 'number' || isNaN(this.state.fps)) return;
        var fpsText = Math.round(this.state.fps) + ' FPS';
        this.ctx.save();
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'top';
        var padding = 6;
        var metrics = this.ctx.measureText(fpsText);
        var w = Math.max(60, metrics.width + padding * 2);
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(this.canvasSize.width - w - 8, 8, w, 22);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(fpsText, this.canvasSize.width - 8, 10);
        this.ctx.restore();
    }

    _coerceLevel(levelData) {
        if (!levelData) return null;
        if (typeof levelData.getObjects === 'function') return levelData;
        if (levelData.tiles) {
            return LevelManager.loadFromData(levelData);
        }
        return levelData;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var engine = new GameEngine('myCanvas');
    engine.init();
    if (typeof window !== 'undefined') {
        window.GameEngine = engine;
        window.startWithLevel = engine.startWithLevel.bind(engine);
    }

    var titleScreen = null;
    if (typeof window !== 'undefined') {
        titleScreen = new TitleScreenController({ startGame: engine.startWithLevel.bind(engine), audio: engine.audio });
        window.TitleScreen = titleScreen;
        engine.titleScreen = titleScreen;
        updateRuntimeServices({
            titleScreen: titleScreen,
            showTitleScreen: titleScreen.show.bind(titleScreen),
            showTitle: titleScreen.show.bind(titleScreen)
        });
        titleScreen.showOnBoot().catch(function (err) {
            console.error('Failed to show title screen on boot:', err);
        });
    }

    if (typeof window !== 'undefined' && window.skipAutoStart) {
        if (window._pendingLevel) {
            engine.startWithLevel(window._pendingLevel);
            window._pendingLevel = null;
        }
        return;
    }

    LevelManager.load('assets/levels/level1.json').then(function (lvl) {
        engine.startWithLevel(lvl);
    }).catch(function (err) {
        console.error('Failed to load level:', err);
        engine.startWithLevel(null);
    });
});


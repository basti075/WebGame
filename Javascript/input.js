export class InputManager {
    constructor() {
        this.keys = {};
        this.gamepadKeys = {};
        this.listeners = new Set();
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);
        window.addEventListener('keydown', this._handleKeyDown);
        window.addEventListener('keyup', this._handleKeyUp);
        window.addEventListener('gamepadconnected', this._logGamepadEvent.bind(this, 'connected'));
        window.addEventListener('gamepaddisconnected', this._logGamepadEvent.bind(this, 'disconnected'));
    }

    isDown(code) {
        return !!this.keys[code] || !!this.gamepadKeys[code];
    }

    onKey(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    updateGamepadState() {
        this.gamepadKeys = {};
        var gps = navigator.getGamepads && navigator.getGamepads();
        if (!gps) return;
        var gp = gps[0];
        if (!gp) return;
        var ax0 = gp.axes[0] || 0;
        var ax1 = gp.axes[1] || 0;
        var thr = 0.5;
        var btn = gp.buttons || [];
        this.gamepadKeys['ArrowLeft'] = (ax0 < -thr) || (btn[14] && btn[14].pressed);
        this.gamepadKeys['ArrowRight'] = (ax0 > thr) || (btn[15] && btn[15].pressed);
        this.gamepadKeys['ArrowDown'] = (ax1 > thr) || (btn[13] && btn[13].pressed);
        this.gamepadKeys['KeyA'] = this.gamepadKeys['ArrowLeft'];
        this.gamepadKeys['KeyD'] = this.gamepadKeys['ArrowRight'];
        this.gamepadKeys['KeyW'] = this.gamepadKeys['ArrowUp'];
        this.gamepadKeys['KeyS'] = this.gamepadKeys['ArrowDown'];
        this.gamepadKeys['Space'] = !!(btn[0] && btn[0].pressed);
    }

    destroy() {
        window.removeEventListener('keydown', this._handleKeyDown);
        window.removeEventListener('keyup', this._handleKeyUp);
        this.listeners.clear();
    }

    _handleKeyDown(e) {
        this.keys[e.code] = true;
        this._emit(e);
    }

    _handleKeyUp(e) {
        this.keys[e.code] = false;
        this._emit(e);
    }

    _emit(event) {
        this.listeners.forEach(function (listener) { try { listener(event); } catch (err) { console.error(err); } });
    }

    _logGamepadEvent(type, event) {
        console.log('Gamepad ' + type + ':', event.gamepad && event.gamepad.id);
    }
}

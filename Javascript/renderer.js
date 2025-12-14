export class Renderer {
    constructor(canvasId) {
        this.canvasId = canvasId;
        this.canvas = null;
        this.ctx = null;
        this.dpr = window.devicePixelRatio || 1;
    }

    init() {
        this.canvas = document.getElementById(this.canvasId);
        if (!this.canvas) {
            throw new Error('Renderer.init: canvas #' + this.canvasId + ' not found');
        }
        this.ctx = this.canvas.getContext('2d');
        var logicalW = this.canvas.getAttribute('width') || this.canvas.width;
        var logicalH = this.canvas.getAttribute('height') || this.canvas.height;
        logicalW = parseInt(logicalW, 10);
        logicalH = parseInt(logicalH, 10);
        this.canvas.style.width = logicalW + 'px';
        this.canvas.style.height = logicalH + 'px';
        this.canvas.width = Math.max(1, Math.floor(logicalW * this.dpr));
        this.canvas.height = Math.max(1, Math.floor(logicalH * this.dpr));
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        return this;
    }

    getContext() {
        return this.ctx;
    }

    size() {
        if (!this.canvas) return { width: 0, height: 0 };
        return { width: this.canvas.width / this.dpr, height: this.canvas.height / this.dpr };
    }

    clear(color) {
        if (!this.ctx) return;
        var s = this.size();
        this.ctx.fillStyle = color || '#000';
        this.ctx.fillRect(0, 0, s.width, s.height);
    }
}

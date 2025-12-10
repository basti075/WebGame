(function () {
    var renderer = {};
    var canvas, ctx, dpr = window.devicePixelRatio || 1;

    renderer.init = function (id) {
        canvas = document.getElementById(id);
        if (!canvas) { console.warn('Renderer.init: canvas #' + id + ' not found'); return; }
        ctx = canvas.getContext('2d');
        var logicalW = canvas.getAttribute('width') || canvas.width;
        var logicalH = canvas.getAttribute('height') || canvas.height;
        logicalW = parseInt(logicalW, 10);
        logicalH = parseInt(logicalH, 10);
        canvas.style.width = logicalW + 'px';
        canvas.style.height = logicalH + 'px';
        canvas.width = Math.max(1, Math.floor(logicalW * dpr));
        canvas.height = Math.max(1, Math.floor(logicalH * dpr));
        // scale drawing operations so 1 unit === 1 CSS pixel
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderer.canvas = canvas;
        renderer.ctx = ctx;
    };

    renderer.getContext = function () { return ctx; };

    renderer.size = function () {
        if (!canvas) return { width: 0, height: 0 };
        return { width: canvas.width / dpr, height: canvas.height / dpr };
    };

    renderer.clear = function (color) {
        if (!ctx) return;
        var s = renderer.size();
        ctx.fillStyle = color || '#000';
        ctx.fillRect(0, 0, s.width, s.height);
    };

    window.Renderer = renderer;
})();

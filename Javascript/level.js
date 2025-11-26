/* Level loader for human-editable row-of-strings JSON.
   Expected JSON shape:
   {
     "tileSize": 12,
     "width": 80,           // optional, derived from rows if absent
     "height": 45,          // optional
     "tiles": [             // REQUIRED: array of strings, one string per row
       "................................................................................",
       "..................................####......................................",
       "################################################################################"
     ],
     "objects": [ { "type":"playerSpawn", "x":100, "y":420 } ]
   }

   Characters:
     '.' => empty (0)
     '#' => solid (1)
     '0'..'9' => numeric tile indices
     unknown => 0
*/
(function () {
    'use strict';

    var DEFAULT_TILE_SIZE = 12;

    function mapCharToTile(ch) {
        if (ch === '#') return 1;
        if (ch === '.') return 0;
        if (ch >= '0' && ch <= '9') return Number(ch);
        return 0;
    }

    function Level(data) {
        if (!data || !Array.isArray(data.tiles) || data.tiles.length === 0 || typeof data.tiles[0] !== 'string') {
            throw new Error('Level JSON must include a "tiles" array of strings (one row per string)');
        }

        this.tileSize = (typeof data.tileSize === 'number') ? data.tileSize : DEFAULT_TILE_SIZE;
        this.objects = Array.isArray(data.objects) ? data.objects.slice() : [];

        // build tilesRows: array of arrays of tile indices
        this.tilesRows = data.tiles.map(function (rowStr) {
            return rowStr.split('').map(mapCharToTile);
        });

        this.height = this.tilesRows.length;
        this.width = this.tilesRows[0] ? this.tilesRows[0].length : 0;

        // validate consistent width
        for (var r = 0; r < this.tilesRows.length; r++) {
            if (this.tilesRows[r].length !== this.width) {
                throw new Error('Level row ' + r + ' has incorrect width (' + this.tilesRows[r].length + ' != ' + this.width + ')');
            }
        }

        // flat tiles array for convenience
        this.tiles = Array.prototype.concat.apply([], this.tilesRows);

        this.widthPx = this.width * this.tileSize;
        this.heightPx = this.height * this.tileSize;
    }

    Level.prototype.tileIndex = function (tx, ty) {
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return null;
        return this.tilesRows[ty][tx] || 0;
    };

    Level.prototype.isSolidAt = function (px, py) {
        var tx = Math.floor(px / this.tileSize);
        var ty = Math.floor(py / this.tileSize);
        // outside level bounds should be considered solid (prevent leaving the map)
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
        var idx = this.tileIndex(tx, ty);
        return !!idx;
    };

    Level.prototype.getObjects = function (type) {
        if (!type) return this.objects.slice();
        return this.objects.filter(function (o) { return o.type === type; });
    };

    Level.prototype.draw = function (ctx, options) {
        options = options || {};
        var showGrid = !!options.grid;

        if (!ctx) return;

        // background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, this.widthPx, this.heightPx);

        // tiles
        var ts = this.tileSize;
        for (var y = 0; y < this.height; y++) {
            var row = this.tilesRows[y];
            for (var x = 0; x < this.width; x++) {
                var idx = row[x];
                if (idx) {
                    ctx.fillStyle = (idx === 1) ? '#444' : '#666';
                    ctx.fillRect(x * ts, y * ts, ts, ts);
                }
                if (showGrid) {
                    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
                    ctx.strokeRect(x * ts + 0.5, y * ts + 0.5, ts - 1, ts - 1);
                }
            }
        }

        // objects
        this.objects.forEach(function (o) {
            if (!o || typeof o.x !== 'number' || typeof o.y !== 'number') return;
            if (o.type === 'playerSpawn') {
                ctx.fillStyle = '#0f8';
                ctx.fillRect(o.x - 4, o.y - 4, 8, 8);
            } else if (o.type === 'goal') {
                ctx.fillStyle = '#ff0';
                ctx.fillRect(o.x - 6, o.y - 6, 12, 12);
            } else {
                ctx.fillStyle = '#f0f';
                ctx.fillRect(o.x - 3, o.y - 3, 6, 6);
            }
        });
    };

    window.Level = Level;
})();

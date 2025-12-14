export class Entity {
    constructor({ x = 0, y = 0, size = 32 } = {}) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.alive = true;
    }

    update(dt, context) {
        // override in subclasses
    }

    draw(ctx) {
        // override in subclasses
    }

    isAlive() {
        return this.alive;
    }

    destroy() {
        this.alive = false;
    }
}

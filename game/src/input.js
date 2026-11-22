// input.js — keyboard + mouse state, normalized for the game loop.
export class Input {
  constructor(canvas, toGameCoords) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0 };
    this.toGameCoords = toGameCoords;
    this.onKey = null; // (keyName) => {} for screen-flow keys
    this.onThrow = null; // (gameCoords) => {}
    this.onSmoke = null;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      this.keys.add(k);
      if (this.onKey) this.onKey(k);
      if (k === 'm' && this.onMute) this.onMute();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse = this.toGameCoords(e.clientX - r.left, e.clientY - r.top);
    });
    canvas.addEventListener('mousedown', (e) => {
      const r = canvas.getBoundingClientRect();
      const g = this.toGameCoords(e.clientX - r.left, e.clientY - r.top);
      if (this.onThrow) this.onThrow(g);
    });
  }
  get state() {
    const k = this.keys;
    return {
      up: k.has('w') || k.has('arrowup'),
      down: k.has('s') || k.has('arrowdown'),
      left: k.has('a') || k.has('arrowleft'),
      right: k.has('d') || k.has('arrowright'),
      sneak: k.has('shift'),
      throwCoin: null,
      smoke: false,
    };
  }
}

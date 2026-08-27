export default class Tube {
  constructor(scene, x, y, w = 250, h = 520, index = 0) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.index = index;
    this.items = [];
    this.capacity = 4;
    this.accent = 0x38bdf8;
    this.bg = scene.add.graphics();
    this.bg.setPipeline('Light2D');
    this.drawGlass();
    this.label = scene.add
      .text(x, y - h / 2 - 32, `TUBE ${index + 1}`, {
        fontFamily: 'Fredoka',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#0f766e',
      })
      .setOrigin(0.5);
  }
  drawGlass() {
    const left = this.x - this.w / 2;
    const top = this.y - this.h / 2;
    const radius = Math.min(28, this.w / 5);
    this.bg.clear();
    this.bg.fillStyle(0xffffff, 0.18);
    this.bg.fillRoundedRect(left, top, this.w, this.h, radius);
    this.bg.fillStyle(this.accent, 0.1);
    this.bg.fillRoundedRect(
      left + 8,
      top + 22,
      this.w - 16,
      this.h - 34,
      radius - 6,
    );
    this.bg.lineStyle(7, this.accent, 0.9);
    this.bg.strokeRoundedRect(left, top, this.w, this.h, radius);
    this.bg.lineStyle(3, 0xffffff, 0.7);
    this.bg.strokeRoundedRect(
      left + 10,
      top + 10,
      this.w - 20,
      this.h - 20,
      radius - 8,
    );
    this.bg.fillStyle(0x0f172a, 0.32);
    this.bg.fillEllipse(this.x, top + 6, this.w - 12, 30);
    this.bg.fillStyle(this.accent, 0.45);
    this.bg.fillEllipse(this.x, top + 3, this.w - 2, 26);
    this.bg.fillStyle(0x0f172a, 0.52);
    this.bg.fillEllipse(this.x, top + 3, this.w - 22, 15);
    this.bg.lineStyle(4, 0xffffff, 0.72);
    this.bg.strokeEllipse(this.x, top + 2, this.w + 4, 27);
    this.bg.fillStyle(0xffffff, 0.55);
    this.bg.fillRoundedRect(left + 16, top + 34, 8, this.h - 82, 4);
    this.bg.fillStyle(0xffffff, 0.32);
    this.bg.fillRoundedRect(left + 15, top - 6, this.w - 30, 16, 8);
    this.bg.lineStyle(5, 0xffffff, 0.8);
    this.bg.strokeRoundedRect(left - 5, top - 8, this.w + 10, 23, 10);
    this.bg.fillStyle(this.accent, 0.25);
    this.bg.fillRoundedRect(left + 12, top + this.h - 25, this.w - 24, 18, 8);
  }
  setCapacity(c) {
    this.capacity = c;
  }
  contains(px, py) {
    return (
      Math.abs(px - this.x) <= this.w / 2 && Math.abs(py - this.y) <= this.h / 2
    );
  }
  setItems(items) {
    this.items = items;
    this.layout();
  }
  push(item) {
    if (this.items.length >= this.capacity) return false;
    this.items.push(item);
    this.layout();
    return true;
  }
  pop() {
    const item = this.items.pop();
    this.layout();
    return item;
  }
  layout() {
    const gap = 108,
      bottom = this.y + this.h / 2 - 52;
    this.items.forEach((item, i) => item.setPosition(this.x, bottom - i * gap));
  }
  setHighlight(on) {
    if (on) {
      this.highlightAccent = this.accent;
      this.accent = 0xfb7185;
    } else if (this.highlightAccent) {
      this.accent = this.highlightAccent;
      this.highlightAccent = null;
    }
    this.drawGlass();
  }
  destroy() {
    this.bg.destroy();
    this.label.destroy();
  }
}

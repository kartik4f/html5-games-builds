import Tube from './Tube.js';
import Item from './Item.js';
import { showGame } from './DomUI.js';

const W = 1920,
  H = 1080;
const MODE_COLORS = {
  number: { background: 0xfff0c2, accent: 0xf97316 },
  order: { background: 0xdff4ff, accent: 0x2563eb },
  math: { background: 0xffe2b8, accent: 0x7c3aed },
  shape: { background: 0xdff8d8, accent: 0x16a34a },
  word: { background: 0xffe1ed, accent: 0xdb2777 },
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }
  init(data) {
    this.mode = data.mode || 'number';
    this.level = data.level || 1;
    this.levels = data.levels || [];
  }
  create() {
    this.levelData = this.cloneLevel(this.levels[this.level - 1]);
    this.dragging = null;
    this.dragOrigin = null;
    this.moves = 0;
    this.completed = false;
    this.hintBusy = false;
    this.hintCount = 0;
    const theme = MODE_COLORS[this.mode];
    this.modeAccent = theme.accent;
    this.backgroundLayer = this.add.container(0, 0).setDepth(-30);
    this.middlegroundLayer = this.add.container(0, 0).setDepth(-20);
    this.foregroundLayer = this.add.container(0, 0).setDepth(20);
    const base = this.add.rectangle(W / 2, H / 2, W, H, theme.background);
    this.backgroundLayer.add(base);
    this.setupLighting(theme.accent);
    this.addNatureBackdrop(theme.accent, this.mode);
    this.addAmbientParticles(theme.accent);
    this.tubes = [];
    this.items = [];
    this.ui = showGame({
      scene: this,
      mode: this.mode,
      level: this.level,
      rule: this.levelData.rule,
      moves: this.moves,
      hints: this.hintCount,
      onMenu: () => this.scene.start('MenuScene'),
      onHint: () => this.showHint(),
      onReplay: () =>
        this.scene.restart({
          mode: this.mode,
          level: this.level,
          levels: this.levels,
        }),
      onPrevious: () => this.goToLevel(this.level - 1),
      onNext: () => this.goToLevel(this.level + 1),
    });
    this.createTubes();
    this.createItems();
    this.createControls();
  }
  setupLighting(accent) {
    this.lights.enable();
    this.lights.setAmbientColor(0x9aa4b8);
    const sun = this.lights.addLight(1630, 150, 360, 0xffd166, 1.15);
    const accentLight = this.lights.addLight(320, 600, 280, accent, 0.8);
    const sunHalo = this.add
      .circle(1630, 150, 125, 0xffd166, 0.1)
      .setPipeline('Light2D')
      .setDepth(-25);
    const accentHalo = this.add
      .circle(320, 600, 90, accent, 0.12)
      .setPipeline('Light2D')
      .setDepth(19);
    this.backgroundLayer.add(sunHalo);
    this.middlegroundLayer.add(accentHalo);
    this.tweens.add({
      targets: sun,
      intensity: 0.82,
      radius: 400,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: accentLight,
      x: 520,
      y: 680,
      duration: 4200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  addNatureBackdrop(accent, mode) {
    const scenery = this.add.graphics().setDepth(0);
    const sky = {
      number: 0xffe8aa,
      order: 0xbfe8ff,
      math: 0xc9c5f5,
      shape: 0xc9f0b7,
      word: 0xffd2a6,
    }[mode];
    const skyWash = this.add
      .rectangle(W / 2, H / 2, W, H, sky, 0.5)
      .setDepth(-29);
    this.backgroundLayer.add(skyWash);
    if (mode === 'word') {
      scenery.fillStyle(0x0284c7, 0.55);
      scenery.fillRect(0, 650, W, 430);
      scenery.fillStyle(0x38bdf8, 0.34);
      scenery.fillRect(0, 700, W, 380);
      scenery.fillStyle(0x0ea5e9, 0.28);
      scenery.fillRect(0, 780, W, 300);
      scenery.lineStyle(7, 0xffffff, 0.62);
      for (let i = 0; i < 8; i++) {
        scenery.arc(
          110 + i * 250,
          690 + (i % 2) * 28,
          80,
          Math.PI,
          Math.PI * 2,
        );
      }
      scenery.lineStyle(4, 0xbae6fd, 0.55);
      for (let i = 0; i < 7; i++) {
        scenery.arc(
          30 + i * 290,
          820 + (i % 3) * 54,
          110,
          Math.PI,
          Math.PI * 2,
        );
      }
      const foam = this.add.graphics().setDepth(1);
      foam.lineStyle(6, 0xffffff, 0.48);
      for (let i = 0; i < 10; i++) {
        foam.lineBetween(
          i * 210 - 30,
          678 + (i % 2) * 9,
          i * 210 + 90,
          678 + (i % 2) * 9,
        );
      }
      this.middlegroundLayer.add(foam);
      this.addBoat(1320, 760);
      this.tweens.add({
        targets: foam,
        x: 36,
        alpha: 0.2,
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.addBird(420, 190, 0x334155, 1, this.middlegroundLayer);
      this.addBird(1540, 260, 0x334155, 0.8, this.middlegroundLayer);
    } else if (mode === 'math') {
      scenery.fillStyle(0x312e81, 0.18);
      scenery.fillRect(0, 0, W, H);
      scenery.fillStyle(0xffffff, 0.75);
      for (let i = 0; i < 30; i++)
        scenery.fillCircle(
          60 + ((i * 173) % 1800),
          80 + ((i * 97) % 420),
          3 + (i % 3),
        );
      this.addBird(330, 210, 0x1e293b, 0.75, this.backgroundLayer);
      this.addBird(1500, 155, 0x1e293b, 0.9, this.backgroundLayer);
    } else {
      scenery.fillStyle(0xffd166, 0.8);
      scenery.fillCircle(1680, 170, 78);
      scenery.fillStyle(0xffffff, 0.55);
      scenery.fillCircle(280, 170, 42);
      scenery.fillCircle(330, 155, 58);
      scenery.fillCircle(395, 175, 38);
      scenery.fillStyle(0x65a30d, 0.16);
      scenery.fillTriangle(0, 540, 480, 270, 940, 540);
      scenery.fillStyle(0x15803d, 0.12);
      scenery.fillTriangle(620, 540, 1120, 300, 1650, 540);
      scenery.fillStyle(accent, 0.12);
      scenery.fillTriangle(1280, 540, 1660, 330, 1920, 540);
      this.addBird(470, 150, 0x334155, 0.9, this.backgroundLayer);
      this.addBird(1430, 230, 0x334155, 1, this.backgroundLayer);
      this.addRoadAndBullockCart(scenery, accent);
      if (mode === 'shape') {
        scenery.fillStyle(0xf43f5e, 0.45);
        for (let i = 0; i < 12; i++)
          scenery.fillCircle(80 + i * 160, 830 + (i % 2) * 25, 9);
      }
    }
    scenery.fillStyle(0x0f766e, 0.12);
    scenery.fillRect(0, 850, W, 230);
    this.middlegroundLayer.add(scenery);
    if (mode === 'math') {
      scenery.fillStyle(0xfef3c7, 0.9);
      scenery.fillCircle(1640, 180, 58);
      scenery.fillStyle(0xc9c5f5, 0.7);
      scenery.fillCircle(1665, 160, 58);
    } else {
      this.addCloud(720, 150, 1.1, this.backgroundLayer);
      this.addCloud(1180, 220, 0.75, this.backgroundLayer);
      this.addTree(145, 810, 0.95, 0x166534, this.foregroundLayer);
      this.addTree(1770, 820, 0.8, 0x15803d, this.foregroundLayer);
    }
    for (let i = 0; i < 12; i++)
      this.addGrass(
        35 + i * 170,
        900 + (i % 3) * 18,
        0.7 + (i % 3) * 0.12,
        accent,
        this.foregroundLayer,
      );
  }
  addCloud(x, y, scale, layer = this.middlegroundLayer) {
    const cloud = this.add.graphics().setDepth(1);
    cloud.fillStyle(0xffffff, 0.48);
    cloud.fillCircle(0, 10, 28);
    cloud.fillCircle(38, 0, 42);
    cloud.fillCircle(84, 12, 27);
    cloud.fillRoundedRect(0, 10, 84, 32, 16);
    cloud.setPosition(x, y).setScale(scale);
    layer.add(cloud);
    this.tweens.add({
      targets: cloud,
      x: x + 35,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  addBoat(x, y) {
    const boat = this.add.graphics().setDepth(2);
    boat.fillStyle(0x92400e, 0.9);
    boat.beginPath();
    boat.moveTo(-72, 0);
    boat.lineTo(72, 0);
    boat.lineTo(42, 30);
    boat.lineTo(-42, 30);
    boat.closePath();
    boat.fillPath();
    boat.lineStyle(5, 0x78350f, 0.9);
    boat.strokePath();
    boat.lineStyle(6, 0x334155, 0.85);
    boat.lineBetween(0, 0, 0, -116);
    boat.fillStyle(0xffffff, 0.88);
    boat.fillTriangle(4, -108, 4, -25, 64, -25);
    boat.fillStyle(0xf97316, 0.9);
    boat.fillTriangle(-5, -98, -5, -38, -48, -38);
    boat.setPosition(x, y);
    this.middlegroundLayer.add(boat);
    this.tweens.add({
      targets: boat,
      y: y + 12,
      angle: 2,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  addTree(x, y, scale, color, layer = this.foregroundLayer) {
    const tree = this.add.graphics().setDepth(1);
    tree.fillStyle(0x92400e, 0.8);
    tree.fillRect(-8, 0, 16, 76);
    tree.fillStyle(color, 0.8);
    tree.fillCircle(-25, 0, 34);
    tree.fillCircle(20, -8, 42);
    tree.fillCircle(0, -38, 38);
    tree.setPosition(x, y).setScale(scale);
    layer.add(tree);
    this.tweens.add({
      targets: tree,
      angle: 2,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  addGrass(x, y, scale, color, layer = this.foregroundLayer) {
    const grass = this.add.graphics().setDepth(2);
    grass.lineStyle(4, color, 0.5);
    grass.lineBetween(0, 0, -10, -34);
    grass.lineBetween(0, 0, 4, -42);
    grass.lineBetween(0, 0, 16, -30);
    grass.setPosition(x, y).setScale(scale);
    layer.add(grass);
    this.tweens.add({
      targets: grass,
      angle: 4,
      duration: 1200 + (x % 4) * 160,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  addBird(x, y, color, scale, layer = this.middlegroundLayer) {
    const bird = this.add.graphics().setDepth(2);
    bird.lineStyle(7, color, 0.75);
    bird.arc(-20, 0, 20, Math.PI, Math.PI * 2, false);
    bird.arc(20, 0, 20, Math.PI, Math.PI * 2, false);
    bird.setPosition(x, y).setScale(scale);
    layer.add(bird);
    this.tweens.add({
      targets: bird,
      x: x + 55,
      y: y - 18,
      duration: 3200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  addRoadAndBullockCart(scenery, accent) {
    scenery.fillStyle(0x8b5e3c, 0.8);
    scenery.fillRect(0, 790, W, 210);
    scenery.lineStyle(12, 0xfef3c7, 0.9);
    scenery.lineBetween(0, 800, W, 800);
    scenery.lineBetween(0, 985, W, 985);
    scenery.lineStyle(8, 0xffd166, 0.95);
    for (let i = 0; i < 16; i++) {
      const x = 30 + i * 130;
      scenery.lineBetween(x, 885, x + 72, 885);
    }
    scenery.fillStyle(0xffffff, 0.75);
    for (let i = 0; i < 5; i++) {
      scenery.fillCircle(90 + i * 430, 812, 6);
      scenery.fillCircle(300 + i * 430, 970, 6);
    }

    const cart = this.add.container(W + 220, 858).setDepth(25);
    const cartArt = this.add.graphics();
    cartArt.fillStyle(0x92400e, 0.95);
    cartArt.fillRoundedRect(-78, -18, 130, 48, 10);
    cartArt.fillStyle(0xf59e0b, 0.9);
    cartArt.fillRoundedRect(-68, -56, 105, 38, 12);
    cartArt.lineStyle(6, 0x78350f, 0.95);
    cartArt.strokeRoundedRect(-78, -18, 130, 48, 10);
    cartArt.lineStyle(7, 0x334155, 0.85);
    cartArt.lineBetween(45, 0, 122, 35);
    cartArt.lineStyle(6, 0x78350f, 0.9);
    cartArt.strokeCircle(-48, 38, 25);
    cartArt.strokeCircle(25, 38, 25);
    cartArt.lineStyle(5, accent, 0.8);
    cartArt.lineBetween(-72, -54, 68, -54);
    cartArt.lineBetween(-58, -54, -38, -78);
    cartArt.lineBetween(48, -54, 28, -78);

    const leftOx = this.add.graphics().setDepth(8);
    const rightOx = this.add.graphics().setDepth(8);
    [leftOx, rightOx].forEach((ox) => {
      ox.fillStyle(0x8b5e3c, 1);
      ox.fillEllipse(0, 0, 44, 25);
      ox.fillStyle(0x1f2937, 0.9);
      ox.fillCircle(-12, -3, 3);
      ox.fillCircle(12, -3, 3);
      ox.lineStyle(5, 0x78350f, 0.9);
      ox.lineBetween(-20, 10, -34, 30);
      ox.lineBetween(20, 10, 34, 30);
    });
    leftOx.setPosition(-122, 2);
    rightOx.setPosition(-178, 2);
    cart.add([cartArt, leftOx, rightOx]);
    cart.setScale(0.72);
    this.foregroundLayer.add(cart);
    this.tweens.add({
      targets: cart,
      x: -220,
      y: 858,
      angle: 0,
      duration: 24000,
      repeat: -1,
      ease: 'Linear',
    });
  }
  createTubes() {
    const n = this.levelData.tubes.length;
    const gap = 30,
      w = Math.min(155, (W - 220 - gap * (n - 1)) / n);
    const capacity = this.levelData.difficulty.capacity;
    const h = 140 + (capacity - 1) * 108;
    const total = n * w + (n - 1) * gap;
    const start = (W - total) / 2 + w / 2;
    const y = 600;
    this.levelData.tubes.forEach((t, i) => {
      const tube = new Tube(this, start + i * (w + gap), y, w, h, i);
      tube.setCapacity(capacity);
      tube.accent = MODE_COLORS[this.mode].accent;
      tube.drawGlass();
      this.tubes.push(tube);
    });
    this.levelData.categories.forEach((cat, i) => {
      if (this.tubes[i]) this.tubes[i].label.setText(cat);
    });
  }
  cloneLevel(level) {
    return {
      ...level,
      difficulty: { ...level.difficulty },
      categories: [...level.categories],
      items: level.items.map((item) => ({ ...item })),
      tubes: level.tubes.map((tube) => ({
        ...tube,
        items: tube.items.map((item) => ({ ...item })),
      })),
    };
  }
  goToLevel(level) {
    if (level < 1 || level > this.levels.length) return;
    this.scene.restart({ mode: this.mode, level, levels: this.levels });
  }
  createItems() {
    this.levelData.tubes.forEach((td, ti) => {
      const tube = this.tubes[ti];
      const arr = [];
      td.items.forEach((data) => {
        const item = new Item(this, data);
        item.tubeIndex = ti;
        item.setDepth(10);
        if (data.shape) this.styleShape(item, data.shape);
        arr.push(item);
        this.items.push(item);
        this.animateIdle(item, this.items.length);
      });
      tube.setItems(arr);
    });
  }
  styleShape(item, shape) {
    const colors = {
      CIRCLE: 0x38bdf8,
      SQUARE: 0xf59e0b,
      TRIANGLE: 0x22c55e,
      DIAMOND: 0xa855f7,
      STAR: 0xf43f5e,
    };
    item.body.remove(item.shape, true);
    item.shape.destroy();
    if (shape === 'CIRCLE') {
      item.shape = this.add.circle(0, 0, 50, colors[shape]);
    } else if (shape === 'SQUARE') {
      item.shape = this.roundedShape('square', colors[shape]);
    } else if (shape === 'TRIANGLE') {
      item.shape = this.add
        .triangle(0, 0, 0, -48, 48, 42, -48, 42, colors[shape])
        .setStrokeStyle(5, 0xffffff, 0.95);
    } else if (shape === 'DIAMOND') {
      item.shape = this.roundedShape('diamond', colors[shape]);
    } else {
      item.shape = this.roundedShape('flower', colors[shape]);
    }
    if (shape === 'CIRCLE') item.shape.setStrokeStyle(5, 0xffffff, 0.95);
    item.body.addAt(item.shape, 0);
    item.useLighting();
  }
  roundedShape(kind, color) {
    const shape = this.add.graphics();
    shape.fillStyle(color, 1);
    shape.lineStyle(5, 0xffffff, 0.95);
    if (kind === 'square') {
      shape.fillRoundedRect(-48, -48, 96, 96, 18);
      shape.strokeRoundedRect(-48, -48, 96, 96, 18);
    } else if (kind === 'triangle') {
      const points = [0, -43, 9, -38, 40, 29, 36, 42, -36, 42, -40, 29];
      shape.fillPoints(points, true);
      shape.strokePoints(points, true);
    } else if (kind === 'diamond') {
      const points = [
        0, -46, 9, -43, 43, -9, 46, 0, 43, 9, 9, 43, 0, 46, -9, 43, -43, 9, -46,
        0, -43, -9, -9, -43,
      ];
      shape.fillPoints(points, true);
      shape.strokePoints(points, true);
    } else {
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        shape.fillCircle(Math.cos(angle) * 28, Math.sin(angle) * 28, 25);
      }
      shape.fillCircle(0, 0, 31);
    }
    return shape;
  }
  createControls() {}

  addAmbientParticles(color) {
    this.ambientParticles = [];
    for (let i = 0; i < 18; i++) {
      const particle = this.add
        .circle(
          70 + ((i * 137) % 1780),
          290 + ((i * 83) % 560),
          4 + (i % 3),
          color,
          0.22,
        )
        .setDepth(1);
      this.middlegroundLayer.add(particle);
      this.ambientParticles.push(particle);
      this.tweens.add({
        targets: particle,
        y: particle.y - 55 - (i % 4) * 14,
        x: particle.x + (i % 2 ? 18 : -18),
        alpha: 0.04,
        duration: 2600 + (i % 5) * 450,
        delay: (i % 6) * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  showHint() {
    if (this.completed || this.hintBusy) return;
    const move = this.findHintMove();
    if (!move) {
      this.showHintMessage('You are very close. Keep sorting the top items.');
      return;
    }
    this.hintCount++;
    this.ui.setHints(this.hintCount);
    this.hintBusy = true;
    const source = this.tubes[move.from];
    const target = this.tubes[move.to];
    const item = move.item;
    source.setHighlight(true);
    target.setHighlight(true);
    item.setDepth(150);
    this.showHintMessage(move.message);
    this.tweens.add({
      targets: item.body,
      scaleX: 1.18,
      scaleY: 1.18,
      angle: -5,
      duration: 220,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        source.setHighlight(false);
        target.setHighlight(false);
        item.setDepth(10);
        this.hintBusy = false;
      },
    });
  }

  findHintMove() {
    for (let i = 0; i < this.tubes.length; i++) {
      const source = this.tubes[i];
      if (!source.items.length) continue;
      const item = source.items[source.items.length - 1];
      const target = this.tubes.findIndex(
        (tube, index) =>
          index !== i &&
          tube.label.text === String(item.data.category) &&
          tube.items.length < tube.capacity,
      );
      if (target >= 0) {
        return {
          from: i,
          to: target,
          item,
          message: `Move “${item.data.value}” to Tube ${target + 1}.`,
        };
      }
    }
    return null;
  }

  showHintMessage(message) {
    this.ui.showHint(message);
  }
  beginDrag(item) {
    if (this.completed) return;
    const source = this.tubes[item.tubeIndex];
    if (source.items[source.items.length - 1] !== item) {
      this.tweens.add({
        targets: item.body,
        scaleX: 0.88,
        scaleY: 0.88,
        duration: 90,
        yoyo: true,
        ease: 'Back.easeOut',
      });
      return;
    }
    this.dragging = item;
    this.dragOrigin = item.tubeIndex;
    this.dragStartX = item.body.x;
    this.dragStartY = item.body.y;
    item.setDepth(100);
    this.tweens.killTweensOf(item.body);
    this.tweens.add({
      targets: item.body,
      scaleX: 1.12,
      scaleY: 1.12,
      angle: -3,
      duration: 150,
      ease: 'Back.easeOut',
    });
    this.tubes.forEach((tube) => tube.setHighlight(false));
  }
  dragItem(item, x, y) {
    if (this.dragging !== item) return;
    item.setPosition(x, y);
    this.tubes.forEach((tube) => tube.setHighlight(tube.contains(x, y)));
  }
  endDrag(item) {
    if (this.dragging !== item) return;
    const target = this.tubes.findIndex((tube) =>
      tube.contains(item.body.x, item.body.y),
    );
    this.tubes.forEach((tube) => tube.setHighlight(false));
    const source = this.tubes[this.dragOrigin];
    let accepted = false;
    if (
      target >= 0 &&
      target !== this.dragOrigin &&
      this.tubes[target].items.length < this.tubes[target].capacity
    ) {
      const releaseX = item.body.x;
      const releaseY = item.body.y;
      source.pop();
      const destination = this.tubes[target];
      destination.push(item);
      const destinationX = item.body.x;
      const destinationY = item.body.y;
      item.setPosition(releaseX, releaseY);
      item.tubeIndex = target;
      this.moves++;
      this.ui.setMoves(this.moves);
      accepted = true;
      this.animateItemTo(
        item,
        destinationX,
        destinationY,
        0,
        this.isSolved() ? () => this.win() : null,
      );
    }
    if (!accepted) {
      source.layout();
      const returnX = item.body.x;
      const returnY = item.body.y;
      this.animateItemTo(item, returnX, returnY);
    }
    item.setDepth(10);
    this.dragging = null;
  }
  animateIdle(item, order) {
    this.tweens.add({
      targets: item.body,
      angle: 2,
      duration: 900 + (order % 4) * 120,
      delay: (order % 4) * 90,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
  animateItemTo(item, x, y, angle = 0, onComplete = null) {
    this.tweens.killTweensOf(item.body);
    const arcX = (item.body.x + x) / 2;
    const arcY = Math.min(item.body.y, y) - 110;
    this.tweens.add({
      targets: item.body,
      x: arcX,
      y: arcY,
      angle: angle - 8,
      scaleX: 1.16,
      scaleY: 1.16,
      duration: 140,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: item.body,
          x,
          y,
          angle,
          scaleX: 1,
          scaleY: 1,
          duration: 220,
          ease: 'Bounce.easeOut',
          onComplete: () =>
            onComplete
              ? onComplete()
              : this.animateIdle(item, this.items.indexOf(item) + 1),
        });
      },
    });
  }
  isSolved() {
    return this.tubes.every(
      (tube, i) =>
        tube.items.every(
          (item) => item.data.category === this.levelData.categories[i],
        ) || tube.items.length === 0,
    );
  }
  win() {
    this.completed = true;
    this.ui.showWin(
      this.moves,
      this.level < 10 ? 'Next level  →' : 'Back to worlds',
      () => {
        if (this.level < 10)
          this.scene.restart({
            mode: this.mode,
            level: this.level + 1,
            levels: this.levels,
          });
        else this.scene.start('MenuScene');
      },
    );
  }
}

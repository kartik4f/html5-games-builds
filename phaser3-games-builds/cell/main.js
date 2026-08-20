import Phaser from 'phaser';

const WIDTH = 1920;
const HEIGHT = 1080;

const CELL_COUNT = 60;
const PARTICLE_COUNT = 400;

class TissueScene extends Phaser.Scene {
  constructor() {
    super('TissueScene');
  }

  create() {
    //--------------------------------------
    // Background
    //--------------------------------------

    this.cameras.main.setBackgroundColor(0x170c23);

    //--------------------------------------
    // Large Gradient Background
    //--------------------------------------

    this.bg = this.add.graphics();

    this.drawBackground();

    //--------------------------------------
    // Containers
    //--------------------------------------

    this.cellLayer = this.add.container();
    this.particleLayer = this.add.container();

    //--------------------------------------
    // World
    //--------------------------------------

    this.cells = [];
    this.particles = [];

    this.createCells();
    this.createParticles();

    //--------------------------------------
    // Camera Drift
    //--------------------------------------

    this.camTime = 0;
  }

  //-------------------------------------------------
  // Background
  //-------------------------------------------------

  drawBackground() {
    this.bg.clear();

    for (let i = 0; i < 40; i++) {
      const alpha = 0.04;

      this.bg.fillStyle(0x35164c, alpha);

      this.bg.fillCircle(WIDTH / 2, HEIGHT / 2, 900 - i * 20);
    }
  }

  //-------------------------------------------------
  // Cells
  //-------------------------------------------------

  createCells() {
    for (let i = 0; i < CELL_COUNT; i++) {
      const x = Phaser.Math.Between(-500, WIDTH + 500);
      const y = Phaser.Math.Between(-500, HEIGHT + 500);

      const r = Phaser.Math.Between(80, 180);

      const graphics = this.add.graphics();

      graphics.x = x;
      graphics.y = y;

      graphics.radius = r;

      graphics.phase = Math.random() * Math.PI * 2;

      graphics.speed = Phaser.Math.FloatBetween(0.5, 1.5);

      graphics.nucleusOffset = Phaser.Math.Between(-20, 20);

      this.drawCell(graphics);

      this.cellLayer.add(graphics);

      this.cells.push(graphics);
    }
  }

  drawCell(g) {
    const r = g.radius;

    g.clear();

    //--------------------------------------
    // Outer Glow
    //--------------------------------------

    g.fillStyle(0xff77dd, 0.08);
    g.fillCircle(0, 0, r + 20);

    //--------------------------------------
    // Membrane
    //--------------------------------------

    g.fillStyle(0xff9ce3, 0.18);
    g.fillCircle(0, 0, r);

    g.lineStyle(4, 0xffffff, 0.25);
    g.strokeCircle(0, 0, r);

    //--------------------------------------
    // Cytoplasm
    //--------------------------------------

    g.fillStyle(0xffd2f6, 0.08);
    g.fillCircle(0, 0, r * 0.8);

    //--------------------------------------
    // Nucleus
    //--------------------------------------

    g.fillStyle(0x8a2be2, 0.7);

    g.fillCircle(r * 0.18, g.nucleusOffset, r * 0.25);

    //--------------------------------------
    // Organelles
    //--------------------------------------

    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;

      const dist = Math.random() * r * 0.6;

      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;

      g.fillStyle(Phaser.Display.Color.RandomRGB().color, 0.35);

      g.fillEllipse(px, py, 10, 5);
    }
  }

  //-------------------------------------------------
  // Floating Particles
  //-------------------------------------------------

  createParticles() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const circle = this.add.circle(
        Phaser.Math.Between(0, WIDTH),

        Phaser.Math.Between(0, HEIGHT),

        Phaser.Math.Between(1, 4),

        0xffffff,

        Phaser.Math.FloatBetween(0.15, 0.5),
      );

      circle.vx = Phaser.Math.FloatBetween(-0.2, 0.2);
      circle.vy = Phaser.Math.FloatBetween(-0.2, 0.2);

      this.particleLayer.add(circle);

      this.particles.push(circle);
    }
  }

  //-------------------------------------------------
  // Update
  //-------------------------------------------------

  update(time, delta) {
    const t = time * 0.001;

    //--------------------------------------
    // Breathing Cells
    //--------------------------------------

    this.cells.forEach((cell) => {
      const s = 1 + Math.sin(t * cell.speed + cell.phase) * 0.03;

      cell.setScale(s);
    });

    //--------------------------------------
    // Brownian Motion
    //--------------------------------------

    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      p.vx += Phaser.Math.FloatBetween(-0.01, 0.01);

      p.vy += Phaser.Math.FloatBetween(-0.01, 0.01);

      p.vx = Phaser.Math.Clamp(p.vx, -0.4, 0.4);

      p.vy = Phaser.Math.Clamp(p.vy, -0.4, 0.4);

      if (p.x < 0) p.x = WIDTH;
      if (p.x > WIDTH) p.x = 0;
      if (p.y < 0) p.y = HEIGHT;
      if (p.y > HEIGHT) p.y = 0;
    });

    //--------------------------------------
    // Camera Drift
    //--------------------------------------

    this.camTime += delta * 0.00015;

    this.cameras.main.scrollX = Math.sin(this.camTime) * 15;

    this.cameras.main.scrollY = Math.cos(this.camTime * 0.8) * 12;
  }
}

new Phaser.Game({
  type: Phaser.AUTO,

  width: WIDTH,

  height: HEIGHT,

  parent: 'game',

  backgroundColor: '#170c23',

  scene: [TissueScene],

  scale: {
    mode: Phaser.Scale.FIT,

    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});

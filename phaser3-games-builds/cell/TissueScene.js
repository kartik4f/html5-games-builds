class TissueScene extends Phaser.Scene {
  constructor() {
    super('TissueScene');
  }

  create() {
    //--------------------------------
    // Background
    //--------------------------------

    this.cameras.main.setBackgroundColor(0x0b0716);

    this.bg = this.add.graphics();

    this.drawGradient();
    this.createParticleTexture();
    this.createFlowField();
    this.frameCount = 0;
    this.tissueBlobs = [];
    this.createMembraneTexture();
    this.createTissue();
    this.fluidParticles = [];

    this.createFluid();
    this.matrixGraphics = this.add.graphics();
    this.matrixGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.matrixLines = [];

    this.createMatrix();
    this.backgroundCells = [];
    this.foregroundBlobs = [];

    this.createBackgroundCells();
    this.createForegroundBlobs();
    this.createVignette();
    //--------------------------------
    // Camera
    //--------------------------------

    this.cameraTime = 0;
  }

  createFlowField() {
    //--------------------------------
    // No noise-field lookup table needed —
    // getFlow() below is a cheap analytic
    // curl-like function, sampled live by
    // whatever calls it. Sharing one function
    // is what makes every object's motion
    // feel like one current instead of
    // independent per-object wobble.
    //--------------------------------

    this.flowScale = 0.0016;
    this.flowSpeed = 0.00012;
  }

  getFlow(x, y, time) {
    const s = this.flowScale;
    const t = time * this.flowSpeed;

    const angle =
      Math.sin(x * s + t) * Math.cos(y * s * 1.3 - t * 0.8) * Math.PI +
      Math.sin((x + y) * s * 0.6 + t * 1.7) * 0.6;

    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
  }

  createVignette() {
    const g = this.add.graphics();

    g.fillStyle(0x000000, 0.18);

    g.fillRect(0, 0, WIDTH, 80);
    g.fillRect(0, HEIGHT - 80, WIDTH, 80);

    g.fillRect(0, 0, 80, HEIGHT);
    g.fillRect(WIDTH - 80, 0, 80, HEIGHT);

    g.setScrollFactor(0);
  }

  createBackgroundCells() {
    const COUNT = 180;

    for (let i = 0; i < COUNT; i++) {
      const r = Phaser.Math.Between(8, 18);

      const cell = this.add.image(
        Phaser.Math.Between(-200, WIDTH + 200),

        Phaser.Math.Between(-200, HEIGHT + 200),

        'particleDot',
      );

      cell.setTint(0xffb6df);
      cell.setAlpha(Phaser.Math.FloatBetween(0.03, 0.08));

      //--------------------------------
      // sizeScale maps the 64px shared
      // texture down to this cell's radius;
      // breathing multiplies on top of it.
      //--------------------------------

      cell.sizeScale = (r * 2) / 64;
      cell.setScale(cell.sizeScale);

      cell.speed = Phaser.Math.FloatBetween(0.03, 0.08);

      cell.seed = Math.random() * 1000;

      cell.baseScale = Phaser.Math.FloatBetween(0.8, 1.3);

      this.backgroundCells.push(cell);
    }
  }

  createForegroundBlobs() {
    const COUNT = 12;

    for (let i = 0; i < COUNT; i++) {
      const r = Phaser.Math.Between(180, 320);

      const blob = this.add.image(
        Phaser.Math.Between(-300, WIDTH + 300),

        Phaser.Math.Between(-300, HEIGHT + 300),

        'particleDot',
      );

      blob.setDisplaySize(r * 2, r * 2);
      blob.setTint(0xff88d8);
      blob.setAlpha(0.025);

      blob.speed = Phaser.Math.FloatBetween(0.02, 0.05);

      blob.seed = Math.random() * 1000;

      this.foregroundBlobs.push(blob);
    }
  }

  createMatrix() {
    const COUNT = 45;

    for (let i = 0; i < COUNT; i++) {
      const line = {
        y: Phaser.Math.Between(-100, HEIGHT + 100),

        amplitude: Phaser.Math.Between(8, 25),

        frequency: Phaser.Math.FloatBetween(0.002, 0.006),

        speed: Phaser.Math.FloatBetween(0.0004, 0.0012),

        thickness: Phaser.Math.FloatBetween(1, 3),

        alpha: Phaser.Math.FloatBetween(0.04, 0.12),

        seed: Math.random() * 1000,
      };

      this.matrixLines.push(line);
    }
  }

  drawMatrix(time) {
    const g = this.matrixGraphics;

    g.clear();

    for (const line of this.matrixLines) {
      const flow = this.getFlow(WIDTH / 2, line.y, time);
      const flowBoost = 1 + Math.abs(flow.y) * 0.6;

      g.lineStyle(
        line.thickness,

        0xffc9f8,

        line.alpha,
      );

      g.beginPath();

      for (let x = -50; x <= WIDTH + 50; x += 32) {
        const y =
          line.y +
          Math.sin(x * line.frequency + time * line.speed + line.seed) *
            line.amplitude *
            flowBoost;

        if (x == -50) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }

      g.strokePath();
    }
  }

  createFluid() {
    const COUNT = 900;

    for (let i = 0; i < COUNT; i++) {
      const r = Phaser.Math.FloatBetween(1, 4);

      const colors = [0xffffff, 0xfff4b0, 0x8ee8ff, 0xffc8ef];

      const p = this.add.image(
        Phaser.Math.Between(-100, WIDTH + 100),
        Phaser.Math.Between(-100, HEIGHT + 100),

        'particleDot',
      );

      p.setDisplaySize(r * 2, r * 2);
      p.setTint(Phaser.Utils.Array.GetRandom(colors));
      p.setAlpha(Phaser.Math.FloatBetween(0.08, 0.35));

      //--------------------------------
      // Store motion data
      //--------------------------------

      p.seed = Math.random() * 1000;

      p.speed = Phaser.Math.FloatBetween(0.15, 0.45);

      p.flow = Phaser.Math.FloatBetween(0.2, 0.8);

      p.vx = 0;
      p.vy = 0;

      p.depthFactor = Phaser.Math.FloatBetween(0.4, 1);

      p.baseAlpha = p.alpha;

      this.fluidParticles.push(p);
    }
  }

  createOrganicBlob(x, y, radius, color = 0xff9ad8) {
    const blob = this.add.graphics();

    blob.x = x;
    blob.y = y;

    blob.baseRadius = radius;

    blob.color = color;

    blob.seed = Math.random() * 1000;

    blob.points = [];

    const POINTS = 24;

    for (let i = 0; i < POINTS; i++) {
      blob.points.push({
        angle: ((Math.PI * 2) / POINTS) * i,

        offset: Phaser.Math.FloatBetween(-12, 12),

        speed: Phaser.Math.FloatBetween(0.8, 1.6),
      });
    }

    //--------------------------------
    // Organelles — mitochondria and
    // vesicles scattered inside the cell,
    // each with its own slow orbit
    //--------------------------------

    blob.organelles = [];

    const organelleCount = Phaser.Math.Between(3, 6);

    for (let i = 0; i < organelleCount; i++) {
      blob.organelles.push({
        angle: Math.random() * Math.PI * 2,
        dist: Phaser.Math.FloatBetween(0.3, 0.7),
        size: Phaser.Math.FloatBetween(4, 9),
        type: Math.random() < 0.5 ? 'mito' : 'vesicle',
        orbitSpeed: Phaser.Math.FloatBetween(0.00006, 0.00015),
        seed: Math.random() * 1000,
      });
    }

    this.drawOrganicBlob(blob, 0);

    return blob;
  }
  drawOrganicBlob(blob, time) {
    const g = blob;

    g.clear();

    //--------------------------------
    // Glow
    //--------------------------------

    g.fillStyle(0xff8ad8, 0.02);
    g.fillCircle(0, 0, blob.baseRadius + 80);

    g.fillStyle(0xff8ad8, 0.03);
    g.fillCircle(0, 0, blob.baseRadius + 50);

    g.fillStyle(0xff8ad8, 0.04);
    g.fillCircle(0, 0, blob.baseRadius + 25);

    //--------------------------------
    // Cell Body
    //--------------------------------

    g.fillStyle(blob.color, 0.16);

    g.beginPath();

    blob.points.forEach((p, index) => {
      const wave =
        Math.sin(time * 0.001 * p.speed + p.angle * 4 + blob.seed) * 8;

      const r = blob.baseRadius + p.offset + wave;

      const x = Math.cos(p.angle) * r;

      const y = Math.sin(p.angle) * r;

      if (index === 0) {
        g.moveTo(x, y);
      } else {
        g.lineTo(x, y);
      }
    });

    g.closePath();

    g.fillPath();

    //--------------------------------
    // Membrane — a soft double stroke to
    // suggest a lipid bilayer rather than
    // one flat line
    //--------------------------------

    g.lineStyle(
      2,

      0xffffff,

      0.15,
    );

    g.strokePath();

    g.lineStyle(
      6,

      blob.color,

      0.05,
    );

    g.strokePath();

    //--------------------------------
    // Organelles — drawn before the
    // nucleus so the nucleus sits on top
    //--------------------------------

    for (const o of blob.organelles) {
      const orbitAngle = o.angle + time * o.orbitSpeed;
      const wobble = Math.sin(time * 0.0006 + o.seed) * 4;
      const d = blob.baseRadius * o.dist + wobble;

      const ox = Math.cos(orbitAngle) * d;
      const oy = Math.sin(orbitAngle) * d;

      if (o.type === 'mito') {
        g.fillStyle(0x8a3fae, 0.35);
        g.fillEllipse(ox, oy, o.size * 1.8, o.size * 0.9);
      } else {
        g.fillStyle(0xffffff, 0.22);
        g.fillCircle(ox, oy, o.size * 0.4);
      }
    }

    //--------------------------------
    // Nucleus
    //--------------------------------

    const nucleusX = Math.sin(time * 0.001 + blob.seed) * 8;
    const nucleusY = Math.cos(time * 0.0013 + blob.seed) * 6;

    g.fillStyle(
      0x6b29ff,

      0.55,
    );

    g.fillCircle(
      nucleusX,

      nucleusY,

      blob.baseRadius * 0.22,
    );

    //--------------------------------
    // Nucleolus — a small dense speck
    // inside the nucleus
    //--------------------------------

    g.fillStyle(0x3d0d66, 0.6);

    g.fillCircle(
      nucleusX + blob.baseRadius * 0.06,
      nucleusY - blob.baseRadius * 0.04,
      blob.baseRadius * 0.06,
    );
  }
  createTissue() {
    const COUNT = 28;

    for (let i = 0; i < COUNT; i++) {
      const x = Phaser.Math.Between(-100, WIDTH + 100);

      const y = Phaser.Math.Between(-100, HEIGHT + 100);

      const r = Phaser.Math.Between(90, 220);

      //--------------------------------
      // Slight per-cell color variance —
      // real cells aren't perfectly uniform
      //--------------------------------

      const base = Phaser.Display.Color.ValueToColor(0xff9ad8);

      const cellColor = Phaser.Display.Color.GetColor(
        Phaser.Math.Clamp(base.red + Phaser.Math.Between(-20, 20), 0, 255),
        Phaser.Math.Clamp(base.green + Phaser.Math.Between(-15, 15), 0, 255),
        Phaser.Math.Clamp(base.blue + Phaser.Math.Between(-20, 20), 0, 255),
      );

      const blob = this.createOrganicBlob(
        x,
        y,
        r,

        cellColor,
      );

      blob.speed = Phaser.Math.FloatBetween(0.4, 1.2);

      blob.phase = Math.random() * 1000;

      this.tissueBlobs.push(blob);
    }
  }

  createParticleTexture() {
    //--------------------------------
    // One shared texture for every dot-like
    // object (fluid, background cells,
    // foreground blobs). This lets WebGL
    // batch hundreds of objects into a
    // handful of draw calls instead of one
    // draw call per object.
    //--------------------------------

    const size = 64;
    const g = this.make.graphics({ add: false });

    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2, size / 2, size / 2);

    g.generateTexture('particleDot', size, size);
    g.destroy();
  }

  createMembraneTexture() {
    const g = this.make.graphics({ add: false });

    g.fillStyle(0xffa5dc, 0.18);
    g.lineStyle(2, 0xffffff, 0.18);

    const radius = 140;

    g.beginPath();

    for (let i = 0; i < 32; i++) {
      const angle = ((Math.PI * 2) / 32) * i;

      const r = radius + Phaser.Math.Between(-8, 8);

      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;

      if (i === 0) g.moveTo(x + radius + 20, y + radius + 20);
      else g.lineTo(x + radius + 20, y + radius + 20);
    }

    g.closePath();
    g.fillPath();
    g.strokePath();

    g.generateTexture(
      'cellMembrane',

      radius * 2 + 40,

      radius * 2 + 40,
    );

    g.destroy();
  }

  drawGradient() {
    const g = this.bg;

    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;

    const colors = [0x0b0716, 0x1b1030, 0x31174b, 0x58236d, 0x873d93];

    let radius = 1200;

    for (let i = 0; i < colors.length; i++) {
      g.fillStyle(colors[i], 0.25);

      g.fillCircle(cx, cy, radius);

      radius -= 180;
    }
  }

  update(time, delta) {
    this.frameCount++;

    //--------------------------------
    // Graphics re-tessellation (organic
    // blob outlines, ECM lines) is the
    // most expensive work per frame.
    // The wobble is slow enough that
    // redrawing every other frame is
    // visually indistinguishable but
    // roughly halves that cost.
    //--------------------------------

    const redrawShapes = this.frameCount % 2 === 0;

    this.cameraTime += delta * 0.00015;

    const cam = this.cameras.main;

    cam.scrollX = Math.sin(this.cameraTime) * 8;

    cam.scrollY = Math.cos(this.cameraTime * 0.7) * 6;

    cam.setZoom(1 + Math.sin(this.cameraTime * 0.8) * 0.01);
    for (const blob of this.tissueBlobs) {
      if (redrawShapes) {
        this.drawOrganicBlob(blob, time);
      }

      const flow = this.getFlow(blob.x, blob.y, time);

      blob.x += Math.sin(time * 0.0002 + blob.seed) * 0.05 + flow.x * 0.025;

      blob.y += Math.cos(time * 0.00018 + blob.seed) * 0.05 + flow.y * 0.025;
    } //--------------------------------
    // Fluid Simulation
    //--------------------------------

    for (const p of this.fluidParticles) {
      //--------------------------------
      // Shared current (flow field)
      //--------------------------------

      const flow = this.getFlow(p.x, p.y, time);

      p.x += flow.x * p.flow;
      p.y += flow.y * p.flow * 0.6;

      //--------------------------------
      // True Brownian motion — a damped
      // random walk, not a periodic sine,
      // so particles never repeat a path
      //--------------------------------

      p.vx = (p.vx + (Math.random() - 0.5) * 0.06) * 0.94;
      p.vy = (p.vy + (Math.random() - 0.5) * 0.06) * 0.94;

      p.x += p.vx;
      p.y += p.vy;

      //--------------------------------
      // Twinkle
      //--------------------------------

      p.alpha = p.baseAlpha + Math.sin(time * 0.002 + p.seed) * 0.05;

      //--------------------------------
      // Wrap
      //--------------------------------

      if (p.x > WIDTH + 120) {
        p.x = -120;

        p.y = Phaser.Math.Between(
          -50,

          HEIGHT + 50,
        );
      }
    }
    if (redrawShapes) {
      this.drawMatrix(time);
    }

    //------------------------------------
    // Background Cells
    //------------------------------------

    for (const cell of this.backgroundCells) {
      cell.x += cell.speed;

      cell.y += Math.sin(time * 0.00025 + cell.seed) * 0.08;

      cell.setScale(
        cell.sizeScale *
          (cell.baseScale + Math.sin(time * 0.001 + cell.seed) * 0.05),
      );

      if (cell.x > WIDTH + 220) {
        cell.x = -220;

        cell.y = Phaser.Math.Between(-100, HEIGHT + 100);
      }
    }

    //------------------------------------
    // Foreground Tissue
    //------------------------------------

    for (const blob of this.foregroundBlobs) {
      blob.x += blob.speed;

      blob.y += Math.cos(time * 0.0002 + blob.seed) * 0.05;

      blob.alpha = 0.02 + Math.sin(time * 0.0007 + blob.seed) * 0.01;

      if (blob.x > WIDTH + 350) {
        blob.x = -350;

        blob.y = Phaser.Math.Between(-150, HEIGHT + 150);
      }
    }
  }
}

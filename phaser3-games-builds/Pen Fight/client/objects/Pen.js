class Pen {
  constructor(scene, x, y, color, id, isLocal) {
    this.scene = scene;
    this.id = id;
    this.color = color;
    this.isLocal = isLocal;

    this.body = scene.matter.add.rectangle(x, y, 24, 80, {
      chamfer: { radius: 8 },
      friction: 0.05,
      frictionAir: 0.02,
      restitution: 0.7,
      density: 0.002,
    });

    this.sprite = scene.add.rectangle(x, y, 24, 80, color);
    this.sprite.setOrigin(0.5);
    this.sprite.setStrokeStyle(2, 0xffffff);

    this.text = scene.add
      .text(x, y, isLocal ? 'YOU' : `P${id.slice(-2)}`, {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5, -1.4);
    this.spriteDepth = 1;
  }

  setRotation(angle) {
    this.scene.matter.body.setAngle(this.body, angle);
    this.sprite.rotation = angle;
  }

  setPosition(x, y) {
    this.scene.matter.body.setPosition(this.body, { x, y });
    this.sprite.setPosition(x, y);
    this.text.setPosition(x, y);
  }

  setState({ x, y, angle }) {
    if (typeof x === 'number' && typeof y === 'number') {
      this.setPosition(x, y);
    }
    if (typeof angle === 'number') {
      this.setRotation(angle);
    }
  }

  getState() {
    const { x, y } = this.body.position;
    const angle = this.body.angle;
    return {
      x,
      y,
      angle,
      velocityX: this.body.velocity.x,
      velocityY: this.body.velocity.y,
      angularVelocity: this.body.angularVelocity,
    };
  }

  update() {
    const { x, y } = this.body.position;
    const angle = this.body.angle;
    this.sprite.setPosition(x, y);
    this.sprite.rotation = angle;
    this.text.setPosition(x, y);
  }

  applyForce(force) {
    this.scene.matter.body.applyForce(this.body, this.body.position, force);
  }

  setTint(color) {
    this.sprite.setFillStyle(color);
  }
}

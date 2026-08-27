export default class Item {
  constructor(scene, data) {
    this.scene = scene;
    this.data = data;
    this.radius = 52;
    this.body = scene.add.container(0, 0);
    this.shape = scene.add
      .circle(0, 0, 52, 0xfde68a, 1)
      .setStrokeStyle(5, 0xb45309, 1);
    this.sphereShade = data.shape
      ? null
      : scene.add.circle(4, 7, 47, 0x92400e, 0.22);
    this.sphereHighlight = data.shape
      ? null
      : scene.add.circle(-11, -13, 37, 0xffffff, 0.16);
    this.sphereShine = data.shape
      ? null
      : scene.add.circle(-22, -26, 11, 0xffffff, 0.5);
    this.text = scene.add
      .text(0, 0, String(data.value), {
        fontFamily: 'Fredoka',
        fontSize: data.fontSize || this.getFontSize(data.value),
        fontStyle: 'bold',
        color: '#431407',
        align: 'center',
        wordWrap: { width: 0 },
      })
      .setOrigin(0.5);
    this.body.add(
      [
        this.shape,
        this.sphereShade,
        this.sphereHighlight,
        this.sphereShine,
        this.text,
      ].filter(Boolean),
    );
    this.useLighting();
    this.body
      .setSize(108, 108)
      .setInteractive({ useHandCursor: true, draggable: true });
    this.body.on('dragstart', () => scene.beginDrag(this));
    this.body.on('drag', (_, x, y) => scene.dragItem(this, x, y));
    this.body.on('dragend', () => scene.endDrag(this));
  }
  getFontSize(value) {
    const length = String(value).length;
    return `${Math.max(14, Math.min(31, Math.floor(88 / (0.62 * Math.max(length, 1)))))}px`;
  }
  setPosition(x, y) {
    this.body.setPosition(x, y);
    if (this.light) {
      this.light.x = x;
      this.light.y = y;
    }
  }
  useLighting() {
    if (this.scene.lights) {
      if (!this.light) {
        this.light = this.scene.lights.addLight(0, 0, 86, 0xffd166, 0.45);
      }
      this.light.x = this.body.x;
      this.light.y = this.body.y;
    }
    this.body.list.forEach((child) => {
      if (child && child.setPipeline) child.setPipeline('Light2D');
    });
  }
  setDepth(d) {
    this.body.setDepth(d);
  }
  setScale(s) {
    this.body.setScale(s);
  }
  setTint(t) {
    this.shape.setFillStyle(t);
  }
  destroy() {
    if (this.light) this.light.destroy();
    this.body.destroy(true);
  }
}

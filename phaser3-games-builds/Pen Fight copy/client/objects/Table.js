class Table {
  constructor(scene, x, y, width, height) {
    this.scene = scene;
    // Visual table representation only - no physical walls
    // Pens fall off edges naturally
    this.tableBody = scene.add.rectangle(x, y, width, height, 0x222222);
    this.tableBody.setStrokeStyle(4, 0xffffff);
    this.tableBody.setDepth(0);
  }
}

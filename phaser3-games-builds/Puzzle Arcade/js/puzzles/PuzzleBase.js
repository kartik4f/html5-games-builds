//==================================================
// puzzles/PuzzleBase.js
//==================================================
//
// Shared contract for the five puzzle modules. A puzzle owns `this.state`
// (plain-JSON-cloneable, undo/redo and level-cache all operate on it via
// Utils.clone) and is responsible for drawing itself into the scene's
// 600x600 board container and reacting to input forwarded by GameScene.
//
// Subclasses implement:
//   generate(level, rng)   - build a fresh this.state for a level
//   redraw()                - (re)create this puzzle's board GameObjects
//   isSolved()               - win condition
//   hint()                   - perform one guided step (calls scene.record()
//                              itself, then scene.afterMutate())
// and optionally:
//   onPointerDown/Move/Up(x, y) - local board coords, 0..600
//   onWheel(dy, x, y)
//   onKey(dirIndex)          - 0=Right,1=Down,2=Left,3=Up (DIRS4 order)

export default class PuzzleBase {
  constructor(scene) {
    this.scene = scene;
    this.state = null;
    this.objects = [];
  }

  // Tracks a GameObject so it gets cleaned up on the next redraw, and
  // parents it under the board container.
  addToBoard(obj) {
    this.scene.boardContainer.add(obj);
    this.objects.push(obj);
    return obj;
  }

  clearObjects() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }

  draw() {
    this.clearObjects();
    this.redraw();
  }

  destroy() {
    this.clearObjects();
  }
}

//==================================================
// PenManager.js
//==================================================

import Pen from './Pen.js';
import { PEN, INPUT } from './Constants.js';

export default class PenManager {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;

    this.pens = [];
  }

  //--------------------------------------------------
  // Create Default Pens
  //--------------------------------------------------

  createDefaultPens() {
    this.createPen(350, 250, PEN.COLORS[0], 0);
    this.createPen(650, 360, PEN.COLORS[1], 1);
    this.createPen(930, 260, PEN.COLORS[2], 2);
  }

  //--------------------------------------------------
  // Create One Pen
  //--------------------------------------------------

  createPen(x, y, color, playerId) {
    const pen = new Pen(this.scene, this.physics, x, y, color, playerId);

    this.pens.push(pen);

    return pen;
  }

  //--------------------------------------------------
  // Remove Pen
  //--------------------------------------------------

  removePen(pen) {
    const index = this.pens.indexOf(pen);

    if (index === -1) return;

    pen.destroy();

    this.pens.splice(index, 1);
  }

  //--------------------------------------------------
  // Update
  //--------------------------------------------------

  update() {
    for (const pen of this.pens) {
      pen.update();
    }
  }

  //--------------------------------------------------
  // Get All Pens
  //--------------------------------------------------

  getPens() {
    return this.pens;
  }

  //--------------------------------------------------
  // Find Pen Under Cursor
  //--------------------------------------------------

  getPenAt(x, y) {
    // Search from top-most to bottom-most.
    // This matters if pens overlap.

    for (let i = this.pens.length - 1; i >= 0; i--) {
      const pen = this.pens[i];

      if (!pen.containsPoint(x, y)) continue;

      return pen;
    }

    return null;
  }

  //--------------------------------------------------
  // Clear Selection
  //--------------------------------------------------

  clearSelection() {
    for (const pen of this.pens) {
      pen.setSelected(false);
    }
  }

  //--------------------------------------------------
  // Select One Pen
  //--------------------------------------------------

  selectPen(pen) {
    this.clearSelection();

    if (pen) {
      pen.setSelected(true);
    }
  }

  //--------------------------------------------------
  // Are Any Pens Moving?
  //--------------------------------------------------

  areAnyMoving() {
    for (const pen of this.pens) {
      if (pen.isMoving()) return true;
    }

    return false;
  }

  //--------------------------------------------------
  // Are All Pens Sleeping?
  //--------------------------------------------------

  areAllSleeping() {
    return !this.areAnyMoving();
  }

  //--------------------------------------------------
  // Reset All Pens
  //--------------------------------------------------

  reset() {
    this.pens[0]?.reset(350, 250);

    this.pens[1]?.reset(650, 360);

    this.pens[2]?.reset(930, 260);
  }

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    for (const pen of this.pens) {
      pen.destroy();
    }

    this.pens.length = 0;
  }

  //   --------------------------------------------------
  //   Get Pen Count
  //   --------------------------------------------------

  getPenCount() {
    return this.pens.length;
  }

  //   --------------------------------------------------
  //   Are Any Pens Moving?
  //   --------------------------------------------------

  areAnyMoving() {
    return this.pens.some((p) => p.isMoving());
  }
}

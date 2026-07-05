//==================================================
// InputController.js
//==================================================

import { INPUT } from './Constants.js';

export default class InputController {
  constructor(scene, penManager, gameRules) {
    this.scene = scene;
    this.penManager = penManager;
    this.gameRules = gameRules;

    this.selectedPen = null;

    this.dragStart = null;
    this.dragCurrent = null;

    this.localPoint = null;

    this.activePointerId = null;

    this.aimGraphics = scene.add.graphics();

    this.registerEvents();
  }

  //--------------------------------------------------
  // Events
  //--------------------------------------------------

  registerEvents() {
    this.scene.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      this.onPointerDown,
      this,
    );

    this.scene.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      this.onPointerMove,
      this,
    );

    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
  }

  //--------------------------------------------------
  // Pointer Down
  //--------------------------------------------------

  onPointerDown(pointer) {
    if (!this.gameRules.canPlayerInteract()) return;

    if (this.activePointerId !== null) return;
    // Another pointer is already aiming
    if (this.activePointerId !== null) return;

    const pen = this.gameRules.getCurrentPen();

    if (!pen) return;

    // Must actually touch the active pen
    if (!pen.containsPoint(pointer.worldX, pointer.worldY)) return;

    if (pen.isMoving()) return;

    this.activePointerId = pointer.id;

    if (!pen) return;

    if (!this.gameRules.alivePens.has(pen)) return;

    this.selectedPen = pen;
    this.penManager.selectPen(pen);

    this.dragStart = {
      x: pointer.worldX,
      y: pointer.worldY,
    };

    this.dragCurrent = {
      ...this.dragStart,
    };

    this.localPoint = pen.getLocalPoint(pointer.worldX, pointer.worldY);
  }

  //--------------------------------------------------
  // Pointer Move
  //--------------------------------------------------

  onPointerMove(pointer) {
    if (pointer.id !== this.activePointerId) return;

    this.dragCurrent.x = pointer.worldX;
    this.dragCurrent.y = pointer.worldY;
  }

  //--------------------------------------------------
  // Pointer Up
  //--------------------------------------------------

  onPointerUp(pointer) {
    if (pointer.id !== this.activePointerId) return;

    this.fire();
  }

  //--------------------------------------------------
  // Fire
  //--------------------------------------------------

  fire() {
    if (!this.gameRules.canPlayerInteract()) {
      this.cancel();
      return;
    }
    let dx = this.dragStart.x - this.dragCurrent.x;
    let dy = this.dragStart.y - this.dragCurrent.y;

    let length = Math.sqrt(dx * dx + dy * dy);

    if (length < INPUT.MIN_DRAG_DISTANCE) {
      this.cancel();

      return;
    }

    if (length > INPUT.MAX_DRAG_DISTANCE) {
      const scale = INPUT.MAX_DRAG_DISTANCE / length;

      dx *= scale;
      dy *= scale;

      length = INPUT.MAX_DRAG_DISTANCE;
    }

    const impulse = {
      x: dx * INPUT.IMPULSE_MULTIPLIER,

      y: dy * INPUT.IMPULSE_MULTIPLIER,
    };

    this.selectedPen.shoot(
      this.localPoint,

      impulse,
    );

    this.cancel();
  }

  //--------------------------------------------------
  // Cancel
  //--------------------------------------------------

  cancel() {
    this.penManager.clearSelection();

    this.selectedPen = null;

    this.dragStart = null;
    this.dragCurrent = null;

    this.localPoint = null;

    this.activePointerId = null;

    this.aimGraphics.clear();
  }

  //--------------------------------------------------
  // Update
  //--------------------------------------------------

  update() {
    this.aimGraphics.clear();

    if (!this.selectedPen) return;

    let dx = this.dragCurrent.x - this.dragStart.x;

    let dy = this.dragCurrent.y - this.dragStart.y;

    const length = Math.sqrt(dx * dx + dy * dy);

    let color = 0x00ff00;

    if (length > 60) color = 0xffff00;

    if (length > 120) color = 0xff0000;

    this.aimGraphics.lineStyle(4, color);

    this.aimGraphics.beginPath();

    this.aimGraphics.moveTo(this.dragStart.x, this.dragStart.y);

    this.aimGraphics.lineTo(this.dragCurrent.x, this.dragCurrent.y);

    this.aimGraphics.strokePath();

    this.aimGraphics.fillStyle(color);

    this.aimGraphics.fillCircle(this.dragCurrent.x, this.dragCurrent.y, 6);
  }
}

/* 
  Pointer
     │
     ▼
InputController
     │
     ▼
PenManager
     │
     ▼
Pen
     │
     ▼
Planck */

//==================================================
// InputController.js
//==================================================

import { INPUT } from './Constants.js';

export default class InputController {
  constructor(scene, penManager, gameRules) {
    this.scene = scene;
    this.penManager = penManager;
    this.gameRules = gameRules;

    // pointer.id -> { pen, dragStart, dragCurrent, localPoint }
    // A Map (instead of single-drag fields) so chaos mode can support
    // several players dragging different pens at the same time.
    this.drags = new Map();

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
    if (this.drags.has(pointer.id)) return;

    const tolerance = pointer.wasTouch ? INPUT.TOUCH_RADIUS : 0;

    const pen = this.findPenForPointer(pointer, tolerance);

    if (!pen) return;

    if (!this.gameRules.canPlayerInteract(pen)) return;

    // Pen is already being dragged by another pointer
    for (const drag of this.drags.values()) {
      if (drag.pen === pen) return;
    }

    // Must actually touch the pen (with extra slack for touch input,
    // since fingers are far less precise than a mouse pointer)
    if (!pen.containsPoint(pointer.worldX, pointer.worldY, tolerance)) return;

    const dragStart = {
      x: pointer.worldX,
      y: pointer.worldY,
    };

    this.drags.set(pointer.id, {
      pen,
      dragStart,
      dragCurrent: { ...dragStart },
      localPoint: pen.getLocalPoint(pointer.worldX, pointer.worldY),
    });

    if (this.gameRules.isChaos) {
      this.penManager.setPenSelected(pen, true);
    } else {
      this.penManager.selectPen(pen);
    }
  }

  //--------------------------------------------------
  // Which pen does this pointer target?
  //--------------------------------------------------

  findPenForPointer(pointer, tolerance) {
    if (this.gameRules.isChaos) {
      return this.penManager.getPenAt(
        pointer.worldX,
        pointer.worldY,
        tolerance,
      );
    }

    return this.gameRules.getCurrentPen();
  }

  //--------------------------------------------------
  // Pointer Move
  //--------------------------------------------------

  onPointerMove(pointer) {
    const drag = this.drags.get(pointer.id);

    if (!drag) return;

    drag.dragCurrent.x = pointer.worldX;
    drag.dragCurrent.y = pointer.worldY;
  }

  //--------------------------------------------------
  // Pointer Up
  //--------------------------------------------------

  onPointerUp(pointer) {
    const drag = this.drags.get(pointer.id);

    if (!drag) return;

    this.fire(pointer.id, drag);
  }

  //--------------------------------------------------
  // Fire
  //--------------------------------------------------

  fire(pointerId, drag) {
    if (!this.gameRules.canPlayerInteract(drag.pen)) {
      this.cancelDrag(pointerId);

      return;
    }

    let dx = drag.dragStart.x - drag.dragCurrent.x;
    let dy = drag.dragStart.y - drag.dragCurrent.y;

    let length = Math.sqrt(dx * dx + dy * dy);

    if (length < INPUT.MIN_DRAG_DISTANCE) {
      this.cancelDrag(pointerId);

      return;
    }

    if (length > INPUT.MAX_DRAG_DISTANCE) {
      const scale = INPUT.MAX_DRAG_DISTANCE / length;

      dx *= scale;
      dy *= scale;

      length = INPUT.MAX_DRAG_DISTANCE;
    }

    //--------------------------------------------------
    // Calculate impulse
    //--------------------------------------------------

    const mass = drag.pen.body.getMass();

    // Normalized drag (0..1)
    const dragAmount = length / INPUT.MAX_DRAG_DISTANCE;

    // Smooth power curve
    const power = Phaser.Math.Easing.Cubic.Out(
      Phaser.Math.Clamp(dragAmount, 0, 1),
    );

    // Final impulse
    const impulse = {
      x: dx * INPUT.IMPULSE_MULTIPLIER * power * mass,

      y: dy * INPUT.IMPULSE_MULTIPLIER * power * mass,
    };

    drag.pen.shoot(drag.localPoint, impulse);

    this.gameRules.onPlayerAction(drag.pen);

    this.cancelDrag(pointerId);
  }

  //--------------------------------------------------
  // Cancel One Drag
  //--------------------------------------------------

  cancelDrag(pointerId) {
    const drag = this.drags.get(pointerId);

    if (!drag) return;

    if (this.gameRules.isChaos) {
      this.penManager.setPenSelected(drag.pen, false);
    } else {
      this.penManager.clearSelection();
    }

    this.drags.delete(pointerId);
  }

  //--------------------------------------------------
  // Cancel Any Drag On A Specific Pen (e.g. it was just eliminated)
  //--------------------------------------------------

  cancelPen(pen) {
    for (const pointerId of [...this.drags.keys()]) {
      if (this.drags.get(pointerId).pen === pen) {
        this.cancelDrag(pointerId);
      }
    }
  }

  //--------------------------------------------------
  // Cancel All Drags
  //--------------------------------------------------

  cancel() {
    for (const pointerId of [...this.drags.keys()]) {
      this.cancelDrag(pointerId);
    }

    this.aimGraphics.clear();
  }

  //--------------------------------------------------
  // Update
  //--------------------------------------------------

  update() {
    this.aimGraphics.clear();

    for (const drag of this.drags.values()) {
      this.drawAim(drag);
    }
  }

  //--------------------------------------------------
  // Draw Aim Line
  //--------------------------------------------------

  drawAim(drag) {
    const dx = drag.dragCurrent.x - drag.dragStart.x;
    const dy = drag.dragCurrent.y - drag.dragStart.y;

    const length = Math.sqrt(dx * dx + dy * dy);

    let color = 0x00ff00;

    if (length > 60) color = 0xffff00;

    if (length > 120) color = 0xff0000;

    this.aimGraphics.lineStyle(4, color);

    this.aimGraphics.beginPath();

    this.aimGraphics.moveTo(drag.dragStart.x, drag.dragStart.y);

    this.aimGraphics.lineTo(drag.dragCurrent.x, drag.dragCurrent.y);

    this.aimGraphics.strokePath();

    this.aimGraphics.fillStyle(color);

    this.aimGraphics.fillCircle(drag.dragCurrent.x, drag.dragCurrent.y, 6);
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

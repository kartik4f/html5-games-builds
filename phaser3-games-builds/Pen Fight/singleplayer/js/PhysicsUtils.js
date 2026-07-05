//==================================================
// PhysicsUtils.js
//==================================================

import { SCALE } from './Constants.js';

export default class PhysicsUtils {
  //--------------------------------------------------
  // Pixels -> World
  //--------------------------------------------------

  static toWorld(value) {
    return value / SCALE;
  }

  //--------------------------------------------------
  // World -> Pixels
  //--------------------------------------------------

  static toPixels(value) {
    return value * SCALE;
  }

  //--------------------------------------------------
  // Pixel Point -> Planck Vec2
  //--------------------------------------------------

  static worldVec(x, y) {
    return planck.Vec2(
      x / SCALE,

      y / SCALE,
    );
  }

  //--------------------------------------------------
  // Planck Vec2 -> Pixel Point
  //--------------------------------------------------

  static pixelVec(vec) {
    return {
      x: vec.x * SCALE,

      y: vec.y * SCALE,
    };
  }

  //--------------------------------------------------
  // Body contains screen point?
  //--------------------------------------------------

  static bodyContainsPoint(body, x, y) {
    const point = this.worldVec(x, y);

    for (
      let fixture = body.getFixtureList();
      fixture;
      fixture = fixture.getNext()
    ) {
      if (fixture.testPoint(point)) {
        return true;
      }
    }

    return false;
  }

  //--------------------------------------------------
  // Local point from pixel coordinates
  //--------------------------------------------------

  static getLocalPoint(body, x, y) {
    return body.getLocalPoint(this.worldVec(x, y));
  }

  //--------------------------------------------------
  // World point from local point
  //--------------------------------------------------

  static getWorldPoint(body, localPoint) {
    return body.getWorldPoint(localPoint);
  }

  //--------------------------------------------------
  // Is body moving?
  //--------------------------------------------------

  static isBodyMoving(body) {
    const linearVelocity = body.getLinearVelocity();
    const angularVelocity = body.getAngularVelocity();

    return (
      linearVelocity.lengthSquared() > 0.002 || Math.abs(angularVelocity) > 0.05
    );
  }

  //--------------------------------------------------
  // Is body sleeping?
  //--------------------------------------------------

  static isBodySleeping(body) {
    return !this.isBodyMoving(body);
  }

  //--------------------------------------------------
  // Stop body immediately
  //--------------------------------------------------

  static stopBody(body) {
    body.setLinearVelocity(planck.Vec2(0, 0));

    body.setAngularVelocity(0);
  }

  //--------------------------------------------------
  // Clamp drag distance
  //--------------------------------------------------

  static clampVector(dx, dy, maxLength) {
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length <= maxLength) {
      return {
        x: dx,

        y: dy,

        length,
      };
    }

    const scale = maxLength / length;

    return {
      x: dx * scale,

      y: dy * scale,

      length: maxLength,
    };
  }

  //--------------------------------------------------
  // Normalize vector
  //--------------------------------------------------

  static normalize(dx, dy) {
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      return {
        x: 0,

        y: 0,

        length: 0,
      };
    }

    return {
      x: dx / length,

      y: dy / length,

      length,
    };
  }
}

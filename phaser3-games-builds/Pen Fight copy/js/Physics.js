//==================================================
// Physics.js
//==================================================

import PhysicsUtils from './PhysicsUtils.js';
import { TABLE } from './Constants.js';

export default class Physics {
  constructor() {
    //------------------------------------------
    // World
    //------------------------------------------

    this.world = planck.World({
      gravity: planck.Vec2(0, 0),
    });
    this.world.setAllowSleeping(true);
    // this.world.setSleepingAllowed(true);

    //------------------------------------------
    // Fixed timestep
    //------------------------------------------

    this.timeStep = 1 / 60;

    this.velocityIterations = 8;
    this.positionIterations = 3;

    //------------------------------------------
    // Static table walls
    //------------------------------------------

    this.createTableBounds();

    //------------------------------------------
    // Collision callbacks
    //------------------------------------------

    // Set by GameScene: (penA, penB, relativeSpeedPx) => void, fired
    // once per real pen-on-pen impact (table-edge sensor contacts are
    // filtered out below).
    this.onPenCollision = null;

    this.registerCollisionEvents();
  }

  //--------------------------------------------------
  // Physics Step
  //--------------------------------------------------

  step() {
    this.world.step(
      this.timeStep,

      this.velocityIterations,

      this.positionIterations,
    );
  }

  //--------------------------------------------------
  // Table Bounds
  //--------------------------------------------------

  createTableBounds() {
    const left = PhysicsUtils.toWorld(TABLE.X);
    const right = PhysicsUtils.toWorld(TABLE.X + TABLE.WIDTH);

    const top = PhysicsUtils.toWorld(TABLE.Y);
    const bottom = PhysicsUtils.toWorld(TABLE.Y + TABLE.HEIGHT);

    const body = this.world.createBody();

    // Top

    body.createFixture(
      planck.Edge(
        planck.Vec2(left, top),

        planck.Vec2(right, top),
      ),
      { isSensor: true },
    );

    // Bottom

    body.createFixture(
      planck.Edge(
        planck.Vec2(left, bottom),

        planck.Vec2(right, bottom),
      ),
      { isSensor: true },
    );

    // Left

    body.createFixture(
      planck.Edge(
        planck.Vec2(left, top),

        planck.Vec2(left, bottom),
      ),
      { isSensor: true },
    );

    // Right

    body.createFixture(
      planck.Edge(
        planck.Vec2(right, top),

        planck.Vec2(right, bottom),
      ),
      { isSensor: true },
    );

    this.tableBody = body;
  }

  //--------------------------------------------------
  // Collision Events
  //--------------------------------------------------

  registerCollisionEvents() {
    this.world.on('begin-contact', this.onBeginContact.bind(this));

    this.world.on('end-contact', this.onEndContact.bind(this));
  }

  //--------------------------------------------------
  // Begin Contact
  //--------------------------------------------------

  onBeginContact(contact) {
    if (!this.onPenCollision) return;

    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();

    // The table-edge fixtures are sensors (no physical bounce) — only
    // real pen-vs-pen fixture contacts should trigger juice.
    if (fixtureA.isSensor() || fixtureB.isSensor()) return;

    const bodyA = fixtureA.getBody();
    const bodyB = fixtureB.getBody();

    const penA = bodyA.penRef;
    const penB = bodyB.penRef;

    if (!penA || !penB || penA === penB) return;

    const vA = bodyA.getLinearVelocity();
    const vB = bodyB.getLinearVelocity();

    const relVx = vA.x - vB.x;
    const relVy = vA.y - vB.y;

    // Planck velocities are in world units (1m = 50px, see
    // PhysicsUtils.SCALE) — convert back to a pixels/sec figure so
    // the caller doesn't need to know about the physics scale.
    const relSpeedPx = Math.sqrt(relVx * relVx + relVy * relVy) * 50;

    this.onPenCollision(penA, penB, relSpeedPx);
  }

  //--------------------------------------------------
  // End Contact
  //--------------------------------------------------

  onEndContact(contact) {}

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    this.world = null;
  }
}

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
    // Future:
    // Collision sounds
    // Hit effects
    // Score detection
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

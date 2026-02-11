const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

const game = new Phaser.Game(config);

let player;
let bullets;
let enemies;
let lastFired = 0;
let colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00]; // Red, Green, Blue, Yellow

function preload() {
  // Load your images here.
  // For now, we will generate textures dynamically so you can run this code immediately!
  this.load.image('bg', 'https://labs.phaser.io/assets/skies/space3.png'); // Placeholder BG
}

function create() {
  // 1. Create Background
  this.add.image(400, 300, 'bg');

  // 2. Create the Pichkari (Player) using a simple graphic for now
  let graphics = this.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(0xffffff, 1);
  graphics.fillRect(0, -10, 40, 20); // Gun shape
  graphics.generateTexture('pichkari', 40, 20);

  player = this.physics.add.sprite(400, 550, 'pichkari');
  player.setCollideWorldBounds(true);

  // 3. Create Bullet Group (The Water)
  // We create a texture for the water drop first
  let dropGfx = this.make.graphics({ x: 0, y: 0, add: false });
  dropGfx.fillStyle(0xffffff, 1);
  dropGfx.fillCircle(5, 5, 5);
  dropGfx.generateTexture('drop', 10, 10);

  bullets = this.physics.add.group({
    defaultKey: 'drop',
    maxSize: 50,
  });

  // 4. Create Enemy Group (The Boring People)
  // Texture for enemy
  let enemyGfx = this.make.graphics({ x: 0, y: 0, add: false });
  enemyGfx.fillStyle(0x888888, 1); // Gray color
  enemyGfx.fillRect(0, 0, 30, 30);
  enemyGfx.generateTexture('enemy', 30, 30);

  enemies = this.physics.add.group();

  // Spawn an enemy every 1 second
  this.time.addEvent({
    delay: 1000,
    callback: spawnEnemy,
    callbackScope: this,
    loop: true,
  });

  // 5. Input Listeners
  this.input.on(
    'pointermove',
    function (pointer) {
      // Rotate player to face the mouse
      let angle = Phaser.Math.Angle.Between(
        player.x,
        player.y,
        pointer.x,
        pointer.y,
      );
      player.setRotation(angle);
    },
    this,
  );

  this.input.on('pointerdown', fireBullet, this);

  // 6. Collisions
  this.physics.add.collider(bullets, enemies, hitEnemy, null, this);
  this.physics.add.collider(player, enemies, gameOver, null, this);
}

function update(time, delta) {
  // Cleanup bullets that go off screen
  bullets.children.each(function (b) {
    if (b.active && (b.y < 0 || b.y > 600 || b.x < 0 || b.x > 800)) {
      b.setActive(false);
      b.setVisible(false);
    }
  });
}

function fireBullet(pointer) {
  let bullet = bullets.get(player.x, player.y);

  if (bullet) {
    bullet.setActive(true);
    bullet.setVisible(true);

    // Randomize the color of the water!
    let randomColor = colors[Math.floor(Math.random() * colors.length)];
    bullet.setTint(randomColor);

    // Physics velocity based on rotation
    this.physics.velocityFromRotation(
      player.rotation,
      400,
      bullet.body.velocity,
    );
  }
}

function spawnEnemy() {
  // Spawn at random x at the top
  let x = Phaser.Math.Between(50, 750);
  let enemy = enemies.create(x, 0, 'enemy');

  // Move towards player
  this.physics.moveToObject(enemy, player, 100);
}

function hitEnemy(bullet, enemy) {
  bullet.setActive(false);
  bullet.setVisible(false);

  // "Color" the enemy
  enemy.setTint(bullet.tintTopLeft); // Turn enemy the color of the bullet
  enemy.setVelocity(0, 0); // Stop moving
  enemy.body.checkCollision.none = true; // Disable further collision

  // Tween to fade them out (simulating them leaving happily)
  this.tweens.add({
    targets: enemy,
    alpha: 0,
    duration: 500,
    onComplete: function () {
      enemy.destroy();
    },
  });
}

function gameOver(player, enemy) {
  this.physics.pause();
  player.setTint(0xff0000);
  alert('Game Over! The vibe has been ruined.');
}

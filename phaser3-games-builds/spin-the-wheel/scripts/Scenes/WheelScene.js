//  import gameModel from '../test-file.js';
//  console.log("gameModel", gameModel);
// const gameModel = require('../test-file.js');
// console.log("gameModel", gameModel);
// PlayGame scene
class WheelScene extends Phaser.Scene {
  // constructor
  constructor() {
    super({ key: "wheelscene" });
  }
  timer = 0;
  resources = 0;
  isGameStarted = false;
  // method to be executed when the scene preloads
  preload() {}

  // method to be executed once the scene has been created
  create() {
    this.isGameStarted = true;
    // starting degrees
    let startDegrees = -90;
    // making a graphic object without adding it to the game
    let graphics = this.make.graphics({
      x: 0,
      y: 0,
      add: false,
    });

    //initialize ui items
    this.fullscreenBtn = this.add.sprite(40, 40, "fullscreenBtn", 0);
    this.fullscreenBtn.setScale(0.5);
    this.pauseBtn = this.add.image(320, 40, "pauseBtn");
    this.pauseBtn.setScale(0.5);

    // Spin button container
    this.spinBtn = this.add.container(180, 670);
    let spinBtnBg = this.add.sprite(0, 0, "spinBtn");
    this.spinBtn.add(spinBtnBg);
    this.spinBtn.scale = 0.35;
    this.spinBtn.getAt(0).setFrame(1);
    let spintBtnText = this.add
      .text(0, 0, "Spin", {
        fontFamily: "Arial Black",
        fontSize: 55,
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.spinBtn.add(spintBtnText);
    this.spinBtn.setInteractive(
      new Phaser.Geom.Rectangle(
        (spinBtnBg.width / 2) * -1,
        (spinBtnBg.height / 2) * -1,
        spinBtnBg.width,
        spinBtnBg.height
      ),
      Phaser.Geom.Rectangle.Contains
    );

    //        Spin button container
    this.claimBtn = this.add.container(280, 540);
    let clianBtnBg = this.add.sprite(0, 0, "claimBtn");
    this.claimBtn.add(clianBtnBg);
    this.claimBtn.scale = 0.25;
    this.claimBtn.getAt(0).setFrame(0);

    let claimBtnText = this.add
      .text(0, 0, "Claim", {
        fontFamily: "Arial Black",
        fontSize: 55,
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.claimBtn.add(claimBtnText);
    this.claimBtn.setInteractive(
      new Phaser.Geom.Rectangle(
        (spinBtnBg.width / 2) * -1,
        (spinBtnBg.height / 2) * -1,
        spinBtnBg.width,
        spinBtnBg.height
      ),
      Phaser.Geom.Rectangle.Contains
    );
    this.anims.create({
      key: "active",
      frames: this.anims.generateFrameNumbers("claimBtn"),
      frameRate: 2,
      repeat: -1,
    });
    this.setClaimBtnAnim();

    // adding a container to group wheel and icons

    this.wheelObjectsContainer = this.add.container(game.config.width / 2, 278);
    this.wheelContainer = this.add.container(0, 0);
    this.wheelContainer.rotateDirection = 1;
    let shadow = this.add.image(0, gameOptions.wheelRadius + 28, "wheelShadow");
    shadow.scale = 0.5;
    this.wheelObjectsContainer.add(shadow);
    this.wheelOuterRing = this.add.sprite(0, 0, "wheelOuterRing");
    this.wheelOuterRing.scale = gameOptions.wheelOuterRingScale;
    this.wheelOuterRing.setOrigin(0.5);

    // array which will contain all icons
    let iconArray = [];
    this.collisionBulbs = [];
    let circleGraphics = this.add.graphics({
      fillStyle: { color: 0xffff00, alpha: 1 },
    });
    circleGraphics.generateTexture("pin-circle", 70, 70);

    this.pinCircleCollider = this.physics.add.image(
      40,
      -gameOptions.wheelRadius,
      "pin-circle"
    ); // 'this' is your Phaser.Scene object
    this.pinCircleCollider.setImmovable(1);
    this.pinCircleCollider.setSize(60, 70);
    this.wheelObjectsContainer.add(this.pinCircleCollider);

    // looping through each slice
    for (let i = 0; i < gameOptions.slices.length; i++) {
      //override or set the slice's colors
      if (i % 2 == 0) {
        gameOptions.slices[i].startColor = "0x3779ba";
        gameOptions.slices[i].endColor = "0x3779ba";
      } else {
        gameOptions.slices[i].startColor = "0xffffff";
        gameOptions.slices[i].endColor = "0xffffff";
      }

      // override rings count to 1
      gameOptions.slices[i].rings = 1;

      // converting colors from 0xRRGGBB format to Color objects
      let startColor = Phaser.Display.Color.ValueToColor(
        gameOptions.slices[i].startColor
      );
      let endColor = Phaser.Display.Color.ValueToColor(
        gameOptions.slices[i].endColor
      );

      for (let j = gameOptions.slices[i].rings; j > 0; j--) {
        // interpolate colors
        let ringColor = Phaser.Display.Color.Interpolate.ColorWithColor(
          startColor,
          endColor,
          gameOptions.slices[i].rings,
          j
        );

        // converting the interpolated color to 0xRRGGBB format
        let ringColorString = Phaser.Display.Color.RGBToString(
          Math.round(ringColor.r),
          Math.round(ringColor.g),
          Math.round(ringColor.b),
          0,
          "0x"
        );

        // setting fill style
        graphics.fillStyle(ringColorString, 1);

        // drawing the slice
        graphics.slice(
          gameOptions.wheelRadius + gameOptions.strokeWidth,
          gameOptions.wheelRadius + gameOptions.strokeWidth,
          (j * gameOptions.wheelRadius) / gameOptions.slices[i].rings,
          Phaser.Math.DegToRad(startDegrees),
          Phaser.Math.DegToRad(startDegrees + gameOptions.slices[i].degrees),
          false
        );

        // filling the slice
        graphics.fillPath();
      }

      // add the icon, if any
      if (gameOptions.slices[i].iconName != undefined) {
        // icon image
        // let icon = this.add.image(gameOptions.wheelRadius * 0.75 * Math.cos(Phaser.Math.DegToRad(startDegrees + gameOptions.slices[i].degrees / 2)), gameOptions.wheelRadius * 0.75 * Math.sin(Phaser.Math.DegToRad(startDegrees + gameOptions.slices[i].degrees / 2)), "prizesIcon", gameOptions.slices[i].iconFrame);
        let icon = this.add.image(
          gameOptions.wheelRadius *
            0.75 *
            Math.cos(
              Phaser.Math.DegToRad(
                startDegrees + gameOptions.slices[i].degrees / 2
              )
            ),
          gameOptions.wheelRadius *
            0.75 *
            Math.sin(
              Phaser.Math.DegToRad(
                startDegrees + gameOptions.slices[i].degrees / 2
              )
            ),
          gameOptions.slices[i].iconName
        );
        // scaling the icon according to game preferences
        icon.scaleX = gameOptions.slices[i].iconScale;
        icon.scaleY = gameOptions.slices[i].iconScale;
        // icon.scale = 0.3

        // rotating the icon
        icon.angle = startDegrees + gameOptions.slices[i].degrees / 2 + 90;

        // add icon to iconArray
        iconArray.push(icon);
      }

      // add slice text, if any
      if (gameOptions.slices[i].sliceText != undefined) {
        // the text
        let text = this.add.text(
          gameOptions.wheelRadius *
            0.75 *
            Math.cos(
              Phaser.Math.DegToRad(
                startDegrees + gameOptions.slices[i].degrees / 2
              )
            ),
          gameOptions.wheelRadius *
            0.75 *
            Math.sin(
              Phaser.Math.DegToRad(
                startDegrees + gameOptions.slices[i].degrees / 2
              )
            ),
          gameOptions.slices[i].sliceText,
          gameOptions.slices[i].sliceTextStyle
        );

        // set text origin to its center
        text.setOrigin(0.5);

        // set text angle
        text.angle = startDegrees + gameOptions.slices[i].degrees / 2 + 90;

        // stroke text, if required
        if (
          gameOptions.slices[i].sliceTextStroke &&
          gameOptions.slices[i].sliceTextStrokeColor
        ) {
          text.setStroke(
            gameOptions.slices[i].sliceTextStrokeColor,
            gameOptions.slices[i].sliceTextStroke
          );
        }

        // add text to iconArray
        iconArray.push(text);
      }

      let colliderCircleShape = new Phaser.Geom.Circle(10, 10, 10);
      // circleGraphics.lineStyle(4, 0xaa0000);
      circleGraphics.strokeCircleShape(colliderCircleShape);
      circleGraphics.fillCircleShape(colliderCircleShape);
      circleGraphics.generateTexture("collider-circle", 20, 20);
      let circle = this.physics.add.image(
        gameOptions.wheelRadius * Math.cos(Phaser.Math.DegToRad(startDegrees)),
        gameOptions.wheelRadius * Math.sin(Phaser.Math.DegToRad(startDegrees)),
        "collider-circle"
      ); 
      circle.setCircle(10);
      circle.setImmovable(1);
      circle.id = i + 1;
      circle.name = "circle" + (i + 1);
      this.wheelContainer.add(circle);
      this.collisionBulbs.push(circle);

      // updating degrees
      startDegrees += gameOptions.slices[i].degrees;
    }

    // generate a texture called "wheel" from graphics data
    graphics.generateTexture(
      "wheel",
      (gameOptions.wheelRadius + gameOptions.strokeWidth) * 2,
      (gameOptions.wheelRadius + gameOptions.strokeWidth) * 2
    );

    // creating a sprite with wheel image as if it was a preloaded image
    this.wheel = this.add.sprite(0, 0, "wheel");

    this.wheel.name = "wheel";

    // adding the wheel to the container
    this.wheelContainer.add(this.wheel);
    // this.wheel.setVisible(0);
    // adding all iconArray items to the container
    this.wheelContainer.add(iconArray);
    this.wheelContainer.add(this.wheelOuterRing);
    // adding the pin in the middle of the canvas
    this.pin = this.add.image(0, 0, "pin");
    this.wheelObjectsContainer.add(this.wheelContainer);
    // this.wheelContainer.setPosition(this.wheelObjectsContainer.x, this.wheelObjectsContainer.y)
    this.wheelObjectsContainer.add(this.pin);
    this.pointer = this.add.image(0, -gameOptions.wheelRadius - 35, "pointer");
    this.pointer.setScale(0.5);
    this.pointer.setOrigin(0.5, 0.38);
    this.wheelObjectsContainer.add(this.pointer);

    circleGraphics.clear();
    circleGraphics.destroy();

    graphics.clear();
    graphics.destroy();
    // adding the text field
    this.prizeText = this.add.text(
      game.config.width / 2,
      game.config.height - 20,
      "Spin the wheel",
      {
        font: "bold 20px Arial",
        align: "center",
        color: "white",
      }
    );
    this.lostSpinsText = this.add.text(118, 535, "Lost Spins: " + lostSpins, {
      font: "bold 12px Arial",
      align: "center",
      color: "white",
    });
    this.totalSpinsText = this.add.text(
      118,
      563,
      "Total Spins: " + totalSpins + "/" + maxSpinsLimit,
      {
        font: "bold 12px Arial",
        align: "center",
        color: "white",
      }
    );

    this.totalPointsText = this.add.text(
      180,
      628,
      points + "/" + maxPointsLimit,
      {
        font: "bold 12px Arial",
        align: "center",
        color: "white",
      }
    );
    this.totalPointsText.setOrigin(0.5);
    // center the text
    this.prizeText.setOrigin(0.5);
    let wheelMaskGraphic = this.make.graphics({
      x: 0,
      y: 0,
      add: true,
    });

    // wheelMaskGraphic.fillStyle(0xffffff);
    // add layer to put the wheel mask on it
    const maskLayer = this.add.layer();
    wheelMaskGraphic.fillRect(180 - 250, 630 - 110, 500, 220);
    let mask = wheelMaskGraphic.createGeometryMask();
    mask.invertAlpha = 1;
    maskLayer.setMask(mask);
    // the game has just started = we can spin the wheel
    this.canSpin = true;
    maskLayer.add(this.wheelObjectsContainer);

    //Progress bar
    this.barBg = this.add.image(180, 604, "barbg");
    this.barBg.setScale(0.4);
    this.barMask = this.add.bitmapMask(null, 180, 604, "barmask");
    this.barFill = this.add.image(
      this.barBg.x - this.barBg.displayWidth,
      this.barBg.y,
      "bar"
    );
    this.barFill.setScale(0.4);
    this.barFill.startX = this.barFill.x;
    this.barFill.setMask(this.barMask);
    let emptybar = this.add.image(this.barBg.x, this.barBg.y, "emptybar");
    emptybar.setScale(0.4);

    this.claimBtn.on("pointerdown", this.handleClaimBtnClick, this);
    this.spinBtn.on("pointerdown", this.handleSpinBtnClick, this);
    this.setProgressBar(() => {
      if (points < maxPointsLimit) this.canSpin = true;
    });

    this.barBg.setInteractive();
    this.barBg.on("pointerdown", this.handleBarClicked, this);
  }

  handleBarClicked() {
    console.log("handleBarClicked");
    // this.scene.start("couponscene");
    this.scene.start("couponscene");
  }
  handleClaimBtnClick() {
    console.log("handleClaimBtnClick");
    let diffSpins = maxSpinsLimit - totalSpins;
    totalSpins += lostSpins > diffSpins ? diffSpins : lostSpins;
    lostSpins -= lostSpins > diffSpins ? diffSpins : lostSpins;

    this.lostSpinsText.setText("Lost Spins: " + lostSpins);
    this.totalSpinsText.setText(
      "Total Spins: " + totalSpins + "/" + maxSpinsLimit
    );
    this.setClaimBtnAnim();
  }

  setClaimBtnAnim() {
    if (lostSpins > 0 && totalSpins < maxSpinsLimit) {
      this.claimBtn.getAt(0).play("active");
    } else {
      this.claimBtn.getAt(0).stop("active");
      this.claimBtn.getAt(0).setFrame(0);
    }
  }

  setVolume(name, vol) {
    sounds[name].volume = vol;
  }
  // function to spin the wheel
  spinWheel() {
    // can we spin the wheel?
    if (this.canSpin) {
      totalSpins -= 1;
      localStorage.setItem("spins", totalSpins);
      this.totalSpinsText.setText(
        "Total Spins: " + totalSpins + "/" + maxSpinsLimit
      );
      this.setClaimBtnAnim();
      // resetting text field
      this.prizeText.setText("");

      // the wheel will spin round for some times. This is just coreography
      let rounds = Phaser.Math.Between(
        gameOptions.wheelRounds.min,
        gameOptions.wheelRounds.max
      );

      // then will rotate by a random number from 0 to 360 degrees. This is the actual spin
      let degrees = Phaser.Math.Between(0, 360);

      // then will rotate back by a random amount of degrees
      let backDegrees = Phaser.Math.Between(
        gameOptions.backSpin.min,
        gameOptions.backSpin.max
      );

      // before the wheel ends spinning, we already know the prize
      let prizeDegree = 0;

      // looping through slices
      for (let i = gameOptions.slices.length - 1; i >= 0; i--) {
        // adding current slice angle to prizeDegree
        prizeDegree += gameOptions.slices[i].degrees;

        // if it's greater than the random angle...
        if (prizeDegree > degrees - backDegrees) {
          // we found the prize
          var prize = i;
          break;
        }
      }

      // now the wheel cannot spin because it's already spinning
      this.canSpin = false;

      // animation tweeen for the spin: duration 3s, will rotate by (360 * rounds + degrees) degrees
      // the quadratic easing will simulate friction

      let yGapCircle = 0;
      let scaleBy = 0;
      if (!this.wheelContainer.isZoomed) {
        this.wheelContainer.isZoomed = true;
        yGapCircle = 240;
        scaleBy = 0.13;
      } else {
        scaleBy = 0;
        yGapCircle = 0;
      }
      let rotateTime = Phaser.Math.Between(
        gameOptions.rotationTimeRange.min,
        gameOptions.rotationTimeRange.max
      );
      this.tweens.add({
        targets: [this.wheelObjectsContainer],
        y: this.wheelObjectsContainer.y + yGapCircle,
        scale: this.wheelObjectsContainer.scale + scaleBy,
        // tween duration
        duration: rotateTime / 2,
        // tween easing
        ease: "'sine.out'",

        // callback scope
        callbackScope: this,

        // function to be executed once the tween has been completed
        onComplete: function (tween) {},
      });

      this.tweens.add({
        // adding the wheel container to tween targets
        targets: [this.wheelContainer],
        // angle destination
        angle: 360 * rounds + degrees,
        // tween duration
        // tween duration
        duration: rotateTime,
        // tween easing
        ease: "sine.out",
        // callback scope
        callbackScope: this,
        // function to be executed once the tween has been completed
        onComplete: function (tween) {
          // another tween to rotate a bit in the opposite direction
          this.tweens.add({
            targets: [this.wheelContainer],

            angle: this.wheelContainer.angle,
            duration: 0,
            ease: "sine.out",
            callbackScope: this,
            onComplete: function (tween) {
              this.showRewardScreen(prize);
              this.setProgressBar(() => {
                if (totalSpins > 0) this.canSpin = true;
              });

              setTimeout(() => {
                this.scene.start("quizscene");
              }, 1000);
            },
          });
        },
      });
    }
  }
  showRewardScreen(prize_ind) {
    // console.log("show reward", gameOptions.slices[prize_ind].points)
    if (gameOptions.slices[prize_ind].points > 0) {
      points += gameOptions.slices[prize_ind].points;
      points = Math.min(points, maxPointsLimit);
      localStorage.setItem("points", points);
      this.totalPointsText.setText(points + "/" + maxPointsLimit);
    }

    this.prizeText.setText(gameOptions.slices[prize_ind].text);

    console.log(
      "Reward: ",
      "total points: " + points,
      "prize: " + gameOptions.slices[prize_ind].text,
      "points: " + gameOptions.slices[prize_ind].points
    );
  }

  setProgressBar(callback) {
    this.tweens.add({
      targets: [this.barFill],
      x:
        this.barFill.startX +
        (this.barBg.displayWidth * points) / maxPointsLimit,
      ease: "linear",
      duration: 500,
      // callback scope
      callbackScope: this,
      // function to be executed once the tween has been completed
      onComplete: callback,
    });
  }
  handleOverlapBulbPin(pin, bulb) {
    if (pin.currentBulbId == bulb.id || this.canSpin) {
      // console.log(pin.currentBulbId, bulb.id ,"return")
      return;
    }

    // console.log(pin.currentBulbId, bulb.id)
    pin.currentBulbId = bulb.id;

    stopSound("tick");
    playSound("tick", 0.5, 0);

    if (this.pinTween != undefined) {
      if (this.pinTween.isPlaying()) {
        this.pinTween.stop();
        this.pointer.setAngle(0);
      }
    }
    this.pinTween = this.tweens.add({
      targets: [this.pointer],
      angle: -20 * this.wheelContainer.rotateDirection,
      duration: 100,
      ease: "linear",
      callbackScope: this,
      yoyo: true,
      onComplete: function (tween) {},
    });
  }

  update(time, delta) {
    this.physics.add.overlap(
      this.pinCircleCollider,
      this.collisionBulbs,
      this.handleOverlapBulbPin,
      null,
      this
    );

    if (this.isGameStarted) {
      this.timer += delta;
      while (this.timer > 1000) {
        this.resources += 1;
        this.timer -= 1000;
        // console.log(this.resources);

        this.updateTimer();
      }
    }
  }

  updateTimer() {
    let currentTimeInMin = Date.now() / (1000 * 60);
    let timeDiff = currentTimeInMin - lastSpinGivenTimeInMin;
    // console.log("Wait for "+(spinsGetTimerInMin-timeDiff).toPrecision(4) +" mins to get "+spinsCountPerTimer+" spins: " )
    if (timeDiff >= spinsGetTimerInMin) {
      console.log(
        "given spins & update lastSpinGivenTime ***** ",
        lastSpinGivenTimeInMin,
        "currentTime :",
        currentTimeInMin.toPrecision(4)
      );
      totalSpins +=
        Math.floor(timeDiff / spinsGetTimerInMin) * spinsCountPerTimer;
      if (totalSpins > maxSpinsLimit) {
        lostSpins += totalSpins - maxSpinsLimit;
        totalSpins = maxSpinsLimit;
        localStorage.setItem("lostSpins", lostSpins);
      }
      this.lostSpinsText.setText("Lost Spins: " + lostSpins);
      lastSpinGivenTimeInMin = currentTimeInMin;
      localStorage.setItem("spins", totalSpins);
      localStorage.setItem("lastSpinGivenTime", currentTimeInMin);
    }
  }

  handleSpinBtnClick(pointer) {
    console.log("spin btn clicked: ", this.canSpin);
    this.spinWheel();
  }
  pointerOverObject() {
    if (!this.canSpin) return;
    console.log("pointer over object");
    this.spinBtn.setScale(0.55);
  }
  pointerOutObject() {
    this.spinBtn.setScale(0.5);
  }
}

const W = 1920;
const H = 1080;
const MODES = [
  ['number', 'Number Safari', 'Spot even numbers and multiples.', '🔢'],
  ['order', 'Skyline Sort', 'Guide values into their ranges.', '📈'],
  ['math', 'Math Mission', 'Solve equations and land the answer.', '🧮'],
  ['shape', 'Shape Garden', 'Match each shape to its home.', '🔷'],
  ['word', 'Word Picnic', 'Sort words by what they mean.', '📚'],
];
const THEMES = {
  number: ['Number Safari', 'Count, spot, sort!', '🔢'],
  order: ['Skyline Sort', 'Find the right altitude!', '📈'],
  math: ['Math Mission', 'Ready, set, calculate!', '🧮'],
  shape: ['Shape Garden', 'Every shape has a home.', '🔷'],
  word: ['Word Picnic', 'Pack words with their friends.', '📚'],
};
const FONT = 'Nunito';
const DISPLAY = 'Fredoka';

function text(scene, value, x, y, size, color = '#263b72', origin = 0.5) {
  return scene.add
    .text(x, y, value, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      color,
      align: 'center',
    })
    .setOrigin(origin);
}

function button(scene, label, x, y, width, color, onClick) {
  const group = scene.add.container(x, y);
  const shadow = roundedSurface(
    scene,
    width + 8,
    62,
    0x172554,
    16,
    0x172554,
    0,
  );
  shadow.setPosition(0, 9).setAlpha(0.22);
  const background = roundedSurface(scene, width, 58, color, 16, 0xffffff, 0.8);
  background.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -29, width, 58),
    Phaser.Geom.Rectangle.Contains,
    { useHandCursor: true },
  );
  const shine = scene.add.rectangle(
    -width * 0.28,
    -18,
    width * 0.3,
    7,
    0xffffff,
    0.3,
  );
  group.add([
    shadow,
    background,
    shine,
    text(scene, label, 0, 0, 22, '#ffffff'),
  ]);
  background.on('pointerover', () => {
    scene.tweens.add({
      targets: group,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 180,
      ease: 'Back.easeOut',
    });
    scene.tweens.add({
      targets: shine,
      x: width * 0.26,
      duration: 320,
      ease: 'Sine.easeInOut',
    });
  });
  background.on('pointerout', () => {
    scene.tweens.add({
      targets: group,
      scaleX: 1,
      scaleY: 1,
      duration: 160,
      ease: 'Back.easeOut',
    });
    shine.x = -width * 0.28;
  });
  background.on('pointerdown', () => {
    scene.tweens.add({
      targets: group,
      scaleX: 0.92,
      scaleY: 0.88,
      duration: 80,
      ease: 'Power2',
    });
  });
  background.on('pointerup', () => {
    scene.tweens.add({
      targets: group,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 220,
      ease: 'Elastic.easeOut',
    });
    onClick();
  });
  return group;
}

function roundedSurface(
  scene,
  width,
  height,
  color,
  radius,
  strokeColor,
  strokeAlpha,
) {
  const surface = scene.add.graphics();
  surface.fillStyle(color, 1);
  surface.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  surface.lineStyle(3, strokeColor, strokeAlpha);
  surface.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  surface.setData('surfaceStyle', {
    width,
    height,
    color,
    radius,
    strokeColor,
    strokeAlpha,
  });
  return surface;
}

function redrawSurface(surface, strokeColor, strokeAlpha) {
  const style = surface.getData('surfaceStyle');
  surface.clear();
  surface.fillStyle(style.color, 1);
  surface.fillRoundedRect(
    -style.width / 2,
    -style.height / 2,
    style.width,
    style.height,
    style.radius,
  );
  surface.lineStyle(3, strokeColor, strokeAlpha);
  surface.strokeRoundedRect(
    -style.width / 2,
    -style.height / 2,
    style.width,
    style.height,
    style.radius,
  );
}

export function showMenu(scene, onStart, onFullscreen) {
  const group = scene.add.container(0, 0).setDepth(100);
  addSparkles(scene, 12, 80, 1750, 320, 760);
  text(scene, 'A TINY PUZZLE ADVENTURE', W / 2, 90, 18, '#b45344');
  scene.add
    .text(W / 2, 145, 'Brain Tubes', {
      fontFamily: DISPLAY,
      fontSize: '104px',
      color: '#263b72',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  text(
    scene,
    'Choose your world and sort your way to the treasure.',
    W / 2,
    265,
    24,
    '#243047',
  );
  let selected = MODES[0][0];
  const cards = [];
  MODES.forEach(([id, title, description, icon], index) => {
    const card = scene.add.container(370 + index * 300, 500);
    const cardShadow = roundedSurface(
      scene,
      270,
      258,
      0x172554,
      24,
      0x172554,
      0,
    );
    cardShadow.setPosition(0, 12).setAlpha(0.16);
    const background = roundedSurface(
      scene,
      260,
      250,
      0xfffdf7,
      24,
      index === 0 ? 0xf05d5e : 0xffffff,
      1,
    );
    background.setInteractive(
      new Phaser.Geom.Rectangle(-130, -125, 260, 250),
      Phaser.Geom.Rectangle.Contains,
      { useHandCursor: true },
    );
    card.add([
      cardShadow,
      background,
      text(scene, icon, 0, -78, 52),
      text(scene, title, 0, -18, 22),
    ]);
    card.add(
      scene.add
        .text(0, 35, description, {
          fontFamily: FONT,
          fontSize: '17px',
          color: '#243047',
          align: 'center',
          wordWrap: { width: 210 },
        })
        .setOrigin(0.5),
    );
    background.on('pointerdown', () => {
      scene.tweens.add({
        targets: card,
        scaleX: 0.96,
        scaleY: 0.94,
        duration: 80,
        yoyo: true,
        ease: 'Back.easeOut',
      });
      selected = id;
      cards.forEach((item) => redrawSurface(item, 0xffffff, 1));
      redrawSurface(background, 0xf05d5e, 1);
    });
    background.on('pointerover', () => {
      scene.tweens.add({
        targets: card,
        y: 488,
        scaleX: 1.035,
        scaleY: 1.035,
        duration: 180,
        ease: 'Back.easeOut',
      });
    });
    background.on('pointerout', () => {
      scene.tweens.add({
        targets: card,
        y: 500,
        scaleX: 1,
        scaleY: 1,
        duration: 160,
        ease: 'Back.easeOut',
      });
    });
    cards.push(background);
    group.add(card);
  });
  group.add(
    button(scene, 'Start adventure  →', W / 2, 780, 300, 0xf05d5e, () =>
      onStart(selected),
    ),
  );
  group.add(
    button(scene, '⛶ Fullscreen', W / 2, 860, 220, 0x263b72, onFullscreen),
  );
}

function addSparkles(scene, count, minX, maxX, minY, maxY) {
  for (let i = 0; i < count; i++) {
    const sparkle = scene.add
      .star(
        minX + ((i * 149) % (maxX - minX)),
        minY + ((i * 83) % (maxY - minY)),
        4,
        7,
        2,
        0xffffff,
        0.55,
      )
      .setDepth(3);
    scene.tweens.add({
      targets: sparkle,
      angle: 180,
      alpha: 0.12,
      scale: 0.55,
      duration: 1500 + (i % 4) * 350,
      delay: (i % 5) * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

export function showGame({
  scene,
  mode,
  level,
  rule,
  moves,
  hints,
  onMenu,
  onHint,
  onReplay,
  onPrevious,
  onNext,
}) {
  const group = scene.add.container(0, 0).setDepth(100);
  addSparkles(scene, 8, 60, 1860, 300, 930);
  const [name, kicker, icon] = THEMES[mode];
  text(scene, icon, 90, 85, 48);
  text(scene, kicker.toUpperCase(), 155, 55, 16, '#b45344', 0);
  scene.add
    .text(155, 95, name, {
      fontFamily: DISPLAY,
      fontSize: '42px',
      color: '#263b72',
    })
    .setOrigin(0, 0.5);
  scene.add
    .text(155, 145, rule, {
      fontFamily: FONT,
      fontSize: '19px',
      color: '#243047',
      wordWrap: { width: 720 },
    })
    .setOrigin(0, 0.5);
  const levelBg = roundedSurface(scene, 230, 68, 0x263b72, 18, 0xffffff, 0.7);
  levelBg.setPosition(1735, 78);
  const levelText = text(scene, `LEVEL ${level} / 10`, 1735, 78, 24, '#ffffff');
  const movesText = text(scene, '', 1470, 75, 20);
  const hintsText = text(scene, '', 1470, 112, 18);
  group.add([levelBg, levelText, movesText, hintsText]);
  group.add(button(scene, '← Worlds', 120, 1010, 170, 0x263b72, onMenu));
  group.add(button(scene, '‹ Previous', 350, 1010, 190, 0x263b72, onPrevious));
  group.add(button(scene, '💡 Hint', W / 2 - 170, 1010, 180, 0xf05d5e, onHint));
  group.add(
    button(scene, '↻ Replay', W / 2 + 170, 1010, 180, 0xf05d5e, onReplay),
  );
  group.add(button(scene, 'Next ›', 1570, 1010, 170, 0x263b72, onNext));
  return {
    setMoves(value) {
      movesText.setText(`Moves ${value}`);
    },
    setHints(value) {
      hintsText.setText(`Hints ${value}`);
    },
    showHint(message) {
      const toast = text(scene, message, W / 2, 285, 22, '#263b72');
      toast.setBackgroundColor('#fffdf7').setPadding(20, 12).setDepth(110);
      scene.tweens.add({
        targets: toast,
        alpha: 0,
        delay: 3000,
        duration: 500,
        onComplete: () => toast.destroy(),
      });
    },
    showWin(value, nextLabel, onNext) {
      const backdrop = scene.add
        .rectangle(W / 2, H / 2, W, H, 0x263b72, 0.55)
        .setDepth(120);
      const panel = roundedSurface(scene, 560, 360, 0xfffdf7, 30, 0xf05d5e, 1)
        .setPosition(W / 2, H / 2)
        .setDepth(121);
      const heading = text(scene, 'LEVEL COMPLETE', W / 2, 485, 38);
      const result = text(
        scene,
        `You solved it in ${value} moves.`,
        W / 2,
        550,
        23,
        '#243047',
      );
      heading.setDepth(122);
      result.setDepth(122);
      const next = button(
        scene,
        nextLabel,
        W / 2,
        640,
        300,
        0xf05d5e,
        onNext,
      ).setDepth(122);
      group.add([backdrop, panel, heading, result, next]);
    },
  };
}

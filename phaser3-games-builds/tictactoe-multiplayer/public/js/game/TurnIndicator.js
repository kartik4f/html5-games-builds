/**
 * TurnIndicator — shows whose turn it is and a small animated dot.
 */
export default class TurnIndicator {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x  Centre X of the indicator
   * @param {number} y  Centre Y of the indicator
   */
  constructor(scene, x, y) {
    this.scene = scene;

    this._dot = scene.add.circle(x - 90, y, 6, 0xffffff).setOrigin(0.5);
    this._text = scene.add.text(x, y, '', {
      fontSize:   '20px',
      color:      '#ffffff',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Pulse the dot continuously
    scene.tweens.add({
      targets:    this._dot,
      alpha:      0.2,
      duration:   600,
      yoyo:       true,
      repeat:     -1,
      ease:       'Sine.inOut',
    });
  }

  /**
   * @param {boolean}   isMyTurn
   * @param {string}    mySymbol     'X' or 'O'
   * @param {string}    currentTurn  'X' or 'O' (whose turn it currently is)
   */
  update(isMyTurn, mySymbol, currentTurn) {
    if (isMyTurn) {
      this._text.setText(`Your turn  (${mySymbol})`);
      this._text.setColor('#00ff88');
      this._dot.setFillStyle(0x00ff88);
    } else {
      this._text.setText(`Opponent's turn  (${currentTurn})`);
      this._text.setColor('#aaaaaa');
      this._dot.setFillStyle(0xaaaaaa);
    }
  }

  /** Show a static status message (e.g. "Opponent disconnected") */
  setMessage(text, color = '#ffaa00') {
    this._text.setText(text).setColor(color);
    this._dot.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color);
  }

  destroy() {
    this._dot.destroy();
    this._text.destroy();
  }
}

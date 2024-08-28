class Example extends Phaser.Scene
{
    a = 0;
    pointerCircle;
    circle;
    graphics;

    create ()
    {

        this.graphics = this.add.graphics({fillStyle:{color: 0xffff00, alpha:1} });
        this.pointerCircle = new Phaser.Geom.Circle(400, 300, 100);
        this.graphics.lineStyle(4, 0xaa0000);
        this.graphics.strokeCircleShape(this.pointerCircle);
        this.graphics.fillCircleShape( this.pointerCircle)
        this.graphics.generateTexture('circle', 200, 200)
        this.circle =  this.add.sprite(0, 0, 'circle') // 'this' is your Phaser.Scene object
        // this.graphics.destroy();



      
    }

    update ()
    {
        // this.circle.x+=10
       
    }
}

const config = {
    width: 800,
    height: 600,
    type: Phaser.AUTO,
    parent: 'phaser-example',
    backgroundColor: 0x5e6df0,
    scene: Example
};

const game = new Phaser.Game(config);

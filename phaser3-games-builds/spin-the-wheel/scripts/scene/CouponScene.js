class CouponScene extends Phaser.Scene{
    constructor(){
        super({ key: 'couponscene' });
    }
    buttonDemo=null;
    coupons= [];
    couponContainer=null;
    preload(){
        this.load.atlas('ui', 'assets/images/9slices/nine-slice.png', 'assets/images/9slices/nine-slice.json');
        this.load.image("maskbigbar", 'assets/images/maskbigbar.png');
        this.load.image('backbtn', 'assets/images/backbtn.png')
    }   

    create(){

        this.createUIButtons();
        this.createBar(50, 340);
        this.createCoupons(75, 170);
        this.input.on("pointerdown", this.handleObjectClick, this);

    }

    update(){

    }

    handleObjectClick(e, gameObjects){
       let name = gameObjects[0].name;
       console.log("objName: ", name)
       if(name!=undefined && name){
        console.log("objName: ", name)
            switch (name) {
                case "backBtn":
                    this.startScene("wheelscene")
                    
                    break;
            
                default:
                    break;
            }
       }
    }

    startScene(name){
        this.scene.start(name);
        // this.scene.start("wheelscene");
    }

    createUIButtons(){
        this.backBtn = this.add.image(40,40,"backbtn");
        this.backBtn.setScale(0.5)
        this.backBtn.name = "backBtn"
        this.pauseBtn = this.add.image(320, 40, "pauseBtn");
        this.pauseBtn.setScale(0.5);
        this.backBtn.setInteractive();
        this.pauseBtn.setInteractive();
          // this.input.on("pointerdown", this.handleObjectClick);
  

    }



    createBar(x, y){
         //Progress bar
         this.barBg = this.add.image(x,y ,"barbg");
         this.barBg.setScale(0.55)
         this.barBg.setAngle(90);
         this.barMask = this.add.bitmapMask(null, x,y, 'maskbigbar');
         this.barFill = this.add.image(this.barBg.x,this.barBg.y + this.barBg.displayWidth ,"bar");
         this.barFill.setScale(0.55)
         this.barFill.setAngle(90);
         this.barFill.startY = this.barFill.y;
         this.barFill.setMask(this.barMask);
         let emptybar = this.add.image(this.barBg.x, this.barBg.y, "emptybar");
         emptybar.setScale(0.55);
         emptybar.setAngle(90);

         



         this.setProgressBar(()=>{});
    }

    setProgressBar(callback){
        this.tweens.add({
            targets:[ this.barFill],
            y: this.barFill.startY -this.barBg.displayWidth*points/maxPointsLimit ,
            ease: "linear",
            duration:500,
             // callback scope
             callbackScope: this,
             // function to be executed once the tween has been completed
             onComplete: callback
        })
    }

    createCoupons(startX, startY){

        let pointsPerMilestone = maxPointsLimit;
        // create coupons cards
        let k = 4
        let scaleFactor = 0.5;
        let x = startX;
        // let startX =60 ; let startY = 170
        for(let i=1; i<=4; i++){
            let displayHeight = 0;
            for(let j=1; j<=k; j++){
                let coupon = this.add.nineslice(startX, startY, 'ui', 'yellow_panel', 128, 110, 64, 64).setOrigin(0, 0.5).setScale(scaleFactor);
                let displayWidth = coupon.displayWidth;
                displayHeight = coupon.displayHeight;
                coupon.id = j;
                coupon.row = i;
                this.coupons.push(coupon);
                let x_fact = 0;
                // x_fact = i==1?70:i==2?90:i==3?120:140
                x_fact = displayWidth*1.1
                startX+=x_fact;
            }
            k--;
            scaleFactor += 0.16;
            startX=x;
            startY+= displayHeight + 40;
            
            
            let milteStonetext = this.add.text(this.barBg.x - this.barBg.displayHeight-10, this.barBg.y + 5 - this.barBg.displayWidth/2 + (i-1)* this.barBg.displayWidth/4 , pointsPerMilestone, {
                fontFamily: "Arial Black",
                fontSize: 10,
                color: "#ffffff"
            }).setOrigin(0)
            pointsPerMilestone = Math.floor(maxPointsLimit/(i+1));
            
        }
    }

    // milestoneTexts

}
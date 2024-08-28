
// PlayGame scene
class PreloadScene extends Phaser.Scene{

    // constructor
    constructor(){
        super({ key: 'preloadscene' });
    }
    timer= 0; resources = 0;
    isGameStarted = false;
    init(){
        document.removeEventListener('gameevent',this.eventGameListener);
    }
    
    // method to be executed when the scene preloads
    preload(){

        this.load.scenePlugin({
            key: 'rexuiplugin',
            url: 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexuiplugin.min.js',
            sceneKey: 'rexUI'
        });  

       
        this.load.image("pin", "assets/images/pin.png");
        this.load.image("pointer", "assets/images/wheel-pointer.png");
      
        this.load.image("pauseBtn", "assets/images/btn-pause.png")
        this.load.image("cicleBulb", "assets/images/circle-bulb.png");
        this.load.image("cicleCollider", "assets/images/circle-collider.png");
        // loading fulscreen btn icons spritesheet
        this.load.spritesheet("fullscreenBtn", "assets/images/fullscreen.png", {
            frameWidth: 118,
            frameHeight: 118
        });
       
        this.load.spritesheet("spinBtn", "assets/images/spinBtn.png", {
            frameWidth: 366,
            frameHeight: 120
        })
        this.load.spritesheet("claimBtn", "assets/images/claim.png", {
            frameWidth: 366,
            frameHeight: 120
        });

        this.load.image("wheelOuterRing","assets/images/wheel.png");
        this.load.image("pointerpin","assets/images/pointerpin.png");
        this.load.image("wheelShadow", "assets/images/wheel-shadow.png");
        
        this.load.image("barbg",  "assets/images/barbg.png");
        this.load.image("barmask",  "assets/images/barmask.png");
        this.load.image("bar",  "assets/images/bar.png");
        this.load.image("emptybar",  "assets/images/emptybar.png");
        
        for(let i = 0; i < gameOptions.slices.length; i++){
            if(gameOptions.slices[i].iconName != undefined){
                this.load.image(gameOptions.slices[i].iconName,"assets/images/prizes/"+gameOptions.slices[i].iconName+"/000.png");
                console.log("assets/images/prizes/"+gameOptions.slices[i].iconName+"/000.png")
            }
        }

       

        audioJson.forEach((item) =>{
            this.load.audio(item);
        })


        

    }
 
    create(){
        //initialize audios
        addSounds(this);
        ///play bgm
        playSound("bgm",0.01,1);      
        this.scene.start("wheelscene");
       
    }
}


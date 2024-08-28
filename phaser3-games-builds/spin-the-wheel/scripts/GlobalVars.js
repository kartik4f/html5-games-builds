// the game itself
var game ;

let isBGM = 1;
let isSFX = 1
let totalSpins=0, lostSpins=0,  points=0;
const maxSpinsLimit = 20; // max no. of spins can be accumulated.
const maxPointsLimit = 2000;
const spinsGetTimerInMin = 10  //in mins
const spinsCountPerTimer = 10; // no. of spins given every time timer is reached.
let lastSpinGivenTimeInMin ,currentTimeInMin;





let audioJson = [
    {"key": "button", "url":['assets/audio/sfx/button.webm', 'assets/audio/sfx/button.ogg']},
    {"key": "lose", "url":['assets/audio/sfx/lose.webm', 'assets/audio/sfx/lose.ogg']},
    {"key": "opening", "url":['assets/audio/sfx/opening.webm', 'assets/audio/sfx/opening.ogg']},
    {"key": "win", "url":['assets/audio/sfx/win.webm', 'assets/audio/sfx/win.ogg']},
    {"key": "tick", "url":['assets/audio/sfx/tick.webm', 'assets/audio/sfx/tick.ogg']},
    {"key": "bgm", "url":['assets/audio/music/bgm.webm', 'assets/audio/music/bgm.ogg']},
    
]

let sounds = []

let gameOptions = {

    // slices configuration
    slices: [
        {
            degrees: 45,
            startColor: 0xff0000,
            endColor: 0xff8800,
            rings: 3,
            iconName: "Car",
          iconScale: 0.35,
            text: "Car",
            points:200
        },
        {
            degrees: 45,
            startColor: 0x00ff00,
            endColor: 0x004400,
            rings: 200,
            iconName: "Coffie",
          iconScale: 0.4,
            text: "Coffie",
            points:10
        },
        // {
        //     degrees: 125,
        //     startColor: 0xff00ff,
        //     endColor: 0x0000ff,
        //     rings: 10,
        //     text: "BLUE TEXT, WHITE STROKE",
        //     sliceText: "BLUE",
        //     sliceTextStyle: {
        //         fontFamily: "Arial Black",
        //         fontSize: 20,
        //         color: "#000077"
        //     },
        //     sliceTextStroke: 8,
        //     sliceTextStrokeColor: "#ffffff"
        // },
        {
            degrees: 45,
            startColor: 0x666666,
            endColor: 0x999999,
            rings: 200,
            iconName: "Drink",
          iconScale: 0.35,
            text: "Drink",
            points: 20

        },
        {
            degrees: 45,
            startColor: 0x666666,
            endColor: 0x999999,
            rings: 200,
            iconName: "Medikit",
          iconScale: 0.35,
            text: "Medikit",
            points: 30
        },
        {
            degrees: 45,
            startColor: 0x666666,
            endColor: 0x999999,
            rings: 200,
            iconName: "Credit Card",
          iconScale: 0.35,
            text: "Credit Card",
            points: 100
        },
        {
            degrees: 45,
            startColor: 0x000000,
            endColor: 0xffff00,
            rings: 1,
            rings: 200,
            iconName: "Flight",
          iconScale: 0.35,
            text: "Flight",
            points:400
        },
        {
            degrees: 45,
            startColor: 0x000000,
            endColor: 0xffff00,
            rings: 1,
            rings: 200,
            iconName: "Sad",
          iconScale: 0.35,
            text: "Better luck next time",
            points: 0
        },
        {
            degrees: 45,
            startColor: 0x000000,
            endColor: 0xffff00,
            rings: 1,
            rings: 200,
            iconName: "Phone",
          iconScale: 0.35,
            text: "Phone",
            points: 50
        }
    ],

    // wheel rotation duration range, in milliseconds
    rotationTimeRange: {
        min: 5000,
        max: 8000
    },

    // wheel rounds before it stops
    wheelRounds: {
        min: 5,
        max: 8
    },

    // degrees the wheel will rotate in the opposite direction before it stops
    backSpin: {
        min: 0,
        max: 1
    },

    // wheel radius, in pixels
    wheelRadius: 135,
    wheelOuterRingScale:0.5,
    wheelOuterRingWidth : 28,
    wheelZoomFactor : 1.5,

    // color of stroke lines
    strokeColor: 0x5e6df0,

    // width of stroke lines
    strokeWidth: 0
}

//  To assign event
// var ev =null;

// function setTargetSceneEvent(name){
//   sceneController = new SceneController(name);
//     ev = new CustomEvent("gameevent", {
//         detail: {
//           sceneName : name
//         }
//     });
//     // document.dispatchEvent(ev);
    
// }

// document.addEventListener('gameevent', (e)=>{
//         console.log(e.detail.sceneName);
//         sceneName = e.detail.sceneName
// })

// setTargetSceneEvent("wheelscene");
// To trigger the Event
// document.dispatchEvent(ev);

function addSounds(ctx){
   
    audioJson.forEach((item)=>{
        sounds[item.key] = ctx.sound.add(item.key);
    })
}

function  playSound(name, vol, loop){
    if(sounds[name]!=undefined)
    sounds[name].play({volume:vol, loop:loop});
}
function stopSound(name){
    if(sounds[name]!=undefined)
    sounds[name].stop();
}
function isPlaying(name){
    if(sounds[name] != undefined){
        return sounds[name].isPlaying
    }
    return  false;
}




function initVariable(){
    lastSpinGivenTimeInMin = Number(localStorage.getItem("lastSpinGivenTime"));
    currentTimeInMin =Date.now()/(1000*60);
    console.log("lastSpinGivenTimeInMin: ",lastSpinGivenTimeInMin, "currentTimeInMin: ",currentTimeInMin )
    if(lastSpinGivenTimeInMin){
        let timeDiff = currentTimeInMin - lastSpinGivenTimeInMin;
        console.log("timeDiff: ", timeDiff)
        totalSpins = Number(localStorage.getItem("spins"));
        points = Number(localStorage.getItem("points"));
        lostSpins = Number(localStorage.getItem("lostSpins"));

        if(timeDiff>= spinsGetTimerInMin){
            totalSpins += Math.floor(timeDiff/spinsGetTimerInMin)*spinsCountPerTimer;
            if(totalSpins>maxSpinsLimit){
                lostSpins += totalSpins - maxSpinsLimit;
                totalSpins = maxSpinsLimit;	
                localStorage.setItem("lostSpins",lostSpins);	
            }
            localStorage.setItem("spins",totalSpins)
            localStorage.setItem("lastSpinGivenTime", currentTimeInMin);
        
            lastSpinGivenTimeInMin = currentTimeInMin;
        }
        else{
            
            lastSpinGivenTimeInMin = lastSpinGivenTimeInMin;
        }	
    }
    else{
        lastSpinGivenTimeInMin = currentTimeInMin;
        totalSpins = spinsCountPerTimer;
        localStorage.setItem("lastSpinGivenTime", currentTimeInMin);
        localStorage.setItem("spins",totalSpins);
        localStorage.setItem("points", points);
        localStorage.setItem("lostSpins",lostSpins);
    }
    console.log("lastSpinGivenTimeInMin: ",lastSpinGivenTimeInMin );
}

// once the window loads...
window.onload = function() {
    initVariable();
    // game configuration object
    let gameConfig = {
        // resolution and scale mode
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            parent: "thegame",
            width:360,
            height:720
            // width: 360*window.devicePixelRatio,
            // height: 740*window.devicePixelRatio
        },

    // game background color
    backgroundColor: 0x5e6df0,


    physics: {
        default: 'arcade',
        arcade: {
            fps:60,
            gravity: { y: 0},
            debug : true
        }
    },

    // scenes used by the game
    scene: [ PreloadScene, WheelScene, CouponScene, QuizScene, GratifyScene]
    };

    // game constructor
    game = new Phaser.Game(gameConfig);

    // pure javascript to give focus to the page/frame
    window.focus()
}


class SceneController{
    constructor(name){
        this.context = null;
        this.name = name;
    }

    showScene(ctx){
        this.context = ctx;
        ctx.scene.start(name);
    }
}

// var sceneController;



class GratifyScene extends Phaser.Scene{
    constructor(){
        super({ key: 'gratifyscene' });
    }
    init(selectedAnswer){
        this.selectedAnswer = selectedAnswer;
        console.log(selectedAnswer)
    }
    preload(){
        
        this.load.image('backbtn', 'assets/images/backbtn.png')
        this.load.json('quizdata', 'assets/mcq.json');
       
    }   

    create(){

        this.createUIButtons();
        this.gratifyText = this.add.text(180, 100, '', {
            fontFamily: "Arial Black",
            fontSize: 15,
            color: "#ffffff"
        }).setOrigin(0.5)


        this.gratifyText.setText(this.selectedAnswer.isCorrect==true?"Congratulations!! You won RS 50": "Opps better luck next time")
      
       
        this.input.on("pointerdown", this.handleObjectClick, this);
        
    }

    update(){

    }

    createUIButtons(){
        
        this.pauseBtn = this.add.image(320, 40, "pauseBtn");
        this.pauseBtn.setScale(0.5)
        this.pauseBtn.name = "pauseBtn"
      
        this.pauseBtn.setInteractive()

        //       Spin button container
        this.submitBtn = this.add.container(180, 670);
        let submitBtnBg = this.add.sprite(0,0, "spinBtn");
        this.submitBtn.add(submitBtnBg);
        this.submitBtn.scale = 0.35
        this.submitBtn.getAt(0).setFrame(1);
        let spintBtnText = this.add.text(0, 0, 'Next', {
            fontFamily: "Arial Black",
            fontSize: 55,
            color: "#ffffff"
        }).setOrigin(0.5)
        this.submitBtn.add(spintBtnText);
        this.submitBtn.name = "submitBtn"
        this.submitBtn.setInteractive(new Phaser.Geom.Rectangle((submitBtnBg.width / 2) * -1, (submitBtnBg.height / 2) * -1, submitBtnBg.width, submitBtnBg.height), Phaser.Geom.Rectangle.Contains)
        
    }
    handleObjectClick(e, gameObjects){
        let ctx = this;
        let name = gameObjects[0].name;
        console.log("objName: ", name)
        if(name!=undefined && name){
            console.log("objName: ", name)
                switch (name) {
                    case "submitBtn":
                        ctx.scene.start("wheelscene");
                        break;

                    default:
                        break;
                }
        }
    }

    setGratifyScreen(){
        this.gratifyText.setText((this.currentQuestionIndex+1)+". "+this.quizJson.questions[this.currentQuestionIndex].question)
    }


}
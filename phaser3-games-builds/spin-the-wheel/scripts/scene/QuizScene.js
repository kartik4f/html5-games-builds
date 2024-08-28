class QuizScene extends Phaser.Scene{
    constructor(){
        super({ key: 'quizscene' });
    }
    buttonDemo=null;
    coupons= [];
    couponContainer=null;
    currentQuestionIndex = 0;
    lastQuestionIndex = 0;

    init(){
        
    }
    preload(){
      
        this.load.image('backbtn', 'assets/images/backbtn.png')
        this.load.json('quizdata', 'assets/mcq.json');
       
    }   

    create(){
        
        this.quizJson = this.cache.json.get('quizdata');
        console.log("quizdata:", this.quizJson)
        this.currentQuestionIndex = Number(localStorage.getItem("questionIndex"));
        if(!this.currentQuestionIndex){
            this.currentQuestionIndex = 0;
        }
        this.currentQuestionIndex = this.currentQuestionIndex >= this.quizJson.questions.length-1?0:this.currentQuestionIndex;
        this.createUIButtons();
        this.createQuestionText();
        this.input.on("pointerdown", this.handleObjectClick, this);
        
    }

    update(){

    }

    createUIButtons(){
        this.backBtn = this.add.sprite(40,40,"backbtn", 0);
        this.backBtn.setScale(0.5)
        this.backBtn.name = "backBtn"
        this.pauseBtn = this.add.image(320, 40, "pauseBtn");
        this.pauseBtn.setScale(0.5)
        this.pauseBtn.name = "pauseBtn"
        this.backBtn.setInteractive();
        this.pauseBtn.setInteractive()

        //       Spin button container
        this.submitBtn = this.add.container(180, 670);
        let submitBtnBg = this.add.sprite(0,0, "spinBtn");
        this.submitBtn.add(submitBtnBg);
        this.submitBtn.scale = 0.35
        this.submitBtn.getAt(0).setFrame(1);
        let spintBtnText = this.add.text(0, 0, 'Submit', {
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
        if( name!=undefined && name){
            let selectedAnswer = {};
           
           
            console.log("objName: ", name)
            if(name.indexOf("option")!=-1){
                selectedAnswer = {text: gameObjects[0].text, isCorrect: gameObjects[0].isCorrect};
                localStorage.setItem("questionIndex", this.currentQuestionIndex+1)
                ctx.scene.start("gratifyscene", selectedAnswer);
              
                return ;
            }


                switch (name) {
                    case "backBtn":
                        ctx.scene.start("wheelscene");
                        break;

                    case "submitBtn":
                        ctx.scene.start("gratifyscene");
                        break;

                    default:
                        break;
                }
        }
    }

    setQuestion(){
        this.questionText.setText((this.currentQuestionIndex+1)+". "+this.quizJson.questions[this.currentQuestionIndex].question)
        this.quizJson.questions[this.currentQuestionIndex].answers.forEach((option,i) => {
            let optionText = this.setText(option)
            optionText.isCorrect = false;
            if(i== this.quizJson.questions[this.currentQuestionIndex].currectIndex){
                optionText.isCorrect = true;
            }
        });
    }

    createQuestionText(){
        this.questionText = this.add.text(180, 100, (this.currentQuestionIndex+1)+". "+this.quizJson.questions[this.currentQuestionIndex].question, {
            fontFamily: "Arial Black",
            fontSize: 14,
            color: "#ffffff"
        }).setOrigin(0.5)
        this.questionText.setInteractive();
        this.quizJson.questions[this.currentQuestionIndex].answers.forEach((option,i) => {
            let optionText = this.add.text(180, 100+(i+1)*40, option, {
                fontFamily: "Arial Black",
                fontSize: 13,
                color: "#ffffff"
            }).setOrigin(0.5)
            optionText.isCorrect = false;
            optionText.name = "option"+(i+1);
            optionText.setInteractive();
            if(i== this.quizJson.questions[this.currentQuestionIndex].correctIndex){
                optionText.isCorrect = true;
            }
        });

    }


}
////////////////////////////////////////////////////////////
// CANVAS
////////////////////////////////////////////////////////////
var stage
var canvasW=0;
var canvasH=0;

/*!
 * 
 * START GAME CANVAS - This is the function that runs to setup game canvas
 * 
 */
function initGameCanvas(w,h){
	var gameCanvas = document.getElementById("gameCanvas");
	gameCanvas.width = w;
	gameCanvas.height = h;
	
	canvasW=w;
	canvasH=h;
	stage = new createjs.Stage("gameCanvas");
	
	createjs.Touch.enable(stage);
	stage.enableMouseOver(20);
	stage.mouseMoveOutside = true;
	
	createjs.Ticker.timingMode = createjs.Ticker.RAF_SYNCHED;
	createjs.Ticker.framerate = 60;
	createjs.Ticker.addEventListener("tick", tick);
}

var guide = false;
var canvasContainer, mainContainer, gameContainer, instructionContainer, resultContainer, moveContainer, confirmContainer;
var guideline, bg, logo, buttonOk, result, shadowResult, buttonReplay, buttonFacebook, buttonTwitter, buttonWhatsapp, buttonFullscreen, buttonSoundOn, buttonSoundOff;

$.cards = {};
$.particles = {};

/*!
 * 
 * BUILD GAME CANVAS ASSERTS - This is the function that runs to build game canvas asserts
 * 
 */
function buildGameCanvas(){
	canvasContainer = new createjs.Container();
	mainContainer = new createjs.Container();
	snowContainer = new createjs.Container();
	snowLoopContainer = new createjs.Container();
	gameContainer = new createjs.Container();
	tailsContainer = new createjs.Container();
	objectsContainer = new createjs.Container();
	instructionContainer = new createjs.Container();
	scoreContainer = new createjs.Container();
	resultContainer = new createjs.Container();
	confirmContainer = new createjs.Container();
	
	
	bg = new createjs.Bitmap(loader.getResult('background'));
	bgP = new createjs.Bitmap(loader.getResult('backgroundP'));
	
	logo = new createjs.Bitmap(loader.getResult('logo'));
	logoP = new createjs.Bitmap(loader.getResult('logoP'));

	buttonStart = new createjs.Bitmap(loader.getResult('buttonStart'));
	centerReg(buttonStart);

	buttonFreestyle = new createjs.Bitmap(loader.getResult('buttonFreestyle'));
	centerReg(buttonFreestyle);

	buttonFlags = new createjs.Bitmap(loader.getResult('buttonFlags'));
	centerReg(buttonFlags);
	
	//game
	itemPlayer = new createjs.Shape();	
	itemPlayer.graphics.beginFill('red').drawRect(-5, -5, 10, 10);

	var _speed = 1;
	var _frameW = 35;
	var _frameH = 30;
	var _count = 5;
	var _animations = {
		none:{frames: [0], speed:_speed},
		splashright:{frames: [1,2,1,2,1,2,1,2], speed:_speed, next:"none"},
		splashleft:{frames: [3,4,3,4,3,4,3,4], speed:_speed, next:"none"}
	};

	var _frame = {"regX": _frameW/2, "regY": _frameH/2, "height": _frameH, "width": _frameW, "count": _count};				
	var spriteData = new createjs.SpriteSheet({
		"images": [loader.getResult("snowSplash")],
		"frames": _frame,
		"animations": _animations
	});

	snowSplash = new createjs.Sprite(spriteData, _frame);
	snowSplash.framerate = 20;
	snowSplash.gotoAndPlay("none");

	stageClick = new createjs.Shape();
	stageClick.hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000").drawRect(0, 0, canvasW, canvasH));

	gameBeginTxt = new createjs.Text();
	gameBeginTxt.font = "50px dimitriregular";
	gameBeginTxt.color = "#fff";
	gameBeginTxt.textAlign = "center";
	gameBeginTxt.textBaseline='alphabetic';
	gameBeginTxt.text = textDisplay.ready;

	gameBeginShadowTxt = new createjs.Text();
	gameBeginShadowTxt.font = "50px dimitri_swankregular";
	gameBeginShadowTxt.color = '#002612';
	gameBeginShadowTxt.textAlign = "center";
	gameBeginShadowTxt.textBaseline='alphabetic';
	gameBeginShadowTxt.text = textDisplay.ready;
	gameBeginShadowTxt.x += 2

	instructionContainer.addChild(gameBeginShadowTxt, gameBeginTxt);

	gameScoreTxt = new createjs.Text();
	gameScoreTxt.font = "60px dimitriregular";
	gameScoreTxt.color = "#fff";
	gameScoreTxt.textAlign = "center";
	gameScoreTxt.textBaseline='alphabetic';

	gameScoreShadowTxt = new createjs.Text();
	gameScoreShadowTxt.font = "60px dimitri_swankregular";
	gameScoreShadowTxt.color = '#002612';
	gameScoreShadowTxt.textAlign = "center";
	gameScoreShadowTxt.textBaseline='alphabetic';
	gameScoreShadowTxt.x += 2;

	scoreContainer.addChild(gameScoreShadowTxt, gameScoreTxt);
	
	//result
	itemResult = new createjs.Bitmap(loader.getResult('itemPop'));
	itemResultP = new createjs.Bitmap(loader.getResult('itemPopP'));
	
	buttonContinue = new createjs.Bitmap(loader.getResult('buttonContinue'));
	centerReg(buttonContinue);
	
	resultShareTxt = new createjs.Text();
	resultShareTxt.font = "35px dimitriregular";
	resultShareTxt.color = '#fff';
	resultShareTxt.textAlign = "center";
	resultShareTxt.textBaseline='alphabetic';
	resultShareTxt.text = textDisplay.share;

	resultShareShadowTxt = new createjs.Text();
	resultShareShadowTxt.font = "35px dimitri_swankregular";
	resultShareShadowTxt.color = '#002612';
	resultShareShadowTxt.textAlign = "center";
	resultShareShadowTxt.textBaseline='alphabetic';
	resultShareShadowTxt.text = textDisplay.share;
	
	resultTitleTxt = new createjs.Text();
	resultTitleTxt.font = "50px dimitriregular";
	resultTitleTxt.color = '#fff';
	resultTitleTxt.textAlign = "center";
	resultTitleTxt.textBaseline='alphabetic';
	resultTitleTxt.text = textDisplay.resultTitle;

	resultTitleShadowTxt = new createjs.Text();
	resultTitleShadowTxt.font = "50px dimitri_swankregular";
	resultTitleShadowTxt.color = '#002612';
	resultTitleShadowTxt.textAlign = "center";
	resultTitleShadowTxt.textBaseline='alphabetic';
	resultTitleShadowTxt.text = textDisplay.resultTitle;
	
	resultDescTxt = new createjs.Text();
	resultDescTxt.font = "65px dimitriregular";
	resultDescTxt.color = '#fff';
	resultDescTxt.textAlign = "center";
	resultDescTxt.textBaseline='alphabetic';
	resultDescTxt.text = '';

	resultDescShadowTxt = new createjs.Text();
	resultDescShadowTxt.font = "65px dimitri_swankregular";
	resultDescShadowTxt.color = '#002612';
	resultDescShadowTxt.textAlign = "center";
	resultDescShadowTxt.textBaseline='alphabetic';
	resultDescShadowTxt.text = '';
	
	
	buttonFacebook = new createjs.Bitmap(loader.getResult('buttonFacebook'));
	buttonTwitter = new createjs.Bitmap(loader.getResult('buttonTwitter'));
	buttonWhatsapp = new createjs.Bitmap(loader.getResult('buttonWhatsapp'));
	centerReg(buttonFacebook);
	createHitarea(buttonFacebook);
	centerReg(buttonTwitter);
	createHitarea(buttonTwitter);
	centerReg(buttonWhatsapp);
	createHitarea(buttonWhatsapp);
	
	buttonFullscreen = new createjs.Bitmap(loader.getResult('buttonFullscreen'));
	centerReg(buttonFullscreen);
	buttonSoundOn = new createjs.Bitmap(loader.getResult('buttonSoundOn'));
	centerReg(buttonSoundOn);
	buttonSoundOff = new createjs.Bitmap(loader.getResult('buttonSoundOff'));
	centerReg(buttonSoundOff);
	buttonSoundOn.visible = false;
	
	buttonExit = new createjs.Bitmap(loader.getResult('buttonExit'));
	centerReg(buttonExit);
	buttonSettings = new createjs.Bitmap(loader.getResult('buttonSettings'));
	centerReg(buttonSettings);
	
	createHitarea(buttonFullscreen);
	createHitarea(buttonSoundOn);
	createHitarea(buttonSoundOff);
	createHitarea(buttonExit);
	createHitarea(buttonSettings);
	optionsContainer = new createjs.Container();
	optionsContainer.addChild(buttonFullscreen, buttonSoundOn, buttonSoundOff, buttonExit);
	optionsContainer.visible = false;
	
	//exit
	itemExit = new createjs.Bitmap(loader.getResult('itemPop'));
	itemExitP = new createjs.Bitmap(loader.getResult('itemPopP'));
	
	buttonConfirm = new createjs.Bitmap(loader.getResult('buttonConfirm'));
	centerReg(buttonConfirm);
	
	buttonCancel = new createjs.Bitmap(loader.getResult('buttonCancel'));
	centerReg(buttonCancel);
	
	popTitleTxt = new createjs.Text();
	popTitleTxt.font = "50px dimitriregular";
	popTitleTxt.color = "#fff";
	popTitleTxt.textAlign = "center";
	popTitleTxt.textBaseline='alphabetic';
	popTitleTxt.text = textDisplay.exitTitle;

	popTitleShadowTxt = new createjs.Text();
	popTitleShadowTxt.font = "50px dimitri_swankregular";
	popTitleShadowTxt.color = '#002612';
	popTitleShadowTxt.textAlign = "center";
	popTitleShadowTxt.textBaseline='alphabetic';
	popTitleShadowTxt.text = textDisplay.exitTitle;
	
	popDescTxt = new createjs.Text();
	popDescTxt.font = "40px dimitriregular";
	popDescTxt.lineHeight = 45;
	popDescTxt.color = "#fff";
	popDescTxt.textAlign = "center";
	popDescTxt.textBaseline='alphabetic';
	popDescTxt.text = textDisplay.exitMessage;

	popDescShadowTxt = new createjs.Text();
	popDescShadowTxt.font = "40px dimitri_swankregular";
	popDescShadowTxt.lineHeight = 45;
	popDescShadowTxt.color = '#002612';
	popDescShadowTxt.textAlign = "center";
	popDescShadowTxt.textBaseline='alphabetic';
	popDescShadowTxt.text = textDisplay.exitMessage;
	
	confirmContainer.addChild(itemExit, itemExitP, popTitleShadowTxt, popTitleTxt, popDescShadowTxt, popDescTxt, buttonConfirm, buttonCancel);
	confirmContainer.visible = false;
	
	if(guide){
		guideline = new createjs.Shape();	
		guideline.graphics.setStrokeStyle(2).beginStroke('red').drawRect((stageW-contentW)/2, (stageH-contentH)/2, contentW, contentH);
	}
	
	mainContainer.addChild(logo, logoP, buttonStart, buttonFreestyle, buttonFlags);
	snowLoopContainer.addChild(tailsContainer, objectsContainer, stageClick, instructionContainer, scoreContainer);
	snowContainer.addChild(snowLoopContainer);
	gameContainer.addChild(stageClick, instructionContainer, scoreContainer);
	resultContainer.addChild(itemResult, itemResultP, buttonContinue, resultTitleShadowTxt, resultTitleTxt, resultDescShadowTxt, resultDescTxt);
	
	if(shareEnable){
		resultContainer.addChild(resultShareShadowTxt, resultShareTxt, buttonFacebook, buttonTwitter, buttonWhatsapp);
	}
	
	canvasContainer.addChild(bg, bgP, snowContainer, mainContainer, gameContainer, resultContainer, confirmContainer, optionsContainer, buttonSettings, guideline);
	stage.addChild(canvasContainer);
	
	changeViewport(viewport.isLandscape);
	resizeGameFunc();
}

function changeViewport(isLandscape){
	if(isLandscape){
		//landscape
		stageW=landscapeSize.w;
		stageH=landscapeSize.h;
		contentW = landscapeSize.cW;
		contentH = landscapeSize.cH;
	}else{
		//portrait
		stageW=portraitSize.w;
		stageH=portraitSize.h;
		contentW = portraitSize.cW;
		contentH = portraitSize.cH;
	}
	
	gameCanvas.width = stageW;
	gameCanvas.height = stageH;
	
	canvasW=stageW;
	canvasH=stageH;
	
	changeCanvasViewport();
}

function changeCanvasViewport(){
	if(canvasContainer!=undefined){
		instructionContainer.x = canvasW/2;
		instructionContainer.y = canvasH/100 * 75;

		snowLoopContainer.x = canvasW/2;

		scoreContainer.x = canvasW/2;
		scoreContainer.y = canvasH/100 * 20;

		buttonStart.visible = buttonFreestyle.visible = buttonFlags.visible = false;
		
		if(viewport.isLandscape){
			bg.visible = true;
			bgP.visible = false;

			logo.visible = true;
			logoP.visible = false;
			
			if(gameSettings.type.freestyle && gameSettings.type.flags){
				buttonFreestyle.visible = true;
				buttonFreestyle.x = canvasW/2 - 90;
				buttonFreestyle.y = canvasH/100 * 73;

				buttonFlags.visible = true;
				buttonFlags.x = canvasW/2 + 90;
				buttonFlags.y = canvasH/100 * 73;
			}else{
				buttonStart.visible = true;
				buttonStart.x = canvasW/2;
				buttonStart.y = canvasH/100 * 73;
			}
			
			//result
			itemResult.visible = true;
			itemResultP.visible = false;
			
			buttonFacebook.x = canvasW/100*43;
			buttonFacebook.y = canvasH/100*62;
			buttonTwitter.x = canvasW/2;
			buttonTwitter.y = canvasH/100*62;
			buttonWhatsapp.x = canvasW/100*57;
			buttonWhatsapp.y = canvasH/100*62;
			
			buttonContinue.x = canvasW/2;
			buttonContinue.y = canvasH/100 * 72;
	
			resultShareTxt.x = canvasW/2;
			resultShareTxt.y = canvasH/100 * 56;

			resultShareShadowTxt.x = resultShareTxt.x + 2;
			resultShareShadowTxt.y = resultShareTxt.y;
	
			resultTitleTxt.x = canvasW/2;
			resultTitleTxt.y = canvasH/100 * 34;

			resultTitleShadowTxt.x = resultTitleTxt.x + 2;
			resultTitleShadowTxt.y = resultTitleTxt.y;
	
			resultDescTxt.x = canvasW/2;
			resultDescTxt.y = canvasH/100 * 49;

			resultDescShadowTxt.x = resultDescTxt.x + 2;
			resultDescShadowTxt.y = resultDescTxt.y;
			
			//exit
			itemExit.visible = true;
			itemExitP.visible = false;

			buttonConfirm.x = (canvasW/2) - 83;
			buttonConfirm.y = (canvasH/100 * 70);
			
			buttonCancel.x = (canvasW/2) + 83;
			buttonCancel.y = (canvasH/100 * 70);

			popTitleTxt.x = canvasW/2;
			popTitleTxt.y = canvasH/100 * 34;

			popTitleShadowTxt.x = popTitleTxt.x + 2;
			popTitleShadowTxt.y = popTitleTxt.y;
			
			popDescTxt.x = canvasW/2;
			popDescTxt.y = canvasH/100 * 48;

			popDescShadowTxt.x = popDescTxt.x + 2;
			popDescShadowTxt.y = popDescTxt.y;

		}else{
			bg.visible = false;
			bgP.visible = true;

			logo.visible = false;
			logoP.visible = true;
			
			if(gameSettings.type.freestyle && gameSettings.type.flags){
				buttonFreestyle.visible = true;
				buttonFreestyle.x = canvasW/2;
				buttonFreestyle.y = canvasH/100 * 65;

				buttonFlags.visible = true;
				buttonFlags.x = canvasW/2;
				buttonFlags.y = canvasH/100 * 73;
			}else{
				buttonStart.visible = true;
				buttonStart.x = canvasW/2;
				buttonStart.y = canvasH/100 * 73;
			}
			
			//result
			itemResult.visible = false;
			itemResultP.visible = true;
			
			buttonFacebook.x = canvasW/100*40;
			buttonFacebook.y = canvasH/100*60;
			buttonTwitter.x = canvasW/2;
			buttonTwitter.y = canvasH/100*60;
			buttonWhatsapp.x = canvasW/100*60;
			buttonWhatsapp.y = canvasH/100*60;
			
			buttonContinue.x = canvasW/2;
			buttonContinue.y = canvasH/100 * 67;
	
			resultShareTxt.x = canvasW/2;
			resultShareTxt.y = canvasH/100 * 56;

			resultShareShadowTxt.x = resultShareTxt.x + 2;
			resultShareShadowTxt.y = resultShareTxt.y;
	
			resultTitleTxt.x = canvasW/2;
			resultTitleTxt.y = canvasH/100 * 38;

			resultTitleShadowTxt.x = resultTitleTxt.x + 2;
			resultTitleShadowTxt.y = resultTitleTxt.y;
	
			resultDescTxt.x = canvasW/2;
			resultDescTxt.y = canvasH/100 * 50;

			resultDescShadowTxt.x = resultDescTxt.x + 2;
			resultDescShadowTxt.y = resultDescTxt.y;
			
			//exit
			itemExit.visible = false;
			itemExitP.visible = true;

			buttonConfirm.x = (canvasW/2) - 83;
			buttonConfirm.y = (canvasH/100 * 67);
			
			buttonCancel.x = (canvasW/2) + 83;
			buttonCancel.y = (canvasH/100 * 67);

			popTitleTxt.x = canvasW/2;
			popTitleTxt.y = canvasH/100 * 38;

			popTitleShadowTxt.x = popTitleTxt.x + 2;
			popTitleShadowTxt.y = popTitleTxt.y;
			
			popDescTxt.x = canvasW/2;
			popDescTxt.y = canvasH/100 * 49;

			popDescShadowTxt.x = popDescTxt.x + 2;
			popDescShadowTxt.y = popDescTxt.y;
		}
	}
}



/*!
 * 
 * RESIZE GAME CANVAS - This is the function that runs to resize game canvas
 * 
 */
function resizeCanvas(){
 	if(canvasContainer!=undefined){
		
		buttonSettings.x = (canvasW - offset.x) - 50;
		buttonSettings.y = offset.y + 45;
		
		var distanceNum = 50;
		if(curPage != 'game'){
			buttonExit.visible = false;
			buttonSoundOn.x = buttonSoundOff.x = buttonSettings.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+distanceNum;
			buttonSoundOn.x = buttonSoundOff.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+(distanceNum);
			
			buttonFullscreen.x = buttonSettings.x;
			buttonFullscreen.y = buttonSettings.y+(distanceNum*2);

		}else{
			buttonExit.visible = true;
			buttonSoundOn.x = buttonSoundOff.x = buttonSettings.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+distanceNum;
			buttonSoundOn.x = buttonSoundOff.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+(distanceNum);
			
			buttonFullscreen.x = buttonSettings.x;
			buttonFullscreen.y = buttonSettings.y+(distanceNum*2);
			
			buttonExit.x = buttonSettings.x;
			buttonExit.y = buttonSettings.y+(distanceNum*3);
		}
	}
}

/*!
 * 
 * REMOVE GAME CANVAS - This is the function that runs to remove game canvas
 * 
 */
 function removeGameCanvas(){
	 stage.autoClear = true;
	 stage.removeAllChildren();
	 stage.update();
	 createjs.Ticker.removeEventListener("tick", tick);
	 createjs.Ticker.removeEventListener("tick", stage);
 }

/*!
 * 
 * CANVAS LOOP - This is the function that runs for canvas loop
 * 
 */ 
function tick(event) {
	updateGame();
	stage.update(event);
}

/*!
 * 
 * CANVAS MISC FUNCTIONS
 * 
 */
function centerReg(obj){
	obj.regX=obj.image.naturalWidth/2;
	obj.regY=obj.image.naturalHeight/2;
}

function createHitarea(obj){
	obj.hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000").drawRect(0, 0, obj.image.naturalWidth, obj.image.naturalHeight));	
}
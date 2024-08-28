////////////////////////////////////////////////////////////
// GAME v1.1
////////////////////////////////////////////////////////////

/*!
 * 
 * GAME SETTING CUSTOMIZATION START
 * 
 */

//players
var player_arr = [
	"assets/player01.png",
	"assets/player02.png",
	"assets/player03.png",
];

//trees
var tree_arr = [
	{src:"assets/tree01.png", regX:24, regY:69, hitDistance:10},
	{src:"assets/tree02.png", regX:18, regY:52, hitDistance:10},
	{src:"assets/tree03.png", regX:24, regY:69, hitDistance:10},
	{src:"assets/tree04.png", regX:18, regY:52, hitDistance:10},
	{src:"assets/tree05.png", regX:24, regY:69, hitDistance:10},
	{src:"assets/tree06.png", regX:18, regY:52, hitDistance:10},
];

//rocks
var rock_arr = [
	{src:"assets/rock01.png", regX:16, regY:18, hitDistance:20},
	{src:"assets/rock02.png", regX:16, regY:18, hitDistance:20},
	{src:"assets/rock03.png", regX:18, regY:16, hitDistance:20},
	{src:"assets/rock04.png", regX:23, regY:25, hitDistance:20},
	{src:"assets/rock05.png", regX:29, regY:25, hitDistance:20},
];

//boards
var board_arr = [
	{src:"assets/board01.png", regX:10, regY:19, hitDistance:15},
	{src:"assets/board02.png", regX:10, regY:19, hitDistance:15},
	{src:"assets/board03.png", regX:10, regY:19, hitDistance:15},
];

//animals
var animal_arr = [
	{src:"assets/deer01.png", regX:29, regY:55, hitDistance:15},
];

var gameSettings = {
	type:{
		freestyle:true,
		flags:true,
	},
	tail:{
		color:"#98A7BC",
		stroke:10,
	},
	flags:{
		loopRange:[15,18], //total loop to display flags
		rangeX:50, //flags x position  
		randomRangeX:30, //flags x position with random range
		enterRange:100 //flags enter range
	},
	playerSpeed:2,
	worldSpeed:10,
	scoreCalculate:.05,
	bonusScore:100,
	bonusScoreColor:["#52259b","#fff"],
	missedFlagsColor:["#000","#fff"],
	level:{
		distance:2000, //target distance to increase speed, eg.500, 1000, 1500
		worldSpeed:1, //speed to increase
		playerSpeed:.3, //speed to decrease
	}
}

//game text display
var textDisplay = {
					instruction:'MOUSE TO MOVE',
					mobileInstruction:'PRESS TO MOVE',
					missedFlags:'MISSED FLAGS',
					exitTitle:'EXIT GAME',
					exitMessage:'ARE YOU SURE\nYOU WANT TO\nQUIT THE GAME?',
					share:'SHARE YOUR SCORE',
					resultTitle:'GAME OVER',
					resultDesc:'[NUMBER]',
				}

//Social share, [SCORE] will replace with game score
var shareEnable = true; //toggle share
var shareTitle = 'Highscore on Downhill Ski is [SCORE]';//social share score title
var shareMessage = '[SCORE] is mine new highscore on Downhill Ski game! Try it now!'; //social share score message

/*!
 *
 * GAME SETTING CUSTOMIZATION END
 *
 */
$.editor = {enable:false};
var playerData = {score:0, bonus:0, distance:0};
var gameData = {paused:true, tails:[], trees:[], speed:0, type:"", enterFlags:false, over:false};
var tweenData = {score:0, tweenScore:0};

/*!
 * 
 * GAME BUTTONS - This is the function that runs to setup button event
 * 
 */
function buildGameButton(){
	buttonStart.cursor = "pointer";
	buttonStart.addEventListener("click", function(evt) {
		playSound('soundButton');
		checkGameType();
		goPage('game');
	});

	buttonFreestyle.cursor = "pointer";
	buttonFreestyle.addEventListener("click", function(evt) {
		playSound('soundButton');
		gameData.type = "freestyle";
		gameData.enterFlags = false;
		goPage('game');
	});

	buttonFlags.cursor = "pointer";
	buttonFlags.addEventListener("click", function(evt) {
		playSound('soundButton');
		gameData.type = "flags";
		gameData.enterFlags = true;
		goPage('game');
	});
	
	itemExit.addEventListener("click", function(evt) {
	});
	
	buttonContinue.cursor = "pointer";
	buttonContinue.addEventListener("click", function(evt) {
		playSound('soundButton');
		goPage('main');
	});
	
	buttonFacebook.cursor = "pointer";
	buttonFacebook.addEventListener("click", function(evt) {
		share('facebook');
	});
	
	buttonTwitter.cursor = "pointer";
	buttonTwitter.addEventListener("click", function(evt) {
		share('twitter');
	});
	buttonWhatsapp.cursor = "pointer";
	buttonWhatsapp.addEventListener("click", function(evt) {
		share('whatsapp');
	});
	
	buttonSoundOff.cursor = "pointer";
	buttonSoundOff.addEventListener("click", function(evt) {
		toggleGameMute(true);
	});
	
	buttonSoundOn.cursor = "pointer";
	buttonSoundOn.addEventListener("click", function(evt) {
		toggleGameMute(false);
	});
	
	buttonFullscreen.cursor = "pointer";
	buttonFullscreen.addEventListener("click", function(evt) {
		toggleFullScreen();
	});
	
	buttonExit.cursor = "pointer";
	buttonExit.addEventListener("click", function(evt) {
		togglePop(true);
		toggleOption();
	});
	
	buttonSettings.cursor = "pointer";
	buttonSettings.addEventListener("click", function(evt) {
		toggleOption();
	});
	
	buttonConfirm.cursor = "pointer";
	buttonConfirm.addEventListener("click", function(evt) {
		playSound('soundButton');
		togglePop(false);
		
		stopAudio();
		stopGame();
		goPage('main');
	});
	
	buttonCancel.cursor = "pointer";
	buttonCancel.addEventListener("click", function(evt) {
		playSound('soundButton');
		togglePop(false);
	});
}

function checkGameType(){
	if(gameSettings.type.freestyle){
		gameData.type = "freestyle";
		gameData.enterFlags = false;
	}else{
		gameData.type = "flags";
		gameData.enterFlags = true;
	}
}

/*!
 * 
 * TOGGLE POP - This is the function that runs to toggle popup overlay
 * 
 */
function togglePop(con){
	confirmContainer.visible = con;
}


/*!
 * 
 * DISPLAY PAGES - This is the function that runs to display pages
 * 
 */
var curPage=''
function goPage(page){
	curPage=page;
	
	mainContainer.visible = false;
	gameContainer.visible = false;
	resultContainer.visible = false;
	
	var targetContainer = null;
	switch(page){
		case 'main':
			targetContainer = mainContainer;
			setupBackground();
		break;
		
		case 'game':
			targetContainer = gameContainer;
			startGame();
		break;
		
		case 'result':
			targetContainer = resultContainer;
			stopGame();
			togglePop(false);
			playSound('soundResult');

			resultDescTxt.text = resultDescShadowTxt.text = 0;
			tweenData.tweenScore = 0;
			TweenMax.to(tweenData, .5, {delay:.5, tweenScore:playerData.score, overwrite:true, onUpdate:function(){
				resultDescTxt.text = addCommas(Math.floor(tweenData.tweenScore));
				resultDescShadowTxt.text = addCommas(Math.floor(tweenData.tweenScore));
			}});
			
			saveGame(playerData.score);
		break;
	}
	
	if(targetContainer != null){
		targetContainer.visible = true;
		targetContainer.alpha = 0;
		TweenMax.to(targetContainer, .5, {alpha:1, overwrite:true});
	}
	
	resizeCanvas();
}

/*!
 * 
 * START GAME - This is the function that runs to start game
 * 
 */
function startGame(){
	gameData.paused = false;

	prepareLevel();
	createPlayer();
	playSound('soundStart');
	playSoundLoop("soundSki");

	if($.browser.mobile || isTablet){
		toggleInstruction(true, false);
	}else{
		toggleInstruction(true, true);
	}
}

function prepareLevel(){
	gameData.trailDistance = 2;
	gameData.trailDistanceMax = 2;

	gameData.speed = 0;
	gameData.speedMax = gameSettings.worldSpeed;
	
	gameData.treeSideDistance = 0;
	gameData.treeSideDistanceMax = 20;
	gameData.treeSideDistanceRandom = [0,10];
	gameData.treeSideDistanceRandomDistance = 0;

	gameData.distance = 0;
	gameData.distanceMax = 10;
	gameData.boardSide = randomBoolean();

	gameData.level = 1;
	gameData.nextDistance = gameSettings.level.distance;

	gameData.loopRange = gameSettings.flags.loopRange;
	insertObjectsArray();

	gameData.moveRange = 500;
	gameData.sideRange = 300;
	gameData.boardRange = gameSettings.flags.rangeX;
	gameData.boardRandomRange = gameSettings.flags.randomRangeX;
	gameData.boardEnterRange = gameSettings.flags.enterRange;
	gameData.showAnimation = "";

	gameData.over = false;
	tailsContainer.y = 0;

	playerData.distance = 0;
	playerData.bonus = 0;
	playerData.score = 0;
	updateScore();
}

function toggleInstruction(con, desktop){
	instructionContainer.visible = con;
	if(con){
		animateBlink(instructionContainer);
		if(desktop){
			gameBeginTxt.text = gameBeginShadowTxt.text = textDisplay.instruction;
		}else{
			gameBeginTxt.text = gameBeginShadowTxt.text = textDisplay.mobileInstruction;
		}

		TweenMax.to(gameBeginTxt, 3, {overwrite:true, onComplete:function(){
			toggleInstruction(false);
		}});
	}else{
		TweenMax.killTweensOf(instructionContainer);
	}
}

function animateBlink(obj){
	var tweenSpeed = .5;
	obj.alpha = 0;
	TweenMax.to(obj, tweenSpeed, {alpha:1, overwrite:true, onComplete:function(){
		TweenMax.to(obj, tweenSpeed, {alpha:0, overwrite:true, onComplete:animateBlink, onCompleteParams:[obj]});
	}});
}

 /*!
 * 
 * STOP GAME - This is the function that runs to stop play game
 * 
 */
function stopGame(){
	gameData.paused = true;
	stopSoundLoop("soundSki");

	TweenMax.killAll(false, true, false);
}

function saveGame(score){
	if ( typeof toggleScoreboardSave == 'function' ) { 
		$.scoreData.score = score;
		if(typeof type != 'undefined'){
			$.scoreData.type = type;	
		}
		toggleScoreboardSave(true);
	}

	/*$.ajax({
      type: "POST",
      url: 'saveResults.php',
      data: {score:score},
      success: function (result) {
          console.log(result);
      }
    });*/
}

/*!
 * 
 * SETUP BACKGROUND - This is the function that runs to setup background
 * 
 */
function setupBackground(){
	gameData.trees = [];
	gameData.rocks = [];
	gameData.boards = [];
	gameData.status = [];
	gameData.animals = [];
	gameData.tails = [];
	objectsContainer.removeAllChildren();	
	tailsContainer.removeAllChildren();

	for(var n=0; n<30; n++){
		createTrees(false);

		var thisTree = gameData.trees[gameData.trees.length-1];
		thisTree.x = randomIntFromInterval(-(landscapeSize.w/2), landscapeSize.w/2);
		thisTree.y = randomIntFromInterval(0, landscapeSize.h);

		if(thisTree.x >= -100 && thisTree.x <= 100){
			thisTree.x += 200;
		}

		if(thisTree.y >= -100 && thisTree.y <= 100){
			thisTree.y += 200;
		}
	}

	sortObjects();
}

/*!
 * 
 * CREATE PLAYER - This is the function that runs to create new player
 * 
 */
function createPlayer(){
	var randomPlayer = Math.floor(Math.random() * player_arr.length);
	var _speed = .5;
	var _frameW = 24;
	var _frameH = 35;
	var _count = 4;
	var _animations = {
		left:{frames: [0], speed:_speed},
		middle:{frames: [1], speed:_speed},
		right:{frames: [2], speed:_speed},
		fall:{frames: [3], speed:_speed}
	};

	var _frame = {"regX": _frameW/2, "regY": _frameH/2, "height": _frameH, "width": _frameW, "count": _count};				
	var spriteData = new createjs.SpriteSheet({
		"images": [loader.getResult("itemPlayer" + randomPlayer)],
		"frames": _frame,
		"animations": _animations
	});

	var newPlayer = new createjs.Sprite(spriteData, _frame);
	newPlayer.framerate = 20;

	itemPlayer = newPlayer;
	itemPlayer.x = 0;
	gameData.moveX = 0;

	objectsContainer.addChild(itemPlayer, snowSplash);
}

/*!
 * 
 * UPDATE GAME - This is the function that runs to loop game update
 * 
 */
function updateGame(){
	if(!gameData.paused){

		if(!gameData.over){
			if(viewport.isLandscape){
				itemPlayer.y = canvasH/100 * 40;
			}else{
				itemPlayer.y = canvasH/100 * 30;
			}
			gameData.moveX = stage.mouseX - snowLoopContainer.x;
			TweenMax.to(itemPlayer, gameSettings.playerSpeed, {x:gameData.moveX, overwrite:true});

			gameData.speed += .1;
			gameData.speed = gameData.speed > gameData.speedMax ? gameData.speedMax : gameData.speed;

			drawTails();
		}else{
			itemPlayer.y -= gameData.speed;
			tailsContainer.y -= gameData.speed;

			gameData.speed -= .5;
			gameData.speed = gameData.speed < 0 ? 0 : gameData.speed;
		}
		
		snowSplash.x = itemPlayer.x;
		snowSplash.y = itemPlayer.y;

		loopPlayer();
		loopObjects();
		sortObjects();

		playerData.distance += gameData.speed;
		updateScore();
	}
}

var sortFunction = function(obj1, obj2, options) {
	if (obj1.y > obj2.y) { return 1; }
	if (obj1.y < obj2.y) { return -1; }
	return 0;
}

/*!
 * 
 * DRAW TAILS - This is the function that runs to draw tails
 * 
 */
function drawTails() {
	for(var i = 0; i <gameData.tails.length; i++) {
		gameData.tails[i].y -= gameData.speed;
	}
	
	gameData.trailDistance++;
	if(gameData.trailDistance >= gameData.trailDistanceMax){
		gameData.trailDistance = 0;
		var pt = new createjs.Point(itemPlayer.x, itemPlayer.y);
		gameData.tails.unshift(pt);
	}
	gameData.tails = gameData.tails.slice(0,100);
	
	tailsContainer.removeAllChildren();
	var points = gameData.tails;
	var nb = gameData.tails.length-1;
  	var trail = new createjs.Shape();

    for(var i = 0; i <= nb - 1; i++) {
		var stroke = i*.2;
		stroke = stroke > 5 ? 5 : stroke;
		stroke = stroke < 0 ? 0 : stroke;

		var midPt = getMidPoint(points[i+1], points[i]);
		trail.graphics.setStrokeStyle(gameSettings.tail.stroke,'round','round').beginStroke(gameSettings.tail.color).mt(points[i].x,points[i].y).curveTo(midPt.x, midPt.y, points[i+1].x,points[i+1].y);
    }
	tailsContainer.addChild(trail);
}

function getMidPoint(p1, p2) {
	return {
	  x: p1.x + (p2.x - p1.x) / 2,
	  y: p1.y + (p2.y - p1.y) / 2
	};
  }

/*!
 * 
 * LOOP PLAYER - This is the function that runs to loop player
 * 
 */
function loopPlayer(){
	if(gameData.over){
		itemPlayer.gotoAndPlay("fall");
		return;
	}

	var distanceX = Math.round(Math.abs(itemPlayer.x - gameData.moveX));
	if(distanceX < 50){
		gameData.showAnimation = "";
		itemPlayer.gotoAndPlay("middle");
	}else if(itemPlayer.x > gameData.moveX){
		if(gameData.showAnimation != "left"){
			gameData.showAnimation = "left";
			snowSplash.gotoAndPlay("splashleft");
			playSound('soundSkiTurn');
		}
		itemPlayer.gotoAndPlay("left");
	}else if(itemPlayer.x < gameData.moveX){
		if(gameData.showAnimation != "right"){
			gameData.showAnimation = "right";
			snowSplash.gotoAndPlay("splashright");
			playSound('soundSkiTurn');
		}
		itemPlayer.gotoAndPlay("right");
	}
}

/*!
 * 
 * OBJECTS ARRAY - This is the function that runs to insert objects array
 * 
 */
function insertObjectsArray(){
	gameData.objectsArr = [];

	var randomTree = randomIntFromInterval(3,5);
	var rockInsert = false;

	for(var n=0; n<randomTree; n++){
		gameData.objectsArr.push(1);
		var randomEmpty = randomIntFromInterval(gameData.loopRange[0],gameData.loopRange[1]);
		for(var e=0; e<randomEmpty; e++){
			gameData.objectsArr.push(0);
			if(randomBoolean() && !rockInsert){
				rockInsert = true;
				gameData.objectsArr.push(2);
			}
		}
	}

	gameData.objectsArr.push(3);
	var randomEmpty = randomIntFromInterval(gameData.loopRange[0],gameData.loopRange[1]);
	var deerInsert = false;
	for(var e=0; e<randomEmpty; e++){
		gameData.objectsArr.push(0);

		if(randomBoolean() && !deerInsert){
			deerInsert = true;
			gameData.objectsArr.push(4);
		}
	}
}

/*!
 * 
 * LOOP OBJECTS - This is the function that runs to loop game objects
 * 
 */
function loopObjects(){
	gameData.treeSideDistance += gameData.speed;
	if(gameData.treeSideDistance >= gameData.treeSideDistanceMax + gameData.treeSideDistanceRandomDistance){
		gameData.treeSideDistanceRandomDistance = randomIntFromInterval(gameData.treeSideDistanceRandom[0],gameData.treeSideDistanceRandom[1]);
		gameData.treeSideDistance = 0;
		createTrees(false);
	}

	gameData.distance += gameData.speed;
	if(gameData.distance >= gameData.distanceMax){
		gameData.distance = 0;
		
		var currentType = gameData.objectsArr[0];
		if(currentType == 1){
			createTrees(true);
		}else if(currentType == 2){
			createRock();
		}else if(currentType == 3){
			createBoard();
		}else if(currentType == 4){
			var randomDeer = randomIntFromInterval(0,3);
			for(var d=0; d<randomDeer; d++){
				createAnimal();
			}
		}
		gameData.objectsArr.splice(0,1);

		if(gameData.objectsArr.length <= 0){
			insertObjectsArray();
		}
	}

	//loop
	for(var n=0; n<gameData.trees.length; n++){
		var thisTree = gameData.trees[n];
		thisTree.y -= gameData.speed;

		var getHitDistance = getDistance(itemPlayer.x, itemPlayer.y, thisTree.x, thisTree.y);
		if(getHitDistance <= thisTree.hitDistance){
			endGame();
		}
	}

	for(var n=0; n<gameData.rocks.length; n++){
		var thisRock = gameData.rocks[n];
		thisRock.y -= gameData.speed;

		var getHitDistance = getDistance(itemPlayer.x, itemPlayer.y, thisRock.x, thisRock.y);
		if(getHitDistance <= thisRock.hitDistance){
			endGame();
		}
	}

	for(var n=0; n<gameData.boards.length; n++){
		var thisBoard = gameData.boards[n];
		thisBoard.y -= gameData.speed;

		var getHitDistance = getDistance(itemPlayer.x, itemPlayer.y, thisBoard.x, thisBoard.y);
		if(getHitDistance <= thisBoard.hitDistance){
			endGame();
		}

		if(thisBoard.targetRange != null && !gameData.over){
			if((itemPlayer.y - thisBoard.y) > 0 && (itemPlayer.y - thisBoard.y) < 30){
				if(itemPlayer.x > thisBoard.x && itemPlayer.x < thisBoard.x + gameData.boardEnterRange){
					thisBoard.targetRange = null;
					addStatus(thisBoard.x + (gameData.boardEnterRange/2), thisBoard.y, gameSettings.bonusScore, true);
				}else if(gameData.enterFlags){
					if((itemPlayer.y - thisBoard.y) >= 20){
						addStatus(thisBoard.x + (gameData.boardEnterRange/2), thisBoard.y, 0, false);
						endGame();
					}
				}
			}
		}
	}

	for(var n=0; n<gameData.status.length; n++){
		var thisScore = gameData.status[n];
		thisScore.y -= gameData.speed;
	}

	for(var n=0; n<gameData.animals.length; n++){
		var thisAnimal = gameData.animals[n];
		thisAnimal.oriY -= gameData.speed;
		thisAnimal.y = thisAnimal.oriY + thisAnimal.offsetY;

		var getHitDistance = getDistance(itemPlayer.x, itemPlayer.y, thisAnimal.x, thisAnimal.y);
		if(getHitDistance <= thisAnimal.hitDistance){
			endGame();
			TweenMax.killTweensOf(thisAnimal);
			thisAnimal.gotoAndPlay("fall");
		}else if(getHitDistance <= 150 && !gameData.over){
			animateAnimal(thisAnimal, "run");
		}
	}

	//remove
	for(var n=0; n<gameData.trees.length; n++){
		var thisTree = gameData.trees[n];
		if(thisTree.y <= canvasH/2 - 500){
			objectsContainer.removeChild(thisTree);
			gameData.trees.splice(n,1);
		}
	}

	for(var n=0; n<gameData.rocks.length; n++){
		var thisRock = gameData.rocks[n];
		if(thisRock.y <= canvasH/2 - 500){
			objectsContainer.removeChild(thisRock);
			gameData.rocks.splice(n,1);
		}
	}

	for(var n=0; n<gameData.boards.length; n++){
		var thisBoard = gameData.boards[n];
		if(thisBoard.y <= canvasH/2 - 500){
			objectsContainer.removeChild(thisBoard);
			gameData.boards.splice(n,1);
		}
	}

	for(var n=0; n<gameData.status.length; n++){
		var thisStatus = gameData.status[n];
		if(thisStatus.y <= canvasH/2 - 500){
			objectsContainer.removeChild(thisStatus);
			gameData.status.splice(n,1);
		}
	}

	for(var n=0; n<gameData.animals.length; n++){
		var thisAnimal = gameData.animals[n];
		if(thisAnimal.y <= canvasH/2 - 500){
			TweenMax.killTweensOf(thisAnimal);
			objectsContainer.removeChild(thisAnimal);
			gameData.animals.splice(n,1);
		}
	}
}

/*!
 * 
 * SORT OBJECTS - This is the function that runs to sort objects
 * 
 */
function sortObjects(){
	objectsContainer.sortChildren(sortFunction);
}

/*!
 * 
 * CREATE TREE - This is the function that runs to create tree
 * 
 */
function createTrees(centre){
	var randomTree = Math.floor(Math.random() * tree_arr.length);
	var newTree = new createjs.Bitmap(loader.getResult('itemTree' + randomTree));
	newTree.regX = tree_arr[randomTree].regX;
	newTree.regY = tree_arr[randomTree].regY;
	newTree.hitDistance = tree_arr[randomTree].hitDistance;

	var centerX = 0;
	var randomX = randomIntFromInterval(centerX-(gameData.moveRange/2),centerX+(gameData.moveRange/2));
	if(!centre){
		randomX = randomIntFromInterval(0,gameData.sideRange);
		if(randomBoolean()){
			randomX = centerX + ((gameData.moveRange/2) + randomX);
		}else{
			randomX = centerX - ((gameData.moveRange/2) + randomX);
		}
	}

	newTree.x = randomX;
	newTree.y = canvasH/2 + 500;
	newTree.y += randomIntFromInterval(0, 100);

	gameData.trees.push(newTree);
	objectsContainer.addChild(newTree);
}

/*!
 * 
 * CREATE ROCK - This is the function that runs to create rock
 * 
 */
function createRock(){
	var randomRock = Math.floor(Math.random() * rock_arr.length);
	var newRock = new createjs.Bitmap(loader.getResult('itemRock' + randomRock));
	newRock.regX = rock_arr[randomRock].regX;
	newRock.regY = rock_arr[randomRock].regY;
	newRock.hitDistance = rock_arr[randomRock].hitDistance;

	var centerX = 0;
	var randomX = randomIntFromInterval(centerX-(gameData.moveRange/2),centerX+(gameData.moveRange/2));
	newRock.x += randomX;
	newRock.y = canvasH/2 + 500;
	newRock.y += randomIntFromInterval(0, 100);

	gameData.rocks.push(newRock);
	objectsContainer.addChild(newRock);
}

/*!
 * 
 * CREATE BOARD - This is the function that runs to create board
 * 
 */
function createBoard(){
	var randomBoard = Math.floor(Math.random() * board_arr.length);
	var newBoardL = new createjs.Bitmap(loader.getResult('itemBoard' + randomBoard));
	newBoardL.regX = board_arr[randomBoard].regX;
	newBoardL.regY = board_arr[randomBoard].regY;
	newBoardL.hitDistance = board_arr[randomBoard].hitDistance;

	var newBoardR = new createjs.Bitmap(loader.getResult('itemBoard' + randomBoard));
	newBoardR.regX = board_arr[randomBoard].regX;
	newBoardR.regY = board_arr[randomBoard].regY;
	newBoardR.hitDistance = board_arr[randomBoard].hitDistance;

	var centerX = 0;
	var randomX = randomIntFromInterval(0,gameData.boardRandomRange);
	var boardCenterX;
	if(gameData.boardSide){
		boardCenterX = centerX + (gameData.boardRange + randomX);
	}else{
		boardCenterX = centerX - (gameData.boardRange + randomX);
	}
	gameData.boardSide = gameData.boardSide == true ? false : true;
	newBoardL.x = boardCenterX - (gameData.boardEnterRange/2);
	newBoardR.x = boardCenterX + (gameData.boardEnterRange/2);
	newBoardL.y = newBoardR.y = canvasH/2 + 500;
	newBoardR.scaleX = -1;
	newBoardL.targetRange = newBoardR;
	newBoardR.targetRange = null;

	gameData.boards.push(newBoardL);
	gameData.boards.push(newBoardR);
	objectsContainer.addChild(newBoardL, newBoardR);
}

/*!
 * 
 * CREATE ANIMAL - This is the function that runs to create animal
 * 
 */
function createAnimal(){
	var randomAnimal = Math.floor(Math.random() * animal_arr.length);
	var _speed = .5;
	var _frameW = 58;
	var _frameH = 55;
	var _count = 6;
	var _animations = {
		idle:{frames: [0], speed:_speed},
		run:{frames: [1,2,3,4], speed:_speed},
		fall:{frames: [5], speed:_speed}
	};

	var _frame = {"regX": rock_arr[randomAnimal].regX, "regY": rock_arr[randomAnimal].regY, "height": _frameH, "width": _frameW, "count": _count};				
	var spriteData = new createjs.SpriteSheet({
		"images": [loader.getResult("itemAnimal" + randomAnimal)],
		"frames": _frame,
		"animations": _animations
	});

	var newAnimal = new createjs.Sprite(spriteData, _frame);
	newAnimal.framerate = 20;
	newAnimal.hitDistance = rock_arr[randomAnimal].hitDistance;
	newAnimal.gotoAndPlay("idle");

	var centerX = 0;
	var randomX = randomIntFromInterval(centerX-(gameData.moveRange/2),centerX+(gameData.moveRange/2));
	newAnimal.x += randomX;
	newAnimal.y = canvasH/2 + 500;
	newAnimal.y += randomIntFromInterval(0, 100);
	newAnimal.oriY = newAnimal.y;

	newAnimal.runSide = newAnimal.x > centerX ? "left" : "right";
	newAnimal.scaleX = newAnimal.runSide == "left" ? -1 : 1;
	newAnimal.offsetY = 0;

	gameData.animals.push(newAnimal);
	objectsContainer.addChild(newAnimal);

	var randomAnimation = randomBoolean() == true ? "idle" : "run";
	animateAnimal(newAnimal, randomAnimation);
}

function animateAnimal(newAnimal, animation){
	newAnimal.gotoAndPlay(animation);
	randomAnimation = randomBoolean() == true ? "idle" : "run";
	
	var posX = newAnimal.x;
	var posY = newAnimal.offsetY;
	var delay = .5;
	if(animation == "run"){
		playSound('soundDeer');
		delay = 0;
		posY = randomIntFromInterval(-200,200);

		if(newAnimal.runSide == "left"){
			posX -= 300;
		}else{
			posX += 300;
		}
	}
	TweenMax.to(newAnimal, 1.5, {delay:delay, x:posX, offsetY:posY, overwrite:true, onComplete:animateAnimal, onCompleteParams:[newAnimal, randomAnimation]});
}

/*!
 * 
 * ADD SCORE - This is the function that runs to add score
 * 
 */
function addStatus(x,y,score,isScore){
	var statusText = "";
	var statusColor = gameSettings.bonusScoreColor[1];
	var statusShadowColor = gameSettings.bonusScoreColor[0];
	if(isScore){
		playSound('soundScore');
		playerData.bonus += score;
		statusText = "+"+score;
	}else{
		statusColor = gameSettings.missedFlagsColor[1];
		statusShadowColor = gameSettings.missedFlagsColor[0];
		statusText = textDisplay.missedFlags;
	}

	var newStatusContainer = new createjs.Container();
	newStatusContainer.x = x;
	newStatusContainer.y = y;

	var newStatus = new createjs.Text();
	newStatus.font = "40px dimitriregular";
	newStatus.color = statusColor;
	newStatus.textAlign = "center";
	newStatus.textBaseline='alphabetic';
	newStatus.text = statusText;

	var newStatusShadow = new createjs.Text();
	newStatusShadow.font = "40px dimitri_swankregular";
	newStatusShadow.color = statusShadowColor;
	newStatusShadow.textAlign = "center";
	newStatusShadow.textBaseline='alphabetic';
	newStatusShadow.text = statusText;
	newStatusShadow.y = 0;

	TweenMax.to(newStatus, .5, {y:newStatus.y-30, overwrite:true});
	TweenMax.to(newStatusShadow, .5, {y:newStatusShadow.y-30, overwrite:true});

	newStatusContainer.addChild(newStatusShadow, newStatus);
	gameData.status.push(newStatusContainer);
	objectsContainer.addChild(newStatusContainer);
}

/*!
 * 
 * UPDATE SCORE - This is the function that runs to update score
 * 
 */
function updateScore(){
	var distanceScore = Math.round(playerData.distance * gameSettings.scoreCalculate);
	playerData.score = distanceScore + playerData.bonus;
	gameScoreTxt.text = gameScoreShadowTxt.text = addCommas(playerData.score);

	if(playerData.distance > gameData.nextDistance){
		gameData.level++;
		gameData.nextDistance = gameSettings.level.distance * gameData.level;
		gameData.speedMax += gameSettings.level.worldSpeed;
		gameData.playerSpeed -= gameSettings.level.playerSpeed;
	}
}

/*!
 * 
 * END GAME - This is the function that runs for game end
 * 
 */
function endGame(){
	if(!gameData.over){
		gameData.over = true;
		TweenMax.killTweensOf(itemPlayer);

		stopSoundLoop("soundSki");
		playSound('soundHit');
		playSound('soundOver');
		for(var n=0; n<gameData.animals.length; n++){
			var thisAnimal = gameData.animals[n];
			TweenMax.killTweensOf(thisAnimal);
			thisAnimal.gotoAndPlay("idle");
		}

		TweenMax.to(gameContainer, 1.5, {overwrite:true, onComplete:function(){
			gameData.paused = true;
			goPage('result')
		}});
	}
}

/*!
 * 
 * OPTIONS - This is the function that runs to toggle options
 * 
 */

function toggleOption(){
	if(optionsContainer.visible){
		optionsContainer.visible = false;
	}else{
		optionsContainer.visible = true;
	}
}


/*!
 * 
 * OPTIONS - This is the function that runs to mute and fullscreen
 * 
 */
function toggleGameMute(con){
	buttonSoundOff.visible = false;
	buttonSoundOn.visible = false;
	toggleMute(con);
	if(con){
		buttonSoundOn.visible = true;
	}else{
		buttonSoundOff.visible = true;	
	}
}

function toggleFullScreen() {
  if (!document.fullscreenElement &&    // alternative standard method
      !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working methods
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

/*!
 * 
 * SHARE - This is the function that runs to open share url
 * 
 */
function share(action){
	gtag('event','click',{'event_category':'share','event_label':action});
	
	var loc = location.href
	loc = loc.substring(0, loc.lastIndexOf("/") + 1);
	
	var title = '';
	var text = '';
	
	title = shareTitle.replace("[SCORE]", addCommas(playerData.score));
	text = shareMessage.replace("[SCORE]", addCommas(playerData.score));
	
	var shareurl = '';
	
	if( action == 'twitter' ) {
		shareurl = 'https://twitter.com/intent/tweet?url='+loc+'&text='+text;
	}else if( action == 'facebook' ){
		shareurl = 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(loc+'share.php?desc='+text+'&title='+title+'&url='+loc+'&thumb='+loc+'share.jpg&width=590&height=300');
	}else if( action == 'google' ){
		shareurl = 'https://plus.google.com/share?url='+loc;
	}else if( action == 'whatsapp' ){
		shareurl = "whatsapp://send?text=" + encodeURIComponent(text) + " - " + encodeURIComponent(loc);
	}
	
	window.open(shareurl);
}
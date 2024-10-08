
const numLadders = 5;
const numSnakes = 5;
const maxPosition = 100;
const cellWidth = 43;
const boardWidth = 430;
const boardStartX = 25;
const boardStartY = 25;
const gridSize = 10;
let moving = false;
let diceValue = 0 ;
let player ;
let ladders = [];
let snakes = [];
let playerPosition = 1;
let box;

runOnStartup(async runtime =>
{
	// Code to run on the loading screen.
	// Note layouts, objects etc. are not yet available.
	
	runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime));
});

async function OnBeforeProjectStart(runtime)
{
	// Code to run just before 'On start of layout' on
	// the first layout. Loading has finished and initial
	// instances are created and available to use here.
	 player = runtime.objects.Player.getFirstInstance();
	 createBoard();
	runtime.addEventListener("tick", () => Tick(runtime));
}

function createBoard(runtime){
	let dir = 1;
    let frame = 0;
	for (let i = 0, j = maxPosition; i < maxPosition; i++, j--) {
      frame = 1 - frame;
		const box = runtime.objects.Box.createInstance(1, x, y, true, 'Box')
//       this.cells.push(
//         new Box(this, x, y, 'b' + (frame + 3), j, cellWidth).setOrigin(0)
//       );

	box.getChildAt(0).setText(j)
//       this.add
//         .text(x + cellWidth, y + cellWidth, j, {
//           fontFamily: 'Arial Black',
//           fontSize: 12,
//           color: frame == 0 ? '#ffffff' : '#000000',
//         })
//         .setOrigin(1)
//         .setDepth(1);
      if ((i + 1) % 10 === 0) {
        y += cellWidth;
        dir = -dir;
      } else {
        x += cellWidth * dir;
      }
    }
}

function Tick(runtime)
{
	// Code to run every tick
}



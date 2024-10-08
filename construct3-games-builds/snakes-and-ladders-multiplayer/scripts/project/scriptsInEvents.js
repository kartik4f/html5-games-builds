


const scriptsInEvents = {

	async Es_game_Event23_Act3(runtime, localVars)
	{
		let start_xy = runtime.callFunction('getXYByPos',[runtime.objects.ArrayLadders.getFirstInstance().getAt(localVars.count)]);
		let end_xy = runtime.callFunction('getXYByPos',[runtime.objects.ArrayLadders.getFirstInstance().getAt(localVars.count+1)])
		console.log(start_xy, end_xy)
		let startXY = start_xy.split(',');
		localVars.startX = startXY[0];
		localVars.startY = startXY[1];
		let endXY = end_xy.split(',');
		localVars.endX = endXY[0];
		localVars.endY = endXY[1]
	},

	async Es_game_Event26_Act3(runtime, localVars)
	{
		let start_xy = runtime.callFunction('getXYByPos',[runtime.objects.ArraySnakes.getFirstInstance().getAt(localVars.count)]);
		let end_xy = runtime.callFunction('getXYByPos',[runtime.objects.ArraySnakes.getFirstInstance().getAt(localVars.count+1)])
		console.log(start_xy, end_xy)
		let startXY = start_xy.split(',');
		localVars.startX = startXY[0];
		localVars.startY = startXY[1];
		let endXY = end_xy.split(',');
		localVars.endX = endXY[0];
		localVars.endY = endXY[1]
	},

	async Es_game_Event27_Act1(runtime, localVars)
	{
		let [x, y] = [0, 0];
		let ind = localVars.position -1;
		const boardStartX = runtime.globalVars.boardStartX;
		const boardStartY = runtime.globalVars.boardStartY;
		const cellWidth = runtime.globalVars.cellWidth;
		const gridSize = runtime.globalVars.gridSize;
		    let s = Math.floor(ind / 10);
		    if (s % 2 === 0) {
		      x = boardStartX + (ind % 10) * cellWidth + cellWidth / 2;
		      y =
		        boardStartY +
		        gridSize * cellWidth -
		        cellWidth / 2 -
		        Math.floor(ind / 10) * cellWidth;
		    } else {
		      x =
		        boardStartX +
		        gridSize * cellWidth -
		        ((ind % 10) * cellWidth + cellWidth / 2);
		      y =
		        boardStartY +
		        gridSize * cellWidth -
		        cellWidth / 2 -
		        Math.floor(ind / 10) * cellWidth;
		    }
		runtime.setReturnValue(x+","+y)
	},

	async Es_game_Event57_Act1(runtime, localVars)
	{
		const player = runtime.objects.Player.getFirstPickedInstance();
		const xy = (runtime.callFunction('getXYByPos', [player.instVars.Position])).split(',')
		localVars.targetX = xy[0]-player.instVars.Gap;
		localVars.targetY = xy[1]+player.instVars.GapY*0.5;
		localVars.targetY = xy[1];
		console.log("player psoition", xy);
	}

};

self.C3.ScriptsInEvents = scriptsInEvents;


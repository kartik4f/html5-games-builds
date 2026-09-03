import BootScene from "./scenes/BootScene.js";
import HomeScene from "./scenes/HomeScene.js";
import DailyScene from "./scenes/DailyScene.js";
import StoryScene from "./scenes/StoryScene.js";
import ScenarioScene from "./scenes/ScenarioScene.js";
import ReflectionScene from "./scenes/ReflectionScene.js";
import ProfileScene from "./scenes/ProfileScene.js";
import ResultsScene from "./scenes/ResultsScene.js";
export default class Game{constructor(){new Phaser.Game({
type:Phaser.AUTO,width:1920,height:1080,parent:"game",backgroundColor:"#f5f1e8",
scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
scene:[BootScene,HomeScene,DailyScene,StoryScene,ScenarioScene,ReflectionScene,ProfileScene,ResultsScene]
});}}
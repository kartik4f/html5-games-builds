import{header,button,panel}from"../ui.js";export default class StoryScene extends Phaser.Scene{constructor(){super("StoryScene");}
create(){this.i=0;this.render();}
render(){this.children.removeAll();const s=window.selGame.session.story,w=this.scale.width,b=s.beats[this.i];
header(this,"VISUAL STORY",`${s.title} • Scene ${this.i+1}/${s.beats.length}`);
panel(this,w/2,390,1450,520);
this.add.text(w/2,300,b.type==="emotion"?`Maya is feeling ${b.emotion}.`:`${b.speaker}:`,{fontSize:"34px",fontStyle:"bold",color:"#607d8b"}).setOrigin(.5);
this.add.text(w/2,430,b.type==="emotion"?"Her expression and body language suggest she is having a difficult moment.":`“${b.text}”`,{fontSize:"44px",color:"#263238",align:"center",wordWrap:{width:1250}}).setOrigin(.5);
button(this,w/2,700,this.i+1<s.beats.length?"CONTINUE":"MAKE A CHOICE",()=>{if(this.i+1<s.beats.length){this.i++;this.render();}else this.scene.start("ScenarioScene");},400);}}
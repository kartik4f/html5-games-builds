import{header,button,panel}from"../ui.js";export default class DailyScene extends Phaser.Scene{constructor(){super("DailyScene");}
create(){const w=this.scale.width,s=window.selGame.startDaily();header(this,"TODAY'S EXPERIENCE",s.title);
panel(this,w/2,380,1200,450);this.add.text(w/2,250,`Theme: ${s.theme}`,{fontSize:"34px",color:"#546e7a"}).setOrigin(.5);
this.add.text(w/2,380,"A new situation is waiting for you.",{fontSize:"42px",color:"#263238"}).setOrigin(.5);
this.add.text(w/2,460,`Focus: ${s.competencies.map(x=>x.replace(/[A-Z]/g,m=>" "+m)).join(" • ")}`,{fontSize:"27px",color:"#607d8b",align:"center"}).setOrigin(.5);
button(this,w/2,650,"ENTER STORY",()=>this.scene.start("StoryScene"),340);}}
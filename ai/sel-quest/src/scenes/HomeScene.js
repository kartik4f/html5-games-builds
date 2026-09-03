import{header,button,panel}from"../ui.js";export default class HomeScene extends Phaser.Scene{constructor(){super("HomeScene");}
create(){const w=this.scale.width,p=window.selGame.player;header(this,"SEL QUEST","Your daily social-emotional world");
this.add.text(w/2,220,"Understand yourself. Connect with others. Choose with intention.",{fontSize:"40px",color:"#37474f",align:"center"}).setOrigin(.5);
panel(this,w/2,500,1050,420);this.add.text(w/2,410,`Welcome back, ${p.name}`,{fontSize:"38px",fontStyle:"bold",color:"#263238"}).setOrigin(.5);
this.add.text(w/2,480,"Today's experience is a short story with a real social decision,
consequences and a reflection.",{fontSize:"30px",color:"#546e7a",align:"center"}).setOrigin(.5);
button(this,w/2,650,"PLAY TODAY",()=>this.scene.start("DailyScene"),360);button(this,w/2,790,"MY GROWTH",()=>this.scene.start("ProfileScene"),360);}}
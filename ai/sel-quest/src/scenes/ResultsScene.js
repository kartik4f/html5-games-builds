import{header,button,panel}from"../ui.js";export default class ResultsScene extends Phaser.Scene{constructor(){super("ResultsScene");}
init(d){this.r=d.result;}create(){const w=this.scale.width,r=this.r;header(this,"TODAY'S GROWTH","You completed today's experience.");
panel(this,w/2,410,1200,600);this.add.text(w/2,190,`+${r.reward.xp} XP   ${"★".repeat(r.reward.stars)}`,{fontSize:"48px",fontStyle:"bold",color:"#263238"}).setOrigin(.5);
let y=310;for(const[k,v]of Object.entries(r.assessment))if(v){this.add.text(470,y,k.replace(/[A-Z]/g,m=>" "+m),{fontSize:"27px",color:"#455a64"});this.add.text(1050,y,`+${v}`,{fontSize:"27px",fontStyle:"bold",color:"#2e5d4f"});y+=60;}
this.add.text(w/2,720,"Come back tomorrow for a new situation.",{fontSize:"30px",color:"#607d8b"}).setOrigin(.5);
button(this,w/2,830,"HOME",()=>this.scene.start("HomeScene"),280);button(this,w/2,940,"MY GROWTH",()=>this.scene.start("ProfileScene"),280);}}
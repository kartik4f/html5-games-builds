import{header,button,panel}from"../ui.js";export default class ScenarioScene extends Phaser.Scene{constructor(){super("ScenarioScene");}
create(){const w=this.scale.width,s=window.selGame.session.story;header(this,"YOUR CHOICE","The story changes based on what you do.");
panel(this,w/2,280,1500,230);this.add.text(w/2,280,s.question,{fontSize:"38px",color:"#263238",align:"center",wordWrap:{width:1400}}).setOrigin(.5);
s.choices.forEach((c,i)=>button(this,w/2,480+i*155,c.text,()=>{const out=window.selGame.choose(c);this.showFeedback(out);},1350));}
showFeedback(o){this.children.list.filter(x=>x.type==="Text").forEach(x=>x.disableInteractive?.());this.add.rectangle(this.scale.width/2,890,1500,180,0xfafafa).setStrokeStyle(2,0xb0bec5);
this.add.text(this.scale.width/2,850,o.feedback,{fontSize:"28px",color:"#37474f",align:"center",wordWrap:{width:1350}}).setOrigin(.5);
this.time.delayedCall(1800,()=>this.scene.start("ReflectionScene"));}}
import{header,button,panel}from"../ui.js";export default class ReflectionScene extends Phaser.Scene{constructor(){super("ReflectionScene");}
create(){const w=this.scale.width;header(this,"REFLECT","What did you notice in yourself or others?");
panel(this,w/2,420,1450,600);this.add.text(w/2,190,"Choose the statement that best describes your reflection.",{fontSize:"34px",color:"#263238"}).setOrigin(.5);
const opts=[
["I noticed what I was feeling before I reacted.","selfAwareness"],["I noticed the other person's perspective.","socialAwareness"],
["I paused before responding.","selfManagement"],["I thought about the relationship impact.","relationshipSkills"]];
opts.forEach((o,i)=>button(this,w/2,300+i*125,o[0],()=>this.finish({skill:o[1]}),1250));}
finish(r){const result=window.selGame.complete(r);this.scene.start("ResultsScene",{result});}}